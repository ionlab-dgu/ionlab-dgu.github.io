#!/usr/bin/env node
/**
 * 학회 데드라인을 aideadlines에서 받아와 src/data/conferences-fetched.json 에 캐시합니다.
 *
 *   node scripts/fetch-conferences.mjs
 *
 * .github/workflows/sync-conferences.yml 이 주 1회(월 03:00 KST) 돌립니다.
 *
 * ── 왜 캐시를 커밋하는가
 * 사이트는 이 JSON만 읽습니다. 빌드가 네트워크에 의존하면 upstream이 죽는 날
 * 배포가 멈춥니다 (CLAUDE.md §4: "외부 fetch는 실패해도 빌드를 깨지 않습니다").
 * 그래서 fetch는 워크플로에서만 일어나고, 결과물은 저장소에 들어옵니다.
 *
 * ── 왜 huggingface/ai-deadlines 인가
 * 원조 paperswithcode/ai-deadlines 는 2024-09-15 이후 푸시가 없고, 데이터의
 * 최신 마감이 2024-09-11 입니다. 그대로 쓰면 임박 마감이 영영 0건입니다.
 * huggingface/ai-deadlines 가 유지되고 있는 후속 저장소이고, venue별로 파일이
 * 쪼개져 있어(src/data/conferences/<source>.yml) 관심 venue만 골라 받을 수 있습니다.
 *
 * ── 실패해도 exit 0
 * upstream 장애로 워크플로가 빨개지면 아무도 안 봅니다. 받아온 게 하나도 없으면
 * 기존 캐시를 그대로 두고 경고만 남깁니다. 캐시는 오래된 채로 남지 그냥 사라지지 않습니다.
 *
 * ── js-yaml 을 쓰는 이유
 * scripts/ 는 원칙적으로 Node 내장 모듈만 씁니다 (설치 없이 돌리려고). 여기서는
 * 예외로 js-yaml(이미 devDependency)을 씁니다. upstream YAML이 중첩 배열
 * (deadlines[])을 쓰기 때문에, 직접 만든 미니 파서는 upstream 스키마가 바뀌는
 * 순간 조용히 틀린 날짜를 뱉습니다. 이 스크립트는 사람이 손으로 돌리는 스캐폴드가
 * 아니라 CI(= pnpm install 이후)에서만 도는 것이라 예외를 두는 편이 안전합니다.
 */
import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';
import { ROOT, CONTENT, green, red, yellow, dim, bold } from './_lib.mjs';

const CONFERENCES_YAML = path.join(CONTENT, 'conferences.yaml');
const OUT = path.join(ROOT, 'src', 'data', 'conferences-fetched.json');
const DEFAULT_BASE_URL =
  'https://raw.githubusercontent.com/huggingface/ai-deadlines/main/src/data/conferences';
const TIMEOUT_MS = 15_000;

/*
 * YAML 파싱은 반드시 CORE_SCHEMA 로 합니다.
 * 기본 스키마는 따옴표 없는 2027-05-15 를 Date 객체로 바꿔버리고, 우리 스키마는
 * 날짜를 전부 'YYYY-MM-DD' 문자열로 전제합니다 (src/lib/yaml.ts 의 같은 주석 참고).
 * upstream YAML도 예외가 아니라서 여기서도 같은 규칙을 씁니다.
 */
function parseYaml(source) {
  return yaml.load(source, { schema: yaml.CORE_SCHEMA });
}

/** 본문 마감으로 인정하는 deadlines[].type. 앞쪽이 우선입니다. */
const PAPER_DEADLINE_TYPES = ['paper', 'submission', 'full_paper'];

/** '2025-05-11 23:59:59' / '2025-05-11' / Date → 'YYYY-MM-DD'. 못 읽으면 undefined. */
function toDay(value) {
  if (!value) return undefined;
  const s = String(value).trim();
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(s);
  return m ? m[1] : undefined;
}

async function fetchText(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

/**
 * upstream 항목 하나를 우리 Conference 모양으로 정규화합니다.
 *
 * upstream은 두 가지 모양이 섞여 있습니다:
 *   신형: deadlines: [{ type: abstract|paper|notification, date, timezone }, ...]
 *   구형: deadline: '...', abstract_deadline: '...' (평평한 필드)
 * 둘 다 받습니다. 새 type이 생겨도 우리가 모르는 건 그냥 무시됩니다.
 */
function normalize(entry, venue) {
  const byType = {};
  if (Array.isArray(entry.deadlines)) {
    for (const d of entry.deadlines) {
      if (d?.type && d.date && !byType[d.type]) byType[d.type] = d;
    }
  }

  // 본문 마감의 type 이름이 venue마다 다릅니다 — 대부분 'paper' 인데 ICLR 등은
  // 'submission' 을 씁니다. 하나만 보면 그 venue가 통째로 0건이 됩니다.
  const paper = PAPER_DEADLINE_TYPES.map((t) => byType[t]).find(Boolean);
  const deadline = toDay(paper?.date) ?? toDay(entry.deadline);
  // 마감일이 없는 항목은 데드라인 목록에 쓸모가 없습니다.
  if (!deadline) return null;

  const location =
    [entry.city, entry.country].filter(Boolean).join(', ') ||
    entry.place ||
    entry.venue ||
    undefined;

  return {
    name: entry.title ?? venue.name,
    full_name: entry.full_name ?? undefined,
    year: typeof entry.year === 'number' ? entry.year : Number(entry.year) || undefined,
    abstract_deadline: toDay(byType.abstract?.date) ?? toDay(entry.abstract_deadline) ?? null,
    deadline,
    timezone: paper?.timezone ?? entry.timezone ?? undefined,
    notification: toDay(byType.notification?.date) ?? toDay(entry.notification),
    conference_date: toDay(entry.start),
    location,
    url: entry.link ?? entry.url ?? undefined,
    tags: entry.sub ? [String(entry.sub).toLowerCase()] : undefined,
    category: venue.category,
    source_id: entry.id ?? `${String(venue.source)}${entry.year ?? ''}`,
    // 자동 수집분임을 표시합니다. /internal/deadlines 의 "확인되지 않은 날짜" 경고는
    // 사람이 추측해 적은 항목에만 붙어야 하므로 이 필드로 갈라냅니다.
    source: 'aideadlines',
    verified_by: null,
    verified_on: null,
  };
}

/** undefined 필드를 떨어내 JSON diff를 조용하게 만듭니다. */
function compact(obj) {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined));
}

async function main() {
  console.log(`\n${bold('학회 데드라인 수집')}`);
  console.log(dim('─'.repeat(24)));

  let config;
  try {
    config = parseYaml(fs.readFileSync(CONFERENCES_YAML, 'utf-8')) ?? {};
  } catch (err) {
    console.log(`  ${red('✗')} content/conferences.yaml 을 읽지 못했습니다: ${err.message}`);
    process.exit(1);
  }

  const venues = (config.tracked_venues ?? []).filter((v) => v?.source);
  if (venues.length === 0) {
    console.log(`  ${yellow('!')} tracked_venues 가 비어 있습니다. 받을 것이 없습니다.`);
    console.log(dim('    content/conferences.yaml 의 tracked_venues 에 venue를 추가하세요.\n'));
    process.exit(0);
  }

  const source = config.external_source_base_url ?? DEFAULT_BASE_URL;
  console.log(dim(`  대상 ${venues.length}개 venue · ${source}\n`));

  const settled = await Promise.all(
    venues.map(async (venue) => {
      const url = `${source}/${venue.source}.yml`;
      try {
        const parsed = parseYaml(await fetchText(url));
        const entries = Array.isArray(parsed) ? parsed : (parsed?.conferences ?? []);
        const rows = entries
          .map((e) => normalize(e, venue))
          .filter(Boolean)
          .map(compact);
        console.log(`  ${green('✓')} ${venue.name.padEnd(9)} ${dim(`${rows.length}건`)}`);
        return { ok: true, rows };
      } catch (err) {
        console.log(`  ${red('✗')} ${venue.name.padEnd(9)} ${dim(String(err.message ?? err))}`);
        return { ok: false, rows: [] };
      }
    }),
  );

  const failed = settled.filter((r) => !r.ok).length;
  const rows = settled.flatMap((r) => r.rows);

  // 하나도 못 받았으면 upstream 장애로 보고 기존 캐시를 건드리지 않습니다.
  // 여기서 빈 배열을 써버리면 사이트의 데드라인이 통째로 사라집니다.
  if (rows.length === 0) {
    console.log(`\n  ${yellow('!')} 받아온 항목이 없습니다. 기존 캐시를 그대로 둡니다.`);
    process.exit(0);
  }

  // 오래 지난 학회까지 쌓아둘 이유가 없습니다. 작년 이후만 남깁니다
  // (직전 연도는 "지난 마감" 섹션과 실적 확인에 쓰입니다).
  const cutoff = String(new Date().getFullYear() - 1);
  const kept = rows
    .filter((r) => r.deadline >= `${cutoff}-01-01`)
    .sort((a, b) => a.deadline.localeCompare(b.deadline) || a.name.localeCompare(b.name));

  // generated_at 은 매번 달라지므로 내용 비교에서 뺍니다.
  // 그러지 않으면 워크플로가 변경이 없어도 주마다 커밋을 남깁니다.
  const payload = JSON.stringify(kept);
  let previous = null;
  try {
    previous = JSON.stringify(JSON.parse(fs.readFileSync(OUT, 'utf-8')).venues ?? null);
  } catch {
    // 캐시가 없거나 깨졌으면 새로 씁니다.
  }

  if (previous === payload) {
    console.log(`\n  ${dim('변경 없음')} — ${kept.length}건 (${path.relative(ROOT, OUT)})\n`);
    process.exit(0);
  }

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(
    OUT,
    JSON.stringify(
      {
        // 이 파일은 사람이 고치는 곳이 아닙니다. 열어본 사람이 바로 알도록 적어 둡니다.
        _comment:
          '자동 생성 파일입니다. 직접 고치지 마세요 — scripts/fetch-conferences.mjs 가 덮어씁니다.',
        generated_at: new Date().toISOString().slice(0, 10),
        source,
        venues: kept,
      },
      null,
      2,
    ) + '\n',
    'utf-8',
  );

  console.log(`\n  ${green('✓')} ${kept.length}건 저장 → ${path.relative(ROOT, OUT)}`);
  if (failed > 0) {
    console.log(`  ${yellow('!')} ${failed}개 venue 를 받지 못했습니다 (해당 venue만 빠집니다).`);
  }
  console.log('');
  // _lib.mjs 가 stdin readline 을 열어두므로 명시적으로 끝냅니다
  // (그러지 않으면 이벤트 루프가 살아 있어 프로세스가 안 죽습니다).
  process.exit(0);
}

await main();
