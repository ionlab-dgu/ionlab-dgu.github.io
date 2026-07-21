/**
 * 출결 JSONL 읽기/쓰기 헬퍼.
 *
 * ─── 설계 원칙 (config/access.yaml 의 principles와 동일) ──────
 * - 자기 보고. 자동 추적하지 않습니다.
 * - append-only. 기존 이벤트를 고치지 않습니다.
 * - **통계·랭킹·리더보드를 만들지 않습니다.** 이 파일에 총 근무시간이나 출석률을
 *   계산하는 함수를 추가하지 마세요. 감시 도구가 되는 순간 이 기능은 실패합니다.
 * - 노출하는 것은 "지금 상태"뿐이고, 개인 로그는 본인만 봅니다.
 */
import fs from 'node:fs';
import path from 'node:path';
import { DATA_DIR } from './paths';
import type { AttendanceAction, AttendanceEvent, Presence, PresenceState } from './types';

const ATTENDANCE_DIR = path.join(DATA_DIR, 'attendance');

/** YYYY-MM (KST 기준) */
export function monthKey(date = new Date()): string {
  const kst = new Date(date.getTime() + 9 * 60 * 60 * 1000);
  return kst.toISOString().slice(0, 7);
}

/** YYYY-MM-DD (KST 기준) */
export function dayKey(date = new Date()): string {
  const kst = new Date(date.getTime() + 9 * 60 * 60 * 1000);
  return kst.toISOString().slice(0, 10);
}

function monthFile(month: string): string {
  return path.join(ATTENDANCE_DIR, `${month}.jsonl`);
}

function isValidAction(a: unknown): a is AttendanceAction {
  return (
    a === 'checkin' || a === 'break_out' || a === 'break_in' || a === 'checkout' || a === 'remote'
  );
}

/** 한 달치 이벤트를 시간순으로 읽습니다. 파일이 없으면 빈 배열. */
export function readMonth(month = monthKey()): AttendanceEvent[] {
  const file = monthFile(month);
  let raw: string;
  try {
    raw = fs.readFileSync(file, 'utf-8');
  } catch {
    return [];
  }

  const events: AttendanceEvent[] = [];
  raw.split('\n').forEach((line, i) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    try {
      const parsed = JSON.parse(trimmed) as AttendanceEvent;
      if (!parsed.user || !isValidAction(parsed.action) || !parsed.at) {
        console.warn(`[lab-os] attendance/${month}.jsonl:${i + 1} 형식이 올바르지 않습니다.`);
        return;
      }
      events.push(parsed);
    } catch {
      console.warn(`[lab-os] attendance/${month}.jsonl:${i + 1} JSON 파싱 실패.`);
    }
  });

  return events.sort((a, b) => a.at.localeCompare(b.at));
}

/** 특정 날짜의 이벤트만. */
export function readDay(day = dayKey()): AttendanceEvent[] {
  const month = day.slice(0, 7);
  return readMonth(month).filter((e) => e.at.slice(0, 10) === day);
}

/** 한 사람의 이벤트. 개인 로그 화면에서만 쓰세요 (본인 것만 보여야 합니다). */
export function readUserMonth(user: string, month = monthKey()): AttendanceEvent[] {
  return readMonth(month).filter((e) => e.user === user);
}

const ACTION_TO_STATE: Record<AttendanceAction, PresenceState> = {
  checkin: 'in_lab',
  break_in: 'in_lab',
  break_out: 'on_break',
  remote: 'remote',
  checkout: 'out',
};

/**
 * 오늘의 이벤트에서 각 멤버의 현재 상태를 도출합니다.
 * 이벤트가 없는 멤버는 'out'(미출근)으로 봅니다.
 */
export function getPresence(memberIds: string[], day = dayKey()): Presence[] {
  const today = readDay(day);
  const last = new Map<string, AttendanceEvent>();
  for (const e of today) last.set(e.user, e); // 시간순이므로 마지막이 최신

  return memberIds.map((user) => {
    const e = last.get(user);
    if (!e) return { user, state: 'out' as PresenceState };
    return {
      user,
      state: ACTION_TO_STATE[e.action],
      since: e.at,
      note: e.note,
    };
  });
}

/** 상태별 인원수. 대시보드 위젯용 — 개인별 시간 집계는 하지 않습니다. */
export function summarizePresence(presences: Presence[]): Record<PresenceState, number> {
  const counts: Record<PresenceState, number> = { in_lab: 0, on_break: 0, remote: 0, out: 0 };
  for (const p of presences) counts[p.state] += 1;
  return counts;
}

/**
 * 현재 상태에서 다음에 누를 버튼. 개인 컨트롤은 "상태에 따라 라벨이 바뀌는 큰 버튼 하나"입니다.
 */
export function nextAction(state: PresenceState): { action: AttendanceAction; label: string } {
  switch (state) {
    case 'out':
      return { action: 'checkin', label: '출근' };
    case 'in_lab':
      return { action: 'checkout', label: '퇴근' };
    case 'on_break':
      return { action: 'break_in', label: '복귀' };
    case 'remote':
      return { action: 'checkout', label: '업무 종료' };
  }
}

export const STATE_LABEL: Record<PresenceState, string> = {
  in_lab: '재실',
  on_break: '외출',
  remote: '재택',
  out: '미출근',
};

export const STATE_BADGE: Record<PresenceState, string> = {
  in_lab: 'badge-green',
  on_break: 'badge-amber',
  remote: 'badge-blue',
  out: 'badge-neutral',
};

/**
 * 이벤트 추가.
 *
 * Phase 1(정적 빌드)에서는 브라우저에서 호출할 수 없습니다 — 이 함수는
 * 스크립트/서버 사이드 전용입니다. Phase 2에서 인증된 엔드포인트가 이 함수를 호출하거나,
 * GitHub API로 커밋하는 방식으로 대체합니다.
 */
export function appendEvent(event: AttendanceEvent): void {
  if (!isValidAction(event.action)) {
    throw new Error(`알 수 없는 action: ${event.action}`);
  }
  const month = event.at.slice(0, 7);
  const file = monthFile(month);
  fs.mkdirSync(ATTENDANCE_DIR, { recursive: true });
  fs.appendFileSync(file, JSON.stringify(event) + '\n', 'utf-8');
}

/** 지금 시각을 KST 오프셋이 붙은 ISO 8601 문자열로. */
export function nowKST(date = new Date()): string {
  const kst = new Date(date.getTime() + 9 * 60 * 60 * 1000);
  return kst.toISOString().replace('Z', '+09:00');
}
