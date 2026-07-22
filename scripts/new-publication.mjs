#!/usr/bin/env node
/**
 * 새 논문 스캐폴드. content/publications/<slug>.md
 * refs.bib 엔트리도 함께 추가합니다 (둘이 어긋나지 않도록).
 */
import fs from 'node:fs';
import path from 'node:path';
import {
  CONTENT,
  ask,
  askList,
  choose,
  slugify,
  listMembers,
  listDirSlugs,
  writeFile,
  yamlValue,
  yamlList,
  banner,
  done,
  close,
  confirm,
  dim,
  green,
  yellow,
} from './_lib.mjs';

banner('새 논문 추가');

const title = await ask('제목 (영문 원제)', { required: true });
const venue = await ask('발표처', { required: true, hint: '예: NeurIPS 2027 / IEEE TNSRE' });
const year = await ask('연도', { default: String(new Date().getFullYear()), required: true });

const type = await choose(
  '종류',
  [
    { label: '국제학술대회 (conference)', value: 'conference' },
    { label: '저널 (journal)', value: 'journal' },
    { label: '워크숍 (workshop)', value: 'workshop' },
    { label: '프리프린트 (preprint)', value: 'preprint' },
  ],
  { default: 0 },
);

const status = await choose(
  '상태',
  [
    { label: '심사 중 (under_review)', value: 'under_review' },
    { label: '게재 확정 (accepted)', value: 'accepted' },
    { label: '게재 (published)', value: 'published' },
  ],
  { default: 0 },
);

const venueShort = slugify(venue).split('-')[0] || 'venue';
const defaultSlug = `${year}-${venueShort}-${slugify(title).split('-').slice(0, 3).join('-')}`;
const slug = await ask('파일 slug', { default: defaultSlug, required: true });

const members = listMembers();
if (members.length) console.log(dim(`\n  등록된 멤버: ${members.join(', ')}`));
const authors = await askList('저자 (순서대로)', {
  hint: '랩 멤버는 member id, 외부인은 이름. 쉼표로 구분',
  required: true,
});

const projectSlugs = listDirSlugs('research');
if (projectSlugs.length) console.log(dim(`  기존 연구: ${projectSlugs.join(', ')}`));
const attributedProjects = await askList('이 논문이 나온 연구 slug');

const grantSlugs = listDirSlugs('grants');
if (grantSlugs.length) console.log(dim(`  기존 과제: ${grantSlugs.join(', ')}`));
console.log(dim('  ↑ 과제 실적으로 귀속되면 반드시 적어주세요. 리포트 집계의 근거입니다.'));
const attributedGrants = await askList('귀속 과제 slug');

const arxiv = await ask('arXiv ID', { hint: '예: 2607.00000' });
const code = await ask('코드 저장소 URL');

// bibkey: 제1저자 성 + 연도 + 제목 첫 단어
const firstAuthor = authors[0] ?? '';
const lastName = firstAuthor.includes('-')
  ? firstAuthor.split('-').pop()
  : firstAuthor.split(/\s+/).pop() || 'anon';
const titleWord = slugify(title).split('-')[0] || 'paper';
const bibkey = await ask('BibTeX 키', {
  default: `${String(lastName).toLowerCase()}${year}${titleWord}`,
});

const file = path.join(CONTENT, 'publications', `${slug}.md`);
writeFile(
  file,
  `---
slug: ${slug}
title: ${yamlValue(title)}
${yamlList('authors', authors)}
venue: ${yamlValue(venue)}
year: ${year}
type: ${type}
status: ${status}
${yamlList('attributed_grants', attributedGrants)}
${yamlList('attributed_projects', attributedProjects)}
arxiv: ${yamlValue(arxiv)}
code: ${yamlValue(code)}
pdf:
bibkey: ${yamlValue(bibkey)}
---

TODO: 초록 또는 2~3문장 요약. 목록 카드와 상세 페이지에 노출됩니다.
`,
);

// refs.bib 갱신
const bibFile = path.join(CONTENT, 'publications', 'refs.bib');
const entryType = type === 'journal' ? 'article' : 'inproceedings';
const containerField = type === 'journal' ? 'journal' : 'booktitle';
const bibAuthors = authors.map(toBibAuthor).join(' and ');

const entry = `
@${entryType}{${bibkey},
  title     = {${title}},
  author    = {${bibAuthors}},
  ${containerField.padEnd(9)} = {${venue}},
  year      = {${year}}${status === 'under_review' ? ',\n  note      = {Under review}' : ''}
}
`;

if (fs.existsSync(bibFile)) {
  const existing = fs.readFileSync(bibFile, 'utf-8');
  if (existing.includes(`{${bibkey},`)) {
    console.log(yellow(`  건너뜀  refs.bib 에 이미 ${bibkey} 가 있습니다`));
  } else if (await confirm('  refs.bib 에 엔트리를 추가할까요?', true)) {
    fs.appendFileSync(bibFile, entry, 'utf-8');
    console.log(green(`  추가  content/publications/refs.bib (${bibkey})`));
  }
} else {
  writeFile(bibFile, `% ION Lab publications — BibTeX 정본.\n${entry}`);
}

close();
done([
  `초록을 채우세요: content/publications/${slug}.md`,
  'refs.bib 의 저자명 표기(Last, First)가 맞는지 확인하세요',
  attributedGrants.length
    ? `과제 실적에 반영됨: ${attributedGrants.join(', ')}`
    : '과제 실적으로 귀속된다면 attributed_grants 를 채우세요',
]);

/** member id(ms-gildong-hong) 또는 이름을 BibTeX 저자 표기로. */
function toBibAuthor(a) {
  if (a.includes('-')) {
    // member id 형태로 보이면 접두사를 떼고 이름을 복원합니다.
    const parts = a.split('-');
    const known = ['intern', 'ms', 'phd', 'postdoc', 'pi', 'example'];
    while (parts.length > 2 && known.includes(parts[0])) parts.shift();
    if (known.includes(parts[0]) && parts.length > 1) parts.shift();
    const cap = parts.map((p) => p.charAt(0).toUpperCase() + p.slice(1));
    if (cap.length >= 2) return `${cap[cap.length - 1]}, ${cap.slice(0, -1).join(' ')}`;
    return cap.join(' ');
  }
  const words = a.trim().split(/\s+/);
  if (words.length >= 2) return `${words[words.length - 1]}, ${words.slice(0, -1).join(' ')}`;
  return a;
}
