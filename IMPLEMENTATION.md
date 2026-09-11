# IMPLEMENTATION

이 시스템이 실제로 어떻게 구현돼 있는지 정리한 문서입니다.

- **작업 규칙**(스키마 정본, 명명, 커밋 컨벤션)은 [CLAUDE.md](./CLAUDE.md)
- **셋업·개발·배포 방법**은 [README.md](./README.md)
- **결정·현황·로드맵**은 [labos-handoff.md](./labos-handoff.md)
- 이 문서는 **"코드가 왜 이렇게 되어 있는가"**를 다룹니다.

최종 갱신: 2026-07-22 · 기준 커밋 `6637b93`

---

## 1. 프로젝트 배경

**ION Lab** (Intelligence and Optimization in Networks Lab)
동국대학교 컴퓨터·AI학과, PI 장혜령. 6~10명 규모.

**목표**: 랩 관리·홈페이지·대시보드를 하나의 시스템으로 통합.

기존에 흩어져 있던 것들을 한 저장소로 모읍니다.

- 대외적으로는 연구실 홈페이지 (연구·논문·구성원·소식)
- 내부적으로는 운영 도구 (출결·일정·데드라인·미팅 노트·과제 관리)

**설계 원칙**: 콘텐츠는 전부 마크다운입니다. 학생과 PI가 파일만 편집하면
사이트가 확장되고, 별도의 CMS나 DB를 두지 않습니다.

---

## 2. 저장소 구조

| 저장소                            | 성격                   | 내용                      |
| --------------------------------- | ---------------------- | ------------------------- |
| `ionlab-dgu/ionlab-dgu.github.io` | **public** (이 저장소) | 시스템 뼈대 + 공개 콘텐츠 |
| `ionlab-dgu/lab-os-private`       | **private**            | 민감 콘텐츠 오버레이      |

로컬에서는 private 저장소를 `.private/`로 심볼릭 링크해 두 소스를 합쳐 봅니다.

```
ionlab-dgu.github.io/     ← 이 저장소 (로컬 폴더명은 자유)
  .private -> ../lab-os-private     (pnpm link:private)
lab-os-private/
  content/one-on-ones/<member-id>/YYYY-MM-DD-one_on_one.md
```

### ⚠️ Private 콘텐츠는 절대 이 저장소에 커밋하지 않습니다

- 1:1 노트, 예산 세부, PI 개인 아이디어는 `lab-os-private`에만 존재합니다
- `.private/` 안의 파일을 복사해 오지 마세요
- **1:1 노트를 `content/` 아래에 만들지 마세요** — 로더가 발견하면 경고를 냅니다
  (`src/lib/content.ts`의 `getOneOnOnes`)

> **저장소 이름 변경 이력**: 이 저장소는 `lab-os`로 시작해 `ionlab-dgu.github.io`로
> 이름이 바뀌었습니다. GitHub Pages org 사이트가 되어 루트 도메인에 배포하기 위해서입니다.
> 그래서 문서·주석에 `lab-os`라는 이름이 남아 있을 수 있습니다 (private 저장소는
> 여전히 `lab-os-private`입니다).

---

## 3. 기술 스택

| 항목         | 버전 (실제 설치 기준)                   |
| ------------ | --------------------------------------- |
| Astro        | 7.1.3                                   |
| TypeScript   | 5.9.3 (strict)                          |
| Tailwind CSS | 4.3.3 (`@tailwindcss/vite`, CSS-first)  |
| pnpm         | 10.34.5                                 |
| 마크다운     | `gray-matter` + `marked`                |
| YAML         | `js-yaml` (CORE_SCHEMA — 아래 4절 참고) |

### Node 버전 — 숫자가 세 군데 다른 이유

| 위치                      | 값          | 의미                          |
| ------------------------- | ----------- | ----------------------------- |
| `package.json` `engines`  | `>=22.12.0` | **계약**. Astro 7의 요구사항  |
| `.github/workflows/*.yml` | `24`        | **CI 실행 버전**. LTS로 고정  |
| 개발 맥북 (2026-07 기준)  | `26.5.0`    | 그냥 그 기계에 깔린 최신 버전 |

**26은 어디에도 요구사항으로 기록하지 않았습니다.** 특정 기계의 사정일 뿐이고,
다른 사람에게 강제하면 불필요한 제약이 됩니다. `>=22.12`만 지키면 됩니다.

> 세션 초기에 Node 20을 쓰다가 `pnpm install`이 engine 체크에서 막혀 업그레이드했습니다.
> **Node 20으로는 빌드가 되지 않습니다** (Astro 7이 `>=22.12` 요구, Node 20은 2026-04 EOL).

### 배포

GitHub Pages **네이티브 배포** (`actions/upload-pages-artifact` + `actions/deploy-pages`).
이 저장소가 곧 org 사이트이므로 외부 저장소로 push하지 않으며, **배포용 토큰이 필요 없습니다**
(OIDC · `id-token: write`).

- 사이트: https://ionlab-dgu.github.io
- `astro.config.mjs`: `site: 'https://ionlab-dgu.github.io'`, **`base` 없음** (루트 배포)
- 저장소 Settings → Pages → **Source: GitHub Actions**

> 초기에는 `lab-os` → `ionlab-dgu.github.io`로 결과물을 push하는 cross-repo 방식이었고
> `PAGES_DEPLOY_TOKEN`이 필요했습니다. 저장소 rename 이후 네이티브 배포로 전환했고
> 그 시크릿은 삭제했습니다.

---

## 4. Private 격리 — 3층 방어

이 시스템에서 가장 중요한 설계입니다. 한 층이 뚫려도 다음 층이 막습니다.

### 1층 — `.gitignore`

```
# PRIVATE OVERLAY — NEVER COMMIT.
.private/
```

private 콘텐츠가 애초에 이 저장소에 **커밋되지 않습니다**.

### 2층 — `PUBLIC_ONLY=1` (빌드 시 오버레이 비활성)

```bash
pnpm build:public    # = PUBLIC_ONLY=1 astro build
```

`src/lib/paths.ts`의 `hasPrivateOverlay()`가 `false`를 반환해,
`.private/`가 디스크에 **존재하더라도 읽지 않습니다**. 배포 워크플로는 항상 이 명령을 씁니다.

### 3층 — `verify:public` 게이트

```bash
pnpm verify:public   # scripts/verify-public-build.mjs
```

`dist/` 산출물을 검사합니다.

1. `dist/` 정상 생성 여부
2. `robots.txt`가 `/internal/`을 차단하는지
3. **`.private/` 문서의 실제 문장이 `dist/`에 나타나는지 대조** — 카나리를 심을 필요가 없습니다
   (`.private/`가 없으면 이 항목은 자동으로 건너뜁니다)
4. 유출된 private 소스 경로(`Doc.source.path`)가 있는지

**배포 워크플로에서 이 검사는 `upload-pages-artifact` 앞에 있습니다.**
따라서 검사가 실패하면 배포할 아티팩트 자체가 만들어지지 않습니다.

추가로 워크플로에는 `.private/` 디렉터리 존재 여부를 확인해 있으면 중단하는 단계가 있습니다.

### 검증된 사실 (실제로 돌려본 결과)

| 시나리오                                          | 결과                                                                      |
| ------------------------------------------------- | ------------------------------------------------------------------------- |
| `pnpm build` (오버레이 연결됨)                    | private 내용이 `/internal/one-on-ones`, `/internal/handbook`**에만** 등장 |
| 같은 빌드의 공개 `/handbook`                      | 내부 전용 문서 없음                                                       |
| `pnpm build:public` (`.private/`가 디스크에 존재) | `dist/` 전체에서 **0건**                                                  |
| 검사기 자체 검증                                  | 오버레이 포함 빌드에 대해 **실패**하며 누출 파일·문장을 지목              |

### Phase 1의 보안 경계에 대한 정직한 진술

**지금은 로그인이 없습니다.** `/internal/*`은 정적으로 빌드되므로 인증으로 막을 수 없습니다.
지금 민감 정보를 지키는 것은 **인증이 아니라 "빌드에 포함하지 않는 것"**입니다.

그래서 `/internal/one-on-ones`에는 "본인 것만 걸러내지 못하니 이 빌드를 공유하지 말라"는
경고가 표시됩니다. 이 전제를 깨는 변경(private을 공개 빌드에 포함)은 하면 안 됩니다.

---

## 5. 콘텐츠 구조

각 타입마다 **`_template`**(스키마 주석 + 빈 필드)과 **`example-*`**(렌더 확인용 seed)가 있습니다.
`_`로 시작하는 파일·폴더는 로더가 건너뜁니다. `example-*`는 실제 콘텐츠가 채워지면 삭제하면 됩니다.

```
content/
  conferences.yaml                          관심 학회 마감일 (30개 venue, D-180 이내)
  members/
    _template.md
    pi-hyeryung-jang.md                     ← 실제 프로필 (채우는 중)
    example-ms-gildong-hong.md
  research/
    _template/{index,reading,experiments,datasets,ideas}.md
    _template/meetings/_template.md
    example-efficient-gnn-inference/
      index.md  reading.md  experiments.md  datasets.md  ideas.md
      meetings/2026-07-20-weekly.md
  grants/
    _template/{index,deliverables,reports}.md
    _template/meetings/_template.md
    example-nrf-graph-optimization/{index,deliverables,reports}.md
  publications/
    _template.md
    example-2026-neurips-efficient-gnn.md
    refs.bib                                ← BibTeX 정본
  news/
    _template.md
    example-2026-07-lab-site-launch.md
  handbook/
    overview.md  faq.md
    onboarding/{intern,ms,phd}.md
    policies/{authorship,graduation,qualification,travel}.md
    tutorials/_template.md  tutorials/example-lab-server.md
  datasets/
    _template.md  example-graph-bench.md
  models/
    _template.md  example-sparse-gnn-v1.md
  seminars/
    _template.md  example-2026-07-15-reading.md

config/
  site.yaml         랩 이름·소개·연락처·연구분야
  nav.yaml          네비게이션 (public은 영문, internal은 한국어)
  calendars.yaml    Google Calendar iCal 설정
  access.yaml       접근 권한 스펙 (Phase 2 인증이 읽을 예정)

data/attendance/
  README.md         JSONL 포맷 스펙
  2026-07.jsonl     월별 append-only 로그
```

### 연구(Research)와 과제(Grant)의 이원화

|              | 연구      | 과제               |
| ------------ | --------- | ------------------ |
| 주도         | 학생      | PI                 |
| 목표         | 논문 기여 | 협약 산출 의무     |
| 라이프사이클 | 유동적    | 리포트 마감이 엄격 |

**관계는 N:N**입니다. 연결 고리:
연구의 `grants[]` · 과제의 `linked_research[]` ·
논문의 `attributed_grants[]` / `attributed_projects[]`.

**논문의 `attributed_grants`가 과제 실적 집계의 근거입니다**
(`getPublicationsByGrant` → `/internal/grants/<slug>`에 자동 집계).

---

## 6. URL 라우팅 (실제 구현됨)

### Public — 누구나

| 경로                     | 파일                                    |
| ------------------------ | --------------------------------------- |
| `/`                      | `src/pages/index.astro`                 |
| `/members`               | `members/index.astro`                   |
| `/members/[id]`          | `members/[id].astro`                    |
| `/research`              | `research/index.astro`                  |
| `/research/[slug]`       | `research/[slug].astro`                 |
| `/research/directions`   | `research/directions/index.astro`       |
| `/research/directions/[slug]` | `research/directions/[slug].astro` |
| `/publications`          | `publications/index.astro`              |
| `/publications/[slug]`   | `publications/[slug].astro`             |
| `/publications/refs.bib` | `publications/refs.bib.ts` (엔드포인트) |
| `/news`                  | `news/index.astro`                      |
| `/handbook`              | `handbook/index.astro`                  |
| `/join`                  | `join.astro`                            |
| `/404`                   | `404.astro`                             |

`/research/[slug]`는 **`index.md` 본문만** 렌더합니다.
실험 로그·아이디어·미팅 노트는 내부 라우트에만 나옵니다.

### Internal — 인증 필요 (Phase 1은 스텁)

| 경로                                               | 내용                                                            |
| -------------------------------------------------- | --------------------------------------------------------------- |
| `/internal`                                        | 대시보드: 재실 위젯 · 오늘 일정 · D-30 데드라인 · 최근 미팅 5건 |
| `/internal/attendance`                             | 체크인 UI (Phase 2까지 비활성) + 원칙 표시                      |
| `/internal/calendar`                               | GCal 통합 뷰 (60일)                                             |
| `/internal/deadlines`                              | 학회 + 과제 리포트 마감 통합                                    |
| `/internal/research` · `/internal/research/[slug]` | 실험·아이디어·미팅 노트 포함 full view                          |
| `/internal/grants` · `/internal/grants/[slug]`     | 산출물·보고서 일정·귀속 논문                                    |
| `/internal/meetings`                               | 미팅 노트 통합 피드                                             |
| `/internal/one-on-ones`                            | 1:1 노트 (private 연결 시에만)                                  |
| `/internal/handbook`                               | 공개 핸드북의 **상위집합** (내부 전용 문서 포함)                |

전체 **29페이지**가 빌드됩니다(`/research/directions` +4, `/publications/[slug]` +1).
모든 페이지는 데이터가 없어도 EmptyState로 정상 렌더됩니다.

---

## 7. 개체 스키마

**정본은 `src/lib/types.ts`입니다.** 각 `_template.md`의 frontmatter 주석은 그 사본이므로,
스키마를 바꾸면 둘 다 고쳐야 합니다. 아래는 실제 example 파일에서 확인한 필드입니다.

### Member — `content/members/<id>.md`

```yaml
id: example-ms-gildong-hong # 파일명과 동일. 다른 문서가 참조하는 키
name_ko: 홍길동
name_en: Gildong Hong
role: ms # ug_intern | ms | phd | postdoc | pi | alumni
cohort: 2026-03 # YYYY-MM
advisor: pi-hyeryung-jang
projects: [example-efficient-gnn-inference]
grants:
  - grant_slug: example-nrf-graph-optimization
    participation_pct: 70
interests: [graph neural networks, efficient inference]
github: example-gildong
email: gildong@example.com
photo: # /images/members/<id>.jpg — 없으면 이니셜 아바타
homepage: https://example.com/gildong
# 졸업 시: role을 alumni로, alumni_since / current_position 추가.
# 파일명·id는 그대로 둡니다 (참조가 깨지지 않도록).
```

### ResearchProject — `content/research/<slug>/index.md`

```yaml
slug: example-efficient-gnn-inference # 폴더명과 동일
title: Budget-Aware Sparsification for Scalable GNN Inference
status: active # idea | active | writing | submitted | accepted | paused | archived
lead: example-ms-gildong-hong
collaborators: [pi-hyeryung-jang]
target_venue: NeurIPS 2027
start: 2026-03 # YYYY-MM
grants: [example-nrf-graph-optimization]
tags: [graph neural networks, efficient inference, sparsification]
short: 한 줄 요약 (카드·목록에 노출)
direction: efficient-learning-inference # content/directions/<slug>.md 의 slug (선택)
```

### ResearchDirection — `content/directions/<slug>.md`

`ResearchProject`보다 한 단계 위의 분류입니다. 폴더가 아니라 단일 파일(Publication과
같은 형태)이고, 자주 바뀌지 않는 것을 전제로 합니다. `/research/directions`(목록)와
`/research/directions/<slug>`(상세, `direction === slug`인 공개 프로젝트 자동 리스트)로
노출됩니다.

```yaml
slug: efficient-learning-inference # 파일명과 동일
order: 2 # 화면 노출 순서, 낮을수록 먼저
name_en: Efficient Learning & Inference
name_ko: 효율적 학습·추론 # 선택 — 없으면 name_en만 노출
short: 대규모 AI 모델의 학습·추론 효율성 # 카드 요약
description: 상세 페이지에 노출되는 조금 더 긴 설명
topics: [Efficient model architectures and inference, ...]
status: active # active | emerging | paused
```

초기 3개(`generative-ai`, `efficient-learning-inference`, `applied-ai`)는 이전에
`config/site.yaml`의 `research_areas`(description이 전부 `TODO:`로 방치돼 있던 필드)가
하던 역할을 대체합니다. `research_areas`는 제거했습니다 — 분류 체계가 다른 두 섹션이
같은 `/research` 페이지에 공존하는 상태였기 때문입니다.

### Grant — `content/grants/<slug>/index.md`

```yaml
slug: example-nrf-graph-optimization
title_ko: (예시) 대규모 그래프 학습을 위한 효율적 추론·최적화 기술 개발
funder: 한국연구재단(NRF)
grant_number: 'EXAMPLE-2026-0000000'
period:
  start: 2026-03-01
  end: 2029-02-28
pi: pi-hyeryung-jang
co_pis: []
status: active # planned | active | reporting | closed
next_deadline:
  kind: interim_report # interim_report | final_report | 정산
  due: 2027-01-31 # 대시보드·/internal/deadlines가 읽는 필드
linked_research: [example-efficient-gnn-inference]
```

> 예산 **금액**은 여기에 적지 않습니다. 정본은 학교 연구비 시스템이고,
> 이 시스템은 대략적 일정·마감만 추적합니다.

### Publication — `content/publications/<slug>.md`

```yaml
slug: example-2026-neurips-efficient-gnn
title: Budget-Aware Graph Sparsification with Bounded Accuracy Loss
authors: [example-ms-gildong-hong, pi-hyeryung-jang] # 랩 멤버는 id, 외부인은 이름
venue: NeurIPS 2026
year: 2026
type: conference # conference | journal | workshop | preprint
status: under_review # under_review | accepted | published
attributed_grants: [example-nrf-graph-optimization] # ← 과제 실적 집계 근거
attributed_projects: [example-efficient-gnn-inference]
arxiv: '2607.00000'
code: https://github.com/ionlab-dgu/example-efficient-gnn
pdf:
bibkey: hong2026budget # refs.bib의 키와 일치해야 함
# type별 Metrics — type과 일치하는 블록만 채웁니다 (신설)
conference:
  tier: A* # A* | A | B | C
  acceptance_rate: 25.8
  main_or_findings: main # main | findings | workshop | short
badges: [] # 수동. best_paper | oral | highlight 전용 색, 그 외는 회색
```

`journal`(index_type, quartile, impact_factor, ranking) · `preprint`(venue) 블록도
같은 자리에 있고 `type`에 맞는 것만 씁니다. `getPublicationBadges()`
(`src/lib/content.ts`)가 이 값들에서 뱃지를 계산합니다:

| 조건                          | 뱃지        | 톤(`.badge-*`) |
| ----------------------------- | ----------- | -------------- |
| `journal.quartile === 'Q1'`   | `Q1`        | blue           |
| `conference.tier === 'A*'`    | `A*`        | blue           |
| `journal.ranking.percentile <= 10` | `Top X%` | gold      |
| `type === 'preprint'`         | `Preprint`  | neutral        |
| `badges[]`의 각 값            | 그 값       | gold/blue/green(알려진 값), 그 외 neutral |

`.badge-gold`는 이번에 추가한 뱃지 톤입니다 — 브랜드 골드(`brand-400`)는 대비
때문에 배경으로만 쓰고, 텍스트는 다른 뱃지와 같은 패턴으로 `brand-700`(라이트)
/ `brand-300`(다크)을 씁니다. `/publications/[slug].astro`(신설)가 상세 페이지이고
Metrics 섹션을 렌더합니다.

### AttendanceEvent — `data/attendance/YYYY-MM.jsonl`

append-only JSONL, 한 줄에 한 이벤트:

```json
{"user":"example-ms-gildong-hong","action":"checkin","at":"2026-07-21T09:12:03+09:00"}
{"user":"example-ms-gildong-hong","action":"break_out","at":"2026-07-21T12:30:00+09:00","note":"점심"}
```

| 필드     | 값                                                               |
| -------- | ---------------------------------------------------------------- |
| `user`   | member id                                                        |
| `action` | `checkin` \| `break_out` \| `break_in` \| `checkout` \| `remote` |
| `at`     | ISO 8601, KST 오프셋 포함                                        |
| `note`   | 선택                                                             |

파생 상태(`PresenceState`): `in_lab` / `on_break` / `remote` / `out`

#### 출결 원칙 (코드로 지켜야 할 제약)

- **통계·랭킹·리더보드를 만들지 않습니다.** 누적 근무시간·출석률 계산 함수를
  `src/lib/attendance.ts`에 추가하지 마세요. 감시 도구가 되는 순간 이 기능은 실패합니다.
- 노출하는 것은 현재 상태와 인원수뿐. 개인 로그는 본인만 열람.
- append-only. 잘못 기록했으면 정정 이벤트를 새로 추가합니다.

### 날짜 처리 (주의)

**모든 날짜는 `YYYY-MM-DD` 문자열입니다.** YAML 파싱은 반드시 `src/lib/yaml.ts`
(CORE_SCHEMA)를 거칩니다. `js-yaml`을 직접 import 하면 기본 스키마가 따옴표 없는
`2027-05-15`를 `Date` 객체로 바꿔서 정렬·표시·D-day 계산이 모두 깨집니다.
실제로 빌드가 `due.slice is not a function`으로 실패한 적이 있습니다.

---

## 8. 미팅 노트 3종

파일명은 모두 `YYYY-MM-DD-<type>.md` 입니다.

| 종류          | 위치                                                  | 템플릿                                             | 섹션                                                                   |
| ------------- | ----------------------------------------------------- | -------------------------------------------------- | ---------------------------------------------------------------------- |
| **주간 진행** | `content/research/<slug>/meetings/`                   | `content/research/_template/meetings/_template.md` | 지난 주 완료 / Blockers·질문 / 이번 주 계획 / PI 피드백 / Action items |
| **과제**      | `content/grants/<slug>/meetings/`                     | `content/grants/_template/meetings/_template.md`   | 진행 상황 / 데드라인 점검 / 결정 사항 / Action items                   |
| **리딩 그룹** | `content/seminars/`                                   | `content/seminars/_template.md`                    | 논문 요약 / 토론 / 우리 연구와 연결 / Take-aways                       |
| **1:1**       | **private 저장소** `content/one-on-ones/<member-id>/` | (private 저장소에 위치)                            | 오늘의 주제 / 논의 / 결정·다음 스텝 / 다음 1:1 전까지                  |

`type` 값: `weekly` · `grant` · `reading` · `one_on_one`

> 주간 미팅 노트는 **발표한 학생이** 미팅 당일에 씁니다.
> 네 종류 모두 `/internal/meetings` 통합 피드에 최신순으로 모입니다.

---

## 9. 개발 워크플로

### 실제 등록된 스크립트 (`package.json`)

| 명령                           | 설명                                                |
| ------------------------------ | --------------------------------------------------- |
| `pnpm dev`                     | 개발 서버 (기본 4321)                               |
| `pnpm build`                   | 빌드 (오버레이가 연결돼 있으면 포함)                |
| `pnpm build:public`            | **공개 배포용** — `PUBLIC_ONLY=1`, private 미포함   |
| `pnpm verify:public`           | 공개 빌드 격리 검사                                 |
| `pnpm preview`                 | 빌드 결과 미리보기                                  |
| `pnpm check`                   | `astro check` (타입 검사)                           |
| `pnpm format` / `format:check` | Prettier                                            |
| `pnpm link:private`            | `../lab-os-private` → `.private/` 심볼릭 링크       |
| `pnpm new:member`              | 멤버 프로필 스캐폴드                                |
| `pnpm new:project`             | 연구 프로젝트 (부속 문서 5개 + meetings/ 일괄 생성) |
| `pnpm new:grant`               | 과제                                                |
| `pnpm new:publication`         | 논문 (+ `refs.bib` 엔트리 동시 갱신)                |

`new:*` 스크립트는 외부 의존성 없이 Node 내장 모듈만 씁니다.
stdin을 줄 단위 큐로 읽으므로 **대화형과 파이프 입력 양쪽에서 동작**합니다
(테스트·CI 스캐폴딩 가능).

### 커밋 전 필수

```bash
pnpm check     # 0 errors 유지
pnpm build     # 빌드 성공 확인
```

**`pnpm dev`만으로는 부족합니다.** dev에서 되고 build에서 깨지는 문제가 실제로 두 번 있었습니다
(경로 해석, Tailwind `@apply`). 자세한 내용은 아래 11절.

### CI

| 워크플로     | 트리거           | 내용                              |
| ------------ | ---------------- | --------------------------------- |
| `ci.yml`     | PR · main push   | 타입 검사 + 공개 빌드 + 격리 검사 |
| `deploy.yml` | main push · 수동 | 빌드 → 격리 검사 → Pages 배포     |

CI는 private 저장소를 checkout 하지 않으므로, **오버레이 없이도 빌드된다는 증명**을 겸합니다.

### AI 도구 사용 지침

- **Claude Code**: [CLAUDE.md](./CLAUDE.md)가 작업 규칙입니다. private 격리 원칙,
  스키마 정본 위치, 출결 데이터 제약, 커밋 컨벤션이 들어 있습니다.
  코드를 고치는 작업은 이 문서를 먼저 읽도록 하세요.
- **그 외 도구(Cowork/Chat 등)**: 이 저장소에는 아직 관련 설정이나 규약이 없습니다.
  운용 방식이 정해지면 여기에 추가하세요. _(작성 시점 기준 미정)_

> 어떤 도구를 쓰든 지켜야 할 것은 하나입니다 —
> **private 콘텐츠를 이 저장소에 넣지 않는 것.**

---

## 10. 미확정 · 향후 작업

### 콘텐츠 TODO (추측으로 채우지 않고 남겨둔 것)

| 위치                                  | 내용                                                                                                                                             |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `config/site.yaml`                    | 이메일, 주소, PI GitHub 사용자명, 연구분야별 설명                                                                                                |
| `config/access.yaml`                  | `role_mapping.pi`의 GitHub 사용자명                                                                                                              |
| `config/calendars.yaml`               | Google Calendar ID·iCal 주소                                                                                                                     |
| `content/members/pi-hyeryung-jang.md` | 부임 연월, 자기소개                                                                                                                              |
| `content/handbook/`                   | 학과 규정 (졸업 요건·자격시험·출장비 한도), 랩 기본 원칙                                                                                         |
| `content/conferences.yaml`            | **학회 날짜가 예년 패턴 기반 초안입니다.** 투고 결정 시 공식 CFP 확인 후 `verified_by`/`verified_on` 기입 (`/internal/deadlines`에 경고 표시 중) |

`example-*` 콘텐츠는 실제 데이터가 들어오면 통째로 삭제하면 됩니다.

### Phase 2 — 인증 및 실제 대시보드 (예정)

- GitHub OAuth → `ionlab-dgu` org 멤버십 검증 → `config/access.yaml`의
  `role_mapping`으로 role 결정 → 라우트별 최소 권한 확인
- **SSR 어댑터 도입이 필요합니다** (현재 `output: 'static'`)
- 출결 체크인 버튼 실제 동작 (인증된 엔드포인트 또는 GitHub API로 JSONL append)
- `/internal/one-on-ones`의 owner 필터 (본인 것 + PI만)

스펙은 `config/access.yaml`과 `src/lib/auth.ts`에 준비되어 있습니다.

### Phase 3 — 자동화 (예정)

- arXiv digest
- Slack 통합 (데드라인 알림 D-14 / D-7 / D-3)

_두 항목 모두 아직 설계하지 않았습니다._

### 기타 미정

- **`.ac.kr` 도메인 신청** — 미정. 진행 시 `astro.config.mjs`의 `site` 변경과
  `public/CNAME` 추가가 필요합니다.

---

## 11. 알아두면 좋은 함정 (실제로 겪은 것)

빌드가 조용히 깨지거나 나중에 발목을 잡았던 것들입니다. 같은 실수를 반복하지 않도록 기록합니다.

**1. 저장소 루트를 `import.meta.url`로 계산하면 빌드에서 깨집니다**
Astro는 프리렌더 단계에서 번들을 `dist/.prerender/`에 두고 실행합니다. 거기서 두 단계를
올라가면 `dist/`가 루트로 잡혀 `content/`·`config/`를 못 읽고, `getStaticPaths()`가 빈 배열을
반환해 **상세 페이지가 하나도 생성되지 않습니다** (dev에서는 정상이라 발견이 늦습니다).
→ `src/lib/paths.ts`가 cwd에서 위로 올라가며 `package.json` + `content/`를 찾습니다.

**2. YAML 기본 스키마는 날짜를 `Date`로 바꿉니다**
`due.slice is not a function`으로 빌드가 실패했습니다. → `src/lib/yaml.ts` 경유 (3절·7절 참고).

**3. Tailwind v4는 컴포넌트 `<style>` 안의 `@apply`에 `@reference`를 요구합니다**
→ 스타일을 `src/styles/global.css`에 정의합니다.

**4. 브랜드 골드 `#f1c232`는 텍스트로 쓸 수 없습니다**
흰 배경 대비 1.68:1 (WCAG AA는 4.5:1). 역할이 나뉘어 있습니다:

| 용도                    | 토큰                                    | 대비   |
| ----------------------- | --------------------------------------- | ------ |
| 채움 (버튼·밑줄·테두리) | `brand-400` `#f1c232` + `text-gray-950` | 11.8:1 |
| 라이트모드 텍스트·링크  | `brand-700` `#8e6e00`                   | 4.79:1 |
| 다크모드 텍스트·링크    | `brand-300` `#f5cf69`                   | 13.2:1 |

버튼은 `.btn-primary` 클래스를 쓰면 조합이 어긋나지 않습니다.

**5. `readline/promises`의 `question()`은 파이프 입력에서 깨집니다**
비-TTY 입력은 버퍼가 한 번에 들어와 나머지 줄이 버려지고,
`Detected unsettled top-level await`로 죽습니다. → `scripts/_lib.mjs`가 줄을 큐에 쌓습니다.

---

## 12. 진행 상황 요약

| 항목                                | 상태              |
| ----------------------------------- | ----------------- |
| Astro + TS + Tailwind 스캐폴드      | ✅                |
| 콘텐츠 구조 (템플릿 + example seed) | ✅                |
| 콘텐츠 로더 + private 오버레이 병합 | ✅                |
| Public 페이지 11개                  | ✅                |
| Internal 페이지 11개                | ✅ (인증은 스텁)  |
| 격리 3층 방어 + 자동 검사           | ✅ 실제 검증 완료 |
| 스캐폴드 스크립트 4종               | ✅                |
| CI + Pages 배포                     | ✅ 라이브         |
| 실제 랩 콘텐츠 입력                 | ⏳ TODO (10절)    |
| 인증 (Phase 2)                      | ⏳ 미착수         |
| 자동화 (Phase 3)                    | ⏳ 미착수         |

**현재**: `astro check` 0 errors / 0 warnings / 0 hints · 22페이지 빌드 ·
https://ionlab-dgu.github.io 배포 중

---

## 13. Venue 동기화 확장 (Phase 1, 2026-09-11)

투고 대상 학회·저널을 **비공개 저장소에서** 통합 관리하기 시작했습니다.
공개 저장소의 `content/conferences.yaml`과 주간 aideadlines 수집은 그대로 돌아갑니다.

### 문서와 데이터가 어긋날 때: 파일이 정본

**숫자·경로·필드처럼 검증 가능한 항목은 실제 파일과 코드가 정본입니다.**
문서는 작성 시점의 스냅샷이고, 갱신이 늦거나 오기가 섞입니다.

이번에 실제로 겪은 사례입니다.

| 문서가 말한 것 | 실측 | 확인 방법 |
| --- | --- | --- |
| 시드 37개 (conference 26 + journal 11) | **39개 (27 + 12)** | `"id"` 키 39회 · 파싱 후 배열 길이 39 · id 중복 0 |
| 기존 venue 16개 | **30개** | `tracked_venues` 항목 수 |

`venue-dashboard-handoff.md` v2 (2026-09-09)의 "37개 (26+11)"는 오기입니다.
같은 문서가 기존 venue를 16개로 적은 것도 직전 세션의 30개 확장이 반영되지 않은
탓입니다. 시드 파일과 실제 `tracked_venues`가 정본입니다.

### venue 대조표 (2026-09-11)

재대조 비용을 줄이려고 남깁니다. 기준은 이름 정규화(대소문자·공백·하이픈 무시)이고,
시드 id의 연도 접미사를 떼어 계열 단위로 묶었습니다.

**a. 양쪽에 있음 — 17계열 / 18레코드**

AAAI · ACL · AISTATS · COLT · CVPR · ICASSP · ICCV · ICLR · ICML · ICRA ·
IJCAI · INTERSPEECH · IROS · KDD · NeurIPS(2026·2027 두 건) · UAI · WWW

**b. 시드에만 있음 — 21계열**

학회 9: ARR · FAccT · INFOCOM · MICCAI · MobiCom · MobiSys · NSDI · SenSys · SIGCOMM
저널 12: TMLR · JMLR · TPAMI · TNNLS · T-RO · RA-L · JBHI · IoT Journal · TKDE ·
TMC · ToN · Nature Machine Intelligence

**c. 공개 YAML에만 있음 — 13개**

ECCV · WACV · EMNLP · NAACL · **COLING** · CIKM · ICDM · WSDM · RSS · CoRL ·
ACM MM · ALT · SIGIR

검산: 17 + 21 = 38계열(= 시드 전체) · 17 + 13 = 30(= `tracked_venues` 전체).
누락도 중복도 없습니다.

### 편입 결과

c의 13개는 **삭제하지 않고** 편입했습니다. 실제로 들어간 것은 12개입니다.

- `confidence: estimated` · `source: tracker` · `notes: "PI 확인 대기"`
- `scope`는 `TODO: 스코프 확인 필요` — aideadlines가 주지 않는 값이라 추측하지 않았습니다
- 이벤트는 초록·논문·통보·개최 네 유형으로 변환

**COLING은 편입하지 못했습니다.** upstream에 파일이 없어 `url`(필수 필드)을
채울 근거가 없습니다. 주소를 지어내는 대신 보류했습니다.

**편입 12건 중 11건은 마감이 이미 지났습니다.** aideadlines에 2027 사이클이
아직 올라오지 않아, 받을 수 있는 최신 값이 종료된 사이클입니다 (ALT는 2025-10-02).

### upstream 미수집 venue

`huggingface/ai-deadlines`에 파일이 없어 자동 수집에서 조용히 빠집니다 (2026-09 확인).

**BMVC · EACL · SDM · COLING**

앞의 셋은 `tracked_venues`에 넣지 않았고, COLING은 넣었지만 수집되지 않습니다.
목록에 있는데 데이터가 안 오는 쪽이 더 위험합니다 — 추적 중이라고 착각하게 됩니다.

향후 선택지는 두 가지입니다. upstream에 네 venue를 PR로 올리거나, 랩의 실제
투고 계획을 확인한 뒤 수동 추적 대상으로 돌리는 것입니다. 지금은 둘 다 하지 않습니다.

### 통합 스키마

정본은 `lab-os-private/src/lib/venues/schema.ts`입니다. venue 하나가 `events[]`를
갖고 카드·타임라인·Slack 알림이 전부 거기서 파생됩니다.

핸드오프 §3의 모델을 골격으로 삼되 다섯 군데를 바꿨습니다.

1. **날짜를 `z.iso.date()`로 받습니다.** 핸드오프의 `z.string()`은 `2027-3-5`도
   `2027-02-29`도 통과시킵니다. 이 프로젝트는 날짜를 전부 `'YYYY-MM-DD'` 문자열로
   전제하므로(7절 "날짜 처리") 스키마가 그 전제를 지켜야 합니다.
2. **파일 전체 스키마를 더했습니다.** venue 단위만 보면 `tracks` 오타를 못 잡습니다.
   record 키를 enum으로 둬서 여섯 트랙과 열세 이벤트 유형이 모두 있는지 확인합니다.
3. **id 유일성을 파일 수준에서 막습니다.** 병합이 id를 키로 쓰므로 중복은 에러가
   아니라 조용한 데이터 손실로 나타납니다.
4. **kind별 필드 규칙은 경고로만 냅니다.** JBHI처럼 특집호 마감을 따로 운영하는
   저널이 있어서, 저널에 이벤트가 붙는 날이 옵니다.
5. **검증 함수가 예외를 던지지 않습니다.** `{ ok, data, errors, warnings }`를
   돌려주고 호출부가 정합니다 — 데이터 한 건 때문에 동기화가 멈추면 안 됩니다.

### `status`는 저장값이 아니라 계산값

같은 데이터라도 날짜가 지나면 상태가 달라집니다. 동기화할 때마다 다시 붙이고,
기준은 **아직 낼 수 있는가**입니다.

| 조건 | status |
| --- | --- |
| 제출 계열 이벤트(`registration`·`abstract`·`paper`·`supplementary`)가 남음 | `open` |
| 제출은 끝났고 통보·개최가 남음 | `in-progress` |
| 전부 지남 | `closed` |
| `events`가 비어 있음 (상시 투고 저널) | 설정하지 않음 |

"미래 이벤트가 하나라도 있으면 open"이라는 단순한 규칙은 쓰지 않았습니다.
그러면 시드가 `in-progress`로 적어 둔 NeurIPS 2026 · INFOCOM 2027 · AAAI-27이
전부 `open`이 됩니다. 이 셋은 마감이 끝나고 결과를 기다리는 상태입니다.
제출 이벤트를 기준으로 삼으니 세 건 모두 시드 값과 계산 결과가 일치했습니다 —
이것이 로직 검증이 됐습니다.

### confidence 운용

1. `confirmed` + `official-cfp`는 **자동으로 덮어쓰지 않습니다.** diff만 냅니다.
2. `estimated`만 트래커 값으로 갱신하고, 그때 `verifiedAt`을 올립니다.
3. `verifiedAt`이 60일을 넘으면 재확인 대상 목록에 들어갑니다.
4. `estimated` → `confirmed` 승격은 사람이 공식 CFP를 보고 손으로만 합니다.

이벤트를 통째로 갈아끼우지 않고 트래커가 주는 네 유형만 손댑니다. 시드에는
트래커에 없는 이벤트(ICRA의 RAS 저널 이전 마감, ARR의 커밋 마감, CVPR의 리버털)와
사람이 쓴 라벨이 있어서, 전체 교체는 그것들을 지워 버립니다.

### confidence 규칙 검증 사례 (2026-09-11)

**실제로 발견한 confirmed 불일치**

| venue | 필드 | 우리 (공식 CFP) | 트래커 |
| --- | --- | --- | --- |
| www-2027 | notification | 2026-12-10 | 2027-01-04 |
| aaai-27 | notification | 2026-11-30 | 2026-09-24 |

둘 다 통보일이라 Slack 알림 품질에는 영향이 없습니다. 시드 값을 유지했습니다.

**핸드오프 §4 사례 정정**

- *"WWW 2027 공식 10/25 대 트래커 10/18"* → **현재 해소됨.** upstream이 갱신해
  시드와 트래커가 모두 2026-10-25입니다. 초록 마감도 양쪽 10-18로 같습니다.
- *"CVPR 2027 공식 11/16 대 트래커 11/13"* → **잘못된 대조.** 트래커에 CVPR 2027
  레코드 자체가 없습니다. 11/13은 CVPR 2026의 마감(2025-11-13)입니다.

**교훈**: 핸드오프 문서의 사례는 참고용이고 실제 sync 결과가 정본입니다.
매 실행의 불일치는 `lab-os-private/content/venues/tracker-diffs.md`에 쌓이고,
의미 있는 것만 사람이 이 문서로 옮깁니다.

### 동기화가 confirmed를 지키는지 확인하는 법

통과하는 데이터로만 돌리면 규칙이 꺼져 있어도 알 수 없습니다.

```bash
cd lab-os-private
pnpm canary:sync    # 트래커 응답을 일부러 틀리게 만들어 넣고 5가지를 봅니다
```

confirmed 불변 · 불일치의 diff 보고 · estimated 갱신 · 트래커에 없는 이벤트
유형 보존 · 트래커가 모르는 venue 불변. 파일을 쓰지 않고 메모리에서만 돕니다.

### `raw/`를 커밋하는 이유

`lab-os-private/content/venues/raw/<날짜>.json`에 aideadlines 응답을 그대로 둡니다.
직전 응답이 남아 있어야 "트래커 값이 다르면 diff만 생성"이 성립합니다. 지우면
매 실행이 첫 실행이 되어 무엇이 바뀌었는지 알 수 없습니다. 공개 저장소가
`conferences-fetched.json`을 커밋하는 것과 같은 논리입니다.

### 공개 저장소를 건드리지 않는다 — 범위 확정

핸드오프 §0/§12의 원칙은 **코드와 데이터에 한정**합니다.
문서와 주석은 §11에 따라 갱신합니다.

| | 이번 Phase 1 |
| --- | --- |
| 금지 | `tracked_venues` 배열 변경 · `fetch-conferences.mjs` 로직 수정 · 새 파일 추가 |
| 허용 | `labos-handoff.md` · `IMPLEMENTATION.md` · `conferences.yaml`의 주석 |

동기화는 공개 저장소의 산출물(`src/data/conferences-fetched.json`)만 읽습니다.
비공개 쪽에서 공개 저장소에 쓰는 경로는 만들지 않았습니다.

`IMPLEMENTATION.md` 자동 갱신도 하지 않습니다. 비공개 워크플로가 공개 저장소를
고치려면 크로스 레포 토큰이 필요하고, 그것은 지금 지키는 격리를 스스로 뚫는 일입니다.

---

## 14. 알려진 한계

### 격리 검증 시스템의 사각지대 (2026-09-11 발견)

**현재 상태 (Phase 1 종료 시점)**

- `verify-public-build.mjs`의 본문 대조는 `.private/content/**/*.md`만 봅니다.
- Phase 1에서 만든 `seed.json` · `venues.json` · `raw/*.json`은 JSON이라 검사 대상 밖입니다.
- 지금은 어떤 로더도 이 JSON을 참조하지 않으므로 **실제 위험은 없습니다.**
- 격리 첫 층(`publicOnly()`)은 작동을 확인했습니다. 2026-09-11에 private 쪽
  `content/news/`에 표식을 심은 문서를 임시로 넣고 빌드한 결과, 코드 단계에서
  걸러져 산출물에 닿지 않았습니다. 확인 후 임시 파일은 지웠습니다.

**CLAUDE.md 카나리 규칙과의 괴리**

CLAUDE.md는 `pnpm build`로 private을 포함해 빌드한 뒤 `pnpm verify:public`이
**실패해야 정상**이라고 적고 있습니다. 실제로 돌리면 통과합니다.
private 저장소에 로더가 읽는 콘텐츠가 하나도 없기 때문입니다 — 연구 계획
템플릿은 이름이 `_`로 시작해 건너뛰어지고, README와 대조 기록은 콘텐츠 타입이
아닙니다. **카나리 규칙 자체는 유효하고, 지금은 카나리로 쓸 대상이 없습니다.**

**Phase 3 착수 전 결정할 것**

| 옵션 | 내용 | 장점 | 단점 |
| --- | --- | --- | --- |
| X | CLAUDE.md에 "격리 검증 시스템은 예외" 조항을 두고 `verify-public-build.mjs`를 JSON까지 확장 | 검사기 단일화 | 예외 조항이 다른 예외를 부름 |
| **Y (추천)** | `lab-os-private/scripts/verify-no-leak.mjs` 신설. 공개 빌드 산출물을 읽기 전용으로 검사하며 JSON까지 대조 | 원칙 유지 · 관심사 분리 | 검사기 이중화 |
| Z | 빌드 시 private에 카나리를 자동 주입하고 검증 후 삭제 | 파일 타입과 무관하게 실제 격리를 검증 | 셋업이 복잡 |

판단 기준은 Phase 3 대시보드의 요구사항입니다. 어떤 데이터를 로드하고 어떻게
렌더하는지가 정해지면 선택도 자명해집니다. 지금 결정을 강제하지 않습니다.

**미래 세션 액션 아이템**

- Phase 3 착수 전에 반드시 이 항목을 다시 볼 것.
- 대시보드가 `venues.json`을 참조하기 시작하는 순간부터 이 사각지대는
  실제 위험으로 바뀝니다.
