/**
 * 마크다운 콘텐츠 로더 + private 오버레이 병합.
 *
 * ─── 동작 원칙 ───────────────────────────────────────────────
 * 1. content/ 를 먼저 읽고, .private/content/ 를 그 위에 겹칩니다.
 * 2. private에서 온 문서에는 source.private = true 가 붙습니다.
 * 3. 같은 slug가 양쪽에 있으면 private이 이깁니다 (오버레이니까).
 * 4. `_` 로 시작하는 파일·폴더(_template 등)는 콘텐츠가 아니므로 건너뜁니다.
 * 5. .private/ 가 없어도 전부 정상 동작합니다 — public 빌드의 안전장치.
 *
 * ─── 중요 ────────────────────────────────────────────────────
 * private 문서를 public 페이지에서 렌더하면 안 됩니다.
 * 페이지에서 반드시 publicOnly() 또는 명시적 필터를 거치세요.
 */
import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import { contentRoots, relFromRoot } from './paths';
import type {
  Dataset,
  Doc,
  Grant,
  GrantBundle,
  HandbookPage,
  MeetingNote,
  Member,
  Model,
  NewsItem,
  Publication,
  ResearchProject,
  ResearchProjectBundle,
  Seminar,
} from './types';

// ─── 저수준 유틸 ────────────────────────────────────────────

/** _template.md, _draft/ 등 언더스코어로 시작하는 것은 콘텐츠가 아님. */
function isSkipped(name: string): boolean {
  return name.startsWith('_') || name.startsWith('.');
}

function readDoc<T>(file: string, isPrivate: boolean): Doc<T> | null {
  try {
    const raw = fs.readFileSync(file, 'utf-8');
    const { data, content } = matter(raw);
    return {
      data: data as T,
      body: content.trim(),
      source: { path: relFromRoot(file), private: isPrivate },
    };
  } catch (err) {
    console.warn(`[lab-os] ${relFromRoot(file)} 파싱 실패 — 건너뜁니다.`, err);
    return null;
  }
}

function listFiles(dir: string, ext = '.md'): string[] {
  try {
    return fs
      .readdirSync(dir, { withFileTypes: true })
      .filter((e) => e.isFile() && e.name.endsWith(ext) && !isSkipped(e.name))
      .map((e) => path.join(dir, e.name))
      .sort();
  } catch {
    return [];
  }
}

function listDirs(dir: string): string[] {
  try {
    return fs
      .readdirSync(dir, { withFileTypes: true })
      .filter((e) => e.isDirectory() && !isSkipped(e.name))
      .map((e) => path.join(dir, e.name))
      .sort();
  } catch {
    return [];
  }
}

/**
 * 단일 파일 타입(members, publications, news 등)을 두 소스에서 모아 병합합니다.
 * key(파일명 기준 slug)가 겹치면 private이 이깁니다.
 */
function loadFlat<T>(subdir: string, keyOf: (doc: Doc<T>, basename: string) => string): Doc<T>[] {
  const byKey = new Map<string, Doc<T>>();
  for (const root of contentRoots(subdir)) {
    for (const file of listFiles(root.dir)) {
      const doc = readDoc<T>(file, root.private);
      if (!doc) continue;
      const basename = path.basename(file, '.md');
      byKey.set(keyOf(doc, basename), doc);
    }
  }
  return [...byKey.values()];
}

/** 폴더형 타입(research, grants)의 폴더 목록을 두 소스에서 모읍니다. */
function loadBundleDirs(subdir: string): Map<string, { dir: string; private: boolean }> {
  const bySlug = new Map<string, { dir: string; private: boolean }>();
  for (const root of contentRoots(subdir)) {
    for (const dir of listDirs(root.dir)) {
      bySlug.set(path.basename(dir), { dir, private: root.private });
    }
  }
  return bySlug;
}

function readOptional<T>(dir: string, name: string, isPrivate: boolean): Doc<T> | undefined {
  const file = path.join(dir, name);
  if (!fs.existsSync(file)) return undefined;
  return readDoc<T>(file, isPrivate) ?? undefined;
}

function readMeetings(dir: string, isPrivate: boolean): Doc<MeetingNote>[] {
  const meetingsDir = path.join(dir, 'meetings');
  return listFiles(meetingsDir)
    .map((f) => readDoc<MeetingNote>(f, isPrivate))
    .filter((d): d is Doc<MeetingNote> => d !== null)
    .sort((a, b) => String(b.data.date ?? '').localeCompare(String(a.data.date ?? '')));
}

// ─── 공개 API: 필터 ─────────────────────────────────────────

/** private 오버레이에서 온 문서를 제거합니다. public 페이지는 반드시 이걸 통과시키세요. */
export function publicOnly<T>(docs: Doc<T>[]): Doc<T>[] {
  return docs.filter((d) => !d.source.private);
}

/** frontmatter의 visibility가 internal/private인 문서까지 함께 제거합니다. */
export function publicVisible<T extends { visibility?: string }>(docs: Doc<T>[]): Doc<T>[] {
  return publicOnly(docs).filter((d) => {
    const v = d.data?.visibility;
    return v === undefined || v === 'public';
  });
}

// ─── Members ────────────────────────────────────────────────

const ROLE_ORDER: Record<string, number> = {
  pi: 0,
  postdoc: 1,
  phd: 2,
  ms: 3,
  ug_intern: 4,
  alumni: 9,
};

export function getMembers(): Doc<Member>[] {
  const docs = loadFlat<Member>('members', (doc, basename) => doc.data?.id ?? basename);
  return docs.sort((a, b) => {
    const ra = ROLE_ORDER[a.data?.role ?? ''] ?? 5;
    const rb = ROLE_ORDER[b.data?.role ?? ''] ?? 5;
    if (ra !== rb) return ra - rb;
    // 같은 역할이면 합류가 빠른 순
    return String(a.data?.cohort ?? '').localeCompare(String(b.data?.cohort ?? ''));
  });
}

export function getMember(id: string): Doc<Member> | undefined {
  return getMembers().find((m) => m.data?.id === id);
}

/** 현역(졸업생 제외) 멤버. */
export function getActiveMembers(): Doc<Member>[] {
  return getMembers().filter((m) => m.data?.role !== 'alumni');
}

export function getAlumni(): Doc<Member>[] {
  return getMembers().filter((m) => m.data?.role === 'alumni');
}

/**
 * member id를 사람이 읽는 이름으로. 등록되지 않은 id(외부 공저자 등)는 그대로 반환합니다.
 */
export function displayName(idOrName: string, members?: Doc<Member>[]): string {
  const list = members ?? getMembers();
  const found = list.find((m) => m.data?.id === idOrName);
  if (!found) return idOrName;
  return found.data?.name_ko || found.data?.name_en || idOrName;
}

// ─── Research ───────────────────────────────────────────────

export function getResearchProjects(): ResearchProjectBundle[] {
  const bundles: ResearchProjectBundle[] = [];
  for (const [slug, { dir, private: isPrivate }] of loadBundleDirs('research')) {
    const index = readOptional<ResearchProject>(dir, 'index.md', isPrivate);
    if (!index) {
      console.warn(`[lab-os] content/research/${slug}/index.md 가 없습니다 — 건너뜁니다.`);
      continue;
    }
    // frontmatter에 slug가 비어 있으면 폴더명으로 채웁니다.
    index.data = { ...index.data, slug: index.data?.slug ?? slug };
    bundles.push({
      index,
      reading: readOptional(dir, 'reading.md', isPrivate),
      experiments: readOptional(dir, 'experiments.md', isPrivate),
      datasets: readOptional(dir, 'datasets.md', isPrivate),
      ideas: readOptional(dir, 'ideas.md', isPrivate),
      meetings: readMeetings(dir, isPrivate),
    });
  }

  const STATUS_ORDER: Record<string, number> = {
    active: 0,
    writing: 1,
    submitted: 2,
    accepted: 3,
    idea: 4,
    paused: 5,
    archived: 9,
  };
  return bundles.sort((a, b) => {
    const sa = STATUS_ORDER[a.index.data?.status ?? ''] ?? 6;
    const sb = STATUS_ORDER[b.index.data?.status ?? ''] ?? 6;
    if (sa !== sb) return sa - sb;
    return String(b.index.data?.start ?? '').localeCompare(String(a.index.data?.start ?? ''));
  });
}

export function getResearchProject(slug: string): ResearchProjectBundle | undefined {
  return getResearchProjects().find((p) => p.index.data?.slug === slug);
}

/** public 사이트에 노출할 프로젝트: private 오버레이 제외 + archived 제외. */
export function getPublicResearchProjects(): ResearchProjectBundle[] {
  return getResearchProjects().filter(
    (p) => !p.index.source.private && p.index.data?.status !== 'archived',
  );
}

// ─── Grants ─────────────────────────────────────────────────

export function getGrants(): GrantBundle[] {
  const bundles: GrantBundle[] = [];
  for (const [slug, { dir, private: isPrivate }] of loadBundleDirs('grants')) {
    const index = readOptional<Grant>(dir, 'index.md', isPrivate);
    if (!index) {
      console.warn(`[lab-os] content/grants/${slug}/index.md 가 없습니다 — 건너뜁니다.`);
      continue;
    }
    index.data = { ...index.data, slug: index.data?.slug ?? slug };
    bundles.push({
      index,
      deliverables: readOptional(dir, 'deliverables.md', isPrivate),
      reports: readOptional(dir, 'reports.md', isPrivate),
      meetings: readMeetings(dir, isPrivate),
    });
  }
  return bundles.sort((a, b) =>
    String(a.index.data?.next_deadline?.due ?? '9999').localeCompare(
      String(b.index.data?.next_deadline?.due ?? '9999'),
    ),
  );
}

export function getGrant(slug: string): GrantBundle | undefined {
  return getGrants().find((g) => g.index.data?.slug === slug);
}

// ─── Publications ───────────────────────────────────────────

export function getPublications(): Doc<Publication>[] {
  const docs = loadFlat<Publication>('publications', (doc, basename) => doc.data?.slug ?? basename);
  return docs.sort((a, b) => {
    const ya = a.data?.year ?? 0;
    const yb = b.data?.year ?? 0;
    if (ya !== yb) return yb - ya;
    return String(a.data?.title ?? '').localeCompare(String(b.data?.title ?? ''));
  });
}

/** 특정 과제에 귀속된 논문. 과제 리포트 자동 집계에 씁니다. */
export function getPublicationsByGrant(grantSlug: string): Doc<Publication>[] {
  return getPublications().filter((p) => (p.data?.attributed_grants ?? []).includes(grantSlug));
}

/** 특정 연구 프로젝트에서 나온 논문. */
export function getPublicationsByProject(projectSlug: string): Doc<Publication>[] {
  return getPublications().filter((p) =>
    (p.data?.attributed_projects ?? []).includes(projectSlug),
  );
}

// ─── News ───────────────────────────────────────────────────

export function getNews(): Doc<NewsItem>[] {
  const docs = loadFlat<NewsItem>('news', (doc, basename) => doc.data?.slug ?? basename);
  return docs.sort((a, b) => {
    // 고정 항목이 먼저, 그다음 최신순
    const pa = a.data?.pinned ? 1 : 0;
    const pb = b.data?.pinned ? 1 : 0;
    if (pa !== pb) return pb - pa;
    return String(b.data?.date ?? '').localeCompare(String(a.data?.date ?? ''));
  });
}

// ─── Handbook ───────────────────────────────────────────────

export function getHandbookPages(): Doc<HandbookPage>[] {
  const pages: Doc<HandbookPage>[] = [];
  const seen = new Set<string>();

  for (const root of contentRoots('handbook')) {
    // 루트 레벨 (overview.md, faq.md)
    for (const file of listFiles(root.dir)) {
      const doc = readDoc<HandbookPage>(file, root.private);
      if (!doc) continue;
      doc.data = { ...doc.data, section: '', slug: doc.data?.slug ?? path.basename(file, '.md') };
      pages.push(doc);
    }
    // 섹션 폴더 (onboarding/, policies/, tutorials/)
    for (const sectionDir of listDirs(root.dir)) {
      const section = path.basename(sectionDir);
      for (const file of listFiles(sectionDir)) {
        const doc = readDoc<HandbookPage>(file, root.private);
        if (!doc) continue;
        doc.data = { ...doc.data, section, slug: doc.data?.slug ?? path.basename(file, '.md') };
        pages.push(doc);
      }
    }
  }

  // slug 중복 시 나중(= private)이 이기도록 뒤에서부터 채택
  const deduped: Doc<HandbookPage>[] = [];
  for (let i = pages.length - 1; i >= 0; i--) {
    const page = pages[i]!;
    const key = page.data.slug;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(page);
  }

  return deduped.sort((a, b) => (a.data?.order ?? 999) - (b.data?.order ?? 999));
}

export function getHandbookPage(slug: string): Doc<HandbookPage> | undefined {
  return getHandbookPages().find((p) => p.data?.slug === slug);
}

// ─── Datasets / Models ──────────────────────────────────────

export function getDatasets(): Doc<Dataset>[] {
  return loadFlat<Dataset>('datasets', (doc, basename) => doc.data?.slug ?? basename).sort((a, b) =>
    String(a.data?.name ?? '').localeCompare(String(b.data?.name ?? '')),
  );
}

export function getModels(): Doc<Model>[] {
  return loadFlat<Model>('models', (doc, basename) => doc.data?.slug ?? basename).sort((a, b) =>
    String(a.data?.name ?? '').localeCompare(String(b.data?.name ?? '')),
  );
}

// ─── Seminars ───────────────────────────────────────────────

export function getSeminars(): Doc<Seminar>[] {
  return loadFlat<Seminar>('seminars', (_doc, basename) => basename).sort((a, b) =>
    String(b.data?.date ?? '').localeCompare(String(a.data?.date ?? '')),
  );
}

// ─── 미팅 노트 통합 피드 ────────────────────────────────────

export interface MeetingFeedItem {
  doc: Doc<MeetingNote>;
  /** 어디에 속한 미팅인가 */
  context: { kind: 'research' | 'grant' | 'seminar' | 'one_on_one'; slug: string; title: string };
}

/**
 * 모든 미팅 노트를 최신순 하나의 피드로. /internal/meetings 에서 씁니다.
 * one-on-one은 private 오버레이에만 존재하므로 .private/ 가 없으면 자연히 빠집니다.
 */
export function getMeetingFeed(limit?: number): MeetingFeedItem[] {
  const items: MeetingFeedItem[] = [];

  for (const project of getResearchProjects()) {
    const title = project.index.data?.title ?? project.index.data?.slug ?? '';
    for (const doc of project.meetings) {
      items.push({
        doc,
        context: { kind: 'research', slug: project.index.data?.slug ?? '', title },
      });
    }
  }

  for (const grant of getGrants()) {
    const title = grant.index.data?.title_ko ?? grant.index.data?.slug ?? '';
    for (const doc of grant.meetings) {
      items.push({ doc, context: { kind: 'grant', slug: grant.index.data?.slug ?? '', title } });
    }
  }

  for (const doc of getSeminars()) {
    items.push({
      doc: doc as unknown as Doc<MeetingNote>,
      context: {
        kind: 'seminar',
        slug: String(doc.data?.date ?? ''),
        title: doc.data?.title || doc.data?.paper || '세미나',
      },
    });
  }

  for (const doc of getOneOnOnes()) {
    items.push({
      doc,
      context: {
        kind: 'one_on_one',
        slug: String(doc.data?.member ?? ''),
        title: `1:1 — ${displayName(String(doc.data?.member ?? ''))}`,
      },
    });
  }

  items.sort((a, b) => String(b.doc.data?.date ?? '').localeCompare(String(a.doc.data?.date ?? '')));
  return limit ? items.slice(0, limit) : items;
}

// ─── 1:1 노트 (private 전용) ────────────────────────────────

/**
 * 1:1 노트는 .private/content/one-on-ones/<member-slug>/YYYY-MM-DD-one_on_one.md 에 있습니다.
 * public 저장소에는 절대 존재하지 않으며, .private/ 가 없으면 빈 배열을 반환합니다.
 */
export function getOneOnOnes(memberId?: string): Doc<MeetingNote>[] {
  const docs: Doc<MeetingNote>[] = [];
  for (const root of contentRoots('one-on-ones')) {
    if (!root.private) {
      // public 저장소에 1:1 노트가 있다면 격리 원칙이 깨진 것입니다.
      console.warn(
        `[lab-os] 경고: public 저장소에 one-on-ones/ 가 있습니다. ` +
          `1:1 노트는 lab-os-private 에만 있어야 합니다: ${relFromRoot(root.dir)}`,
      );
      continue;
    }
    for (const memberDir of listDirs(root.dir)) {
      const slug = path.basename(memberDir);
      if (memberId && slug !== memberId) continue;
      for (const file of listFiles(memberDir)) {
        const doc = readDoc<MeetingNote>(file, true);
        if (doc) {
          doc.data = { ...doc.data, member: doc.data?.member ?? slug };
          docs.push(doc);
        }
      }
    }
  }
  return docs.sort((a, b) => String(b.data?.date ?? '').localeCompare(String(a.data?.date ?? '')));
}
