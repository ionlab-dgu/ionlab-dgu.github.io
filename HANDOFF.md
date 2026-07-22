# HANDOFF

이 시스템의 아키텍처, 주요 결정 사항, 진행 상황을 정리한 문서입니다.

- **작업 규칙**(스키마 정본, 명명, 커밋 컨벤션)은 [CLAUDE.md](./CLAUDE.md)
- **셋업·개발·배포 방법**은 [README.md](./README.md)
- 이 문서는 **"왜 이렇게 되어 있는가"와 "지금 어디까지 왔는가"**를 다룹니다.

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
  conferences.yaml                          관심 학회 마감일 (5개 venue)
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
| `/publications`          | `publications/index.astro`              |
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

전체 **22페이지**가 빌드됩니다. 모든 페이지는 데이터가 없어도 EmptyState로 정상 렌더됩니다.

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
```

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
```

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
