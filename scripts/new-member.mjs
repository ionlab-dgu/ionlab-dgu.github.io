#!/usr/bin/env node
/** 새 멤버 프로필 스캐폴드. content/members/<id>.md */
import path from 'node:path';
import {
  CONTENT,
  ask,
  askList,
  choose,
  slugify,
  thisMonth,
  listDirSlugs,
  writeFile,
  yamlValue,
  yamlList,
  banner,
  done,
  close,
  dim,
} from './_lib.mjs';

banner('새 멤버 추가');

const ROLES = [
  { label: '학부 인턴', value: 'ug_intern', prefix: 'intern' },
  { label: '석사과정', value: 'ms', prefix: 'ms' },
  { label: '박사과정', value: 'phd', prefix: 'phd' },
  { label: '박사후연구원', value: 'postdoc', prefix: 'postdoc' },
  { label: 'PI', value: 'pi', prefix: 'pi' },
];

const nameKo = await ask('이름 (한글)', { required: true });
const nameEn = await ask('이름 (영문)', { hint: '예: Gildong Hong' });
const role = await choose('과정', ROLES, { default: 1 });
const prefix = ROLES.find((r) => r.value === role).prefix;

const defaultId = nameEn ? `${prefix}-${slugify(nameEn)}` : '';
const id = await ask('파일 id', {
  default: defaultId || undefined,
  required: true,
  hint: '파일명이자 다른 문서에서 참조할 키입니다. 나중에 바꾸기 번거로우니 신중히.',
});

const cohort = await ask('합류 연월', { default: thisMonth() });
const email = await ask('이메일');
const github = await ask('GitHub 사용자명', { hint: '@ 없이. 인증·권한 매핑에 쓰입니다.' });
const homepage = await ask('홈페이지/스칼라 URL');
const interests = await askList('관심 주제');

const projectSlugs = listDirSlugs('research');
if (projectSlugs.length) console.log(dim(`\n  기존 프로젝트: ${projectSlugs.join(', ')}`));
const projects = await askList('참여 연구 프로젝트 slug');

const grantSlugs = listDirSlugs('grants');
if (grantSlugs.length) console.log(dim(`  기존 과제: ${grantSlugs.join(', ')}`));
const grantSlug = await ask('참여 과제 slug', { hint: '없으면 비워두세요' });
const grantPct = grantSlug ? await ask('참여율 (%)', { default: '50' }) : '';

const grantsBlock = grantSlug
  ? `grants:\n  - grant_slug: ${grantSlug}\n    participation_pct: ${Number(grantPct) || 0}`
  : 'grants: []';

const file = path.join(CONTENT, 'members', `${id}.md`);
const content = `---
id: ${id}
name_ko: ${yamlValue(nameKo)}
name_en: ${yamlValue(nameEn)}
role: ${role}
cohort: ${yamlValue(cohort)}
advisor: pi-hyeryung-jang
${yamlList('projects', projects)}
${grantsBlock}
${yamlList('interests', interests)}
github: ${yamlValue(github)}
email: ${yamlValue(email)}
photo:${nameEn || id ? ` # /images/members/${id}.jpg` : ''}
homepage: ${yamlValue(homepage)}
---

TODO: 2~4문장 자기소개. 어떤 문제에 관심이 있고, 어떤 방법을 쓰는지.
공개 페이지(/members/${id})에 그대로 노출됩니다.
`;

writeFile(file, content);
close();
done([
  `본문의 TODO를 채우세요: content/members/${id}.md`,
  `사진을 넣으려면 public/images/members/${id}.jpg 에 두고 photo 필드를 채우세요`,
  'pnpm dev 로 /members 에서 확인',
]);
