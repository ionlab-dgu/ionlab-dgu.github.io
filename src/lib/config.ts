/**
 * config/*.yaml 로더.
 *
 * 파일이 없거나 깨져 있어도 빌드는 성공해야 합니다 — 기본값으로 대체하고 경고만 남깁니다.
 */
import fs from 'node:fs';
import path from 'node:path';
import { parseYaml } from './yaml';
import { CONFIG_DIR } from './paths';

function loadYaml<T>(filename: string, fallback: T): T {
  const file = path.join(CONFIG_DIR, filename);
  try {
    const raw = fs.readFileSync(file, 'utf-8');
    const parsed = parseYaml(raw);
    if (parsed == null || typeof parsed !== 'object') return fallback;
    return parsed as T;
  } catch (err) {
    console.warn(`[lab-os] config/${filename} 을 읽지 못했습니다. 기본값을 사용합니다.`, err);
    return fallback;
  }
}

// ─── site.yaml ──────────────────────────────────────────────

export interface ResearchArea {
  title_ko?: string;
  title_en?: string;
  description?: string;
}

export interface SiteConfig {
  lab: {
    name_ko?: string;
    name_en?: string;
    full_name_en?: string;
    tagline_ko?: string;
    tagline_en?: string;
    university_ko?: string;
    university_en?: string;
    department_ko?: string;
    department_en?: string;
    address_ko?: string;
    room?: string;
  };
  pi: { member_id?: string; name_ko?: string; name_en?: string; email?: string };
  contact: { email?: string; github_org?: string };
  site: {
    url?: string;
    locale_default?: string;
    locales?: string[];
    hero_headline_ko?: string;
    hero_body_ko?: string;
  };
  research_areas?: ResearchArea[];
  links: Record<string, string>;
  /** 핸드북과 동일 콘텐츠로 답하는 별도 Claude Project 링크 (외부). */
  lab_brain_url?: string;
}

const SITE_FALLBACK: SiteConfig = {
  lab: { name_ko: 'ION Lab', name_en: 'ION Lab' },
  pi: {},
  contact: {},
  site: { locale_default: 'ko' },
  links: {},
};

export const site = loadYaml<SiteConfig>('site.yaml', SITE_FALLBACK);

// ─── nav.yaml ───────────────────────────────────────────────

export interface NavItem {
  label: string;
  href: string;
}

export interface NavConfig {
  public: NavItem[];
  internal: NavItem[];
}

export const nav = loadYaml<NavConfig>('nav.yaml', { public: [], internal: [] });

// ─── calendars.yaml ─────────────────────────────────────────

export interface CalendarConfig {
  key: string;
  label: string;
  color?: string;
  description?: string;
  gcal_id?: string;
  ical_url?: string;
  env_var?: string;
  visibility?: 'public' | 'internal';
}

/**
 * GCal이 아닌 외부 소스 (지금은 학회 데드라인 하나).
 *
 * GCal 캘린더와 달리 빌드 시점에 fetch하지 않습니다. 워크플로가 받아와
 * cache_path 의 JSON으로 커밋해 두고, 사이트는 그 캐시만 읽습니다.
 */
export interface ExternalSourceConfig {
  key: string;
  label: string;
  color?: string;
  description?: string;
  visibility?: 'public' | 'internal';
  source?: string;
  base_url?: string;
  /** 저장소 루트 기준 상대 경로. */
  cache_path?: string;
  sync_schedule?: string;
}

export interface CalendarsConfig {
  fetch: {
    mode: 'build' | 'runtime';
    timeout_ms: number;
    fail_on_error: boolean;
    /** 반복 일정을 며칠치까지 펼칠지. 기본 60. */
    expand_days?: number;
  };
  /** 화면에 날짜·시각을 보여줄 기준 시간대 (IANA). 기본 Asia/Seoul. */
  display_timezone?: string;
  calendars: CalendarConfig[];
  external_sources?: ExternalSourceConfig[];
}

export const calendars = loadYaml<CalendarsConfig>('calendars.yaml', {
  fetch: { mode: 'build', timeout_ms: 8000, fail_on_error: false },
  calendars: [],
  external_sources: [],
});

// ─── access.yaml ────────────────────────────────────────────

export type AccessLevel = 'public' | 'member' | 'pi' | 'owner';

export interface AccessConfig {
  auth: {
    provider?: string;
    org?: string;
    require_org_membership?: boolean;
    stub_mode?: boolean;
  };
  role_mapping: { pi?: string[]; admin?: string[] };
  routes: Record<string, AccessLevel>;
  content_rules: Record<string, AccessLevel>;
  principles?: string[];
}

export const access = loadYaml<AccessConfig>('access.yaml', {
  auth: { stub_mode: true },
  role_mapping: {},
  routes: {},
  content_rules: {},
});

/** 사이트 표시 이름(짧은 형태). 네비게이션 브랜드·문서 제목 등에 씁니다. */
export const siteName = site.lab?.name_ko || site.lab?.name_en || 'ION Lab';

/**
 * Lab Brain(별도 Claude Project) 링크. 값이 없거나 'TODO:' 이면 undefined 를
 * 반환해 헤더 버튼·배너가 통째로 생략되게 합니다 (filled() 규칙과 동일).
 */
export const labBrainUrl = filled(site.lab_brain_url);

/**
 * 풀네임. 약어(ION)가 무엇의 줄임말인지 처음 보는 사람에게 알려주기 위한 것이므로,
 * 값이 없으면 빈 문자열이 아니라 undefined를 반환해 렌더 측에서 통째로 생략하게 합니다.
 */
export const siteFullName = filled(site.lab?.full_name_en);

/**
 * <title> 등에 쓸 "짧은 이름 — 풀네임 풀이" 형태.
 *
 * 풀네임("Intelligence and Optimization in Networks (ION) Lab")을 그대로 붙이면
 * "ION Lab — ... (ION) Lab" 처럼 약어와 Lab이 중복됩니다.
 * 그래서 괄호 약어와 끝의 Lab을 떼고 풀이 부분만 남깁니다.
 */
export const siteTitleWithFullName = (() => {
  if (!siteFullName) return siteName;
  const expanded = siteFullName
    .replace(/\s*\([^)]*\)\s*/g, ' ') // (ION) 제거
    .replace(/\s+Lab\s*$/i, '') // 끝의 Lab 제거
    .replace(/\s+/g, ' ')
    .trim();
  return expanded ? `${siteName} — ${expanded}` : siteName;
})();

/** "TODO:" 로 시작하는 설정값은 아직 채워지지 않은 것으로 간주해 렌더에서 숨깁니다. */
export function filled(value: string | undefined | null): string | undefined {
  if (!value) return undefined;
  const trimmed = String(value).trim();
  if (!trimmed || trimmed.startsWith('TODO')) return undefined;
  return trimmed;
}
