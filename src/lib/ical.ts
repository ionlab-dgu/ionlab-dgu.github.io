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
