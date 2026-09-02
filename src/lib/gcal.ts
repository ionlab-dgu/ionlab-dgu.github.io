/**
 * Google Calendar (iCal) 연동 — 읽기 전용.
 *
 * GCal이 정본입니다. 사이트는 표시만 하고 쓰기는 하지 않습니다.
 *
 * 이 파일은 **가져오기와 설정**만 맡습니다. iCal 문자열을 뜯는 일과 반복 일정을
 * 전개하는 일은 ical.ts 에 있습니다 (그쪽은 순수 함수라 테스트가 붙어 있습니다).
 *
 * Phase 1(현재): ical URL이 설정돼 있으면 빌드 시 fetch해 파싱합니다.
 *   설정이 없거나 fetch가 실패해도 **빈 배열을 반환하고 빌드는 성공합니다.**
 * Phase 2: 런타임 fetch(프록시 경유) 옵션 추가 — config/calendars.yaml 의 fetch.mode.
 */
import { calendars as calConfig, filled } from './config';
import type { CalendarConfig } from './config';
import { PUBLIC_ONLY } from './paths';
import { DEFAULT_TIMEZONE, dayInZone, expandEvents, parseIcal } from './ical';
import type { CalendarEvent } from './types';

export { parseIcal, expandEvents } from './ical';

/** 표시 기준 시간대. config/calendars.yaml 의 display_timezone 으로 바꿀 수 있습니다. */
export function displayTimezone(): string {
  return filled(calConfig.display_timezone) ?? DEFAULT_TIMEZONE;
}

/**
 * 반복 일정을 며칠치까지 펼칠지. config/calendars.yaml 의 fetch.expand_days.
 *
 * 무한히 펼칠 수는 없으니 창을 정해야 합니다. 화면이 보여주는 범위
 * (/internal/calendar 가 60일)보다 짧으면 일정이 조용히 사라지므로 기본값을
 * 거기에 맞춰 뒀습니다.
 */
export function expandDays(): number {
  const configured = calConfig.fetch?.expand_days;
  return typeof configured === 'number' && configured > 0 ? configured : 60;
}

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

/**
 * 이 캘린더를 공개 빌드 산출물에 실어도 되는가.
 *
 * 두 조건을 **모두** 만족해야 합니다. 하나는 실수로 뒤집힐 수 있어도
 * 둘이 동시에 뒤집히기는 어렵게 하려는 것입니다.
 */
function isPublicSafe(cal: CalendarConfig): boolean {
  return cal.visibility === 'public' && cal.default_visible_public === true;
}

/**
 * 설정된 모든 캘린더의 이벤트를 가져옵니다.
 *
 * ⚠️ PUBLIC_ONLY=1 (공개 배포 빌드)에서는 **어떤 캘린더도 읽지 않습니다.**
 *
 * 이게 이 파일에서 가장 중요한 줄입니다. Phase 1 에는 로그인이 없고
 * /internal/* 페이지도 정적으로 빌드돼 공개 URL로 나갑니다. 즉 "공개 페이지에
 * 안 쓰면 안전하다"가 성립하지 않습니다 — 실제로 ical_url 을 채웠더니
 * dist/internal/calendar/index.html 과 dist/internal/index.html 에 일정 제목이
 * 그대로 실렸습니다.
 *
 * 예전에는 deploy.yml 이 캘린더 환경변수를 안 넘긴다는 **규약**에만 기대고
 * 있었습니다. 규약은 다음 사람이 깨뜨립니다. 여기서 코드로 막습니다.
 *
 * 실패해도 절대 throw하지 않습니다 (fail_on_error가 true가 아닌 한).
 * 캘린더가 하나도 설정되지 않았으면 빈 배열 — 페이지는 empty state를 렌더합니다.
 */
export async function fetchAllEvents(
  opts: { visibility?: 'public' | 'internal' } = {},
): Promise<CalendarEvent[]> {
  if (PUBLIC_ONLY) return [];

  const configured = (calConfig.calendars ?? []).filter((cal) => {
    if (opts.visibility === 'public' && !isPublicSafe(cal)) return false;
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
    const zone = displayTimezone();
    // 원본 VEVENT → 반복 회차 전개(+EXDATE 제외, 수정된 회차 병합).
    return expandEvents(parseIcal(text, cal.key, { timezone: zone }), {
      days: expandDays(),
      timezone: zone,
    });
  } catch (err) {
    const message = `[lab-os] 캘린더 '${cal.key}' 를 가져오지 못했습니다: ${String(err)}`;
    if (calConfig.fetch?.fail_on_error) throw new Error(message);
    console.warn(message + ' — 빈 목록으로 계속합니다.');
    return [];
  } finally {
    clearTimeout(timer);
  }
}

/** 특정 날짜(표시 시간대 기준)의 일정만 골라냅니다. */
export function eventsOnDay(events: CalendarEvent[], day: string): CalendarEvent[] {
  return events.filter((e) => e.day === day);
}

/**
 * 오늘부터 N일 이내의 일정.
 *
 * 비교는 표시 시간대의 날짜(day)로 합니다. UTC 문자열을 잘라 쓰면 경계에 있는
 * 일정이 하루씩 빠집니다.
 */
export function upcomingEvents(
  events: CalendarEvent[],
  days = 7,
  from = new Date(),
): CalendarEvent[] {
  const zone = displayTimezone();
  const start = dayInZone(from.getTime(), zone);
  const until = dayInZone(from.getTime() + days * 86_400_000, zone);
  return events.filter((e) => e.day >= start && e.day <= until);
}

/** 캘린더 key → 설정. 색상·라벨 표시에 씁니다. */
export function calendarMeta(key: string): CalendarConfig | undefined {
  return (calConfig.calendars ?? []).find((c) => c.key === key);
}
