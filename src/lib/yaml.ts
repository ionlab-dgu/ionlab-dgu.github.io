/**
 * YAML 파싱 — 프로젝트 전체에서 이 함수만 씁니다.
 *
 * ⚠️ 기본 스키마를 쓰면 안 되는 이유:
 * js-yaml의 기본 스키마는 따옴표 없는 `2027-05-15` 를 JavaScript `Date` 객체로 바꿉니다.
 * 우리 스키마(src/lib/types.ts)는 날짜를 전부 `string`(YYYY-MM-DD)으로 선언하고 있고,
 * 정렬·비교·표시가 모두 문자열을 전제로 합니다. Date가 섞이면
 *   - `due.slice(0, 10)` 이 런타임에 터지고 (빌드 실패)
 *   - `{date}` 가 "Tue Jul 21 2026 09:00:00 GMT+0900" 로 렌더되고
 *   - 타임존 때문에 하루가 밀립니다 (KST 자정 = UTC 전날 15시)
 *
 * CORE_SCHEMA는 JSON과 동일한 타입만 해석하므로 날짜가 문자열로 남습니다.
 * 콘텐츠 작성자가 날짜에 따옴표를 붙이는지 여부에 결과가 좌우되지 않게 하는 것이 목적입니다.
 */
import yaml from 'js-yaml';

export function parseYaml<T = unknown>(source: string): T {
  return yaml.load(source, { schema: yaml.CORE_SCHEMA }) as T;
}

/** gray-matter 에 넘길 엔진 설정. frontmatter도 같은 규칙으로 파싱합니다. */
export const matterOptions = {
  engines: {
    yaml: (s: string) => parseYaml(s) as object,
  },
};
