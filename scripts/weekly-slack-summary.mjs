#!/usr/bin/env node
/**
 * 주간 요약을 Slack에 올립니다.
 *
 *   SLACK_WEBHOOK_URL=https://hooks.slack.com/... node scripts/weekly-slack-summary.mjs
 *   node scripts/weekly-slack-summary.mjs --dry-run   # 포스팅 없이 본문만 출력
 *
 * .github/workflows/weekly-summary.yml 이 주 2회(월 09:37 KST + 수 09:23 KST) 돌립니다.
 *
 * 담는 것:
 *   1. 앞으로 7일간의 랩 일정 (제목·날짜·시각)
 *   2. 앞으로 180일(conferences.yaml 의 display.lookahead_days) 이내 학회 마감
 *      (수동 목록 + 자동 수집 캐시를 합친 것), 티어별(긴급/이번 달/다음 달/그 이후)로
 *      묶어서 보여줍니다. 티어 하나에 5건 넘게 있으면 나머지는 "그 외 N개는
 *      사이트 참조"로 접습니다 — 그래야 학회 30개를 추적해도 메시지가 안 길어집니다.
 *   3. content/workshops.yaml 에 적힌 workshop (있을 때만 — 학회와 달리 자동
 *      수집하지 않는 수동 목록이라, 비어 있으면 이 섹션은 아예 안 뜹니다)
 *
 * ── 실행 시각 로깅 (관찰용, 2026-09-10 도입)
 * 2026-09-09 실행이 예정(09:23 KST)보다 4시간29분 늦게(13:52 KST) 돌았습니다.
 * GitHub Actions 예약 실행은 부하가 몰리면 늦게 돈다고 공식 문서에 나와 있지만
 * 이 정도로 늦은 사례는 처음이라, 패턴인지 일회성인지 보려고 매 실행마다
 * 예정 시각과 실제 트리거 시각을 로그에 남깁니다. Slack 메시지에는 넣지 않습니다
 * (독자에게는 의미 없는 운영 정보라서) — Actions 로그에서만 봅니다.
 * schedule 이벤트일 때만 계산합니다 (workflow_dispatch는 "예정"이 없으므로).
 * 2~4주 데이터가 쌓이면 외부 cron 서비스로 옮길지 이 로그로 판단합니다.
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

const EVENT_HORIZON_DAYS = 7;
const TIMEOUT_MS = 15_000;
const DRY_RUN = process.argv.includes('--dry-run');

// 티어 경계·순서는 content/conferences.yaml 의 display.tier_thresholds 와 같은
// 기본값입니다 (src/lib/deadlines.ts 의 DISPLAY_FALLBACK과 동일하게 유지하세요).
const TIER_ORDER = ['urgent', 'this_month', 'next_month', 'future'];
const TIER_LABEL = { urgent: '긴급', this_month: '이번 달', next_month: '다음 달', future: '그 이후' };
const TIER_THRESHOLDS_FALLBACK = { urgent: 14, this_month: 30, next_month: 60, future: 180 };
const LOOKAHEAD_DAYS_FALLBACK = 180;
// 티어 하나에 너무 많이 쌓이면 메시지가 길어져 아무도 안 읽습니다.
const MAX_PER_TIER = 5;

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

/*
 * 마감 정보의 소스는 셋이고, 우선순위는 **private > 수동 > 자동 수집** 입니다.
 *
 * private 오버레이(lab-os-private)의 content/venues/venues.json 은 사람이 공식 CFP를
 * 보고 채운 것이라 confidence·source·verifiedAt 을 함께 들고 있습니다. 수동 목록
 * (content/conferences.yaml 의 conferences[])은 verified_by 가 비어 있는 초안이
 * 대부분이고, 자동 수집분은 upstream 에 레코드가 없으면 아예 비어 있습니다.
 *
 * 2026-09-23 진단: 추적 중인 30개 중 upstream(aideadlines)에 2027 사이클 레코드가
 * 있는 것은 7개뿐이었습니다 (AAAI·ICLR·ICRA·NAACL·WACV·WSDM·WWW). CVPR 2027·
 * ICCV 2027·ACL 2027·KDD 2027 을 포함해 25개 이상이 통째로 빠져 있었습니다.
 * private 을 가장 높게 두는 이유가 이것입니다.
 *
 * ⚠️ content/conferences.yaml 의 "수동 목록이 자동 수집분을 덮어쓴다"는 설명은
 *    사이트(src/lib/deadlines.ts)에서는 그대로 맞습니다. 다만 이 스크립트에서는
 *    그 위에 private 이 한 겹 더 올라갑니다.
 *
 * ⚠️ private 을 읽어도 공개 배포본과는 무관합니다. 이 스크립트는 dist/ 를 만들지
 *    않고 읽어서 Slack 에 보내기만 합니다 (워크플로의 GCAL_ICAL_LAB_GENERAL 과
 *    같은 논리입니다 — weekly-summary.yml 주석 참고). 다만 그 전제는 Webhook 채널이
 *    랩 내부 전용이라는 것이고, 그것은 이 파일 맨 위에 적어 둔 그대로입니다.
 */

/**
 * private venues.json 을 찾습니다. 없으면 undefined 를 반환하고, 호출부가
 * 자동 수집분과 수동 목록만으로 계속 진행합니다 — private 오버레이가 없다고
 * 요약이 안 나가면 안 됩니다.
 *
 * 후보 순서:
 *   1. PRIVATE_VENUES_PATH — 명시적으로 지정했을 때
 *   2. .private/content/... — 로컬 심볼릭 링크 (pnpm link:private)
 *   3. lab-os-private/content/... — 워크플로의 actions/checkout path
 *
 * 3번이 ROOT 의 **하위**인 것에 주의하세요. actions/checkout 의 path 는
 * $GITHUB_WORKSPACE 기준이고 이 저장소도 거기에 체크아웃되므로, 형제 경로인
 * ROOT/../lab-os-private 는 러너에 존재하지 않습니다.
 */
function resolvePrivateVenuesPath() {
  const candidates = [
    process.env.PRIVATE_VENUES_PATH?.trim(),
    path.join(ROOT, '.private', 'content', 'venues', 'venues.json'),
    path.join(ROOT, 'lab-os-private', 'content', 'venues', 'venues.json'),
  ].filter(Boolean);
  return candidates.find((candidate) => fs.existsSync(candidate));
}

/**
 * 대조용 키. 대소문자·공백·하이픈·아포스트로피·마침표를 지웁니다.
 * 'ACM MM' 과 'acm-mm', "NSDI '27" 과 'NSDI 27' 이 같은 venue 로 붙습니다.
 *
 * **정본은 private 저장소의 src/lib/venues/merge.ts 입니다.** 여기 있는 것은
 * 사본이므로 한쪽만 고치지 마세요 (CLAUDE.md §2 의 스키마 사본 규칙과 같습니다).
 * 사본을 두는 이유는 private 오버레이가 없을 때도 이 스크립트가 돌아야 하기
 * 때문입니다.
 */
function venueKey(nameOrId) {
  return String(nameOrId)
    .toLowerCase()
    .replace(/[\s'’.\-_]/g, '');
}

/**
 * private venue 의 id 에서 연도·사이클 접미사를 떼어 계열 키를 만듭니다.
 * 'aaai-27' → aaai, 'kdd-2027-c2' → kdd. 't-ro' 처럼 숫자가 아닌 꼬리는 그대로입니다.
 *
 * **이름이 아니라 id 를 씁니다.** 이름 쪽은 "AAAI-27", "ACL 2027 (ARR 1월 사이클)",
 * "KDD 2027 Cycle 2", "NSDI '27" 처럼 형태가 제각각이라, 끝의 네 자리 연도만 떼는
 * 정규식으로는 51건 중 27건밖에 정규화되지 않았습니다(2026-10-01 실측). 그 결과로
 * private 이 이미 덮고 있는 AAAI·ACL·KDD 가 "정보 없음"으로 잘못 분류됐습니다.
 * id 는 전부 kebab-case 라 안정적이고, 추적 중인 30개 중 29개가 id 기준으로
 * 연결됩니다 (연결되지 않는 하나는 COLING 이고 그것은 실제로 private 에도 없습니다).
 */
function seriesKeyFromId(id) {
  return venueKey(String(id).replace(/-(?:19|20)?\d{2}(?:-.*)?$/, ''));
}

/**
 * 같은 계열 안에서 회차를 구분하는 두 자리 연도.
 * 'aaai-27' → '27', 'kdd-2027-c2' → '27', 2027 → '27', 'tmlr' → '' (상시 투고 저널).
 *
 * 네 자리로 맞추지 않고 두 자리로 줄이는 이유는, private 의 id 가 'aaai-27' 처럼
 * 두 자리인 것과 'icra-2027' 처럼 네 자리인 것이 섞여 있어서입니다. 네 자리를
 * 그대로 쓰면 private 의 'AAAI-27' 과 자동 수집분의 'AAAI 2027' 이 서로 다른
 * 회차로 갈려 둘 다 목록에 남습니다.
 */
function seriesYear(idOrYear) {
  return String(idOrYear).match(/(?:19|20)?(\d{2})(?:-[^-]*)?$/)?.[1] ?? '';
}

/** private venue 레코드를 공통 형태로 옮깁니다. */
function fromPrivateVenue(v) {
  return {
    seriesKey: seriesKeyFromId(v.id),
    seriesYear: seriesYear(v.id),
    name: v.name,
    kind: v.kind ?? 'conference',
    confidence: v.confidence ?? 'confirmed',
    url: v.url,
    verifiedAt: v.verifiedAt ?? null,
    origin: 'private',
    events: (v.events ?? []).filter((e) => e?.type && e?.date),
  };
}

/**
 * 자동 수집분·수동 목록의 평평한 필드를 private 과 같은 events[] 형태로 옮깁니다.
 *
 * upstream(aideadlines) 스키마에는 초록·논문·통보 셋밖에 없습니다. 등록·보충·
 * 리버털·최종본·커밋·저널 이전이 없는 것은 수집 실패가 아니라 스키마의 한계이고,
 * 그 유형들은 private 쪽에만 있습니다.
 */
function fromRecord(c, origin) {
  const events = [];
  for (const [type, date] of [
    ['abstract', c.abstract_deadline],
    ['paper', c.deadline],
    ['notification', c.notification],
  ]) {
    if (date) events.push({ type, date: String(date).slice(0, 10), label: '' });
  }
  return {
    seriesKey: venueKey(c.name),
    seriesYear: seriesYear(c.year ?? ''),
    name: `${c.name}${c.year ? ` ${c.year}` : ''}`,
    kind: 'conference',
    // 자동 수집분·수동 목록에는 confidence 개념이 없습니다. "(추정)" 표시를
    // 붙이지 않으려고 confirmed 로 둡니다 — 추정이라고 단정할 근거도 없습니다.
    confidence: 'confirmed',
    url: c.url,
    verifiedAt: c.verified_on ?? null,
    origin,
    events,
  };
}

/**
 * 세 소스를 합쳐 정규화된 venue 목록을 만듭니다.
 * 같은 계열·같은 회차면 우선순위가 높은 쪽(= 나중에 넣은 쪽)이 이깁니다.
 */
function collectVenues() {
  const manual = readYaml(path.join(CONTENT, 'conferences.yaml'));
  const fetched = readJson(path.join(ROOT, 'src', 'data', 'conferences-fetched.json'));

  const merged = new Map();
  const put = (v) => merged.set(`${v.seriesKey}-${v.seriesYear}`, v);

  for (const c of fetched.venues ?? []) {
    if (c?.name) put(fromRecord(c, 'fetched'));
  }
  for (const c of manual.conferences ?? []) {
    if (c?.name) put(fromRecord(c, 'manual'));
  }

  const privatePath = resolvePrivateVenuesPath();
  if (privatePath) {
    const venues = readJson(privatePath).venues ?? [];
    for (const v of venues) {
      if (v?.id && v?.name) put(fromPrivateVenue(v));
    }
    console.log(
      `  ${green('✓')} private venue ${dim(`${venues.length}건 · ${path.relative(ROOT, privatePath)}`)}`,
    );
  } else {
    console.log(
      `  ${yellow('!')} private venue 파일이 없어 자동 수집분과 수동 목록만 씁니다.`,
    );
    console.log(dim('    로컬: pnpm link:private · 워크플로: PRIVATE_REPO_PAT 시크릿'));
  }

  return [...merged.values()];
}

/** 표시 대상 이벤트 유형과 한글 라벨. 여기 없는 유형은 건너뜁니다. */
const EVENT_LABELS = {
  abstract: '초록 마감',
  paper: '논문 마감',
};

/** conferences.yaml 의 display.lookahead_days / tier_thresholds. 없으면 기본값. */
function getDisplayConfig() {
  const manual = readYaml(path.join(CONTENT, 'conferences.yaml'));
  const display = manual.display ?? {};
  return {
    lookaheadDays: display.lookahead_days ?? LOOKAHEAD_DAYS_FALLBACK,
    tierThresholds: { ...TIER_THRESHOLDS_FALLBACK, ...(display.tier_thresholds ?? {}) },
  };
}

/** 남은 일수가 어느 티어인지. 지난 마감이거나 future 경계보다 멀면 null(= 표시 안 함). */
function tierOf(daysLeft, thresholds) {
  if (daysLeft < 0) return null;
  if (daysLeft <= thresholds.urgent) return 'urgent';
  if (daysLeft <= thresholds.this_month) return 'this_month';
  if (daysLeft <= thresholds.next_month) return 'next_month';
  if (daysLeft <= thresholds.future) return 'future';
  return null;
}

/** 학회 마감을 티어별로 묶습니다. 각 티어 안에서는 마감일 오름차순. */
function tieredDeadlines(from) {
  const { lookaheadDays, tierThresholds } = getDisplayConfig();
  const groups = { urgent: [], this_month: [], next_month: [], future: [] };

  for (const v of collectVenues()) {
    for (const ev of v.events) {
      const what = EVENT_LABELS[ev.type];
      if (!what) continue;
      const due = String(ev.date).slice(0, 10);
      const daysLeft = daysUntil(due, from);
      if (daysLeft > lookaheadDays) continue;
      const tier = tierOf(daysLeft, tierThresholds);
      if (!tier) continue;
      groups[tier].push({ label: v.name, what, due, daysLeft, url: v.url });
    }
  }

  for (const tier of TIER_ORDER) groups[tier].sort((a, b) => a.due.localeCompare(b.due));
  return groups;
}

// ─── 2. Workshop (수동 관리) ─────────────────────────────────

/**
 * content/workshops.yaml 의 workshops[]. 학회와 달리 자동 수집하지 않으므로
 * 파일이 없거나 비어 있는 게 정상 상태입니다 — 그 경우 buildMessage가 섹션 자체를
 * 생략합니다(사이트의 EmptyState 관례와 다르게, Slack 메시지는 매주 오는 push라
 * 빈 섹션이 반복되면 그 자체가 소음이 됩니다).
 */
function upcomingWorkshops(from) {
  const manual = readYaml(path.join(CONTENT, 'workshops.yaml'));
  return (manual.workshops ?? [])
    .filter((w) => w?.name && w.status !== 'skipped')
    .filter((w) => !w.workshop_deadline || daysUntil(w.workshop_deadline, from) >= 0)
    .sort((a, b) => (a.workshop_deadline ?? '9999').localeCompare(b.workshop_deadline ?? '9999'));
}

// ─── 3. 랩 일정 ──────────────────────────────────────────────

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

// ─── 4. 본문 ────────────────────────────────────────────────

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

function buildMessage(deadlinesByTier, workshops, events, from) {
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

  // 티어별로 묶어서 보여줍니다. 빈 티어는 아예 줄을 만들지 않습니다 — "긴급 (0건)"처럼
  // 빈 헤더가 매주 반복되면 아무도 안 읽는 잡음이 됩니다.
  lines.push('', '*학회 마감*');
  const totalDeadlines = TIER_ORDER.reduce((sum, tier) => sum + deadlinesByTier[tier].length, 0);
  if (totalDeadlines === 0) {
    lines.push('· 임박한 학회 마감이 없습니다.');
  } else {
    for (const tier of TIER_ORDER) {
      const items = deadlinesByTier[tier];
      if (items.length === 0) continue;
      lines.push(`_${TIER_LABEL[tier]}_ (${items.length}건)`);
      const shown = items.slice(0, MAX_PER_TIER);
      for (const d of shown) {
        const name = d.url ? `<${d.url}|${d.label}>` : d.label;
        lines.push(`· \`${ddayLabel(d.daysLeft)}\` ${name} ${d.what} — ${d.due}`);
      }
      const rest = items.length - shown.length;
      if (rest > 0) lines.push(`· 그 외 ${rest}개는 사이트 참조 (/calendar)`);
    }
  }

  // 없거나 비어 있으면 섹션째 생략합니다 — workshops.yaml은 수동 관리라 안 채워둔
  // 랩이 더 많을 텐데, "Workshop (0건)"이 매주 뜨면 그 자체가 소음입니다.
  if (workshops.length > 0) {
    lines.push('', `*Workshop* (${workshops.length}건)`);
    for (const w of workshops) {
      const name = w.url ? `<${w.url}|${w.name}>` : w.name;
      const parent = w.parent_conference ? ` (${w.parent_conference})` : '';
      const due = w.workshop_deadline ? ` — ${w.workshop_deadline} 마감` : '';
      lines.push(`· ${name}${parent}${due}`);
    }
  }

  lines.push('', '_학회 마감은 공식 CFP가 정본입니다. 투고를 결정했다면 직접 확인하세요._');
  return lines.join('\n');
}

// ─── 실행 시각 로깅 (관찰용, 2026-09-10 도입) ─────────────────

const SCHEDULE_DELAY_WARN_MINUTES = 15;

/** UTC ISO 문자열을 'YYYY-MM-DD HH:mm KST' 로. 로그 가독성용. */
function toKstLabel(date) {
  return (
    date.toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }).replace('T', ' ') + ' KST'
  );
}

/**
 * 'MIN HOUR * * DOW' 형태의 cron 표현식에서 시:분만 뽑습니다.
 * 이 워크플로의 cron은 전부 이 형태(요일 지정, 매일/매월 아님)라 그 이상은
 * 다루지 않습니다 — 못 다루는 형태를 만나면 null (틀린 값을 지어내지 않습니다).
 */
function parseCronHourMinute(cron) {
  const parts = String(cron ?? '').trim().split(/\s+/);
  if (parts.length !== 5) return null;
  const [min, hour] = parts.map(Number);
  if (!Number.isInteger(min) || !Number.isInteger(hour)) return null;
  return { hour, min };
}

/**
 * 예정 실행 시각과 실제 트리거 시각을 비교해 로그에 남깁니다.
 *
 * schedule 이벤트일 때만 계산합니다 — workflow_dispatch(수동 실행)에는 "예정
 * 시각"이라는 개념이 없습니다. 필요한 두 값(WEEKLY_SUMMARY_CRON, WEEKLY_SUMMARY_RUN_STARTED_AT)이
 * 없으면(예: 로컬 실행) 계산을 건너뛰고 그 사실만 남깁니다 — 이 로그가 없다고
 * 스크립트가 실패하면 안 됩니다(CLAUDE.md: 외부 신호 없어도 안 깨짐).
 */
function logRunTiming(now) {
  console.log(`  ${dim('실행 시각')} UTC ${now.toISOString()} · ${toKstLabel(now)}`);

  const eventName = process.env.GITHUB_EVENT_NAME;
  if (eventName !== 'schedule') {
    console.log(`  ${dim('–')} ${dim(`event=${eventName ?? '(로컬 실행)'} — 지연 계산은 schedule 실행에서만 합니다.`)}`);
    return;
  }

  const cron = process.env.WEEKLY_SUMMARY_CRON;
  const startedAtRaw = process.env.WEEKLY_SUMMARY_RUN_STARTED_AT;
  const hourMin = parseCronHourMinute(cron);
  const startedAt = startedAtRaw ? new Date(startedAtRaw) : null;

  if (!hourMin || !startedAt || Number.isNaN(startedAt.getTime())) {
    console.log(
      `  ${yellow('!')} 예정 시각을 계산하지 못했습니다 (cron="${cron ?? ''}", ` +
        `run_started_at="${startedAtRaw ?? ''}"). 워크플로 env 설정을 확인하세요.`,
    );
    return;
  }

  // cron은 매치된 요일에만 발동하므로, 실제 트리거 시각과 같은 UTC 날짜에
  // 예정 시:분을 얹으면 그 회차의 예정 시각이 됩니다.
  const expected = new Date(
    Date.UTC(
      startedAt.getUTCFullYear(),
      startedAt.getUTCMonth(),
      startedAt.getUTCDate(),
      hourMin.hour,
      hourMin.min,
      0,
    ),
  );
  const delayMinutes = Math.round((startedAt.getTime() - expected.getTime()) / 60_000);

  console.log(`  ${dim('예정 트리거')} UTC ${expected.toISOString()} · ${toKstLabel(expected)}`);
  console.log(`  ${dim('실제 트리거')} UTC ${startedAt.toISOString()} · ${toKstLabel(startedAt)}`);
  console.log(`  ${dim('지연')} ${delayMinutes}분`);

  if (delayMinutes > SCHEDULE_DELAY_WARN_MINUTES) {
    console.log(
      `  ${yellow(`⚠ WARNING: 예약 실행이 ${delayMinutes}분 늦게 트리거됐습니다 ` +
        `(> ${SCHEDULE_DELAY_WARN_MINUTES}분). GitHub Actions 스케줄 지연이며 이 스크립트의 문제가 아닙니다.`)}`,
    );
  }
}

// ─── 실행 ───────────────────────────────────────────────────

async function main() {
  console.log(`\n${bold('주간 Slack 요약')}`);
  console.log(dim('─'.repeat(24)));

  const from = new Date();
  logRunTiming(from);
  const deadlinesByTier = tieredDeadlines(from);
  const deadlineCount = TIER_ORDER.reduce((sum, tier) => sum + deadlinesByTier[tier].length, 0);
  console.log(`  ${green('✓')} 마감 ${dim(`${deadlineCount}건 (티어별 그룹핑)`)}`);

  const workshops = upcomingWorkshops(from);
  console.log(`  ${green('✓')} Workshop ${dim(`${workshops.length}건`)}`);

  const events = await upcomingLabEvents(from);
  const message = buildMessage(deadlinesByTier, workshops, events, from);

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
