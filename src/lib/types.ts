/**
 * 콘텐츠 스키마의 TypeScript 정본.
 *
 * content/<type>/_template.md 의 frontmatter 주석과 이 파일은 항상 일치해야 합니다.
 * 스키마를 바꾸면 둘 다 고치세요.
 *
 * 원칙: 로더는 런타임 검증을 강제하지 않습니다(마크다운을 손으로 쓰는 환경이므로
 * 필드가 비어 있는 것이 정상입니다). 대신 대부분의 필드를 optional로 두고,
 * 렌더 측에서 없으면 생략하도록 합니다.
 */

// ─── 공통 ───────────────────────────────────────────────────

export type Visibility = 'public' | 'internal';

/** 로더가 모든 항목에 붙이는 출처 메타데이터. */
export interface SourceMeta {
  /** 파일 경로 (저장소 루트 기준). 디버깅·에러 메시지용. */
  path: string;
  /** true면 .private/ 오버레이에서 온 콘텐츠. 절대 public 빌드에 포함하지 않는다. */
  private: boolean;
}

/** 로더가 반환하는 문서의 공통 형태. */
export interface Doc<T> {
  /** frontmatter */
  data: T;
  /** frontmatter를 제외한 마크다운 본문 */
  body: string;
  source: SourceMeta;
}

// ─── Member ─────────────────────────────────────────────────

export type MemberRole = 'ug_intern' | 'ms' | 'phd' | 'postdoc' | 'pi' | 'alumni';

export interface GrantParticipation {
  grant_slug: string;
  participation_pct?: number;
}

export interface Member {
  id: string;
  name_ko?: string;
  name_en?: string;
  role: MemberRole;
  /** 합류 연월 YYYY-MM */
  cohort?: string;
  advisor?: string | null;
  projects?: string[];
  grants?: GrantParticipation[];
  interests?: string[];
  github?: string;
  email?: string;
  photo?: string;
  homepage?: string;
  /** 졸업생만 */
  alumni_since?: string;
  current_position?: string;
}

// ─── Research ───────────────────────────────────────────────

export type ResearchStatus =
  | 'idea'
  | 'active'
  | 'writing'
  | 'submitted'
  | 'accepted'
  | 'paused'
  | 'archived';

export interface ResearchProject {
  slug: string;
  title?: string;
  status: ResearchStatus;
  lead?: string;
  collaborators?: string[];
  target_venue?: string;
  /** YYYY-MM */
  start?: string;
  grants?: string[];
  tags?: string[];
  short?: string;
}

/** 프로젝트 폴더 전체 (index + 부속 문서 + 미팅 노트). */
export interface ResearchProjectBundle {
  index: Doc<ResearchProject>;
  reading?: Doc<Record<string, unknown>>;
  experiments?: Doc<Record<string, unknown>>;
  datasets?: Doc<Record<string, unknown>>;
  ideas?: Doc<Record<string, unknown>>;
  meetings: Doc<MeetingNote>[];
}

// ─── Grant ──────────────────────────────────────────────────

export type GrantStatus = 'planned' | 'active' | 'reporting' | 'closed';
export type DeadlineKind = 'interim_report' | 'final_report' | '정산' | string;

export interface Grant {
  slug: string;
  title_ko?: string;
  funder?: string;
  grant_number?: string;
  period?: { start?: string; end?: string };
  pi?: string;
  co_pis?: string[];
  status: GrantStatus;
  next_deadline?: { kind: DeadlineKind; due: string } | null;
  linked_research?: string[];
}

export interface GrantBundle {
  index: Doc<Grant>;
  deliverables?: Doc<Record<string, unknown>>;
  reports?: Doc<Record<string, unknown>>;
  meetings: Doc<MeetingNote>[];
}

// ─── Publication ────────────────────────────────────────────

export type PublicationType = 'conference' | 'journal' | 'workshop' | 'preprint';
export type PublicationStatus = 'under_review' | 'accepted' | 'published';

export interface Publication {
  slug: string;
  title?: string;
  /** 랩 멤버는 member id, 외부인은 이름 문자열 */
  authors?: string[];
  venue?: string;
  year?: number;
  type?: PublicationType;
  status?: PublicationStatus;
  attributed_grants?: string[];
  attributed_projects?: string[];
  arxiv?: string;
  code?: string;
  pdf?: string;
  bibkey?: string;
}

// ─── News ───────────────────────────────────────────────────

export type NewsCategory = 'paper' | 'award' | 'member' | 'event' | 'grant' | 'misc';

export interface NewsItem {
  slug: string;
  date: string;
  title?: string;
  category?: NewsCategory;
  pinned?: boolean;
  related_members?: string[];
  related_publications?: string[];
  image?: string;
}

// ─── Handbook ───────────────────────────────────────────────

export interface HandbookPage {
  slug: string;
  title?: string;
  order?: number;
  visibility?: Visibility;
  audience?: MemberRole[] | string[];
  updated?: string;
  /** 로더가 채움: onboarding / policies / tutorials / '' (루트) */
  section?: string;
}

// ─── Dataset / Model ────────────────────────────────────────

export interface Dataset {
  slug: string;
  name?: string;
  source?: string;
  license?: string;
  size?: string;
  modality?: string[];
  location?: string;
  access?: 'open' | 'restricted' | 'internal';
  added?: string;
  maintainer?: string;
  used_by?: string[];
}

export interface Model {
  slug: string;
  name?: string;
  task?: string;
  architecture?: string;
  trained_on?: string[];
  checkpoint?: string;
  code?: string;
  metrics?: Record<string, unknown>;
  added?: string;
  maintainer?: string;
  used_by?: string[];
}

// ─── Meeting notes ──────────────────────────────────────────

export type MeetingType = 'weekly' | 'one_on_one' | 'reading' | 'grant';

export interface MeetingNote {
  date: string;
  type: MeetingType;
  /** weekly일 때 */
  project?: string;
  /** grant 미팅일 때 */
  grant?: string;
  /** one_on_one일 때 */
  member?: string;
  /** reading일 때 */
  paper?: string;
  paper_url?: string;
  presenter?: string;
  attendees?: string[];
  visibility?: Visibility | 'private';
}

// ─── Seminar ────────────────────────────────────────────────

export interface Seminar {
  date: string;
  type: 'reading' | 'invited' | 'workshop';
  title?: string;
  paper?: string;
  paper_url?: string;
  presenter?: string;
  affiliation?: string;
  attendees?: string[];
  visibility?: Visibility;
}

// ─── Attendance ─────────────────────────────────────────────

export type AttendanceAction = 'checkin' | 'break_out' | 'break_in' | 'checkout' | 'remote';

export interface AttendanceEvent {
  user: string;
  action: AttendanceAction;
  /** ISO 8601, 오프셋 포함 */
  at: string;
  note?: string;
}

/** 이벤트 로그에서 도출한 현재 상태. */
export type PresenceState = 'in_lab' | 'on_break' | 'remote' | 'out';

export interface Presence {
  user: string;
  state: PresenceState;
  since?: string;
  note?: string;
}

// ─── Calendar / Deadlines ───────────────────────────────────

export interface CalendarEvent {
  uid: string;
  summary: string;
  start: string;
  end?: string;
  allDay: boolean;
  location?: string;
  description?: string;
  /** config/calendars.yaml 의 key */
  calendar: string;
}

export interface Conference {
  name: string;
  full_name?: string;
  year?: number;
  abstract_deadline?: string | null;
  deadline?: string;
  timezone?: string;
  notification?: string;
  conference_date?: string;
  location?: string;
  url?: string;
  tags?: string[];
  verified_by?: string | null;
  verified_on?: string | null;
}

/** 학회 데드라인과 과제 리포트 데드라인을 하나로 합친 뷰 모델. */
export interface DeadlineItem {
  kind: 'conference' | 'conference_abstract' | 'grant_report';
  label: string;
  sublabel?: string;
  due: string;
  /** 오늘 기준 남은 일수. 음수면 지났다는 뜻. */
  daysLeft: number;
  url?: string;
  href?: string;
}
