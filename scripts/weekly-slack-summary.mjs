#!/usr/bin/env node
/**
 * 주간 요약을 Slack에 올립니다.
 *
 *   SLACK_WEBHOOK_URL=https://hooks.slack.com/... node scripts/weekly-slack-summary.mjs
 *   node scripts/weekly-slack-summary.mjs --dry-run   # 포스팅 없이 본문만 출력
 *
 * .github/workflows/weekly-summary.yml 이 주 1회(월 07:00 KST) 돌립니다.
 *
 * 담는 것: **D-30 이내 학회 마감뿐입니다.**
 * (수동 목록 + 자동 수집 캐시를 합친 것)
 *
 * ── 랩 일정과 과제 마감을 넣지 않는 이유
 * Slack 채널의 구성원을 이 스크립트는 알 수 없습니다. alumni 나 외부 협력자가
 * 초대돼 있을 수도 있습니다. 랩 일정에는 미팅 상대 이름이, 과제에는 리포트
 * 마감과 과제명이 들어갑니다. 둘 다 /internal/ 에서 봅니다.
 *
 * 여기 넣으면 격리 경계가 "빌드에 포함하지 않는 것"에서 "채널 설정을 믿는 것"으로
 * 내려앉습니다 (CLAUDE.md §1). 학회 마감은 공식 CFP에 이미 공개된 정보라
 * 어느 채널에 올라가도 새는 것이 없습니다.
 *
 * 채널이 랩 내부 전용임이 확실해지면 랩 일정도 넣을 수 있습니다:
 * INCLUDE_LAB_EVENTS=1 을 주고, 워크플로에 캘린더 env_var 시크릿을 추가하세요.
 * 기본값은 넣지 않는 쪽입니다 — 모르면 안 보내는 게 맞습니다.
 *
 * ── Webhook이 없으면 그냥 성공합니다
 * 시크릿을 아직 안 넣었다고 워크플로가 매주 빨개지면 아무도 안 봅니다.
 * 무엇을 보내려 했는지 로그에 남기고 exit 0 합니다.
 */
import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';
import { ROOT, CONTENT, green, red, yellow, dim, bold } from './_lib.mjs';

const IMMINENT_DAYS = 30;
const EVENT_HORIZON_DAYS = 7;
const TIMEOUT_MS = 15_000;
const DRY_RUN = process.argv.includes('--dry-run');
/** 채널이 랩 내부 전용임이 확실할 때만 켜세요. 기본은 꺼짐. */
const INCLUDE_LAB_EVENTS = process.env.INCLUDE_LAB_EVENTS === '1';

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

/**
 * VEVENT에서 SUMMARY/DTSTART만 뽑는 최소 파서.
 *
 * src/lib/gcal.ts 의 parseIcal 과 같은 일을 합니다. 그쪽은 TypeScript라
 * .mjs 스크립트에서 import할 수 없어 꼭 필요한 두 필드만 다시 구현했습니다.
 * 반복 일정(RRULE)은 전개하지 않습니다 — gcal.ts 도 마찬가지입니다.
 */
function parseIcal(text) {
  const unfolded = text.replace(/\r\n[ \t]/g, '').replace(/\n[ \t]/g, '');
  const events = [];
  let current = null;

  for (const line of unfolded.split(/\r?\n/)) {
    if (line.startsWith('BEGIN:VEVENT')) {
      current = {};
      continue;
    }
    if (line.startsWith('END:VEVENT')) {
      if (current?.start) events.push(current);
      current = null;
      continue;
    }
    if (!current) continue;

    const sep = line.indexOf(':');
    if (sep < 0) continue;
    const key = line.slice(0, sep).split(';')[0].toUpperCase();
    const value = line.slice(sep + 1);

    if (key === 'SUMMARY') {
      current.summary = value.replace(/\\n/g, ' ').replace(/\\([,;\\])/g, '$1');
    } else if (key === 'LOCATION') {
      current.location = value.replace(/\\([,;\\])/g, '$1');
    } else if (key === 'DTSTART') {
      const dateOnly = /^(\d{4})(\d{2})(\d{2})$/.exec(value.trim());
      const dateTime = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z?)$/.exec(value.trim());
      if (dateOnly) {
        current.start = `${dateOnly[1]}-${dateOnly[2]}-${dateOnly[3]}`;
        current.allDay = true;
      } else if (dateTime) {
        const [, y, mo, d, h, mi, s, z] = dateTime;
        current.start = `${y}-${mo}-${d}T${h}:${mi}:${s}${z ? 'Z' : ''}`;
        current.allDay = false;
      }
    }
  }
  return events;
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
  if (!INCLUDE_LAB_EVENTS) {
    console.log(
      `  ${dim('–')} ${dim('랩 일정은 요약에 넣지 않습니다 (INCLUDE_LAB_EVENTS=1 로 켤 수 있습니다)')}`,
    );
    return [];
  }

  const config = readYaml(path.join(ROOT, 'config', 'calendars.yaml'));
  const calendars = (config.calendars ?? [])
    .map((cal) => ({ cal, url: resolveIcalUrl(cal) }))
    .filter((c) => c.url);

  if (calendars.length === 0) {
    console.log(
      `  ${dim('–')} ${dim('연결된 캘린더 없음 (gcal_id 가 아직 TODO 이거나 ical 주소가 비어 있습니다)')}`,
    );
    return [];
  }

  const start = from.toISOString().slice(0, 10);
  const until = new Date(from.getTime() + EVENT_HORIZON_DAYS * 86_400_000)
    .toISOString()
    .slice(0, 10);

  const all = [];
  for (const { cal, url } of calendars) {
    try {
      const events = parseIcal(await fetchText(url));
      const inRange = events.filter((e) => {
        const d = e.start.slice(0, 10);
        return d >= start && d <= until;
      });
      for (const e of inRange) all.push({ ...e, calendar: cal.label ?? cal.key });
      console.log(`  ${green('✓')} ${cal.label ?? cal.key} ${dim(`${inRange.length}건`)}`);
    } catch (err) {
      // 캘린더 하나가 안 열려도 요약 전체를 포기하지는 않습니다.
      console.log(`  ${yellow('!')} ${cal.label ?? cal.key} ${dim(String(err.message ?? err))}`);
    }
  }
  return all.sort((a, b) => a.start.localeCompare(b.start));
}

// ─── 3. 본문 ────────────────────────────────────────────────

function eventTimeLabel(e) {
  if (e.allDay) return `${e.start.slice(0, 10)} 종일`;
  const d = new Date(e.start);
  if (Number.isNaN(d.getTime())) return e.start.slice(0, 10);
  const day = d.toLocaleDateString('ko-KR', {
    month: 'numeric',
    day: 'numeric',
    weekday: 'short',
    timeZone: 'Asia/Seoul',
  });
  const time = d.toLocaleTimeString('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Seoul',
  });
  return `${day} ${time}`;
}

function buildMessage(deadlines, events, from) {
  const week = from.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'Asia/Seoul',
  });

  const lines = [`*이번 주 랩 요약* — ${week}`, ''];

  lines.push(`*마감 D-${IMMINENT_DAYS} 이내* (${deadlines.length}건)`);
  if (deadlines.length === 0) {
    lines.push('· 임박한 학회 마감이 없습니다.');
  } else {
    for (const d of deadlines) {
      const name = d.url ? `<${d.url}|${d.label}>` : d.label;
      lines.push(`· \`${ddayLabel(d.daysLeft)}\` ${name} ${d.what} 마감 — ${d.due}`);
    }
  }

  if (INCLUDE_LAB_EVENTS) {
    lines.push('', `*앞으로 ${EVENT_HORIZON_DAYS}일 일정* (${events.length}건)`);
    if (events.length === 0) {
      lines.push('· 등록된 일정이 없습니다.');
    } else {
      for (const e of events) {
        const where = e.location ? ` · ${e.location}` : '';
        lines.push(`· ${eventTimeLabel(e)} — ${e.summary ?? '(제목 없음)'}${where}`);
      }
    }
  } else {
    lines.push('', '_랩 일정은 각자 Google Calendar에서 확인하세요._');
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
