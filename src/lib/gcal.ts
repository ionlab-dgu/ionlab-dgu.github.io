/**
 * Google Calendar (iCal) 연동 — 읽기 전용.
 *
 * GCal이 정본입니다. 사이트는 표시만 하고 쓰기는 하지 않습니다.
 *
 * Phase 1(현재): ical URL이 설정돼 있으면 빌드 시 fetch해 파싱합니다.
 *   설정이 없거나 fetch가 실패해도 **빈 배열을 반환하고 빌드는 성공합니다.**
 * Phase 2: 런타임 fetch(프록시 경유) 옵션 추가 — config/calendars.yaml 의 fetch.mode.
 */
import { calendars as calConfig, filled } from './config';
import type { CalendarConfig } from './config';
import type { CalendarEvent } from './types';

/** ical URL을 결정합니다: 설정의 ical_url > 환경변수(env_var). 없으면 undefined. */
function resolveIcalUrl(cal: CalendarConfig): string | undefined {
  const direct = filled(cal.ical_url);
  if (direct) return direct;
  if (cal.env_var) {
    const fromEnv = process.env[cal.env_var];
    if (fromEnv && fromEnv.trim()) return fromEnv.trim();
  }
  return undefined;
}

/** iCal의 날짜 형식(20260721T091200Z / 20260721)을 ISO 문자열로. */
function parseIcalDate(value: string): { iso: string; allDay: boolean } | null {
  const v = value.trim();
  const dateOnly = /^(\d{4})(\d{2})(\d{2})$/.exec(v);
  if (dateOnly) {
    return { iso: `${dateOnly[1]}-${dateOnly[2]}-${dateOnly[3]}`, allDay: true };
  }
  const dateTime = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z?)$/.exec(v);
  if (dateTime) {
    const [, y, mo, d, h, mi, s, z] = dateTime;
    return { iso: `${y}-${mo}-${d}T${h}:${mi}:${s}${z ? 'Z' : ''}`, allDay: false };
  }
  return null;
}

/** iCal 본문에서 VEVENT를 뽑아내는 최소 파서. 반복 일정(RRULE)은 아직 전개하지 않습니다. */
export function parseIcal(text: string, calendarKey: string): CalendarEvent[] {
  // RFC 5545의 line folding(다음 줄이 공백으로 시작하면 이어붙임) 해제
  const unfolded = text.replace(/\r\n[ \t]/g, '').replace(/\n[ \t]/g, '');
  const lines = unfolded.split(/\r?\n/);

  const events: CalendarEvent[] = [];
  let current: Partial<CalendarEvent> | null = null;

  for (const line of lines) {
    if (line.startsWith('BEGIN:VEVENT')) {
      current = { calendar: calendarKey };
      continue;
    }
    if (line.startsWith('END:VEVENT')) {
      if (current?.start && current.uid) {
        events.push({
          uid: current.uid,
          summary: current.summary ?? '(제목 없음)',
          start: current.start,
          end: current.end,
          allDay: current.allDay ?? false,
          location: current.location,
          description: current.description,
          calendar: calendarKey,
        });
      }
      current = null;
      continue;
    }
    if (!current) continue;

    const sep = line.indexOf(':');
    if (sep < 0) continue;
    const rawKey = line.slice(0, sep);
    const value = line.slice(sep + 1);
    const key = rawKey.split(';')[0]!.toUpperCase();

    switch (key) {
      case 'UID':
        current.uid = value;
        break;
      case 'SUMMARY':
        current.summary = unescapeIcal(value);
        break;
      case 'LOCATION':
        current.location = unescapeIcal(value);
        break;
      case 'DESCRIPTION':
        current.description = unescapeIcal(value);
        break;
      case 'DTSTART': {
        const parsed = parseIcalDate(value);
        if (parsed) {
          current.start = parsed.iso;
          current.allDay = parsed.allDay;
        }
        break;
      }
      case 'DTEND': {
        const parsed = parseIcalDate(value);
        if (parsed) current.end = parsed.iso;
        break;
      }
    }
  }

  return events.sort((a, b) => a.start.localeCompare(b.start));
}

function unescapeIcal(v: string): string {
  return v.replace(/\\n/g, '\n').replace(/\\,/g, ',').replace(/\\;/g, ';').replace(/\\\\/g, '\\');
}

/**
 * 설정된 모든 캘린더의 이벤트를 가져옵니다.
 *
 * 실패해도 절대 throw하지 않습니다 (fail_on_error가 true가 아닌 한).
 * 캘린더가 하나도 설정되지 않았으면 빈 배열 — 페이지는 empty state를 렌더합니다.
 */
export async function fetchAllEvents(
  opts: { visibility?: 'public' | 'internal' } = {},
): Promise<CalendarEvent[]> {
  const configured = (calConfig.calendars ?? []).filter((cal) => {
    if (opts.visibility === 'public' && cal.visibility !== 'public') return false;
    return resolveIcalUrl(cal) !== undefined;
  });

  if (configured.length === 0) return [];

  const results = await Promise.all(configured.map((cal) => fetchCalendar(cal)));
  return results.flat().sort((a, b) => a.start.localeCompare(b.start));
}

async function fetchCalendar(cal: CalendarConfig): Promise<CalendarEvent[]> {
  const url = resolveIcalUrl(cal);
  if (!url) return [];

  const timeout = calConfig.fetch?.timeout_ms ?? 8000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    return parseIcal(text, cal.key);
  } catch (err) {
    const message = `[lab-os] 캘린더 '${cal.key}' 를 가져오지 못했습니다: ${String(err)}`;
    if (calConfig.fetch?.fail_on_error) throw new Error(message);
    console.warn(message + ' — 빈 목록으로 계속합니다.');
    return [];
  } finally {
    clearTimeout(timer);
  }
}

/** 오늘(KST) 일정만 골라냅니다. */
export function eventsOnDay(events: CalendarEvent[], day: string): CalendarEvent[] {
  return events.filter((e) => e.start.slice(0, 10) === day);
}

/** 오늘부터 N일 이내의 일정. */
export function upcomingEvents(
  events: CalendarEvent[],
  days = 7,
  from = new Date(),
): CalendarEvent[] {
  const start = from.toISOString().slice(0, 10);
  const until = new Date(from.getTime() + days * 86_400_000).toISOString().slice(0, 10);
  return events.filter((e) => {
    const d = e.start.slice(0, 10);
    return d >= start && d <= until;
  });
}

/** 캘린더 key → 설정. 색상·라벨 표시에 씁니다. */
export function calendarMeta(key: string): CalendarConfig | undefined {
  return (calConfig.calendars ?? []).find((c) => c.key === key);
}
