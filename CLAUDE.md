# lab-os — 작업 지침

ION Lab(동국대 컴퓨터·AI학과)의 랩 운영 시스템입니다. 공개 홈페이지와 내부 도구를 겸합니다.

이 문서는 **이 저장소에서 작업할 때 지켜야 할 규칙**을 적습니다.
셋업·실행 방법은 [README.md](./README.md)를 보세요.

---

## 1. 가장 중요한 규칙: private 격리

민감한 콘텐츠(1:1 노트, 예산 세부, PI 개인 아이디어)는 **별도의 private 저장소**
(`ionlab-dgu/lab-os-private`)에만 존재합니다. 이 저장소에는 절대 들어오면 안 됩니다.

```
lab-os/            (public)   시스템 뼈대 + 공개 콘텐츠
lab-os-private/    (private)  민감 콘텐츠 오버레이
  └─ 로컬에서는 lab-os/.private 로 심볼릭 링크
```

### 지켜야 할 것

- **`.private/` 안의 파일을 이 저장소로 옮기지 마세요.** `.gitignore`가 막고 있지만,
  `git add -f` 같은 것으로 우회하지 마세요.
- **1:1 노트를 `content/` 아래에 만들지 마세요.** 로더가 발견하면 경고를 냅니다
  (`src/lib/content.ts`의 `getOneOnOnes`).
- 새 페이지에서 콘텐츠를 나열할 때, **공개 페이지라면 반드시 `publicOnly()` 또는
  `publicVisible()`를 통과**시키세요 (`src/lib/content.ts`).
- 공개 배포는 항상 `pnpm build:public`(= `PUBLIC_ONLY=1`)로 합니다.
  이 모드에서는 `.private/`가 디스크에 있어도 아예 읽지 않습니다.

### 검증 방법

민감 콘텐츠를 다루는 코드를 고쳤다면 직접 확인하세요:

```bash
pnpm build:public
pnpm verify:public
```

`verify:public`(`scripts/verify-public-build.mjs`)은 `.private/`가 연결돼 있으면
**그 문서의 실제 문장이 `dist/`에 나타나는지 대조**합니다. CI가 매 푸시마다 돌리고,
배포 워크플로는 이 검사를 통과해야만 push합니다.

검사기 자체가 동작하는지 확인하려면 일부러 깨보세요:

```bash
pnpm build          # private 포함 빌드
pnpm verify:public  # 실패해야 정상 (누출 파일과 문장을 지목합니다)
```

### Phase 1의 보안 경계

지금은 **로그인이 없습니다.** `/internal/*` 페이지는 정적으로 빌드되므로 인증으로
막을 수 없습니다. 지금 민감 정보를 지키는 것은 인증이 아니라 **"빌드에 포함하지 않는 것"**
입니다. 이 전제를 깨는 변경(예: private 콘텐츠를 공개 빌드에 넣기)은 하지 마세요.

GitHub OAuth + org 멤버십 검증은 Phase 2에서 붙입니다 (`src/lib/auth.ts`, `config/access.yaml`).

---

## 2. 콘텐츠 스키마

**스키마의 정본은 `src/lib/types.ts`입니다.** 각 타입의 `_template.md` frontmatter 주석은
그 사본이므로, 스키마를 바꾸면 **둘 다** 고쳐야 합니다.

| 타입            | 위치                                                       | 형태                                              |
| --------------- | ---------------------------------------------------------- | ------------------------------------------------- |
| Member          | `content/members/<id>.md`                                  | 단일 파일                                         |
| ResearchProject | `content/research/<slug>/`                                 | 폴더 (index + 부속 문서 + meetings/)              |
| Grant           | `content/grants/<slug>/`                                   | 폴더 (index + deliverables + reports + meetings/) |
| Publication     | `content/publications/<slug>.md`                           | 단일 파일 (+ `refs.bib`)                          |
| News            | `content/news/<slug>.md`                                   | 단일 파일                                         |
| Handbook        | `content/handbook/**/*.md`                                 | 섹션 폴더                                         |
| Dataset / Model | `content/datasets                                          | models/<slug>.md`                                 | 단일 파일 |
| Seminar         | `content/seminars/<date>-<type>.md`                        | 단일 파일                                         |
| LabSeminar      | `content/lab-seminars/<학기>/YYYY-MM-DD.md`                | 학기 폴더 (+ `_rotation-<학기>.yaml`)             |
| Conference      | `content/conferences.yaml`                                 | 단일 YAML                                         |
| Attendance      | `data/attendance/YYYY-MM.jsonl`                            | append-only JSONL                                 |
| ResearchPlan    | **private** `content/research-plans/<member-id>/<학기>.md` | 학생 폴더                                         |

### Seminar와 LabSeminar의 구분

- **Seminar** (`content/seminars/`): 초청 강연·외부 워크숍. 외부 연사가 옵니다.
- **LabSeminar** (`content/lab-seminars/`): 우리끼리 매주 하는 논문 발표(= 리딩 그룹).
  학기 폴더 아래 날짜 파일, 발표 순서는 `_rotation-<학기>.yaml` 한 장.
  `_` 로 시작하므로 로더가 세미나 노트로 오인하지 않습니다
  (`getSeminarRotations`가 따로 읽습니다).

### 연구(Research)와 과제(Grant)의 구분

혼동하기 쉬우니 분명히 해둡니다.

- **연구**: 학생 주도, 논문 기여가 목표, 라이프사이클이 유동적 (`status: idea → active → ...`)
- **과제**: PI 주도, 리포트 마감이 엄격, 산출 의무가 있음
- 관계는 **N:N**입니다. 한 연구가 여러 과제의 지원을 받고, 한 과제가 여러 연구를 커버합니다.
- 연결 고리: 연구의 `grants[]`, 과제의 `linked_research[]`,
  논문의 `attributed_grants[]` / `attributed_projects[]`.
- **논문의 `attributed_grants`가 과제 실적 집계의 근거**입니다
  (`getPublicationsByGrant`). 실적으로 들어갈 논문이면 반드시 채우세요.

### 명명 규칙

- **파일·폴더 slug**: 영문 kebab-case (`budget-aware-sparsification`)
- **member id**: `<역할접두사>-<영문이름-kebab>` (`ms-gildong-hong`, `phd-`, `postdoc-`, `pi-`, `intern-`)
  - 졸업 시 파일명·id는 **그대로 두고** `role: alumni` + `alumni_since`만 바꿉니다
    (다른 문서의 참조가 깨지지 않도록).
- **미팅 노트**: `YYYY-MM-DD-<type>.md` (`2026-07-20-weekly.md`, `-one_on_one`, `-reading`, `-grant`)
- **논문**: `<year>-<venue-short>-<keyword>.md`
- **`_` 로 시작하는 파일·폴더는 콘텐츠가 아닙니다** (`_template.md`, `_template/`).
  로더가 건너뜁니다. 초안을 숨기고 싶으면 `_` 를 붙이세요.
- **`example-` 접두사**는 렌더 확인용 seed입니다. 실제 콘텐츠가 채워지면 통째로 지우세요.

### 날짜

**모든 날짜는 `YYYY-MM-DD` 문자열입니다** (`start`, `cohort`는 `YYYY-MM`).
YAML 파싱은 `src/lib/yaml.ts`(CORE_SCHEMA)를 거치므로 따옴표 유무와 무관하게
문자열로 남습니다. **`js-yaml`을 직접 import 하지 마세요** — 기본 스키마는 날짜를
`Date` 객체로 바꿔 정렬·표시·D-day 계산을 모두 깨뜨립니다.

### 본문 작성

- 비어 있는 자리는 `TODO: [무엇을 쓸지 힌트]` 형태로 남깁니다.
- `config/site.yaml` 등 설정값도 `TODO:` 로 시작하면 렌더에서 자동으로 숨겨집니다
  (`filled()` in `src/lib/config.ts`). 확인하지 못한 정보를 추측해서 채우지 마세요.

---

## 3. 출결 데이터 원칙

`data/attendance/*.jsonl`은 **자기 보고**이며 append-only입니다.

- **통계·랭킹·리더보드를 만들지 마세요.** 누적 근무시간이나 출석률을 계산하는 함수를
  `src/lib/attendance.ts`에 추가하지 마세요. 감시 도구가 되는 순간 이 기능은 실패합니다.
- 노출하는 것은 **현재 상태**(재실/재택/외출/미출근)와 **인원수**뿐입니다.
- 개인 로그는 본인만 봅니다.
- 기존 이벤트를 수정·삭제하지 않습니다. 잘못 기록했으면 정정 이벤트를 새로 추가합니다.

이 원칙은 `config/access.yaml`의 `principles`에도 적혀 있고 `/internal/attendance`에 표시됩니다.

---

## 4. 코드 규칙

### 구조

```
src/lib/         데이터 로딩·도메인 로직 (여기에 로직을 모읍니다)
src/layouts/     BaseLayout → PublicLayout / InternalLayout
src/components/  common/ (공용) · public/ · internal/
src/pages/       라우팅. 로직보다 조립에 집중
config/          site·nav·calendars·access YAML
scripts/         콘텐츠 스캐폴드 CLI (의존성 없이 Node 내장 모듈만)
```

### 지켜야 할 것

- **모든 페이지는 데이터가 하나도 없어도 정상 렌더되어야 합니다.** 목록이 비면
  `EmptyState`로 "무엇을 하면 채워지는가"(파일 경로 또는 명령)를 알려주세요.
  빈 화면이나 크래시는 안 됩니다.
- **외부 fetch는 실패해도 빌드를 깨지 않습니다.** `gcal.ts`처럼 빈 배열을 반환하고
  경고만 남기세요. 캘린더가 안 열린다고 사이트가 배포되지 않으면 안 됩니다.
- **시각을 다룰 때 `new Date('2026-09-02T15:00:00')` 처럼 오프셋 없는 문자열을 쓰지 마세요.**
  실행 환경의 로컬 시간으로 해석돼 로컬(KST)과 CI(UTC)의 결과가 달라집니다.
  캘린더에서 실제로 9시간이 밀리는 버그가 있었습니다 — 아래 "캘린더 시각" 참고.
- **경로는 `src/lib/paths.ts`의 상수를 쓰세요.** `import.meta.url` 기준으로 루트를 계산하면
  빌드 시 `dist/.prerender/` 안으로 해석되어 조용히 깨집니다 (실제로 겪은 버그입니다).
- **Tailwind v4**: 컴포넌트 `<style>` 블록에서 `@apply`를 쓰려면 `@reference`가 필요합니다.
  그냥 `src/styles/global.css`에 정의하세요.
- 새 의존성은 신중히. 지금 런타임 의존성은 `astro`, `marked`, `js-yaml`, `gray-matter`뿐입니다.

### 캘린더 시각 (건드리기 전에 읽으세요)

iCal 파싱은 `src/lib/ical.ts`에 있습니다. `gcal.ts`는 가져오기·설정만 합니다.

- **`CalendarEvent.start`은 UTC입니다.** 정렬·비교에만 쓰세요.
  화면에 쓸 날짜·시각은 파싱 시점에 표시 시간대로 계산해 둔 `day`(YYYY-MM-DD)와
  `time`(HH:mm)입니다. **`start.slice(0, 10)`으로 날짜를 만들지 마세요** —
  KST 오전 8시 일정이 전날로 묶입니다.
- **`.astro`에서 `new Date()`를 부르지 마세요.** 그러라고 `day`/`time`을 미리 넣어 둡니다.
- 시간대 변환은 `Intl`(ICU 내장)로 합니다. luxon·date-fns-tz는 필요 없습니다.
  Asia/Seoul이 +09:00 고정이라고 상수로 처리하지 마세요 — 해외 학회 일정이
  하나만 들어와도 깨집니다.
- **반복 일정은 전개됩니다** (`expandEvents`). RRULE(WEEKLY/DAILY/MONTHLY +
  INTERVAL/COUNT/UNTIL/BYDAY/WKST), EXDATE, RECURRENCE-ID를 함께 처리합니다.
  RECURRENCE-ID를 빼먹으면 원래 시각의 유령 일정과 옮겨진 일정이 둘 다 뜹니다.
  못 다루는 규칙(BYSETPOS 등)을 만나면 전개를 포기하고 원본 한 건만 남깁니다 —
  틀린 날짜를 지어내지 않는 쪽이 낫기 때문입니다.
- 전개 범위는 `config/calendars.yaml`의 `fetch.expand_days`(기본 60)입니다.
  화면이 보여주는 범위보다 짧게 두면 일정이 조용히 사라집니다.
- 이 동작은 `test/ical.test.ts`가 지킵니다. **`TZ=Asia/Seoul`과 `TZ=UTC` 양쪽에서**
  돌려야 의미가 있습니다 (`pnpm test`가 두 번 돌립니다).

**캘린더 일정은 공개 빌드에 절대 들어가지 않습니다.**
`PUBLIC_ONLY=1`이면 `fetchAllEvents()`가 무조건 빈 배열을 반환합니다
(`src/lib/gcal.ts`). 이 줄을 지우거나 우회하지 마세요.

이게 필요한 이유: Phase 1에는 로그인이 없고 `/internal/*`도 정적으로 빌드돼
공개 URL로 나갑니다. 그래서 **"공개 페이지에만 안 쓰면 안전하다"가 성립하지
않습니다.** 실제로 `ical_url`을 채웠더니 `dist/internal/calendar/index.html`과
`dist/internal/index.html`에 미팅 제목("동경 미팅" 등)이 그대로 실렸습니다.

`config/calendars.yaml`의 모든 캘린더는 `visibility: internal` +
`default_visible_public: false`입니다. 공개 페이지에 일정을 내보내려면 두 값을
모두 뒤집어야 하고(`gcal.ts`의 `isPublicSafe`), 그 위에 `PUBLIC_ONLY` 게이트가
한 겹 더 있습니다. **일부러 세 겹입니다.** Phase 2에서 인증이 붙기 전까지
이 전제를 바꾸지 마세요.

### 브랜드 색 (건드리기 전에 읽으세요)

브랜드 골드 `#f1c232`는 **흰 배경 대비가 1.68:1**이라 본문·링크 텍스트로 쓸 수 없습니다
(WCAG AA는 4.5:1). 역할이 나뉘어 있습니다:

| 용도                    | 토큰                                    | 대비   |
| ----------------------- | --------------------------------------- | ------ |
| 채움 (버튼·밑줄·테두리) | `brand-400` `#f1c232` + `text-gray-950` | 11.8:1 |
| 라이트모드 텍스트·링크  | `brand-700` `#8e6e00`                   | 4.79:1 |
| 다크모드 텍스트·링크    | `brand-300` `#f5cf69`                   | 13.2:1 |

`bg-brand-400`에 흰 글씨를 얹거나 `text-brand-400`을 본문에 쓰지 마세요.
버튼은 `.btn-primary` 클래스를 쓰면 조합이 어긋나지 않습니다.

### 검증

변경 후 항상:

```bash
pnpm check    # astro check — 0 errors를 유지합니다
pnpm test     # node --test (TZ=Asia/Seoul, TZ=UTC 양쪽)
pnpm build    # 빌드 성공 확인
```

`pnpm dev`만으로는 부족합니다. **dev에서 되고 build에서 깨지는 문제가 실제로 있었습니다**
(경로 해석, Tailwind `@apply`, 캘린더 시간대). 커밋 전에 `pnpm build`를 돌리세요.

---

## 5. 커밋 · PR

### 커밋

Conventional Commits를 씁니다.

```
feat(pages): 내부 대시보드 추가
fix(content): 날짜가 Date 객체로 파싱되는 문제 수정
docs(handbook): 저자권 정책 보완
chore(deps): astro 7.2로 업데이트
```

스코프 예: `content`, `pages`, `lib`, `ui`, `brand`, `config`, `scripts`, `ci`, `handbook`

본문에는 **무엇을 했는지보다 왜 했는지**를 적습니다. 특히:

- 발견한 버그는 증상과 원인을 함께 적습니다 (다음 사람이 같은 함정을 피하도록).
- 트레이드오프를 선택했다면 근거를 남깁니다.
- 검증했다면 어떻게 검증했는지 적습니다.

### PR

- `main`에 직접 푸시하지 말고 브랜치 → PR로 갑니다.
- **콘텐츠만 고치는 PR**(마크다운 수정, 미팅 노트 추가)은 리뷰 없이 머지해도 됩니다.
- **`src/` 를 건드리는 PR**은 `pnpm check`와 `pnpm build`가 통과해야 합니다.
- private 격리에 영향을 주는 변경은 위 4절의 카나리 테스트 결과를 PR 본문에 적어주세요.

### 학생이 콘텐츠를 추가하는 흐름

마크다운만 고치면 되도록 설계돼 있습니다. 스캐폴드 스크립트를 안내하세요:

```bash
pnpm new:member       # 멤버 프로필
pnpm new:project      # 연구 프로젝트 (폴더 + 부속 문서 일괄 생성)
pnpm new:grant        # 과제
pnpm new:publication  # 논문 (+ refs.bib 엔트리)
```

---

## 6. 자주 헷갈리는 것

**Q. 미팅 노트는 어디에 두나요?**
주간 진행은 `content/research/<slug>/meetings/`, 과제는 `content/grants/<slug>/meetings/`,
랩 세미나(= 리딩 그룹)는 `content/lab-seminars/<학기>/`, 초청 강연은 `content/seminars/`,
**1:1은 private 저장소의 `content/one-on-ones/<member-id>/`**.
연구 계획서도 **private 저장소**의 `content/research-plans/<member-id>/<학기>.md` 입니다.

**Q. 연구를 공개 사이트에서 숨기려면?**
`status: archived`로 두면 공개 목록에서 빠지고 내부 목록에는 남습니다.
아예 숨기려면 private 저장소로 옮기세요.

**Q. 핸드북 문서를 내부 전용으로 두려면?**
frontmatter에 `visibility: internal`. `/handbook`에서는 빠지고 `/internal/handbook`에만 나옵니다.

**Q. 학회 마감일이 `content/conferences.yaml`에 있는데 맞나요?**
초안입니다. `verified_by`가 비어 있으면 확인되지 않은 날짜이고 `/internal/deadlines`에
경고가 뜹니다. 투고를 결정했다면 공식 CFP를 확인하고 `verified_by`/`verified_on`을 채우세요.
