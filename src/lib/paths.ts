/**
 * 저장소 내 경로 상수와 private 오버레이 탐지.
 *
 * 두 개의 콘텐츠 소스가 있습니다:
 *   1. content/          — public 저장소(lab-os). 항상 존재.
 *   2. .private/content/ — private 저장소(lab-os-private) 오버레이. 없을 수 있음.
 *
 * .private/ 가 없어도 모든 것이 정상 동작해야 합니다. 이것이 public 빌드의 안전장치입니다.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

/** 저장소 루트 (src/lib/ 에서 두 단계 위) */
export const ROOT = path.resolve(here, '../..');

export const CONTENT_DIR = path.join(ROOT, 'content');
export const CONFIG_DIR = path.join(ROOT, 'config');
export const DATA_DIR = path.join(ROOT, 'data');
export const PRIVATE_DIR = path.join(ROOT, '.private');
export const PRIVATE_CONTENT_DIR = path.join(PRIVATE_DIR, 'content');
export const PRIVATE_DATA_DIR = path.join(PRIVATE_DIR, 'data');

/**
 * PUBLIC_ONLY=1 이면 private 오버레이를 아예 읽지 않습니다.
 * public 사이트 배포 워크플로가 이 플래그로 빌드해, 실수로 private이
 * 섞여 들어가는 것을 원천 차단합니다.
 */
export const PUBLIC_ONLY = process.env.PUBLIC_ONLY === '1';

let warned = false;

/** private 오버레이를 읽을 수 있는 상태인가. */
export function hasPrivateOverlay(): boolean {
  if (PUBLIC_ONLY) return false;
  try {
    return fs.statSync(PRIVATE_CONTENT_DIR).isDirectory();
  } catch {
    if (!warned) {
      warned = true;
      console.info(
        '[lab-os] .private/ 오버레이가 없습니다. public 콘텐츠만으로 빌드합니다. ' +
          '(로컬에서 private을 보려면: pnpm link:private)',
      );
    }
    return false;
  }
}

/**
 * 두 소스의 같은 하위 경로를 반환합니다. private이 없으면 public 하나만.
 * 예: contentRoots('members') → ['<root>/content/members', '<root>/.private/content/members']
 */
export function contentRoots(subdir = ''): Array<{ dir: string; private: boolean }> {
  const roots = [{ dir: path.join(CONTENT_DIR, subdir), private: false }];
  if (hasPrivateOverlay()) {
    roots.push({ dir: path.join(PRIVATE_CONTENT_DIR, subdir), private: true });
  }
  return roots.filter((r) => {
    try {
      return fs.statSync(r.dir).isDirectory();
    } catch {
      return false;
    }
  });
}

/** 저장소 루트 기준 상대 경로로 바꿔 로그·디버깅에 쓰기 좋게 만듭니다. */
export function relFromRoot(abs: string): string {
  return path.relative(ROOT, abs);
}
