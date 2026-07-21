/**
 * content/publications/refs.bib 를 그대로 서빙합니다.
 * (public/ 에 복사본을 두면 정본이 둘이 되어 어긋나므로, 빌드 시 원본을 읽습니다.)
 */
import fs from 'node:fs';
import path from 'node:path';
import type { APIRoute } from 'astro';
import { CONTENT_DIR } from '../../lib/paths';

export const GET: APIRoute = () => {
  const file = path.join(CONTENT_DIR, 'publications', 'refs.bib');
  let body = '';
  try {
    body = fs.readFileSync(file, 'utf-8');
  } catch {
    body = '% refs.bib 가 아직 없습니다.\n';
  }
  return new Response(body, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
