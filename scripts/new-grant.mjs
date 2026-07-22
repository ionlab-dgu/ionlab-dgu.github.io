#!/usr/bin/env node
/** 새 과제 스캐폴드. content/grants/<slug>/{index,deliverables,reports}.md + meetings/ */
import path from 'node:path';
import {
  CONTENT,
  ask,
  askList,
  choose,
  slugify,
  today,
  listDirSlugs,
  writeFile,
  yamlValue,
  yamlList,
  banner,
  done,
  close,
  dim,
} from './_lib.mjs';

banner('새 과제 추가');
console.log(
  dim(
    '과제(Grant)는 PI 주도·리포트 마감이 엄격합니다. 학생 주도 연구는 pnpm new:project 를 쓰세요.',
  ),
);
console.log(dim('예산 금액의 정본은 학교 연구비 시스템입니다. 여기에는 일정만 적습니다.'));

const titleKo = await ask('과제명 (국문)', { required: true, hint: '협약서 기준' });
const slug = await ask('폴더 slug', {
  default: slugify(titleKo) || undefined,
  required: true,
  hint: '영문 kebab-case. 예: nrf-mid-career-2027',
});

const funder = await ask('지원기관', { default: '한국연구재단(NRF)' });
const grantNumber = await ask('과제번호');
const periodStart = await ask('시작일', { default: today(), hint: 'YYYY-MM-DD' });
const periodEnd = await ask('종료일', { hint: 'YYYY-MM-DD' });

const status = await choose(
  '상태',
  [
    { label: '수행 중 (active)', value: 'active' },
    { label: '예정 (planned)', value: 'planned' },
    { label: '보고 중 (reporting)', value: 'reporting' },
    { label: '종료 (closed)', value: 'closed' },
  ],
  { default: 0 },
);

const deadlineKind = await choose(
  '다음 마감 종류',
  [
    { label: '연차실적보고서', value: 'interim_report' },
    { label: '최종보고서', value: 'final_report' },
    { label: '정산', value: '정산' },
  ],
  { default: 0 },
);
const deadlineDue = await ask('다음 마감일', {
  hint: 'YYYY-MM-DD. 대시보드와 /internal/deadlines 가 이 값을 읽습니다',
});

const projectSlugs = listDirSlugs('research');
if (projectSlugs.length) console.log(dim(`\n  기존 연구: ${projectSlugs.join(', ')}`));
const linkedResearch = await askList('이 과제로 지원하는 연구 slug');

const coPis = await askList('공동연구원', { hint: 'member id 또는 이름' });

const nextDeadlineBlock = deadlineDue
  ? `next_deadline:\n  kind: ${deadlineKind}\n  due: ${yamlValue(deadlineDue)}`
  : 'next_deadline: null';

const dir = path.join(CONTENT, 'grants', slug);

writeFile(
  path.join(dir, 'index.md'),
  `---
slug: ${slug}
title_ko: ${yamlValue(titleKo)}
funder: ${yamlValue(funder)}
grant_number: ${yamlValue(grantNumber)}
period:
  start: ${yamlValue(periodStart)}
  end: ${yamlValue(periodEnd)}
pi: pi-hyeryung-jang
${yamlList('co_pis', coPis)}
status: ${status}
${nextDeadlineBlock}
${yamlList('linked_research', linkedResearch)}
---

## 과제 개요

TODO: 협약서 기준 목표를 2~3문장으로.

## 연차별 목표

- **1차년도**: TODO
- **2차년도**: TODO

## 참여 연구원

TODO: 누가 몇 % 참여인지. (정본은 협약서/학교 시스템)
`,
);

writeFile(
  path.join(dir, 'deliverables.md'),
  `---
type: deliverables
grant: ${slug}
---

# 산출물 의무 및 달성 현황

협약서의 정량 목표를 그대로 옮기고 달성분을 채웁니다.
논문의 attributed_grants 에 \`${slug}\` 를 적으면 /internal/grants/${slug} 에서 자동 집계됩니다.

| 항목 | 목표 | 달성 | 비고 |
| --- | --- | --- | --- |
| SCI(E) 논문 | TODO: 0편 | 0편 | |
| 국제학술대회 | TODO: 0편 | 0편 | |
| 국내학술대회 | TODO: 0편 | 0편 | |
| 특허 출원 | TODO: 0건 | 0건 | |
| 인력 양성 | TODO: 석사 0명 | 0명 | |

## 달성 목록

TODO: 달성한 산출물을 나열 (publication slug 링크).
`,
);

writeFile(
  path.join(dir, 'reports.md'),
  `---
type: reports
grant: ${slug}
---

# 보고서 일정

**데드라인이 가장 엄격한 문서입니다.** 날짜가 바뀌면 index.md 의 next_deadline 도 함께 갱신하세요.

| 종류 | 마감 | 상태 | 담당 | 비고 |
| --- | --- | --- | --- | --- |
| 연차실적보고서 | ${deadlineDue || 'YYYY-MM-DD'} | 예정 | pi | |
| 연차정산 | YYYY-MM-DD | 예정 | 행정 | |
| 최종보고서 | ${periodEnd ? periodEnd.slice(0, 4) + '-MM-DD' : 'YYYY-MM-DD'} | 예정 | pi | |

상태: 예정 → 작성중 → 제출 → 승인

## 제출 이력

아직 제출한 보고서가 없습니다.
`,
);

writeFile(path.join(dir, 'meetings', '.gitkeep'), '');

close();
done([
  `index.md 와 deliverables.md 의 TODO를 협약서 기준으로 채우세요`,
  `참여 학생의 프로필(content/members/*.md)에 grants 항목을 추가하세요`,
  deadlineDue
    ? `마감 ${deadlineDue} 이 /internal/deadlines 에 표시됩니다`
    : `next_deadline 을 채우면 데드라인 화면에 표시됩니다`,
]);
