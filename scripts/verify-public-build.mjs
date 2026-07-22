#!/usr/bin/env node
/**
 * 공개 빌드 산출물(dist/)에 private 콘텐츠가 섞이지 않았는지 검사합니다.
 *
 * `pnpm build:public` 직후에 돌리세요. CI가 매 푸시마다 자동으로 실행합니다.
 *
 * 검사 항목:
 *   1. dist/ 가 정상적으로 생성되었는가
 *   2. robots.txt 가 /internal/ 을 막고 있는가
 *   3. .private/ 의 문서 본문이 dist/ 에 나타나지 않는가
 *      (로컬에서 .private 가 연결돼 있을 때만 — CI에는 없으므로 자동으로 건너뜁니다)
 *   4. dist/ 안에 .private 경로 문자열이 남아 있지 않은가
 *
 * 3번이 핵심입니다. 사람이 매번 카나리를 심어 확인할 수는 없으므로,
 * 실제 private 문서에서 특징적인 문장을 뽑아 자동으로 대조합니다.
 */
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, green, red, yellow, dim, bold } from './_lib.mjs';

const DIST = path.join(ROOT, 'dist');
const PRIVATE_CONTENT = path.join(ROOT, '.private', 'content');

let failures = 0;
let checks = 0;

function pass(label) {
  checks++;
  console.log(`  ${green('✓')} ${label}`);
}

function fail(label, detail) {
  checks++;
  failures++;
  console.log(`  ${red('✗')} ${label}`);
  if (detail)
    console.log(
      detail
        .split('\n')
        .map((l) => `      ${l}`)
        .join('\n'),
    );
}

function skip(label, reason) {
  console.log(`  ${dim('–')} ${dim(label)} ${dim(`(${reason})`)}`);
}

console.log(`\n${bold('공개 빌드 격리 검사')}`);
console.log(dim('─'.repeat(24)));

// ── 1. dist 존재 ────────────────────────────────────────────
if (!fs.existsSync(path.join(DIST, 'index.html'))) {
  fail('dist/index.html 이 없습니다', 'pnpm build:public 을 먼저 실행하세요.');
  report();
}
pass('dist/ 생성됨');

const distFiles = walk(DIST);

// ── 2. robots.txt ───────────────────────────────────────────
const robotsPath = path.join(DIST, 'robots.txt');
if (!fs.existsSync(robotsPath)) {
  fail('robots.txt 가 없습니다', 'public/robots.txt 를 확인하세요.');
} else {
  const robots = fs.readFileSync(robotsPath, 'utf-8');
  if (/Disallow:\s*\/internal\//.test(robots)) pass('robots.txt 가 /internal/ 을 차단함');
  else fail('robots.txt 에 Disallow: /internal/ 이 없습니다', robots.trim());
}

// ── 3. private 본문 누출 ────────────────────────────────────
if (!fs.existsSync(PRIVATE_CONTENT)) {
  skip('private 본문 대조', '.private/ 가 연결되지 않음 — CI에서는 정상');
} else {
  const privateFiles = walk(PRIVATE_CONTENT).filter((f) => f.endsWith('.md'));
  if (privateFiles.length === 0) {
    skip('private 본문 대조', '.private/content 에 문서가 없음');
  } else {
    const leaks = [];
    for (const file of privateFiles) {
      for (const phrase of distinctivePhrases(file)) {
        for (const distFile of distFiles) {
          if (!/\.(html|js|json|txt|xml|bib)$/.test(distFile)) continue;
          const content = fs.readFileSync(distFile, 'utf-8');
          if (content.includes(phrase)) {
            leaks.push(
              `${path.relative(ROOT, file)}\n  → ${path.relative(DIST, distFile)}\n  발췌: "${phrase.slice(0, 60)}…"`,
            );
            break;
          }
        }
      }
    }
    if (leaks.length === 0) {
      pass(`private 문서 ${privateFiles.length}건이 dist/ 에 나타나지 않음`);
    } else {
      fail(`private 콘텐츠가 공개 빌드에 누출되었습니다 (${leaks.length}건)`, leaks.join('\n\n'));
    }
  }
}

// ── 4. private 소스 경로 누출 ───────────────────────────────
//
// Doc.source.path 가 화면에 새어 나온 경우를 잡습니다.
// 단순히 ".private/" 문자열을 찾으면 안 됩니다 — 우리 문서와 UI가 그 경로를
// **설명하려고** 언급하기 때문입니다(예: 출결 페이지에 표시되는 격리 원칙 문구).
// 그래서 실제 파일을 가리키는 형태(확장자로 끝나는 경로)만 검사합니다.
const SOURCE_PATH = /\.private\/[\w./-]+\.(md|mdx|jsonl?|ya?ml|bib)\b/;
const pathLeaks = distFiles
  .filter((f) => /\.(html|js|json|txt|xml)$/.test(f))
  .map((f) => ({ file: f, match: fs.readFileSync(f, 'utf-8').match(SOURCE_PATH) }))
  .filter((x) => x.match);

if (pathLeaks.length === 0) pass('dist/ 에 private 소스 경로 없음');
else
  fail(
    'private 파일 경로가 산출물에 남아 있습니다',
    pathLeaks.map((x) => `${path.relative(DIST, x.file)}: ${x.match[0]}`).join('\n'),
  );

report();

// ────────────────────────────────────────────────────────────

function report() {
  console.log('');
  if (failures > 0) {
    console.log(red(`${failures}/${checks} 검사 실패`));
    console.log(yellow('공개 빌드에 비공개 콘텐츠가 섞였을 수 있습니다. 배포하지 마세요.') + '\n');
    process.exit(1);
  }
  console.log(green(`${checks}/${checks} 검사 통과`) + '\n');
  process.exit(0);
}

/** 문서에서 대조에 쓸 만한 문장을 뽑습니다 (템플릿 상투구는 제외). */
function distinctivePhrases(file) {
  const raw = fs.readFileSync(file, 'utf-8');
  const body = raw.replace(/^---\n[\s\S]*?\n---\n/, '');
  return body
    .split('\n')
    .map((l) => l.replace(/^[#>\-*\s]+/, '').trim())
    .filter(
      (l) =>
        l.length >= 25 &&
        !l.startsWith('TODO') &&
        !l.startsWith('|') &&
        !/^[\[\]()`_*\s]+$/.test(l),
    )
    .slice(0, 5);
}

function walk(dir) {
  const out = [];
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}
