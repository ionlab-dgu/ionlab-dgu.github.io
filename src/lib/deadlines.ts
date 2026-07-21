/**
 * 데드라인 통합 뷰.
 *
 * 두 출처를 하나의 정렬된 목록으로 합칩니다:
 *   1. content/conferences.yaml — 관심 학회 투고 마감
 *   2. content/grants/<slug>/index.md 의 next_deadline — 과제 리포트 마감
 *
 * 대시보드는 D-30 이내를 강조합니다.
 */
import fs from 'node:fs';
import path from 'node:path';
import { parseYaml } from './yaml';
import { CONTENT_DIR, contentRoots } from './paths';
import { getGrants } from './content';
import type { Conference, DeadlineItem } from './types';

/** D-30 이내면 "임박". 대시보드 강조 기준. */
export const IMMINENT_DAYS = 30;

/** content/conferences.yaml 파싱. 파일이 없거나 깨져도 빈 배열. */
export function getConferences(): Conference[] {
  const files = [
    path.join(CONTENT_DIR, 'conferences.yaml'),
    ...contentRoots()
      .filter((r) => r.private)
      .map((r) => path.join(r.dir, 'conferences.yaml')),
  ];

  const all: Conference[] = [];
  for (const file of files) {
    try {
      const raw = fs.readFileSync(file, 'utf-8');
      const parsed = parseYaml<{ conferences?: Conference[] } | null>(raw);
      if (parsed?.conferences?.length) all.push(...parsed.conferences);
    } catch {
      // 없으면 그냥 건너뜁니다.
    }
  }
  return all;
}

/** 두 날짜(YYYY-MM-DD) 사이의 일수. 음수면 이미 지났다는 뜻. */
export function daysUntil(due: string, from = new Date()): number {
  const dueDate = new Date(`${due.slice(0, 10)}T23:59:59+09:00`);
  const diff = dueDate.getTime() - from.getTime();
  return Math.ceil(diff / 86_400_000);
}

/**
 * 학회 + 과제 리포트 데드라인을 하나로 합쳐 마감이 가까운 순으로 정렬합니다.
 *
 * @param opts.includePast 지난 데드라인도 포함할지 (기본 false)
 * @param opts.withinDays  N일 이내만 (미지정이면 전부)
 */
export function getDeadlines(
  opts: { includePast?: boolean; withinDays?: number; from?: Date } = {},
): DeadlineItem[] {
  const from = opts.from ?? new Date();
  const items: DeadlineItem[] = [];

  for (const conf of getConferences()) {
    const label = `${conf.name}${conf.year ? ` ${conf.year}` : ''}`;
    if (conf.abstract_deadline) {
      items.push({
        kind: 'conference_abstract',
        label,
        sublabel: '초록 마감',
        due: conf.abstract_deadline,
        daysLeft: daysUntil(conf.abstract_deadline, from),
        url: conf.url,
      });
    }
    if (conf.deadline) {
      items.push({
        kind: 'conference',
        label,
        sublabel: '논문 마감',
        due: conf.deadline,
        daysLeft: daysUntil(conf.deadline, from),
        url: conf.url,
      });
    }
  }

  for (const grant of getGrants()) {
    const next = grant.index.data?.next_deadline;
    if (!next?.due) continue;
    const slug = grant.index.data?.slug ?? '';
    items.push({
      kind: 'grant_report',
      label: grant.index.data?.title_ko ?? slug,
      sublabel: DEADLINE_KIND_LABEL[next.kind] ?? String(next.kind),
      due: next.due,
      daysLeft: daysUntil(next.due, from),
      href: `/internal/grants/${slug}`,
    });
  }

  let filtered = items;
  if (!opts.includePast) filtered = filtered.filter((i) => i.daysLeft >= 0);
  if (opts.withinDays !== undefined) {
    filtered = filtered.filter((i) => i.daysLeft <= opts.withinDays!);
  }

  return filtered.sort((a, b) => a.due.localeCompare(b.due));
}

export const DEADLINE_KIND_LABEL: Record<string, string> = {
  interim_report: '연차실적보고서',
  final_report: '최종보고서',
  정산: '정산',
};

/** D-day 표기. 오늘이면 D-DAY, 지났으면 D+n. */
export function ddayLabel(daysLeft: number): string {
  if (daysLeft === 0) return 'D-DAY';
  if (daysLeft > 0) return `D-${daysLeft}`;
  return `D+${Math.abs(daysLeft)}`;
}

/** 남은 일수에 따른 배지 색. */
export function ddayBadge(daysLeft: number): string {
  if (daysLeft < 0) return 'badge-neutral';
  if (daysLeft <= 7) return 'badge-red';
  if (daysLeft <= IMMINENT_DAYS) return 'badge-amber';
  return 'badge-neutral';
}
