/**
 * config/*.yaml 로더.
 *
 * 파일이 없거나 깨져 있어도 빌드는 성공해야 합니다 — 기본값으로 대체하고 경고만 남깁니다.
 */
import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';
import { CONFIG_DIR } from './paths';

function loadYaml<T>(filename: string, fallback: T): T {
  const file = path.join(CONFIG_DIR, filename);
  try {
    const raw = fs.readFileSync(file, 'utf-8');
    const parsed = yaml.load(raw);
    if (parsed == null || typeof parsed !== 'object') return fallback;
    return parsed as T;
  } catch (err) {
    console.warn(`[lab-os] config/${filename} 을 읽지 못했습니다. 기본값을 사용합니다.`, err);
    return fallback;
  }
}

// ─── site.yaml ──────────────────────────────────────────────

export interface SiteConfig {
  lab: {
    name_ko?: string;
    name_en?: string;
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
  links: Record<string, string>;
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

export interface CalendarsConfig {
  fetch: { mode: 'build' | 'runtime'; timeout_ms: number; fail_on_error: boolean };
  calendars: CalendarConfig[];
}

export const calendars = loadYaml<CalendarsConfig>('calendars.yaml', {
  fetch: { mode: 'build', timeout_ms: 8000, fail_on_error: false },
  calendars: [],
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

/** 사이트 표시 이름. 레이아웃 title 등에 씁니다. */
export const siteName = site.lab?.name_ko || site.lab?.name_en || 'ION Lab';

/** "TODO:" 로 시작하는 설정값은 아직 채워지지 않은 것으로 간주해 렌더에서 숨깁니다. */
export function filled(value: string | undefined | null): string | undefined {
  if (!value) return undefined;
  const trimmed = String(value).trim();
  if (!trimmed || trimmed.startsWith('TODO')) return undefined;
  return trimmed;
}
