#!/usr/bin/env node
/**
 * ../lab-os-private 를 .private/ 로 심볼릭 링크합니다.
 *
 * 이렇게 하면 로컬 개발에서 두 저장소의 콘텐츠가 합쳐진 상태로 보이고,
 * .private/ 는 .gitignore 되어 있으므로 public 저장소에 섞여 들어가지 않습니다.
 *
 * CI에서는 이 스크립트를 쓰지 않습니다 — GitHub Actions가 GH_PAT로 .private/ 에 checkout 합니다.
 */
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, green, yellow, red, dim, bold } from './_lib.mjs';

const LINK = path.join(ROOT, '.private');
const DEFAULT_TARGET = path.resolve(ROOT, '..', 'lab-os-private');
const target = process.argv[2] ? path.resolve(process.argv[2]) : DEFAULT_TARGET;

console.log(`\n${bold('private 오버레이 연결')}`);
console.log(dim('─'.repeat(24)));

// 1. 대상 확인
if (!fs.existsSync(target)) {
  console.error(red(`\n대상을 찾을 수 없습니다: ${target}`));
  console.error(`
private 저장소를 먼저 클론하세요:

  ${dim('cd ' + path.dirname(ROOT))}
  ${dim('git clone git@github.com:ionlab-dgu/lab-os-private.git')}

다른 위치에 있다면 경로를 인자로 넘기세요:

  ${dim('pnpm link:private ../어딘가/lab-os-private')}
`);
  process.exit(1);
}

if (!fs.statSync(target).isDirectory()) {
  console.error(red(`\n디렉터리가 아닙니다: ${target}`));
  process.exit(1);
}

// 2. 기존 링크 정리
if (fs.existsSync(LINK) || fs.lstatSync(LINK, { throwIfNoEntry: false })) {
  const stat = fs.lstatSync(LINK);
  if (stat.isSymbolicLink()) {
    const current = fs.readlinkSync(LINK);
    const resolved = path.resolve(ROOT, current);
    if (resolved === target) {
      console.log(green(`\n이미 연결되어 있습니다: .private -> ${target}`));
      report();
      process.exit(0);
    }
    console.log(yellow(`기존 링크를 교체합니다 (${resolved} -> ${target})`));
    fs.unlinkSync(LINK);
  } else {
    // 심볼릭 링크가 아닌 실제 디렉터리/파일이면 건드리지 않습니다.
    // CI가 checkout 해 둔 것일 수 있고, 지우면 데이터가 날아갑니다.
    console.error(red(`\n.private 이 심볼릭 링크가 아닙니다: ${LINK}`));
    console.error(
      dim('실제 디렉터리로 보입니다. 내용을 확인하고 직접 정리하세요 (자동으로 지우지 않습니다).'),
    );
    process.exit(1);
  }
}

// 3. 링크 생성
fs.symlinkSync(target, LINK, 'dir');
console.log(green(`\n연결됨  .private -> ${target}`));
report();

function report() {
  const contentDir = path.join(LINK, 'content');
  if (!fs.existsSync(contentDir)) {
    console.log(
      yellow(`\n주의: ${path.join(target, 'content')} 가 없습니다.`) +
        dim('\nprivate 저장소는 content/ 아래에 오버레이할 콘텐츠를 두어야 합니다.'),
    );
    console.log(
      dim(
        '\n예상 구조:\n  content/one-on-ones/<member-id>/YYYY-MM-DD-one_on_one.md\n  content/handbook/...\n  content/research/<slug>/...',
      ),
    );
    return;
  }

  const count = countFiles(contentDir);
  console.log(dim(`\n오버레이 콘텐츠 ${count}개 파일을 인식했습니다.`));
  console.log(
    `\n이제 ${dim('pnpm dev')} 로 실행하면 내부 페이지에 private 콘텐츠가 함께 보입니다.`,
  );
  console.log(
    dim('공개 배포용 빌드는 pnpm build:public 으로 하세요 (private을 아예 읽지 않습니다).'),
  );
}

function countFiles(dir) {
  let n = 0;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) n += countFiles(full);
    else n += 1;
  }
  return n;
}
