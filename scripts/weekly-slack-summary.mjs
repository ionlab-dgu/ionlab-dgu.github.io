#!/usr/bin/env node
/**
 * 주간 요약을 Slack에 올립니다.
 *
 *   SLACK_WEBHOOK_URL=https://hooks.slack.com/... node scripts/weekly-slack-summary.mjs
 *   node scripts/weekly-slack-summary.mjs --dry-run   # 포스팅 없이 본문만 출력
 *
 * .github/workflows/weekly-summary.yml 이 주 1회(월 07:00 KST) 돌립니다.
 *
 * 담는 것:
 *   1. 앞으로 7일간의 랩 일정 (제목·날짜·시각)
 *   2. D-30 이내 학회 마감 (수동 목록 + 자동 수집 캐시를 합친 것)
 *
 * ── ⚠️ 이 스크립트가 기대고 있는 전제
 * **SLACK_WEBHOOK_URL 이 가리키는 채널은 랩 내부 전용(학생 + PI)입니다.**
 * 랩 일정 제목에는 미팅 상대 이름이 그대로 들어갑니다. 그 전제 위에서
 * 필터링·마스킹 없이 보냅니다.
 *
 * 이 전제는 코드에서 확인할 수 없습니다. Webhook 을 alumni·외부 협력자가
 * 있는 채널로 옮긴다면 **여기부터 다시 보세요** — 그 순간 격리 경계가
 * "빌드에 포함하지 않는 것"에서 "채널 설정을 믿는 것"으로 내려앉습니다
 * (CLAUDE.md §1). 그 경우 랩 일정을 빼고 학회 마감만 보내면 됩니다
 * (학회 마감은 공식 CFP에 이미 공개된 정보라 어느 채널에 올라가도 안전합니다).
 *
 * ── 과제(Grant) 마감은 여전히 넣지 않습니다
 * 리포트 마감·예산 일정은 성격이 달라 /internal/deadlines 에서 봅니다.
 * 채널이 내부 전용이어도 굳이 흘려보낼 이유가 없습니다.
 *
 * ── Webhook이 없으면 그냥 성공합니다
 * 시크릿을 아직 안 넣었다고 워크플로가 매주 빨개지면 아무도 안 봅니다.
 * 무엇을 보내려 했는지 로그에 남기고 exit 0 합니다.
 */
import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';
import { ROOT, CONTENT, green, red, yellow, dim, bold } from './_lib.mjs';
// 사이트와 **같은 파서**를 씁니다. 예전에는 여기 미니 파서를 따로 두고 있었는데,
// 그 사본은 TZID 를 무시하고(UTC 러너에서 9시간 밀림) RRULE 도 전개하지 않아
// 매주 반복하는 세미나·그룹 미팅이 요약에서 통째로 빠졌습니다.
// ical.ts 는 `import type` 밖에 안 써서 .mjs 에서 그대로 import 됩니다.
import { parseIcal, expandEvents, DEFAULT_TIMEZONE } from '../src/lib/ical.ts';

const IMMINENT_DAYS = 30;
const EVENT_HORIZON_DAYS = 7;
const TIMEOUT_MS = 15_000;
const DRY_RUN = process.argv.includes('--dry-run');

/** CORE_SCHEMA 로 파싱해 날짜를 문자열로 남깁니다 (src/lib/yaml.ts 와 같은 이유). */
function parseYaml(source) {
  return yaml.load(source, { schema: yaml.CORE_SCHEMA });
}

function readYaml(file) {
  try {
    return parseYaml(fs.readFileSync(file, 'utf-8')) ?? {};
  } catch {
    return {};
  }
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf-8'));
  } catch {
    return {};
  }
}

/** src/lib/deadlines.ts 의 daysUntil 과 같은 계산 (KST 자정 기준). */
function daysUntil(due, from = new Date()) {
  const dueDate = new Date(`${String(due).slice(0, 10)}T23:59:59+09:00`);
  return Math.ceil((dueDate.getTime() - from.getTime()) / 86_400_000);
}

function ddayLabel(daysLeft) {
  if (daysLeft === 0) return 'D-DAY';
  return daysLeft > 0 ? `D-${daysLeft}` : `D+${Math.abs(daysLeft)}`;
}

// ─── 1. 학회 마감 ────────────────────────────────────────────

/**
 * 자동 수집 캐시 + 수동 목록. 같은 학회·연도면 수동이 이깁니다
 * (src/lib/deadlines.ts 의 getConferences() 와 같은 규칙).
 */
function collectConferences() {
  const manual = readYaml(path.join(CONTENT, 'conferences.yaml'));
  const fetched = readJson(path.join(ROOT, 'src', 'data', 'conferences-fetched.json'));

  const merged = new Map();
  const key = (c) =>
    `${String(c.name ?? '')
      .trim()
      .toLowerCase()}-${c.year ?? ''}`;

  for (const c of fetched.venues ?? []) merged.set(key(c), c);
  for (const c of manual.conferences ?? []) {
    if (c?.name) merged.set(key(c), c);
  }
  return [...merged.values()];
}

function imminentDeadlines(from) {
  const items = [];
  for (const c of collectConferences()) {
    const label = `${c.name}${c.year ? ` ${c.year}` : ''}`;
    for (const [due, what] of [
      [c.abstract_deadline, '초록'],
      [c.deadline, '논문'],
    ]) {
      if (!due) continue;
      const daysLeft = daysUntil(due, from);
      if (daysLeft < 0 || daysLeft > IMMINENT_DAYS) continue;
      items.push({ label, what, due: String(due).slice(0, 10), daysLeft, url: c.url });
    }
  }
  return items.sort((a, b) => a.due.localeCompare(b.due));
}

// ─── 2. 랩 일정 ──────────────────────────────────────────────

/**
 * iCal 주소를 정합니다: ical_url > env_var.
 * gcal_id 가 'TODO:' 로 시작하면 아직 캘린더를 안 만든 것이므로 건너뜁니다.
 */
function resolveIcalUrl(cal) {
  const direct = String(cal.ical_url ?? '').trim();
  if (direct && !direct.startsWith('TODO')) return direct;
  const fromEnv = cal.env_var ? process.env[cal.env_var] : undefined;
  if (fromEnv && fromEnv.trim()) return fromEnv.trim();
  return undefined;
}

async function fetchText(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

async function upcomingLabEvents(from) {
  const config = readYaml(path.join(ROOT, 'config', 'calendars.yaml'));
  const zone = config.display_timezone || DEFAULT_TIMEZONE;

  const calendars = (config.calendars ?? [])
    .map((cal) => ({ cal, url: resolveIcalUrl(cal) }))
    .filter((c) => c.url);

  if (calendars.length === 0) {
    console.log(
      `  ${dim('–')} ${dim('연결된 캘린더 없음 — 워크플로에 GCAL_ICAL_LAB_GENERAL 시크릿을 넣으세요')}`,
    );
    return [];
  }

  const all = [];
  for (const { cal, url } of calendars) {
    try {
      // 사이트와 같은 경로: 파싱 → 반복 전개(EXDATE·RECURRENCE-ID 포함).
      // 이 전개가 없으면 매주 반복하는 세미나·그룹 미팅이 요약에서 통째로 빠집니다.
      const events = expandEvents(parseIcal(await fetchText(url), cal.key, { timezone: zone }), {
        from,
        days: EVENT_HORIZON_DAYS,
        timezone: zone,
      });
      for (const e of events) all.push({ ...e, calendar: cal.label ?? cal.key });
      console.log(`  ${green('✓')} ${cal.label ?? cal.key} ${dim(`${events.length}건`)}`);
    } catch (err) {
      // 캘린더 하나가 안 열려도 요약 전체를 포기하지는 않습니다.
      console.log(`  ${yellow('!')} ${cal.label ?? cal.key} ${dim(String(err.message ?? err))}`);
    }
  }
  return all.sort((a, b) => a.start.localeCompare(b.start));
}

// ─── 3. 본문 ────────────────────────────────────────────────

const WEEKDAY_KO = ['일', '월', '화', '수', '목', '금', '토'];

function eventTimeLabel(e) {
  // day/time 은 ical.ts 가 표시 시간대로 미리 계산해 둔 값입니다.
  // 여기서 new Date(e.start) 를 쓰면 UTC 러너에서 시각이 밀립니다.
  // 요일은 날짜 문자열에서 직접 뽑습니다 — 로케일 포맷터를 태우면
  // "9. 2. (수)" 처럼 어색해지고 실행 환경 로케일에도 좌우됩니다.
  const [y, m, d] = e.day.split('-').map(Number);
  const weekday = WEEKDAY_KO[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  const date = `${m}/${d}(${weekday})`;
  return e.time ? `${date} ${e.time}` : `${date} 종일`;
}

function buildMessage(deadlines, events, from) {
  const week = from.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'Asia/Seoul',
  });

  const lines = [`*이번 주 랩 요약* — ${week}`, ''];

  lines.push(`*앞으로 ${EVENT_HORIZON_DAYS}일 일정* (${events.length}건)`);
  if (events.length === 0) {
    lines.push('· 등록된 일정이 없습니다.');
  } else {
    for (const e of events) {
      const where = e.location ? ` · ${e.location}` : '';
      lines.push(`· ${eventTimeLabel(e)} — ${e.summary ?? '(제목 없음)'}${where}`);
    }
  }

  lines.push('', `*마감 D-${IMMINENT_DAYS} 이내* (${deadlines.length}건)`);
  if (deadlines.length === 0) {
    lines.push('· 임박한 학회 마감이 없습니다.');
  } else {
    for (const d of deadlines) {
      const name = d.url ? `<${d.url}|${d.label}>` : d.label;
      lines.push(`· \`${ddayLabel(d.daysLeft)}\` ${name} ${d.what} 마감 — ${d.due}`);
    }
  }

  lines.push('', '_학회 마감은 공식 CFP가 정본입니다. 투고를 결정했다면 직접 확인하세요._');
  return lines.join('\n');
}

// ─── 실행 ───────────────────────────────────────────────────

async function main() {
  console.log(`\n${bold('주간 Slack 요약')}`);
  console.log(dim('─'.repeat(24)));

  const from = new Date();
  const deadlines = imminentDeadlines(from);
  console.log(`  ${green('✓')} 임박 마감 ${dim(`${deadlines.length}건`)}`);

  const events = await upcomingLabEvents(from);
  const message = buildMessage(deadlines, events, from);

  console.log(`\n${dim('─'.repeat(24))}`);
  console.log(message);
  console.log(`${dim('─'.repeat(24))}\n`);

  const webhook = process.env.SLACK_WEBHOOK_URL?.trim();
  if (DRY_RUN) {
    console.log(`  ${dim('–')} ${dim('--dry-run — 포스팅하지 않습니다.')}\n`);
    process.exit(0);
  }
  if (!webhook) {
    console.log(`  ${yellow('!')} SLACK_WEBHOOK_URL 이 없어 포스팅을 건너뜁니다.`);
    console.log(
      dim('    설정하려면: GitHub 저장소 → Settings → Secrets → Actions → SLACK_WEBHOOK_URL\n'),
    );
    process.exit(0);
  }

  try {
    const res = await fetchTextPost(webhook, message);
    console.log(`  ${green('✓')} Slack 포스팅 완료 ${dim(res)}\n`);
  } catch (err) {
    // 요약 한 번 못 올린 것으로 워크플로를 빨갛게 만들지 않습니다.
    console.log(`  ${red('✗')} Slack 포스팅 실패: ${String(err.message ?? err)}`);
    console.log(dim('    본문은 위 로그에 남아 있습니다.\n'));
  }
  process.exit(0);
}

async function fetchTextPost(url, text) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text, mrkdwn: true }),
      signal: controller.signal,
    });
    const body = await res.text();
    if (!res.ok) throw new Error(`HTTP ${res.status} ${body}`);
    return body;
  } finally {
    clearTimeout(timer);
  }
}

await main();
