/**
 * 인증 · 인가 — Phase 1 스텁.
 *
 * ─── 현재 상태 (Phase 1) ─────────────────────────────────────
 * 정적 사이트이므로 **실제 인증이 없습니다.** /internal/* 페이지는 빌드되지만
 * "인증 필요" 안내를 함께 보여줍니다. 진짜 비밀은 이 저장소에 두지 않는 것으로 지킵니다:
 *   - 민감 콘텐츠는 lab-os-private 저장소에만 존재
 *   - public 배포는 PUBLIC_ONLY=1 로 빌드해 private을 아예 읽지 않음
 *
 * 즉 Phase 1의 보안 경계는 "인증"이 아니라 **"빌드에 포함하지 않는 것"** 입니다.
 * /internal 페이지에 표시되는 내부 데이터는 private 없이 빌드하면 비어 있게 됩니다.
 *
 * ─── Phase 2 계획 ────────────────────────────────────────────
 * GitHub OAuth → ionlab-dgu org 멤버십 검증 → config/access.yaml 의 role_mapping으로
 * role 결정 → 라우트별 최소 권한(routes) 확인. SSR 어댑터 도입이 필요합니다.
 */
import { access } from './config';
import { PUBLIC_ONLY } from './paths';
import type { AccessLevel } from './config';
import type { MemberRole } from './types';

export type Role = 'anonymous' | 'member' | 'pi';

export interface Session {
  authenticated: boolean;
  role: Role;
  /** 로그인한 사용자의 member id. Phase 1에서는 항상 undefined. */
  memberId?: string;
  githubLogin?: string;
}

const ANONYMOUS: Session = { authenticated: false, role: 'anonymous' };

/** 인증이 아직 붙지 않았는지. 페이지는 이 값으로 안내 배너를 띄웁니다. */
export function isStubMode(): boolean {
  return access.auth?.stub_mode !== false;
}

/**
 * 현재 세션. Phase 1에서는 언제나 익명입니다.
 *
 * Phase 2에서는 요청 컨텍스트(Astro.cookies / Astro.request)를 받아
 * 세션 쿠키를 검증하도록 시그니처를 확장합니다.
 */
export function getSession(): Session {
  if (isStubMode()) return ANONYMOUS;
  // Phase 2: 세션 쿠키 검증 → org 멤버십 확인 → role 매핑
  return ANONYMOUS;
}

/** 라우트에 필요한 최소 권한을 config/access.yaml 에서 찾습니다. */
export function requiredLevel(pathname: string): AccessLevel {
  const routes = access.routes ?? {};
  if (routes[pathname]) return routes[pathname];

  // 와일드카드 매칭: '/internal/research/*'
  for (const [pattern, level] of Object.entries(routes)) {
    if (!pattern.endsWith('/*')) continue;
    const prefix = pattern.slice(0, -2);
    if (pathname.startsWith(prefix + '/')) return level;
  }

  // 명시되지 않은 /internal/* 은 보수적으로 member 이상
  return pathname.startsWith('/internal') ? 'member' : 'public';
}

/** 세션이 해당 권한을 만족하는가. */
export function hasAccess(session: Session, level: AccessLevel, ownerId?: string): boolean {
  switch (level) {
    case 'public':
      return true;
    case 'member':
      return session.authenticated;
    case 'pi':
      return session.role === 'pi';
    case 'owner':
      if (session.role === 'pi') return true;
      return session.authenticated && !!ownerId && session.memberId === ownerId;
  }
}

/**
 * 페이지에서 쓰는 가드. Phase 1에서는 차단하지 않고 "안내를 띄워야 하는가"만 알려줍니다.
 * (정적 빌드라 리다이렉트로 막아도 실효가 없고, 실제 보호는 콘텐츠 격리가 담당합니다.)
 */
export interface Guard {
  session: Session;
  level: AccessLevel;
  allowed: boolean;
  /** true면 페이지 상단에 "인증 필요" 안내를 표시합니다. */
  showAuthNotice: boolean;
}

export function guard(pathname: string, ownerId?: string): Guard {
  const session = getSession();
  const level = requiredLevel(pathname);
  const allowed = hasAccess(session, level, ownerId);
  return {
    session,
    level,
    allowed,
    showAuthNotice: level !== 'public' && !allowed,
  };
}

/** member role → 세션 role. Phase 2에서 role_mapping과 함께 씁니다. */
export function roleFromMember(memberRole: MemberRole | undefined): Role {
  if (memberRole === 'pi') return 'pi';
  if (!memberRole) return 'anonymous';
  return 'member';
}

/**
 * 이 빌드가 public 전용인가. 페이지에서 internal 데이터가 왜 비었는지 안내할 때 씁니다.
 */
export function isPublicOnlyBuild(): boolean {
  return PUBLIC_ONLY;
}
