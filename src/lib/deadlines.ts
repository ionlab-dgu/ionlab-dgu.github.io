/**
 * 데드라인 통합 뷰.
 *
 * 세 출처를 하나의 정렬된 목록으로 합칩니다:
 *   1. src/data/conferences-fetched.json — aideadlines에서 주 1회 받아온 캐시 (자동)
 *   2. content/conferences.yaml 의 conferences[] — 사람이 확인해 적은 목록 (수동)
 *   3. content/grants/<slug>/index.md 의 next_deadline — 과제 리포트 마감
 *
 * 1과 2가 같은 학회·같은 연도를 가리키면 **2가 이깁니다.** upstream이 틀렸거나
 * 아직 안 올라온 날짜를 우리가 덮어쓸 수 있어야 하기 때문입니다.
 *
 * 대시보드는 D-30 이내를 강조합니다.
 */
import fs from 'node:fs';
import path from 'node:path';
import { parseYaml } from './yaml';
import { CONTENT_DIR, SRC_DATA_DIR, contentRoots } from './paths';
import { getGrants } from './content';
import type {
  Conference,
  ConferenceDisplayConfig,
  DeadlineItem,
  FetchedConferences,
  TrackedVenue,
} from './types';

/** D-30 이내면 "임박". 대시보드 강조 기준. */
export const IMMINENT_DAYS = 30;

const CONFERENCES_YAML = 'conferences.yaml';
const FETCHED_JSON = 'conferences-fetched.json';

interface ConferencesFile {
  tracked_venues?: TrackedVenue[];
  display?: Partial<ConferenceDisplayConfig>;
  conferences?: Conference[];
}

const DISPLAY_FALLBACK: ConferenceDisplayConfig = {
  show_upcoming_only: true,
  highlight_days: [30, 14, 7, 3],
  default_view: 'list',
};

/**
 * content/conferences.yaml 을 읽습니다 (private 오버레이가 있으면 그것도).
 *
 * 파일이 없거나 깨져도 던지지 않습니다 — 빈 객체로 계속합니다.
 */
function readConferencesFiles(): ConferencesFile[] {
  const files = [
    path.join(CONTENT_DIR, CONFERENCES_YAML),
    ...contentRoots()
      .filter((r) => r.private)
      .map((r) => path.join(r.dir, CONFERENCES_YAML)),
  ];

  const out: ConferencesFile[] = [];
  for (const file of files) {
    try {
      const parsed = parseYaml<ConferencesFile | null>(fs.readFileSync(file, 'utf-8'));
      if (parsed && typeof parsed === 'object') out.push(parsed);
    } catch {
      // 없으면 그냥 건너뜁니다.
    }
  }
  return out;
}

/** 자동 수집 대상 venue 목록. */
export function getTrackedVenues(): TrackedVenue[] {
  return readConferencesFiles().flatMap((f) => f.tracked_venues ?? []);
}

/** 표시 규칙. 설정에 없는 항목은 기본값으로 채웁니다. */
export function getConferenceDisplay(): ConferenceDisplayConfig {
  const configured = readConferencesFiles().find((f) => f.display)?.display ?? {};
  return { ...DISPLAY_FALLBACK, ...configured };
}

/**
 * scripts/fetch-conferences.mjs 가 만든 캐시.
 *
 * 캐시가 없어도(= 아직 한 번도 안 돌렸어도) 빌드는 성공해야 합니다.
 * 그래서 파일이 없거나 깨졌으면 조용히 빈 배열입니다.
 */
export function getFetchedConferences(): Conference[] {
  try {
    const raw = fs.readFileSync(path.join(SRC_DATA_DIR, FETCHED_JSON), 'utf-8');
    const parsed = JSON.parse(raw) as FetchedConferences;
    return (parsed.venues ?? []).map((c) => ({ ...c, source: c.source ?? 'aideadlines' }));
  } catch {
    return [];
  }
}

/**
 * 캐시 파일의 상태. 화면이 "마감이 없다"와 "아직 한 번도 안 받아왔다"를
 * 구분하기 위해 필요합니다 — 둘은 사용자가 할 일이 다릅니다.
 */
export function getFetchedMeta(): { exists: boolean; generatedAt?: string; count: number } {
  try {
    const raw = fs.readFileSync(path.join(SRC_DATA_DIR, FETCHED_JSON), 'utf-8');
    const parsed = JSON.parse(raw) as FetchedConferences;
    return {
      exists: true,
      generatedAt: parsed.generated_at,
      count: parsed.venues?.length ?? 0,
    };
  } catch {
    return { exists: false, count: 0 };
  }
}

/** 병합 키. 같은 학회의 같은 회차를 가리키면 같은 키가 나와야 합니다. */
function conferenceKey(c: Conference): string {
  return `${c.name.trim().toLowerCase()}-${c.year ?? ''}`;
}

/**
 * 자동 수집분 + 수동 목록. 같은 키면 수동이 이깁니다.
 *
 * 수동 항목은 사람이 공식 CFP를 보고 적은 것이므로 upstream보다 신뢰도가 높습니다
 * (적어도 verified_by 가 채워졌다면). 자동 수집분을 덮어쓰지 못하면 우리가
 * 확인한 날짜를 사이트에 반영할 방법이 없습니다.
 */
export function getConferences(): Conference[] {
  const merged = new Map<string, Conference>();

  for (const c of getFetchedConferences()) merged.set(conferenceKey(c), c);
  for (const file of readConferencesFiles()) {
    for (const c of file.conferences ?? []) {
      if (!c?.name) continue;
      merged.set(conferenceKey(c), { ...c, source: c.source ?? 'manual' });
    }
  }

  return [...merged.values()].sort((a, b) => (a.deadline ?? '').localeCompare(b.deadline ?? ''));
}

/** 두 날짜(YYYY-MM-DD) 사이의 일수. 음수면 이미 지났다는 뜻. */
export function daysUntil(due: string, from = new Date()): number {
  const dueDate = new Date(`${due.slice(0, 10)}T23:59:59+09:00`);
  const diff = dueDate.getTime() - from.getTime();
  return Math.ceil(diff / 86_400_000);
}

interface DeadlineOptions {
  /** 지난 데드라인도 포함할지 (기본 false) */
  includePast?: boolean;
  /** N일 이내만 (미지정이면 전부) */
  withinDays?: number;
  from?: Date;
}

function applyFilters(items: DeadlineItem[], opts: DeadlineOptions): DeadlineItem[] {
  let filtered = items;
  if (!opts.includePast) filtered = filtered.filter((i) => i.daysLeft >= 0);
  if (opts.withinDays !== undefined) {
    filtered = filtered.filter((i) => i.daysLeft <= opts.withinDays!);
  }
  return filtered.sort((a, b) => a.due.localeCompare(b.due));
}

function conferenceItems(from: Date): DeadlineItem[] {
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
  return items;
}

/**
 * 학회 마감만. **과제는 절대 포함하지 않습니다.**
 *
 * 공개 페이지(/calendar)가 쓰는 함수입니다. getDeadlines() 를 쓰고 나중에
 * 과제를 걸러내는 방식이면, 필터를 빠뜨린 순간 과제명·마감일이 공개 사이트로
 * 새어 나갑니다. 애초에 getGrants() 를 부르지 않는 함수를 따로 둡니다
 * (CLAUDE.md §1: 공개 페이지에서 나열할 때는 통로 자체를 좁힙니다).
 */
export function getConferenceDeadlines(opts: DeadlineOptions = {}): DeadlineItem[] {
  return applyFilters(conferenceItems(opts.from ?? new Date()), opts);
}

/**
 * 학회 + 과제 리포트 데드라인을 하나로 합쳐 마감이 가까운 순으로 정렬합니다.
 *
 * 과제가 섞이므로 **내부 페이지에서만** 쓰세요. 공개 페이지는
 * getConferenceDeadlines() 를 씁니다.
 */
export function getDeadlines(opts: DeadlineOptions = {}): DeadlineItem[] {
  const from = opts.from ?? new Date();
  const items: DeadlineItem[] = conferenceItems(from);

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

  return applyFilters(items, opts);
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
