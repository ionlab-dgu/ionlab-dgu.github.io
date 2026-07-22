#!/usr/bin/env node
/**
 * 새 연구 프로젝트 스캐폴드.
 * content/research/<slug>/{index,reading,experiments,datasets,ideas}.md + meetings/
 */
import path from 'node:path';
import {
  CONTENT,
  ask,
  askList,
  choose,
  slugify,
  thisMonth,
  listMembers,
  listDirSlugs,
  writeFile,
  yamlValue,
  yamlList,
  banner,
  done,
  close,
  dim,
} from './_lib.mjs';

banner('새 연구 프로젝트 추가');
console.log(
  dim('연구(Research)는 학생 주도·논문 목표입니다. PI 주도의 과제는 pnpm new:grant 를 쓰세요.'),
);

const title = await ask('제목 (영문)', {
  required: true,
  hint: '논문 제목 초안이어도 좋습니다',
});
const slug = await ask('폴더 slug', {
  default: slugify(title).split('-').slice(0, 5).join('-'),
  required: true,
});

const status = await choose(
  '현재 상태',
  [
    { label: '구상 (idea)', value: 'idea', description: '아직 실험 전' },
    { label: '진행 중 (active)', value: 'active', description: '실험 진행 중' },
    { label: '집필 중 (writing)', value: 'writing' },
    { label: '심사 중 (submitted)', value: 'submitted' },
  ],
  { default: 0 },
);

const members = listMembers();
if (members.length) console.log(dim(`\n  등록된 멤버: ${members.join(', ')}`));
const lead = await ask('주도 학생 member id', { required: true });
const collaborators = await askList('공동 참여자 member id');

const targetVenue = await ask('목표 발표처', { hint: '예: NeurIPS 2027' });
const start = await ask('시작 연월', { default: thisMonth() });

const grantSlugs = listDirSlugs('grants');
if (grantSlugs.length) console.log(dim(`  기존 과제: ${grantSlugs.join(', ')}`));
const grants = await askList('지원 과제 slug', {
  hint: '이 연구를 지원하는 과제. 없으면 비워두세요',
});

const tags = await askList('태그');
const short = await ask('한 줄 요약', { hint: '카드·목록에 노출됩니다' });

const dir = path.join(CONTENT, 'research', slug);

writeFile(
  path.join(dir, 'index.md'),
  `---
slug: ${slug}
title: ${yamlValue(title)}
status: ${status}
lead: ${yamlValue(lead)}
${yamlList('collaborators', collaborators)}
target_venue: ${yamlValue(targetVenue)}
start: ${yamlValue(start)}
${yamlList('grants', grants)}
${yamlList('tags', tags)}
short: ${yamlValue(short)}
---

## 문제

TODO: 무엇이 풀리지 않았는가. 왜 중요한가.

## 접근

TODO: 어떤 방법으로 풀 것인가. 핵심 아이디어 한 문단.

## 현재 상태

TODO: 지금 어디까지 왔는가. 다음 마일스톤은 무엇인가.

## 관련 연구

TODO: 가장 가까운 선행 연구 2~3개와, 우리가 다른 점.
자세한 정리는 [reading.md](./reading.md).
`,
);

writeFile(
  path.join(dir, 'reading.md'),
  `---
type: reading_list
project: ${slug}
---

# 읽은 논문

프로젝트에 직접 관련된 논문만. 새 논문은 위에 추가(최신순).

| 날짜 | 논문 | 한 줄 요약 | 우리와의 관계 |
| --- | --- | --- | --- |
| ${thisMonth()}-01 | TODO: 저자, 제목, venue | TODO | TODO |

## 읽을 것

- [ ] TODO: 제목 — 왜 읽어야 하는지 한 줄

## 깊게 본 논문

### TODO: 논문 제목

- **문제**: TODO
- **기여**: TODO
- **방법**: TODO
- **한계**: TODO
- **우리에게**: TODO
`,
);

writeFile(
  path.join(dir, 'experiments.md'),
  `---
type: experiments
project: ${slug}
---

# 실험 로그

**규칙: 실패한 실험도 지우지 않습니다.** 왜 안 됐는지가 다음 실험의 근거입니다.
최신 실험을 위에 추가하세요.

## EXP-001 — TODO: 한 줄 제목

- **날짜**: TODO
- **가설**: TODO: 무엇이 참일 것이라 예상했는가
- **설정**: TODO: 데이터 / 모델 / 하이퍼파라미터 / 시드
- **코드**: TODO: commit hash
- **결과**: TODO: 기대와 달랐다면 그것도 결과입니다
- **해석**: TODO
- **다음**: TODO
`,
);

writeFile(
  path.join(dir, 'datasets.md'),
  `---
type: datasets
project: ${slug}
---

# 이 프로젝트가 쓰는 데이터

전역 레지스트리는 content/datasets/ 에 있습니다.
여기에는 **이 프로젝트에서의 사용 방식**만 적습니다.

## TODO: 데이터셋 이름

- **레지스트리**: content/datasets/TODO.md
- **위치**: TODO
- **전처리**: TODO
- **Split**: TODO
- **주의**: TODO
`,
);

writeFile(
  path.join(dir, 'ideas.md'),
  `---
type: ideas
project: ${slug}
---

# 아이디어 / 미해결 질문

설익어도 됩니다.

## 해볼 만한 것

- TODO: 아이디어 — 왜 될 것 같은지

## 답을 모르는 질문

- TODO: 질문 — 답하려면 무슨 실험이 필요한가

## 접었지만 기록해 둘 것

- TODO: 아이디어 — 왜 접었는가
`,
);

writeFile(path.join(dir, 'meetings', '.gitkeep'), '');

close();
done([
  `index.md 의 TODO를 채우세요: content/research/${slug}/index.md`,
  `주간 미팅 노트는 content/research/${slug}/meetings/YYYY-MM-DD-weekly.md 로 추가합니다`,
  `멤버 프로필(content/members/${lead}.md)의 projects 에 ${slug} 를 추가하세요`,
  `pnpm dev 로 /research/${slug} 확인`,
]);
