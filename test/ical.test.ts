/**
 * src/lib/ical.ts 의 시간대·반복 처리 테스트.
 *
 * `node --test` 로 돕니다. 새 테스트 러너 의존성은 없습니다 — ical.ts 가
 * `import type` 밖에 안 쓰므로 Node의 타입 스트리핑만으로 실행됩니다.
 *
 * ⚠️ 이 테스트는 **TZ=Asia/Seoul 과 TZ=UTC 양쪽에서** 돌려야 의미가 있습니다.
 *    고치려는 버그가 정확히 "실행 환경 TZ에 따라 결과가 달라지는 것"이었기 때문에,
 *    한쪽에서만 돌리면 회귀를 못 잡습니다. package.json 의 test 스크립트가
 *    두 번 돌립니다.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { expandEvents, parseIcal, parseRrule } from '../src/lib/ical.ts';

/** VEVENT 하나짜리 최소 iCal 문서를 만듭니다. */
function ical(...vevents: string[]): string {
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', ...vevents, 'END:VCALENDAR'].join('\r\n');
}

function vevent(lines: string[]): string {
  return ['BEGIN:VEVENT', ...lines, 'END:VEVENT'].join('\r\n');
}

const parse = (doc: string) => parseIcal(doc, 'test');

// 창의 기준점. 실제 랩 세미나 시리즈가 시작하는 날입니다.
const FROM = new Date('2026-09-02T00:00:00+09:00');
const expand = (doc: string, days = 60) => expandEvents(parse(doc), { from: FROM, days });

describe('시간대 변환', () => {
  it('TZID 벽시계 시각을 UTC 순간으로 바꾼다', () => {
    const [event] = parse(
      ical(vevent(['UID:a', 'SUMMARY:세미나', 'DTSTART;TZID=Asia/Seoul:20260902T150000'])),
    );
    // 15:00 KST = 06:00 UTC. 이 값은 실행 환경 TZ와 무관해야 합니다.
    assert.equal(event!.start, '2026-09-02T06:00:00.000Z');
    assert.equal(event!.day, '2026-09-02');
    assert.equal(event!.time, '15:00');
  });

  it('Z 가 붙은 UTC 시각은 그대로 쓴다', () => {
    const [event] = parse(ical(vevent(['UID:b', 'SUMMARY:미팅', 'DTSTART:20261008T050000Z'])));
    assert.equal(event!.start, '2026-10-08T05:00:00.000Z');
    assert.equal(event!.time, '14:00'); // KST
  });

  it('날짜 경계를 넘는 UTC 시각을 KST 날짜로 묶는다', () => {
    // 이것이 start.slice(0, 10) 이 틀리는 경우입니다: UTC로는 10-08 이지만
    // 서울에서는 이미 10-09 오전 8시입니다.
    const [event] = parse(ical(vevent(['UID:c', 'SUMMARY:심야', 'DTSTART:20261008T230000Z'])));
    assert.equal(event!.start.slice(0, 10), '2026-10-08');
    assert.equal(event!.day, '2026-10-09');
    assert.equal(event!.time, '08:00');
  });

  it('종일 일정은 날짜만 갖는다', () => {
    const [event] = parse(ical(vevent(['UID:d', 'SUMMARY:휴일', 'DTSTART;VALUE=DATE:20260902'])));
    assert.equal(event!.allDay, true);
    assert.equal(event!.day, '2026-09-02');
    assert.equal(event!.time, undefined);
  });
});

describe('RRULE 파싱', () => {
  it('다룰 수 있는 규칙을 읽는다', () => {
    const rule = parseRrule('FREQ=WEEKLY;WKST=SU;UNTIL=20261214T145959Z;BYDAY=WE');
    assert.equal(rule?.freq, 'WEEKLY');
    assert.deepEqual(rule?.byday, ['WE']);
    assert.equal(rule?.wkst, 'SU');
    assert.equal(rule?.interval, 1);
  });

  it('모르는 부품이 있으면 포기한다 (틀린 날짜를 지어내지 않는다)', () => {
    assert.equal(parseRrule('FREQ=MONTHLY;BYMONTHDAY=15'), null);
    assert.equal(parseRrule('FREQ=WEEKLY;BYSETPOS=-1;BYDAY=FR'), null);
    assert.equal(parseRrule('FREQ=YEARLY'), null);
    // 서수가 붙은 BYDAY('둘째 주 월요일')도 아직 못 다룹니다.
    assert.equal(parseRrule('FREQ=MONTHLY;BYDAY=2MO'), null);
  });
});

describe('반복 일정 전개', () => {
  const seminar = (extra: string[] = []) =>
    ical(
      vevent([
        'UID:seminar',
        'SUMMARY:ION lab seminar',
        'DTSTART;TZID=Asia/Seoul:20260902T150000',
        'RRULE:FREQ=WEEKLY;WKST=SU;UNTIL=20261214T145959Z;BYDAY=WE',
        ...extra,
      ]),
    );

  it('매주 수요일을 창 안의 실제 날짜로 펼친다', () => {
    const events = expand(seminar());
    assert.deepEqual(
      events.map((e) => e.day),
      [
        '2026-09-02',
        '2026-09-09',
        '2026-09-16',
        '2026-09-23',
        '2026-09-30',
        '2026-10-07',
        '2026-10-14',
        '2026-10-21',
        '2026-10-28',
      ],
    );
    // 회차마다 같은 벽시계 시각을 유지해야 합니다.
    assert.ok(events.every((e) => e.time === '15:00'));
    assert.ok(events.every((e) => e.recurring));
  });

  it('EXDATE 로 지정된 회차를 뺀다', () => {
    const events = expand(seminar(['EXDATE;TZID=Asia/Seoul:20260909T150000']));
    assert.equal(events.length, 8);
    assert.ok(!events.some((e) => e.day === '2026-09-09'));
  });

  it('RECURRENCE-ID 수정본이 원래 회차를 대체한다 (유령 일정 없음)', () => {
    const doc = ical(
      vevent([
        'UID:seminar',
        'SUMMARY:ION lab seminar',
        'DTSTART;TZID=Asia/Seoul:20260902T150000',
        'RRULE:FREQ=WEEKLY;WKST=SU;UNTIL=20261214T145959Z;BYDAY=WE',
      ]),
      vevent([
        'UID:seminar',
        'SUMMARY:ION lab seminar (시간 변경)',
        'RECURRENCE-ID;TZID=Asia/Seoul:20260909T150000',
        'DTSTART;TZID=Asia/Seoul:20260909T170000',
      ]),
    );
    const events = expand(doc);
    assert.equal(events.length, 9); // 늘지도 줄지도 않습니다

    const moved = events.filter((e) => e.day === '2026-09-09');
    assert.equal(moved.length, 1); // 15:00 유령 + 17:00 수정본이 둘 다 뜨면 2가 됩니다
    assert.equal(moved[0]!.time, '17:00');
    assert.equal(moved[0]!.summary, 'ION lab seminar (시간 변경)');
  });

  it('COUNT 를 시리즈 처음부터 세어 이미 끝난 시리즈는 만들지 않는다', () => {
    // 2021년에 시작한 COUNT=3 시리즈는 2021년에 끝났습니다.
    // 창 안에서 3번 나오면 안 됩니다.
    const doc = ical(
      vevent([
        'UID:old',
        'SUMMARY:옛날 미팅',
        'DTSTART;TZID=Asia/Seoul:20210105T100000',
        'RRULE:FREQ=WEEKLY;COUNT=3;BYDAY=TU',
      ]),
    );
    assert.deepEqual(expand(doc), []);
  });

  it('INTERVAL 을 지킨다', () => {
    const doc = ical(
      vevent([
        'UID:biweekly',
        'SUMMARY:격주 미팅',
        'DTSTART;TZID=Asia/Seoul:20260902T150000',
        'RRULE:FREQ=WEEKLY;INTERVAL=2;BYDAY=WE;COUNT=4',
      ]),
    );
    assert.deepEqual(
      expand(doc).map((e) => e.day),
      ['2026-09-02', '2026-09-16', '2026-09-30', '2026-10-14'],
    );
  });

  it('DST 가 있는 지역에서도 벽시계 시각을 유지한다', () => {
    // 미국 DST 는 2026-11-01 에 끝납니다. UTC ms 에 7일치를 더하는 방식이면
    // 11월 회차가 08:00 으로 밀립니다.
    // 기본 창(60일)은 11-01 에서 끝나므로 경계를 넘도록 늘려서 봅니다.
    const doc = ical(
      vevent([
        'UID:ny',
        'SUMMARY:NY call',
        'DTSTART;TZID=America/New_York:20261028T090000',
        'RRULE:FREQ=WEEKLY;BYDAY=WE;COUNT=3',
      ]),
    );
    assert.deepEqual(
      expand(doc, 120).map((e) => e.start),
      [
        '2026-10-28T13:00:00.000Z', // EDT (UTC-4)
        '2026-11-04T14:00:00.000Z', // EST (UTC-5) — 현지로는 여전히 09:00
        '2026-11-11T14:00:00.000Z',
      ],
    );
  });

  it('못 다루는 규칙이면 원본 한 건만 남긴다', () => {
    const doc = ical(
      vevent([
        'UID:weird',
        'SUMMARY:이상한 반복',
        'DTSTART;TZID=Asia/Seoul:20260902T150000',
        'RRULE:FREQ=MONTHLY;BYMONTHDAY=15',
      ]),
    );
    const events = expand(doc);
    assert.equal(events.length, 1);
    assert.equal(events[0]!.day, '2026-09-02');
    assert.ok(!events[0]!.recurring);
  });

  it('반복이 아닌 일정은 창 안에 있을 때만 남는다', () => {
    const doc = ical(
      vevent(['UID:one', 'SUMMARY:단발', 'DTSTART;TZID=Asia/Seoul:20260910T100000']),
      vevent(['UID:far', 'SUMMARY:창 밖', 'DTSTART;TZID=Asia/Seoul:20270910T100000']),
    );
    assert.deepEqual(
      expand(doc).map((e) => e.summary),
      ['단발'],
    );
  });
});
