/**
 * iCal(RFC 5545) 파싱 — 순수 함수만 모읍니다.
 *
 * gcal.ts 에서 분리한 이유는 두 가지입니다:
 *   1. 테스트. gcal.ts 는 ./config 를 통해 fs·YAML을 끌고 들어와서 node --test 로
 *      바로 돌릴 수 없습니다. 여기는 `import type` 밖에 없어 타입 스트리핑만으로 돕니다.
 *   2. 네트워크·설정과 파싱을 섞지 않기 위해서. 이 파일은 문자열만 받고 문자열만 냅니다.
 *
 * ── 시간대를 다루는 방식 (여기가 핵심입니다)
 *
 * iCal의 DTSTART 는 세 가지 형태로 옵니다:
 *
 *   DTSTART:20241008T080000Z              UTC. 그대로 순간(instant)입니다.
 *   DTSTART;TZID=Asia/Seoul:20260902T110000   그 시간대의 '벽시계' 시각.
 *   DTSTART;VALUE=DATE:20260902           종일 일정. 순간이 아니라 날짜입니다.
 *
 * 예전 구현은 TZID 파라미터를 버리고 '2026-09-02T11:00:00' 같은 문자열을 만들었습니다.
 * 그러면 new Date() 가 그것을 **실행 환경의 로컬 시간**으로 읽습니다. 개발자 노트북
 * (KST)에서는 맞게 보이지만 CI·GitHub Pages 빌드(UTC)에서는 9시간이 밀립니다.
 * dev 에서 되고 build 에서 깨지는 종류의 버그입니다 (CLAUDE.md §4).
 *
 * 그래서 여기서는:
 *   - 시각이 있는 일정은 전부 **UTC 순간**으로 환산해 들고 다닙니다 (start = ...Z).
 *   - 화면에 쓸 날짜·시각은 파싱 시점에 **표시 시간대 기준으로 미리 계산**해
 *     day / time 필드에 넣습니다. 덕분에 .astro 쪽에서 new Date() 를 부를 일이
 *     없어지고, 실행 환경의 TZ가 무엇이든 결과가 같습니다.
 *
 * 시간대 변환은 Intl(ICU 내장)로 합니다. Asia/Seoul 이 +09:00 고정이라 상수로
 * 처리할 수도 있지만, 해외 학회 일정이 하나만 들어와도 깨지므로 임의 IANA 존을
 * DST까지 정확히 다루는 쪽을 택했습니다. 새 의존성은 필요 없습니다.
 */
import type { CalendarEvent } from './types';

/** 표시 기준 시간대. 랩이 서울에 있으므로 기본값입니다. */
export const DEFAULT_TIMEZONE = 'Asia/Seoul';

// ─── 원시 파싱 ──────────────────────────────────────────────

export interface IcalProp {
  name: string;
  params: Record<string, string>;
  value: string;
}

/** RFC 5545 의 line folding(다음 줄이 공백으로 시작하면 이어붙임)을 풉니다. */
export function unfold(text: string): string[] {
  return text
    .replace(/\r\n[ \t]/g, '')
    .replace(/\n[ \t]/g, '')
    .split(/\r?\n/);
}

/** `DTSTART;TZID=Asia/Seoul:20260902T110000` → name/params/value 로 쪼갭니다. */
export function parseProp(line: string): IcalProp | null {
  const sep = line.indexOf(':');
  if (sep < 0) return null;

  const segments = line.slice(0, sep).split(';');
  const name = segments[0]!.toUpperCase();
  if (!name) return null;

  const params: Record<string, string> = {};
  for (const segment of segments.slice(1)) {
    const eq = segment.indexOf('=');
    if (eq < 0) continue;
    params[segment.slice(0, eq).toUpperCase()] = segment.slice(eq + 1).replace(/^"|"$/g, '');
  }

  return { name, params, value: line.slice(sep + 1) };
}

/** iCal 이스케이프(\n, \, , \; , \\) 해제. */
export function unescapeIcal(v: string): string {
  return v.replace(/\\n/gi, '\n').replace(/\\([,;\\])/g, '$1');
}

// ─── 시간대 ─────────────────────────────────────────────────

const formatterCache = new Map<string, Intl.DateTimeFormat | null>();

function zoneFormatter(zone: string): Intl.DateTimeFormat | null {
  if (formatterCache.has(zone)) return formatterCache.get(zone)!;

  let formatter: Intl.DateTimeFormat | null = null;
  try {
    formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: zone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    // 알 수 없는 TZID. UTC로 폴백합니다 (throw 해서 빌드를 깨뜨리지 않습니다).
    formatter = null;
  }

  formatterCache.set(zone, formatter);
  return formatter;
}

interface ZonedParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

/** UTC 순간을 특정 시간대의 달력 값으로 쪼갭니다. */
function partsInZone(utcMs: number, zone: string): ZonedParts | null {
  const formatter = zoneFormatter(zone);
  if (!formatter) return null;

  const found: Record<string, string> = {};
  for (const { type, value } of formatter.formatToParts(new Date(utcMs))) {
    found[type] = value;
  }

  return {
    year: Number(found.year),
    month: Number(found.month),
    day: Number(found.day),
    hour: Number(found.hour),
    minute: Number(found.minute),
    second: Number(found.second),
  };
}

/** 그 순간에 해당 시간대가 갖는 UTC 오프셋(분). DST가 있으면 반영됩니다. */
function zoneOffsetMinutes(utcMs: number, zone: string): number {
  const parts = partsInZone(utcMs, zone);
  if (!parts) return 0;
  const asIfUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );
  return (asIfUtc - utcMs) / 60_000;
}

/**
 * 벽시계 시각(그 시간대에서 그렇게 읽히는 시각) → UTC epoch ms.
 *
 * 오프셋 자체가 시점에 따라 달라지므로(DST) 한 번에 구할 수 없습니다.
 * 순진한 추정으로 한 번 오프셋을 구하고, 그 추정 시점의 오프셋으로 다시 보정합니다.
 * DST 경계를 사이에 둔 경우에도 두 번이면 수렴합니다.
 */
export function wallTimeToUtc(parts: ZonedParts, zone: string): number {
  const naive = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );
  const firstGuess = naive - zoneOffsetMinutes(naive, zone) * 60_000;
  return naive - zoneOffsetMinutes(firstGuess, zone) * 60_000;
}

const pad = (n: number) => String(n).padStart(2, '0');

/** UTC 순간 → 표시 시간대 기준 YYYY-MM-DD. */
export function dayInZone(utcMs: number, zone: string): string {
  const parts = partsInZone(utcMs, zone);
  if (!parts) return new Date(utcMs).toISOString().slice(0, 10);
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`;
}

/** UTC 순간 → 표시 시간대 기준 HH:mm. */
export function timeInZone(utcMs: number, zone: string): string {
  const parts = partsInZone(utcMs, zone);
  if (!parts) return new Date(utcMs).toISOString().slice(11, 16);
  return `${pad(parts.hour)}:${pad(parts.minute)}`;
}

// ─── 날짜 값 파싱 ───────────────────────────────────────────

const DATE_ONLY = /^(\d{4})(\d{2})(\d{2})$/;
const DATE_TIME = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z)?$/;

export interface IcalMoment {
  allDay: boolean;
  /** 종일 일정일 때의 날짜 (YYYY-MM-DD). */
  date?: string;
  /** 시각이 있는 일정일 때의 UTC epoch ms. */
  utcMs?: number;
}

/**
 * DTSTART / DTEND / EXDATE / RECURRENCE-ID 의 값 하나를 순간으로 바꿉니다.
 *
 * @param params  같은 속성에 붙은 파라미터 (TZID, VALUE 등)
 * @param zone    TZID 가 없는 '떠 있는(floating)' 시각을 어느 시간대로 읽을지.
 *                RFC 상으로는 "보는 사람의 시간대"지만, 우리 캘린더는 서울 기준이라
 *                표시 시간대로 읽습니다. 실행 환경 TZ에 좌우되지 않는 게 핵심입니다.
 */
export function parseIcalMoment(
  value: string,
  params: Record<string, string> = {},
  zone: string = DEFAULT_TIMEZONE,
): IcalMoment | null {
  const v = value.trim();

  const dateOnly = DATE_ONLY.exec(v);
  if (dateOnly) {
    return { allDay: true, date: `${dateOnly[1]}-${dateOnly[2]}-${dateOnly[3]}` };
  }

  const dateTime = DATE_TIME.exec(v);
  if (!dateTime) return null;

  const parts: ZonedParts = {
    year: Number(dateTime[1]),
    month: Number(dateTime[2]),
    day: Number(dateTime[3]),
    hour: Number(dateTime[4]),
    minute: Number(dateTime[5]),
    second: Number(dateTime[6]),
  };

  // 끝에 Z 가 붙으면 이미 UTC 입니다. 시간대 변환이 필요 없습니다.
  if (dateTime[7]) {
    return {
      allDay: false,
      utcMs: Date.UTC(
        parts.year,
        parts.month - 1,
        parts.day,
        parts.hour,
        parts.minute,
        parts.second,
      ),
    };
  }

  return { allDay: false, utcMs: wallTimeToUtc(parts, params.TZID ?? zone) };
}

// ─── VEVENT ────────────────────────────────────────────────

export interface ParseIcalOptions {
  /** 화면에 보여줄 때 기준이 되는 시간대. */
  timezone?: string;
}

/**
 * 순간 하나를 CalendarEvent 의 start/day/time 세 필드로 펼칩니다.
 *
 * day/time 을 여기서 미리 계산해 두면 .astro 쪽에서 new Date() 를 쓸 일이 없어져,
 * 빌드 환경의 TZ가 무엇이든 같은 화면이 나옵니다.
 */
export function momentFields(
  moment: IcalMoment,
  zone: string,
): Pick<CalendarEvent, 'start' | 'day' | 'time' | 'allDay'> {
  if (moment.allDay) {
    const date = moment.date!;
    return { start: date, day: date, allDay: true };
  }
  const utcMs = moment.utcMs!;
  return {
    start: new Date(utcMs).toISOString(),
    day: dayInZone(utcMs, zone),
    time: timeInZone(utcMs, zone),
    allDay: false,
  };
}

/**
 * iCal 본문에서 VEVENT를 뽑아냅니다.
 *
 * 반복 일정(RRULE)은 이 함수가 전개하지 않습니다 — expandEvents() 가 합니다.
 * 여기서는 원본 VEVENT 를 그대로, RRULE·EXDATE·RECURRENCE-ID 를 붙여서 냅니다.
 */
export function parseIcal(
  text: string,
  calendarKey: string,
  opts: ParseIcalOptions = {},
): CalendarEvent[] {
  const zone = opts.timezone ?? DEFAULT_TIMEZONE;
  const events: CalendarEvent[] = [];

  let current: Partial<CalendarEvent> | null = null;
  let startMoment: IcalMoment | null = null;

  for (const line of unfold(text)) {
    if (line.startsWith('BEGIN:VEVENT')) {
      current = { calendar: calendarKey };
      startMoment = null;
      continue;
    }

    if (line.startsWith('END:VEVENT')) {
      if (current?.uid && startMoment) {
        events.push({
          uid: current.uid,
          summary: current.summary ?? '(제목 없음)',
          location: current.location,
          description: current.description,
          calendar: calendarKey,
          end: current.end,
          startTzid: current.startTzid,
          rrule: current.rrule,
          exdates: current.exdates,
          recurrenceId: current.recurrenceId,
          ...momentFields(startMoment, zone),
        });
      }
      current = null;
      startMoment = null;
      continue;
    }

    if (!current) continue;

    const prop = parseProp(line);
    if (!prop) continue;

    switch (prop.name) {
      case 'UID':
        current.uid = prop.value;
        break;
      case 'SUMMARY':
        current.summary = unescapeIcal(prop.value);
        break;
      case 'LOCATION':
        current.location = unescapeIcal(prop.value);
        break;
      case 'DESCRIPTION':
        current.description = unescapeIcal(prop.value);
        break;
      case 'DTSTART':
        startMoment = parseIcalMoment(prop.value, prop.params, zone);
        // 반복 회차는 '같은 벽시계 시각'을 유지해야 합니다. 그러려면 어느 시간대의
        // 벽시계였는지 알아야 하므로 TZID 를 버리지 않고 들고 갑니다.
        current.startTzid = prop.params.TZID ?? zone;
        break;
      case 'DTEND': {
        const moment = parseIcalMoment(prop.value, prop.params, zone);
        if (moment) {
          current.end = moment.allDay ? moment.date : new Date(moment.utcMs!).toISOString();
        }
        break;
      }
      case 'RRULE':
        current.rrule = prop.value.trim();
        break;
      case 'EXDATE': {
        // 한 줄에 쉼표로 여러 개가 올 수 있습니다.
        const list = current.exdates ?? [];
        for (const raw of prop.value.split(',')) {
          const moment = parseIcalMoment(raw, prop.params, zone);
          if (!moment) continue;
          list.push(moment.allDay ? moment.date! : new Date(moment.utcMs!).toISOString());
        }
        current.exdates = list;
        break;
      }
      case 'RECURRENCE-ID': {
        const moment = parseIcalMoment(prop.value, prop.params, zone);
        if (moment) {
          current.recurrenceId = moment.allDay
            ? moment.date!
            : new Date(moment.utcMs!).toISOString();
        }
        break;
      }
    }
  }

  return events.sort((a, b) => a.start.localeCompare(b.start));
}

// ─── 반복 일정 (RRULE) ──────────────────────────────────────

/**
 * 지원 범위를 의도적으로 좁혔습니다.
 *
 * 실제 랩 캘린더의 RRULE 137건은 **전부 FREQ=WEEKLY** 이고, 쓰이는 부품도
 * UNTIL(117) / BYDAY(100) / WKST(95) / COUNT(20) / INTERVAL(3) 뿐입니다.
 * BYSETPOS·BYMONTHDAY 같은 것은 하나도 없습니다. DAILY·MONTHLY 는 지금 쓰이지
 * 않지만 앞으로 생길 수 있어 같이 넣었습니다.
 *
 * 여기 없는 규칙(BYMONTHDAY 등)을 만나면 전개를 포기하고 원본 한 건만 남깁니다.
 * 틀린 날짜를 지어내는 것보다 낫습니다.
 */
export interface Rrule {
  freq: 'DAILY' | 'WEEKLY' | 'MONTHLY';
  interval: number;
  count?: number;
  /** UTC epoch ms. 종일 시리즈면 그 날의 끝. */
  untilMs?: number;
  /** SU·MO·… 요일 코드. WEEKLY 에서만 씁니다. */
  byday?: string[];
  /** 주의 시작 요일. 기본 MO. */
  wkst: string;
}

const WEEKDAY_CODES = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];

/** RRULE 문자열을 뜯습니다. 지원하지 않는 규칙이면 null. */
export function parseRrule(value: string): Rrule | null {
  const parts: Record<string, string> = {};
  for (const chunk of value.split(';')) {
    const eq = chunk.indexOf('=');
    if (eq < 0) continue;
    parts[chunk.slice(0, eq).trim().toUpperCase()] = chunk.slice(eq + 1).trim();
  }

  const freq = parts.FREQ?.toUpperCase();
  if (freq !== 'DAILY' && freq !== 'WEEKLY' && freq !== 'MONTHLY') return null;

  // 다룰 줄 모르는 부품이 하나라도 있으면 전개하지 않습니다.
  const known = new Set(['FREQ', 'INTERVAL', 'COUNT', 'UNTIL', 'BYDAY', 'WKST']);
  for (const key of Object.keys(parts)) {
    if (!known.has(key)) return null;
  }

  const byday = parts.BYDAY?.split(',')
    .map((d) => d.trim().toUpperCase())
    .filter((d) => WEEKDAY_CODES.includes(d));

  // BYDAY에 '2MO'(둘째 주 월요일) 같은 서수가 붙으면 위 필터에서 걸러지고
  // 빈 배열이 됩니다. 그건 우리가 못 다루는 규칙이므로 포기합니다.
  if (parts.BYDAY && (!byday || byday.length === 0)) return null;

  let untilMs: number | undefined;
  if (parts.UNTIL) {
    const moment = parseIcalMoment(parts.UNTIL, {}, 'UTC');
    if (!moment) return null;
    untilMs = moment.allDay ? Date.parse(`${moment.date}T23:59:59Z`) : moment.utcMs!;
  }

  const interval = parts.INTERVAL ? Number(parts.INTERVAL) : 1;
  if (!Number.isFinite(interval) || interval < 1) return null;

  const count = parts.COUNT ? Number(parts.COUNT) : undefined;
  if (count !== undefined && (!Number.isFinite(count) || count < 1)) return null;

  return {
    freq,
    interval,
    count,
    untilMs,
    byday: byday && byday.length ? byday : undefined,
    wkst: parts.WKST?.toUpperCase() ?? 'MO',
  };
}

/** 달력 날짜 산술은 UTC 자정 기준으로 합니다 (시간대 변환은 마지막에 한 번). */
function civilToUtcNoon(p: ZonedParts): number {
  return Date.UTC(p.year, p.month - 1, p.day);
}

function civilFromUtcNoon(ms: number, time: ZonedParts): ZonedParts {
  const d = new Date(ms);
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
    hour: time.hour,
    minute: time.minute,
    second: time.second,
  };
}

function addDays(p: ZonedParts, n: number): ZonedParts {
  return civilFromUtcNoon(civilToUtcNoon(p) + n * 86_400_000, p);
}

/** 월 더하기. 말일 넘침(2/30 등)은 RFC대로 건너뜁니다 → null. */
function addMonths(p: ZonedParts, n: number): ZonedParts | null {
  const total = p.year * 12 + (p.month - 1) + n;
  const year = Math.floor(total / 12);
  const month = (total % 12) + 1;
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  if (p.day > lastDay) return null;
  return { ...p, year, month };
}

function dayOfWeek(p: ZonedParts): number {
  return new Date(civilToUtcNoon(p)).getUTCDay();
}

/** 무한 루프 방지. 주 단위로 100년어치면 충분합니다. */
const MAX_OCCURRENCES = 6000;

/**
 * 반복 규칙을 실제 발생 시각(UTC ms)들로 펼칩니다.
 *
 * COUNT 는 **시리즈 처음부터** 세야 맞습니다. 2021년에 시작한 COUNT=15 시리즈는
 * 2021년에 끝난 것이지, 창(window) 안에서 15번 나오는 게 아닙니다. 그래서
 * DTSTART 부터 세되, 창 끝을 지나면 바로 멈춥니다.
 */
export function expandRrule(
  rrule: Rrule,
  startUtcMs: number,
  zone: string,
  windowEndMs: number,
): number[] {
  const anchor = partsInZone(startUtcMs, zone);
  if (!anchor) return [startUtcMs];

  const out: number[] = [];
  let emitted = 0;

  const push = (parts: ZonedParts): 'ok' | 'stop' => {
    const ms = wallTimeToUtc(parts, zone);
    if (ms < startUtcMs) return 'ok'; // DTSTART 이전 후보는 시리즈에 없습니다
    if (rrule.untilMs !== undefined && ms > rrule.untilMs) return 'stop';
    emitted++;
    if (rrule.count !== undefined && emitted > rrule.count) return 'stop';
    out.push(ms);
    if (ms > windowEndMs) return 'stop'; // 창을 넘었으면 더 볼 필요 없습니다
    return 'ok';
  };

  if (rrule.freq === 'WEEKLY') {
    const wkstIndex = Math.max(0, WEEKDAY_CODES.indexOf(rrule.wkst));
    const codes = rrule.byday ?? [WEEKDAY_CODES[dayOfWeek(anchor)]!];
    // 주 안에서의 순서를 WKST 기준으로 정렬해야 발생 순서가 맞습니다.
    const offsets = codes
      .map((c) => (WEEKDAY_CODES.indexOf(c) - wkstIndex + 7) % 7)
      .sort((a, b) => a - b);

    const weekStart = addDays(anchor, -((dayOfWeek(anchor) - wkstIndex + 7) % 7));

    for (let w = 0; w < MAX_OCCURRENCES; w++) {
      const base = addDays(weekStart, w * rrule.interval * 7);
      let stopped = false;
      for (const offset of offsets) {
        if (push(addDays(base, offset)) === 'stop') {
          stopped = true;
          break;
        }
      }
      if (stopped) break;
    }
  } else if (rrule.freq === 'DAILY') {
    for (let i = 0; i < MAX_OCCURRENCES; i++) {
      if (push(addDays(anchor, i * rrule.interval)) === 'stop') break;
    }
  } else {
    for (let i = 0; i < MAX_OCCURRENCES; i++) {
      const parts = addMonths(anchor, i * rrule.interval);
      if (!parts) continue; // 그 달에 없는 날짜는 건너뜁니다 (RFC 5545)
      if (push(parts) === 'stop') break;
    }
  }

  return out;
}

export interface ExpandOptions {
  /** 창의 시작. 기본 지금. */
  from?: Date;
  /** 창의 길이(일). 기본 60. */
  days?: number;
  timezone?: string;
}

/**
 * parseIcal() 결과를 받아 반복 일정을 실제 회차로 펼칩니다.
 *
 * 세 가지를 함께 처리합니다. 하나라도 빠지면 지금보다 나빠집니다:
 *
 *   RRULE          매주 반복을 실제 날짜마다 만들어냅니다.
 *   EXDATE         그중 취소된 회차를 뺍니다.
 *   RECURRENCE-ID  특정 회차만 시간·제목이 바뀐 경우, 원래 자리의 회차를
 *                  **지우고** 수정본을 넣습니다. 이걸 안 하면 원래 시각의
 *                  유령 일정과 옮겨진 일정이 둘 다 뜹니다.
 *                  실제 캘린더에서 VEVENT 1198개 중 250개가 이 오버라이드입니다.
 */
export function expandEvents(events: CalendarEvent[], opts: ExpandOptions = {}): CalendarEvent[] {
  const zone = opts.timezone ?? DEFAULT_TIMEZONE;
  const from = opts.from ?? new Date();
  const windowStartMs = from.getTime();
  const windowEndMs = windowStartMs + (opts.days ?? 60) * 86_400_000;

  // uid → (원래 회차 시각 → 수정본)
  const overrides = new Map<string, Map<string, CalendarEvent>>();
  for (const event of events) {
    if (!event.recurrenceId) continue;
    const forUid = overrides.get(event.uid) ?? new Map<string, CalendarEvent>();
    forUid.set(event.recurrenceId, event);
    overrides.set(event.uid, forUid);
  }

  const used = new Set<CalendarEvent>();
  const out: CalendarEvent[] = [];

  for (const event of events) {
    if (event.recurrenceId) continue; // 오버라이드는 마스터를 통해서만 나옵니다

    // 반복이 아니거나(대부분), 우리가 못 다루는 규칙이면 원본 한 건만 남깁니다.
    const rule = event.rrule ? parseRrule(event.rrule) : null;
    if (!rule) {
      if (inWindow(event, windowStartMs, windowEndMs)) out.push(stripRecurrenceFields(event));
      continue;
    }

    const tz = event.startTzid ?? zone;

    // 종일 시리즈는 start 가 YYYY-MM-DD 라 Date.parse 로는 그 날 UTC 자정이 됩니다.
    // 표시 시간대의 자정으로 잡아야 날짜가 밀리지 않습니다.
    const startMs = event.allDay
      ? wallTimeToUtc(
          {
            year: Number(event.start.slice(0, 4)),
            month: Number(event.start.slice(5, 7)),
            day: Number(event.start.slice(8, 10)),
            hour: 0,
            minute: 0,
            second: 0,
          },
          tz,
        )
      : Date.parse(event.start);
    if (Number.isNaN(startMs)) {
      out.push(stripRecurrenceFields(event));
      continue;
    }
    const excluded = new Set(event.exdates ?? []);
    const forUid = overrides.get(event.uid);

    for (const occurrenceMs of expandRrule(rule, startMs, tz, windowEndMs)) {
      const occurrence: IcalMoment = event.allDay
        ? { allDay: true, date: dayInZone(occurrenceMs, tz) }
        : { allDay: false, utcMs: occurrenceMs };
      const iso = event.allDay ? occurrence.date! : new Date(occurrenceMs).toISOString();
      if (excluded.has(iso)) continue;

      const override = forUid?.get(iso);
      if (override) {
        // 수정본은 자기 시각을 갖고 있습니다. 창 안이면 넣습니다.
        if (inWindow(override, windowStartMs, windowEndMs)) {
          out.push(stripRecurrenceFields(override));
        }
        used.add(override);
        continue;
      }

      if (occurrenceMs < windowStartMs || occurrenceMs > windowEndMs) continue;

      out.push({
        ...stripRecurrenceFields(event),
        ...momentFields(occurrence, zone),
        recurring: true,
      });
    }
  }

  // 마스터가 이 창에서 만들어내지 않은 오버라이드 — 예컨대 창 밖의 회차를
  // 창 안으로 옮긴 경우. 그냥 두면 사라지므로 따로 챙깁니다.
  for (const forUid of overrides.values()) {
    for (const override of forUid.values()) {
      if (used.has(override)) continue;
      if (!inWindow(override, windowStartMs, windowEndMs)) continue;
      out.push(stripRecurrenceFields(override));
    }
  }

  return out.sort((a, b) => a.start.localeCompare(b.start));
}

function inWindow(event: CalendarEvent, startMs: number, endMs: number): boolean {
  if (event.allDay) {
    const day = event.day;
    return (
      day >= new Date(startMs).toISOString().slice(0, 10) &&
      day <= new Date(endMs).toISOString().slice(0, 10)
    );
  }
  const ms = Date.parse(event.start);
  return !Number.isNaN(ms) && ms >= startMs && ms <= endMs;
}

/** 전개가 끝나면 원본 규칙 필드는 화면에 쓸모가 없으므로 떨어냅니다. */
function stripRecurrenceFields(event: CalendarEvent): CalendarEvent {
  const { rrule, exdates, recurrenceId, startTzid, ...rest } = event;
  return rest;
}
