/**
 * new-*.mjs 스크립트가 공유하는 헬퍼.
 * 외부 의존성 없이 Node 내장 모듈만 씁니다 (스크립트 하나 돌리자고 install이 필요하면 안 되므로).
 */
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { stdin, stdout } from 'node:process';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const CONTENT = path.join(ROOT, 'content');

/*
 * 입력 처리.
 *
 * readline/promises 의 question() 을 그대로 쓰면 **파이프 입력에서 깨집니다**:
 * 비-TTY 입력은 버퍼 전체가 한 번에 들어와 'line' 이벤트가 연달아 발생하는데,
 * 대기 중인 question() 은 하나뿐이라 나머지 줄이 버려지고, EOF 이후의 질문은
 * 영영 resolve 되지 않습니다 ("Detected unsettled top-level await").
 *
 * 그래서 들어온 줄을 큐에 쌓아두고 하나씩 꺼내 씁니다.
 * 덕분에 `printf '...\n...' | pnpm new:member` 처럼 비대화형으로도 돌릴 수 있어
 * 테스트와 CI 스캐폴딩이 가능합니다.
 */
const rl = readline.createInterface({ input: stdin, output: stdout, terminal: stdin.isTTY });

const queue = [];
const waiters = [];
let closed = false;

rl.on('line', (line) => {
  const waiter = waiters.shift();
  if (waiter) waiter(line);
  else queue.push(line);
});

rl.on('close', () => {
  closed = true;
  // 남은 대기자는 빈 문자열로 풀어줍니다 (기본값/선택 항목으로 처리됨).
  while (waiters.length) waiters.shift()('');
});

function readLine() {
  if (queue.length) return Promise.resolve(queue.shift());
  if (closed) return Promise.resolve('');
  return new Promise((resolve) => waiters.push(resolve));
}

async function prompt(text) {
  stdout.write(text);
  const answer = await readLine();
  // 비-TTY 입력은 에코가 없으므로 무엇이 입력됐는지 로그에 남깁니다.
  if (!stdin.isTTY) stdout.write(`${answer}\n`);
  return answer;
}

export function close() {
  rl.close();
}

/** 색상 (TTY가 아니면 무색) */
const useColor = stdout.isTTY;
const c = (code) => (s) => (useColor ? `\x1b[${code}m${s}\x1b[0m` : s);
export const dim = c('2');
export const bold = c('1');
export const green = c('32');
export const yellow = c('33');
export const red = c('31');

/**
 * 한 줄 입력.
 * @param {string} question
 * @param {{ default?: string, required?: boolean, hint?: string }} opts
 */
export async function ask(question, opts = {}) {
  const { default: def, required = false, hint } = opts;
  if (hint) console.log(dim(`  ${hint}`));
  const suffix = def ? dim(` (${def})`) : required ? red(' *') : dim(' (선택)');
  for (;;) {
    const answer = (await prompt(`${question}${suffix}: `)).trim();
    if (answer) return answer;
    if (def) return def;
    if (!required) return '';
    console.log(red('  필수 항목입니다.'));
  }
}

/** 목록에서 하나 고르기. */
export async function choose(question, choices, opts = {}) {
  console.log(`\n${bold(question)}`);
  choices.forEach((ch, i) => {
    const label = typeof ch === 'string' ? ch : ch.label;
    const desc = typeof ch === 'string' ? '' : ch.description ? dim(` — ${ch.description}`) : '';
    console.log(`  ${i + 1}) ${label}${desc}`);
  });
  const def = opts.default !== undefined ? String(opts.default + 1) : undefined;
  for (;;) {
    const answer = (await prompt(`번호${def ? dim(` (${def})`) : ''}: `)).trim() || def;
    const idx = Number(answer) - 1;
    if (Number.isInteger(idx) && idx >= 0 && idx < choices.length) {
      const ch = choices[idx];
      return typeof ch === 'string' ? ch : ch.value;
    }
    console.log(red('  1~' + choices.length + ' 사이 번호를 입력하세요.'));
  }
}

/** 쉼표로 구분된 목록 입력 → 배열 */
export async function askList(question, opts = {}) {
  const answer = await ask(question, { ...opts, hint: opts.hint ?? '쉼표로 구분' });
  return answer
    ? answer
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    : [];
}

export async function confirm(question, def = true) {
  const answer = (await prompt(`${question} ${dim(def ? '(Y/n)' : '(y/N)')}: `))
    .trim()
    .toLowerCase();
  if (!answer) return def;
  return answer === 'y' || answer === 'yes';
}

/** 영문 kebab-case slug로 정규화 */
export function slugify(s) {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/** YYYY-MM-DD (KST) */
export function today() {
  const kst = new Date(Date.now() + 9 * 3600 * 1000);
  return kst.toISOString().slice(0, 10);
}

/** YYYY-MM (KST) */
export function thisMonth() {
  return today().slice(0, 7);
}

/** 이미 있는 멤버 id 목록 (참조 입력을 돕기 위해) */
export function listMembers() {
  try {
    return fs
      .readdirSync(path.join(CONTENT, 'members'))
      .filter((f) => f.endsWith('.md') && !f.startsWith('_'))
      .map((f) => f.replace(/\.md$/, ''));
  } catch {
    return [];
  }
}

export function listDirSlugs(subdir) {
  try {
    return fs
      .readdirSync(path.join(CONTENT, subdir), { withFileTypes: true })
      .filter((e) => e.isDirectory() && !e.name.startsWith('_'))
      .map((e) => e.name);
  } catch {
    return [];
  }
}

/** 파일 쓰기. 이미 있으면 덮어쓰지 않고 중단합니다. */
export function writeFile(filePath, content) {
  if (fs.existsSync(filePath)) {
    console.error(red(`\n이미 존재합니다: ${path.relative(ROOT, filePath)}`));
    console.error(dim('덮어쓰지 않고 중단합니다. 기존 파일을 확인하세요.'));
    process.exit(1);
  }
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf-8');
  console.log(green(`  생성  ${path.relative(ROOT, filePath)}`));
}

/** frontmatter 값 직렬화 (문자열은 필요할 때만 따옴표) */
export function yamlValue(v) {
  if (v === undefined || v === null || v === '') return '';
  if (Array.isArray(v)) return v.length === 0 ? '[]' : '';
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  const s = String(v);
  // 날짜처럼 보이거나 콜론/따옴표가 있으면 따옴표로 감쌉니다.
  if (/^\d{4}-\d{2}(-\d{2})?$/.test(s)) return `'${s}'`;
  if (/[:#'"[\]{}]|^\s|\s$/.test(s)) return `'${s.replace(/'/g, "''")}'`;
  return s;
}

/** 배열을 YAML 블록으로 */
export function yamlList(key, items, indent = '') {
  if (!items || items.length === 0) return `${indent}${key}: []`;
  return [`${indent}${key}:`, ...items.map((i) => `${indent}  - ${yamlValue(i)}`)].join('\n');
}

export function banner(title) {
  console.log(`\n${bold(title)}`);
  console.log(dim('─'.repeat(Math.max(20, title.length))));
  console.log(dim('빈 칸으로 두면 나중에 파일에서 채울 수 있습니다. Ctrl+C로 취소.'));
}

export function done(nextSteps = []) {
  console.log(`\n${green('완료')}`);
  if (nextSteps.length) {
    console.log('\n다음으로:');
    nextSteps.forEach((s) => console.log(`  · ${s}`));
  }
  console.log('');
}
