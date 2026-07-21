/**
 * 마크다운 본문 렌더링.
 *
 * 자체 로더로 읽은 문서의 body(문자열)를 HTML로 바꿉니다.
 * 콘텐츠는 우리 저장소에서 온 신뢰 가능한 소스이므로 별도 sanitize는 하지 않습니다.
 * (외부 입력을 렌더하게 되면 그때 sanitizer를 추가해야 합니다.)
 */
import { marked } from 'marked';

marked.setOptions({
  gfm: true,
  breaks: false,
});

export function renderMarkdown(body: string | undefined): string {
  if (!body || !body.trim()) return '';
  return marked.parse(body, { async: false });
}

/**
 * 본문 첫 문단을 요약으로. 목록 카드의 미리보기에 씁니다.
 * 마크다운 기호는 대충 걷어냅니다 (제목·링크·강조).
 */
export function excerpt(body: string | undefined, maxLength = 160): string {
  if (!body) return '';
  const firstPara =
    body
      .split(/\n\s*\n/)
      .map((p) => p.trim())
      .find((p) => p && !p.startsWith('#') && !p.startsWith('|') && !p.startsWith('<!--')) ?? '';

  const plain = firstPara
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[*_`>#]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (plain.length <= maxLength) return plain;
  return plain.slice(0, maxLength).trimEnd() + '…';
}

/** "TODO:" 로 시작하는 placeholder 본문인지. 목록에서 흐리게 표시할 때 씁니다. */
export function isPlaceholder(body: string | undefined): boolean {
  if (!body) return true;
  return /^\s*TODO[::]/.test(body.trim());
}
