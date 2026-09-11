# ION Lab OS — HANDOFF

랩 관리 시스템 `lab-os` 아키텍처·결정사항·현황 정리 문서.
새 Claude 세션에서 컨텍스트 로딩용, 학생 온보딩용, 결정 기록용.

Last updated: 2026-09 (v3.2 — Venue sync Phase 1 완료 반영)

---

## 1. 프로젝트 배경

- **연구실**: ION Lab (Intelligence and Optimization in Networks)
- **소속**: Dongguk University, 컴퓨터·AI학부
- **PI**: 장혜령 (Hyeryung Jang), 조교수
- **규모**: 6~10명
- **목표**: 랩 지식·프로젝트·과제·출결·홈페이지를 통합 관리하는 시스템 + 대시보드
- **사이트 라이브**: https://ionlab-dgu.github.io/

---

## 2. 핵심 철학

1. **완벽주의 함정 회피** — 3개월 뒤 갈아엎을 각오로 시작, 나선형 진화 허용
2. **학생 buy-in이 성공을 결정** — 미완성 상태에서 함께 채우기 초대
3. **Private 격리 3층 방어 훼손 금지**
4. **모든 페이지가 빈 데이터로도 정상 렌더** (empty state 필수)
5. **입력 UX가 곧 데이터 품질** — 필수 필드 최소화
6. **SSoT 존중** — 중복 저장 만들지 않기
7. **커밋 단위 작게** — 되돌리기 쉬움
8. **Slack은 신호 layer** (저장소 아님)
9. **감시 금지** — 통계·랭킹·리더보드 만들지 않음 (출결·데일리·1:1 전부)

---

## 3. 저장소 구조 (2-repo overlay)

- `ionlab-dgu/ionlab-dgu.github.io` **(public)** — 시스템 뼈대 + 홈페이지
- `ionlab-dgu/lab-os-private` **(private)** — 민감 콘텐츠 오버레이
  - 연구 1:1 노트
  - Personal 1-on-1 노트
  - **Research plans** (학생별·학기별)
  - PI 개인 아이디어, grant 예산 세부, 지원 예정 과제
- 빌드 시 private을 `.private/`에 checkout해서 두 소스 병합
- Public 사이트 빌드는 별도 워크플로로 private 없이 (안전장치)

로컬 폴더:
```
~/dev/ionlab-dgu/
├── ionlab-dgu.github.io/  (public)
└── lab-os-private/
```

---

## 4. 기술 스택

- **Framework**: Astro 7 + TypeScript
- **Styling**: Tailwind CSS
- **Package manager**: pnpm
- **Node**: 22.12+ 요구 (실제 사용: Node 26)
- **Deploy**: GitHub Pages (native GitHub Actions, PAT 방식 아님)
- **인증** (Phase 2 예정): GitHub OAuth + org membership 검증

배포 URL: `https://ionlab-dgu.github.io/`

---

## 5. Private 격리 3층 방어 (매우 중요)

1. `.gitignore`의 `.private/` — 커밋 자체 봉쇄
2. `build:public` 시 `PUBLIC_ONLY=1` 환경변수 — 오버레이 로더 비활성
3. `verify:public` 게이트 — 검사 실패 시 upload-pages-artifact 실행 안 됨

**이 세 층은 어떤 리팩터링·기능 추가에서도 훼손 금지.**

---

## 6. 콘텐츠 구조 (`content/`)

```
content/
├── members/           # 멤버 프로필
├── research/          # 연구 프로젝트 (학생 주도, 논문 목표)
│   └── [slug]/
│       ├── index.md
│       ├── reading.md
│       ├── experiments.md
│       ├── datasets.md
│       ├── ideas.md
│       └── meetings/
├── grants/            # 과제 (PI 주도)
├── publications/      # 논문 (refs.bib 포함)
├── news/              # 뉴스 아이템
├── handbook/
│   ├── policies/
│   │   ├── graduation.md      # ✓ 작성됨 (draft)
│   │   ├── operations.md      # ✓ 작성됨 (draft)
│   │   └── authorship.md      # ✓ 작성됨 (draft)
│   └── tutorials/
│       └── research-plan-guide.md  # 예정
├── datasets/, models/ # 전역 registry
├── seminars/          # 초청 강연·워크숍 (외부)
├── lab-seminars/      # 내부 랩 세미나 (신설 예정)
│   ├── _rotation-YYYY-학기.yaml
│   └── YYYY-학기/YYYY-MM-DD.md
└── conferences.yaml
```

lab-os-private:
```
lab-os-private/content/
├── one-on-ones/           # 연구 1:1 노트
├── personal-1on1s/        # Personal 1-on-1 노트 (신설 예정)
└── research-plans/        # 학생별·학기별 (신설 예정)
    └── [student-slug]/
        └── [semester].md
```

---

## 7. URL 라우팅

**Public** (누구나):
- `/`, `/members`, `/members/[slug]`
- `/research`, `/research/[slug]`
- `/publications`, `/news`, `/handbook`, `/join`
- `/lab-seminars` (신설 예정)

**Internal** (인증 필요, Phase 2 실제 구현):
- `/internal` — 대시보드
- `/internal/attendance`, `/internal/calendar`, `/internal/deadlines`
- `/internal/research/[slug]`, `/internal/grants`
- `/internal/handbook` (full), `/internal/meetings`
- `/internal/one-on-ones` — 본인 + PI만
- `/internal/personal-1on1s` — 본인 + PI만 (신설 예정)
- `/internal/research-plans` — 본인 + PI만 (신설 예정)

---

## 8. 개체 스키마 (frontmatter)

### Member
```yaml
id, name_ko, name_en
role: ug_intern | ms | phd | postdoc | pi | alumni
cohort: YYYY-MM
advisor, projects[]
grants: [{grant_slug, participation_pct}]
interests[], github, email, photo, homepage
```

### ResearchProject
```yaml
slug, title
status: idea | active | writing | submitted | accepted | paused | archived
lead, collaborators[], target_venue
start: YYYY-MM
grants[], tags[], short
direction  # content/directions/<slug>.md 의 slug (선택)
```

### ResearchDirection (신설)
```yaml
# content/directions/<slug>.md — 단일 파일, ResearchProject보다 한 단계 위 분류
slug, order, name_en, name_ko, short, description
topics[]
status: active | emerging | paused
```
초기 3개: Generative AI / Efficient Learning & Inference / Applied AI.
`/research/directions`(목록) · `/research/directions/<slug>`(상세, 관련 프로젝트 자동
리스트) 로 노출. 기존 `config/site.yaml`의 `research_areas`(description 전부 TODO로
방치돼 있던 것)를 대체했습니다. 같은 페이지에 분류 체계가 다른 두 섹션이 공존하는
것을 피하기 위해서입니다.

### Grant
```yaml
slug, title_ko, funder, grant_number
period: [start, end]
pi, co_pis[], status
next_deadline: {kind, due}
linked_research[]
```

### Publication
```yaml
slug, title, authors[], venue, year
type: conference | journal | workshop | preprint
status: under_review | accepted | published
attributed_grants[], attributed_projects[]
arxiv, code
# type별 Metrics (선택, type과 일치하는 블록만):
journal: {index_type, quartile, impact_factor, ranking: {category, percentile, rank}}
conference: {tier, acceptance_rate, h5_index, main_or_findings}
preprint: {venue}
badges[]  # 수동. best_paper | oral | highlight 는 전용 색
```
자동 뱃지: Q1 저널 → Q1(파랑), tier A* → A*(파랑), ranking.percentile ≤ 10 →
Top X%(금색), type preprint → Preprint(회색). `getPublicationBadges()`가 계산합니다.
학생 가이드: `content/handbook/tutorials/publication-registration.md`.

### AttendanceEvent (JSONL)
```yaml
user, action, at, note
```

### LabSeminar (신설)
```yaml
date, semester, type: lab_seminar
presenter, discussant
paper: {title, authors, venue, year, arxiv, code}
status: upcoming | done | skipped
```

### ResearchPlan (신설, private)
```yaml
student, semester, projects[]
last_updated, next_review
visibility: private
```

---

## 9. 미팅 프랙티스 (전체 정리)

| 이름 | 주기 | 소요 | 시간 | 형식 | 상태 |
|---|---|---|---|---|---|
| **랩 세미나** | 매주 | 60분 | **수 15:00** | 논문 발표 (사전 abstract+intro 읽기 + 토론 장려) | ✓ 확정 |
| **연구 1:1** | 매주 | 60분 | 각자 협의 | Progress·PI 지도, 아젠다 미리 공유 | ✓ 확정 |
| **Personal 1-on-1** | 월 1회 | 30분 | 각자 협의 | 사람 중심 (진로·웰빙·피드백) | ✓ 확정 |
| **월요일 스탠드업** | - | - | - | - | 보류 |
| **Slack #daily-log** | - | - | - | (async) | 미결정 |

### 랩 세미나
- **요일·시간**: 매주 수요일 15:00 (기존 화 16:00에서 변경)
- 60분, 대면 원칙, 전원 참석
- 로테이션: **학생끼리 협의로 학기초 배정** (rotation 파일 public)
- 개편 (Phase A 초기 최소 수준):
  - 사전 읽기: 참석자 전원 abstract + intro
  - 발표 후 discussion 장려
  - 심화 개편 (30/20 분리, 지정 discussant 등)은 향후 검토

### 연구 1:1
- **매주 진행** (격주 옵션 → 매주로 확정)
- 학생이 아젠다 미리 공유 필수
- **아젠다·이력 트래킹을 lab-os에서 지속** (Phase 2 시스템 통합 예정)
- 노트: lab-os-private/one-on-ones/[student-slug]/YYYY-MM-DD.md

### Personal 1-on-1
- **월 1회, 약 30분**
- **연구 얘기 안 함** — 진로, 웰빙, 피드백, 개인 상황
- 학생 주도, PI는 경청
- 강요 X (선택 가능하게)
- 가벼운 문서화 (몇 줄, 필요시 follow-up)
- 노트: lab-os-private/personal-1on1s/[student-slug]/YYYY-MM-DD.md

---

## 10. 미팅 노트 4종 (템플릿)

파일명: `YYYY-MM-DD.md`

### 연구 1:1
위치: `lab-os-private/one-on-ones/[student-slug]/`
- frontmatter: date, student, advisor, type: one_on_one, visibility: private
- 섹션: 지난 액션 아이템 / 아젠다 / 논의 요약 / PI 피드백 / 결정 / 다음 액션

### Personal 1-on-1
위치: `lab-os-private/personal-1on1s/[student-slug]/`
- frontmatter: date, student, type: personal_1on1, visibility: private
- 섹션: Vibe check / 학생이 꺼낸 얘기 / 논의 요약 / PI 관찰 / Follow-up
- 자유 형식 (구조 강제 X)

### Lab seminar
위치: `content/lab-seminars/[학기]/YYYY-MM-DD.md`
- frontmatter: date, semester, type: lab_seminar, presenter, discussant, paper{...}
- 섹션: 사전 공유 / 발표 요약 / Discussion 하이라이트 / Take-aways / Action items

### Reading group
- **랩 세미나 = 리딩 그룹** (별도 구분 없음)

---

## 11. Research Plan 시스템

### 도입
- **2026 가을 학기부터 전원** (신입 + 기존 학생 모두)
- **첫 작성 시점**: 다음 주 (학기 시작 첫 주)

### 위치
- `lab-os-private/research-plans/[student-slug]/[semester].md`
- 예: `lab-os-private/research-plans/hjkim/2026-fall.md`

### 프로세스
- **학기 시작 첫 주**: 학생 초안 작성
- **학기 초 30분 PI 리뷰**: 승인 or 조정
- **중간 리뷰** (약 6주 후, 10월 중순): milestone 점검
- **학기말 회고 + 다음 학기 초안**

### 템플릿 구성
- North Star (한 문장)
- 진행 중 프로젝트 (참여도 %)
- Milestones (M1~M4, 2~4주 단위)
- Kill Criteria (방향 재검토·중단 조건)
- 위험 요소·대응
- PI 지원 요청
- 리뷰 로그

### 가이드
- `content/handbook/tutorials/research-plan-guide.md` (public)
- 학생용 가이드: 왜 쓰나, 좋은 예/나쁜 예, 흔한 실수

### 원칙
- **Private 저장** (kill criteria 정직하게 쓰기 위해)
- 학생 자율성 존중 (강요 X, 지원 O)
- 완벽한 계획 강요 X — 방향 재조정 자연스러움

---

## 12. Lab Seminar 인프라

### 위치·구조
```
content/lab-seminars/
├── README.md
├── _template.md
├── _rotation-2026-fall.yaml
├── 2026-fall/
│   ├── 2026-09-03.md
│   └── ...
└── index.md   # 로테이션 뷰 + 아카이브
```

### 로테이션 (public)
- `_rotation-YYYY-학기.yaml`에 학기별 배정
- **학생끼리 협의로 배정** (학기 초)
- 개인 사정으로 교환 가능 (Slack 협의)
- **파일 위치 public** (모두 확인 가능)

### 개별 세미나 페이지
- 발표 후 발표자가 요약·discussion 정리
- 사이트에서 검색·참조 가능

### 개편 방향
- **현재 (2026 가을)**: 최소 개편 — 사전 읽기 + 토론 장려
- **향후 검토**: 30분 발표 + 20분 discussion 분리, 지정 discussant 심화, 격주 workshop 교차 등

---

## 13. 프로젝트 이원화 (Research vs Grant)

| | Research | Grant |
|---|---|---|
| 주도 | 학생 | PI |
| 목표 | 논문 기여 | 자금·산출 의무 이행 |
| 라이프사이클 | 유동적 | 정형, 마감 엄격 |
| 성공 지표 | Publication | 리포트 통과 |

- **관계는 N:N** — 한 연구가 여러 과제 지원, 한 과제가 여러 연구 커버
- Publication의 `attributed_grants` · `attributed_projects` 로 연결
- **Grant 예산은 대략적 데드라인만** 트래킹 (금액 세부는 학교 시스템에)

---

## 14. 출결 (A안: 자기 보고)

- **Actions**: `checkin`, `break_out`, `break_in`, `checkout`, `remote`
- **대시보드**: "지금 연구실에" 위젯 + 멤버 카드 상태 배지
- **개인 컨트롤**: 상태에 따라 라벨 바뀌는 큰 버튼 1개
- **개인 로그**: 본인만 열람
- **금지**: 통계·랭킹·리더보드 (감시 방지)

---

## 15. 캘린더 & 컨퍼런스 데드라인 (Phase 1 완료)

### 접근 정책
- 모든 랩 캘린더 = **internal only** (Phase 2 인증 후 실제 접근 제한)
- 배포된 public 사이트에는 lab 이벤트 노출 zero (6개 페이지 검증 완료)
- 학생·PI는 GCal 앱에서 직접 subscribe해서 확인
- 로컬 dev에서만 사이트에서 이벤트 확인 가능 (`.env`로 iCal URL 주입)

### 캘린더 원본
- **Google Calendar가 primary**입니다. 편집은 GCal에서 하고, 사이트는 read-only입니다.
- `config/calendars.yaml`이 캘린더를 정의합니다 (현재 lab_official, 향후 확장 가능).

### 구조 (2-tier)

**Tier 1: Public conferences.yaml (aideadlines auto-sync)**
- `content/conferences.yaml`: 30개 tracked venue (aideadlines에서 자동 수집)
- 2026-09에 16개에서 30개로 확장했습니다. 카테고리별 목록은 다음과 같습니다.
  - ML General: NeurIPS, ICML, ICLR / AI General: AAAI, IJCAI
  - Vision: CVPR, ECCV, ICCV, WACV / NLP: ACL, EMNLP, NAACL, COLING
  - Theory/Stats: AISTATS, UAI, COLT, ALT / Data Mining: KDD, WSDM, ICDM, CIKM
  - Robotics: ICRA, IROS, RSS, CoRL / Speech: INTERSPEECH, ICASSP
  - Multimedia: ACM MM / Web·IR: WWW, SIGIR
- 공개 사이트 `/calendar`에서 표시 (컨퍼런스 데드라인만)
- **BMVC · EACL · SDM · COLING은 huggingface/ai-deadlines에 파일이 없습니다**
  (2026-09 확인). 앞의 셋은 자동 수집 대상에서 뺐고, COLING은 `tracked_venues`에
  등록돼 있지만 같은 이유로 수집되지 않습니다. 목록에 있는데 데이터가 안 들어오는
  쪽이 더 위험하기 때문입니다. 투고를 고려한다면 `conferences:`에 수동으로 적으세요.
- 표시 범위는 `display.lookahead_days`(기본 **180일**, 예전 60일에서 확장)이고,
  `display.tier_thresholds`(urgent 14 / this_month 30 / next_month 60 / future 180)로
  Slack 요약·`/internal/calendar`가 마감을 묶어 보여줍니다. D-30 이내는 여전히
  `/calendar`(공개)·`/internal/deadlines`의 강조 기준(`IMMINENT_DAYS`)이며,
  이는 별개의 값입니다.

**Tier 2: Private venues.json (풍부한 metadata)**
- `lab-os-private/content/venues/venues.json`: 51건 통합본
  - 시드 39건 (conference 27 + journal 12)
  - 기존 전용 12건 (aideadlines에만 있고 시드에 없음, tracker/estimated로 편입)
- 각 venue: id, name, track, kind, label, scope, pageLimit, 
  cycle, timezone, confidence, source, events[], notes 등
- Confidence 규칙: confirmed + official-cfp 항목은 자동 덮어쓰기 금지
- Events 배열: registration, abstract, paper, notification, rebuttal, 
  cameraReady, conference 등 세분화 (13가지 type)

### Venue Phase 1 확정 사항 (2026-09-11)

투고 대상 pool을 **비공개 저장소에서** 확장 관리하기 시작했습니다.
공개 저장소의 `conferences.yaml`과 주간 aideadlines 수집은 **그대로 유지**됩니다.

- 데이터·스키마·스크립트를 전부 `lab-os-private`에 두었습니다. 공개 사이트 노출은 없습니다.
- 공개 저장소는 **읽기 전용 참조**입니다. 비공개 쪽 `sync-venues.mjs`가
  `src/data/conferences-fetched.json` 산출물만 읽고, 공개 저장소에는 아무것도 쓰지 않습니다.
- `fetch-conferences.mjs`는 손대지 않았습니다.

| 통합 데이터 | 건수 |
| --- | --- |
| 시드 (2026-09-09 조사) | 39 (학회 27 · 저널 12) |
| 트래커 전용 편입 | 12 |
| **통합본** | **51** |

이 문서의 예전 판이 적어 둔 "37개(26+11)"는 오기입니다. 시드 파일이 정본입니다.
COLING은 upstream에 레코드가 없어 `url`을 채울 수 없었기 때문에 편입을 보류했습니다.

**핵심 규칙**

- `confidence: confirmed` + `source: official-cfp`인 항목은 동기화로 **덮어쓰지 않습니다.**
  값이 다르면 diff만 냅니다. 실제로 WWW·AAAI의 통보일에서 불일치를 찾아냈습니다.
- `status`는 저장된 값이 아니라 **오늘을 기준으로 계산한 값**입니다. 제출 계열 이벤트가
  남아 있으면 `open`, 제출은 끝났고 통보·개최가 남았으면 `in-progress`, 전부
  지났으면 `closed`입니다.
- `raw/<날짜>.json`에 트래커 원본을 보존합니다. 직전 응답이 남아 있어야 diff가 성립합니다.

**Phase 3 착수 전에 반드시 볼 것**: 격리 검증의 사각지대.
`verify-public-build.mjs`는 `.md`만 검사하므로 venue JSON이 검사 대상 밖에 있습니다.
지금은 로더가 참조하지 않아 위험이 없지만, 대시보드가 `venues.json`을 읽는
순간부터 실제 위험이 됩니다. 대응 옵션은 `IMPLEMENTATION.md` 14절에 정리해 두었습니다.

### Workshop (신설, 수동 관리)
- `content/workshops.yaml`의 `workshops[]`로 관리하며, 학회와 달리 **자동으로 수집하지
  않습니다**. huggingface/ai-deadlines에 워크숍 개별 항목이 잘 없고, 메인 학회 프로그램이
  확정된 후에야 워크숍 CFP가 뜨는 경우가 많아서 자동화 비용 대비 실익이 낮기 때문입니다.
  학기 초에 한 번 훑어보고 채우는 저유지보수 방식입니다.
- `src/lib/deadlines.ts`의 `getWorkshops()` / `getUpcomingWorkshops()`가 읽습니다.
  파일이 없거나 비어 있으면 빈 배열을 반환하며, 이는 정상 상태입니다.
- `/internal/calendar`에 별도 섹션으로 두었고(비어 있으면 EmptyState), Slack 요약에도
  섹션이 있습니다. 다만 Slack에서는 비어 있으면 **섹션 자체를 생략**합니다. 사이트의
  EmptyState 관례와 다르게 한 것은, Slack은 매주 오는 push라서 빈 섹션이 반복되면
  그 자체가 소음이 되기 때문입니다.
- 아직 비어 있습니다. `content/handbook/tutorials/calendar-setup.md` §4를 참고해 PI가
  채워야 합니다.

### Slack 알림 (Phase 1 자동화)
- **Sync Conference Deadlines**: 매주 월 09:23 KST 자동
- **Weekly Summary (Slack)**: 매주 월 09:37 KST + 수 09:23 KST 자동
  - 랩 이벤트 (GCAL_ICAL_LAB_GENERAL) + 컨퍼런스 데드라인 (30개)
  - 랩 내부 채널로만 발송
  - 학회 마감은 티어별(긴급/이번 달/다음 달/그 이후)로 묶고, 티어당 5건이 넘으면
    "그 외 N개는 사이트 참조"로 접습니다 (venue를 30개로 늘린 뒤 필요해진 처리)
- 두 workflow 모두 `workflow_dispatch`로 수동 실행 지원
- **⚠️ Cron 오프셋 주의**: 정각(:00) 및 흔한 분(:15, :30)은 GitHub 부하 관리로 
  skip 리스크. 비관행 분(:23, :37 등) 사용 관례.

### 예약 실행 지연 관찰 (2026-09-10 시작)
- 첫 예약 실행(2026-09-07 00:00 UTC)은 통째로 **skip**됐고(위 cron 오프셋 조정의
  원인), 그 다음 2026-09-09 실행은 skip되지는 않았지만 예정(09:23 KST)보다
  **4시간 29분 늦게**(13:52 KST) 트리거됐습니다. 실행 기록으로 실측해 확인했습니다
  (`createdAt: 2026-09-09T04:52:33Z`, cron 예정 `00:23Z`).
- 이 한 건만으로는 판단할 수 없어서, `weekly-summary.yml`이 매 실행마다 예정 시각과
  실제 트리거 시각·지연 분을 Actions 로그에 남기도록 계측했습니다
  (`scripts/weekly-slack-summary.mjs`의 `logRunTiming()`). 15분을 넘는 지연이면
  로그에 WARNING을 남깁니다. Slack 메시지에는 넣지 않습니다. 독자에게는 무의미한
  운영 정보이기 때문입니다.
- **2~4주 동안 데이터가 쌓이면** 판단합니다. 지연이 상시적이면 GitHub Actions의
  scheduled workflow 대신 외부 cron 서비스로 옮기는 것을 고려하고, 산발적이면
  현행을 유지합니다.

### Local dev
- **로컬 dev**: `.env`의 `GCAL_ICAL_LAB_GENERAL`로 이벤트 확인
- Slack Weekly Summary: 별도 fetch 경로 (GitHub Secret `GCAL_ICAL_LAB_GENERAL`)
  - Public 사이트 빌드와 완전 격리

### 안전장치
- Public 사이트 빌드: `PUBLIC_ONLY=1` 게이트 → lab 데이터 로드 자체 X
- Slack fetch 경로: 사이트 빌드와 완전 격리 (secret은 workflow에서만 참조)
- gcal.ts: TZID 오프셋 정확 처리 + RRULE 전개 지원 (60일 window). 이 60일은 GCal
  반복 일정의 전개 범위인 `config/calendars.yaml`의 `expand_days`이고, 학회 마감의
  `lookahead_days`와는 다른 값입니다. 헷갈리기 쉬워서 명시해 둡니다.
- UI 문구: "연결 안 됨"과 "일정 없음" 구분해서 오해 방지
- **격리 검증 사각지대 인지됨** (IMPLEMENTATION.md 참조):
  - verify-public-build.mjs는 .md만 검사, JSON은 사각지대
  - Phase 3 대시보드 착수 전 반드시 검사기 확장 필요

### Phase 2 예정 (다음 세션 이후)
- Slack 알림 확장 (venues.json 51건 반영)
- 임박 핑 (D-14/7/1, estimated 제외)
- 설정 파일 (channel, tracks, thresholds)
- 확정 필요:
  - Slack 채널 (Weekly Summary 채널 병합 vs 신설)
  - 알림 스코프 (51개 전체 vs 랩 방향 매핑 트랙만)

### Phase 3 예정 (Phase 2 후)
- `/internal/venues/` 카드 뷰
- 타임라인 뷰
- 필터 URL 동기화
- 트랙 색상 반영 (핸드오프 §7)

---

## 16. 개발 워크플로

```bash
pnpm run dev              # 로컬 개발 서버
pnpm run build            # 전체 빌드
pnpm run build:public     # PUBLIC_ONLY=1
pnpm run verify:public    # 격리 검사 게이트
```

스캐폴드 스크립트: `scripts/new-{member,project,grant,publication}.mjs`

---

## 17. Claude 모드 가이드

| 작업 | 모드 |
|---|---|
| 아키텍처·전략 결정, 구조 다듬기 | **Chat** (이 Project) |
| 실제 파일·코드 편집, CI 설정 | **Claude Code** |
| 마크다운 대량 콘텐츠 채우기 | **Cowork** |
| 학생용 지식 어시스턴트 | 별도 **Claude Project** (Lab Brain) |

---

## 18. Lab Brain (Claude Project)

### 현재 상태
- **Claude Project 구축·테스트 완료** (PI 계정)
- **자료 업로드**: handbook 3개 (graduation, operations, authorship)
- Custom instructions 설정 완료

### 학생 접근 방식 (미결정)
Claude Project 공유는 Team/Enterprise 플랜에서만 가능. 검토 중인 옵션:
1. **DIY 복제**: 각 학생 본인 계정에 동일 Project 재현
2. **Notion 병용**: Notion에 handbook 미러링 + Notion AI
3. **사이트 챗봇**: 사이트에 자체 위젯 (Phase 3, 개발 부담)
4. **Team 플랜 유료** (연 약 400만원, 마지막 옵션)

### 잠정 조치
- 사이트의 "Ask Lab Brain" 버튼 임시 제거 (코드는 유지)
- 다음 세션에서 접근 방식 결정

### 자료 동기화
- Handbook 업데이트 시 Lab Brain Project knowledge에도 재업로드 (수동)
- 큰 변경 시에만 (월 1~2회 예상)

---

## 19. 현재 상태 (완료)

**기반 구축**
- [x] 아키텍처 결정
- [x] GitHub org (`ionlab-dgu`) + 두 repo 생성
- [x] Astro scaffold, 콘텐츠 폴더 구조
- [x] GitHub Pages 배포 (native Actions)
- [x] Private 격리 3층 방어
- [x] 사이트 라이브: https://ionlab-dgu.github.io/

**문서화**
- [x] Handbook policies 3개 (graduation, operations, authorship — draft)
- [x] research-plan-guide.md 작성
- [x] calendar-setup.md 작성 (TODO 채우기만 남음)

**미팅 프랙티스**
- [x] 미팅 프랙티스 결정 (랩 세미나 수 15:00, 연구 1:1 매주, Personal 1-on-1 월 1회)
- [x] Handbook operations.md의 §1 랩 세미나 개편 반영

**인프라**
- [x] Research Plan 인프라 (lab-os-private/research-plans/)
- [x] Lab Seminar 인프라 (content/lab-seminars/ + rotation YAML)
- [x] 캘린더 인프라 (config/calendars.yaml + gcal.ts TZID/RRULE)

**자동화**
- [x] Conference deadlines 자동 sync (매주 월 09:23 KST)
- [x] Slack Weekly Summary 자동 발송 (월 09:37 + 수 09:23 KST)
- [x] Public 사이트 유출 검증 (6개 페이지, lab 데이터 0건)
- [x] UI 문구 개선 ("연결 안 됨" vs "일정 없음" 구분)
- [x] Cron 오프셋 조정 (정각 skip 이슈 대응)
- [x] **Venue sync Phase 1** (2026-09-11):
  - Private venues.json 51건 통합본 (시드 39 + 편입 12)
  - Zod 스키마 + 검증기 (경고 24건 = 편입 12건의 미충족 필드)
  - Sync 스크립트 (estimated만 갱신, confirmed 보호)
  - Aideadlines raw 스냅샷 보존
  - 카나리 17종 통과 (스키마 12 + sync 5)
  - 격리 첫 층 (publicOnly) 작동 실측 검증
  - IMPLEMENTATION.md에 원칙·사례 축적

**Lab Brain**
- [x] Lab Brain Claude Project 구축·테스트
- [x] 참조 사이트 조사·확정 (MILAB, KIXLAB, al-folio)

---

## 20. 남은 작은 TODO

**Phase 1 완료 후 (2026-09-11)**
- [ ] Venue 편입 12건의 pageLimit·scope 채우기 (경고 24건 해소)
- [ ] BMVC/EACL/SDM/COLING 처리 방향 결정
  - 옵션 A: 랩 투고 계획 확인 후 수동 tracking
  - 옵션 B: aideadlines upstream 기여 (PR 제출)
  - 옵션 C: 편입 보류 유지 (현재 상태)
- [ ] 격리 검증 사각지대 대응 (Phase 3 착수 전 필수)
  - JSON 파일 검사 확장 or private 별도 검사기 or 카나리 자동화

**기존**
- [ ] `content/handbook/tutorials/calendar-setup.md`의 TODO(PI) 2곳 채우기
  - 구독 URL (아래 §15 안내 값)
  - Slack 채널명 (Weekly Summary가 발송되는 채널)
- [ ] 데드라인·세미나 캘린더 추가 gcal_id 
  - 현재 0/3 연결, Phase 2 이전에 필수 아님
  - lab_official만 있어도 실용상 OK
- [ ] 학생 대상 공지 (2026 가을 학기 시작 시):
  - Research Plan 첫 작성 안내
  - 랩 세미나 시간·형식 변경 안내 (수 15:00)
  - Personal 1-on-1 도입 안내
- [ ] Third-party actions v5 릴리스 시 workflow 업데이트
  - actions/checkout@v4 → @v5 등
  - Node 20 deprecation 대응

---

## 21. 로드맵

**Phase 1 (마무리 단계)**: Public 홈페이지 + 기본 콘텐츠 + 자동화
- [x] 사이트 라이브
- [x] Handbook 3 policies 초안
- [x] Research plan / Lab seminar 인프라
- [x] 캘린더 인프라 + 자동 sync + Slack 요약
- [x] **Venue sync Phase 1** (Private venues.json 51건 통합)
- [ ] 학기 시작 시 학생 공지 (2026 가을)

**Phase 2 (4~6주 후)**: Slack 알림 확장 + Internal dashboard 시작
- **Venue Slack 확장** (Phase 1 후속):
  - 주간 다이제스트에 venues.json 51건 반영
  - 임박 핑 (D-14/7/1, estimated 제외)
  - 설정 파일 (channel, tracks, thresholds)
- GitHub OAuth 인증 (본격 도입)
- 출결 체크인 UI 실작동
- **GCal 실제 렌더링** (`/internal/calendar`에 실제 이벤트 표시)
- **1:1 아젠다·이력 트래킹 시스템**
- **PI 전용 인건비 현황 대시보드** (admin-only, lab-os-private)

**Phase 3 (이후)**: Claude 통합·심화 자동화 + Venue 대시보드
- **Venue 대시보드** (Phase 2 후속):
  - `/internal/venues/` 카드 뷰
  - 타임라인 뷰
  - 필터 URL 동기화
  - 트랙 색상 반영
  - ⚠️ 착수 전 격리 검증 사각지대 대응 필수
- arXiv 다이제스트
- 논문 게재 시 자동 sync
- 주간 랩 리포트
- Slack 알림 심화 (개별 데드라인 D-14/7/3)

**병행**: Lab Brain 학생 접근 방식 결정·구축

### 다음 세션 후보
0. ⚠️ **인건비 현황 대시보드 요구사항 논의** (PI 세션 commitment — 다음 세션 시작 시 remind)
   - 관리자(PI)만 접근
   - lab-os-private 저장 (개인정보·급여 민감)
   - `/internal/admin/personnel` 형태 라우팅 검토
   - 데이터 후보: 학생별 grant 참여율, 월별 인건비 지급, 잔여 예산, BK21 계약 등
   - Phase 2 (인증) 붙인 후 실제 구현
1. **wandb 도입 계획** (Phase B 재개, Research Plan 이후)
2. **Venue Slack 확장** (Phase 1 완료로 준비됨)
3. Lab Brain 학생 접근 결정 (Notion 검토, DIY 등)
4. Publications 카드 UI 실험
5. ION Lab 로고 제작
6. Handbook 나머지 (온보딩, 튜토리얼)
7. 콘텐츠 채우기 (Cowork 모드)

---

## 22. 미확정 사항

- **Lab Brain 학생 접근 방식** — Notion·DIY·다른 옵션 검토
- **wandb 도입 시점·컨벤션** (다음 세션)
- **Slack #daily-log 도입 여부**
- **랩 세미나 심화 개편** — 30/20 분리, 지정 discussant 등 (일단 최소 개편만)
- **Slack slash command (`/lab-calendar`)** — 실사용 패턴 관찰 후 결정
  - 자동화 + 북마크로 대부분 커버, 지금 셋업 오버헤드 비추
- 학교 `.ac.kr` 서브도메인 신청 여부
- 각 개체 스키마 세부 필드
- Grant 예산 트래킹 깊이 확장 여부
- 인증 방식 (GitHub OAuth vs Cloudflare Access vs 학교 SSO)

---

## 23. 참조 & 영감

### 랩 사이트 구조 참고 (확정)
- **MILAB @ SNU** — https://milab.snu.ac.kr — 구조·publications 페이지
- **KIXLAB @ KAIST** — https://www.kixlab.org — 구조 템플릿
- **Language & AGI Lab (Yonsei)** — https://langlab.yonsei.ac.kr — 초기 참조

### 폰트 참고
- **Lilian Weng** — https://lilianweng.github.io — 폰트 확인 후 적용 검토

### 학술 템플릿 (확정)
- **al-folio 데모** — https://alshedivat.github.io/al-folio
- **al-folio repo** — https://github.com/alshedivat/al-folio
- 우리는 Astro로 이미 구축 중, 레이아웃·섹션·기능 참고용

### 개인 사이트 참고 (PI 개인 홈페이지 용, 별도 프로젝트)
- **Andrej Karpathy** — https://karpathy.ai — 미니멀 극단

---

## 24. 디자인·시각 TODO

1. **ION Lab 로고 제작** — 미니멀·아카데믹, wordmark + 심볼
2. **Publications 페이지 개편** — MILAB/KIXLAB/al-folio 참조, 최근 논문 카드 UI
3. **폰트 시스템 검토** — Lilian Weng 사이트 폰트 확인
4. **MILAB/KIXLAB 대비 누락 섹션 파악**

---

## 25. 유지보수

- HANDOFF는 살아있는 문서. 큰 결정 시 업데이트.
- Project knowledge에 재업로드 필요 (자동 sync 아님).
- 큰 변경 발생 시에만 (매주 X).

### GitHub Actions 관리 팁
- Third-party actions (checkout, setup-node, pnpm 등)은 새 major 버전 릴리스 시 
  workflow 파일 업데이트
- Node.js runtime deprecation warning은 warning이 error로 바뀌기 전에 대응
  - 예: `actions/checkout@v4` → `@v5` (v5 릴리스 시)
- 현재 Node 20 deprecation warning 있음 (2025-09 발표) — 
  각 action의 v5 릴리스 대기 중
- **Cron 스케줄은 정각·흔한 분 피하기**: `0 0 * * 1`처럼 정각(:00)이나 
  :15/:30/:45 같은 흔한 분은 GitHub 부하 관리로 skip 리스크. 
  :23, :37 같은 비관행 분 사용 (2026-09 실제 skip 겪은 후 조정)

### 캘린더 시스템 유지
- Public 사이트에 lab 데이터가 실수로 커밋되지 않는지 정기 확인
  (major refactor 후 검증 권장)
- GCal iCal URL은 secret으로만 관리, 코드/문서에 절대 하드코딩 X
- 노출 의심 시 GCal에서 iCal URL 재발급 → GitHub Secret 갱신

---

## 26. 다음 세션 시작 방법

새 Chat 세션 (이 Project 안에서):
```
HANDOFF 기반으로 이어갑니다.
오늘은 [원하는 방향] 진행하고 싶습니다.

방향 후보:
- Claude Code 작업 결과 확인·이어가기
- wandb 도입 계획
- Lab Brain 학생 접근 결정
- Publications 카드 UI
- ION Lab 로고
- Handbook 나머지 (onboarding, tutorials)
- 콘텐츠 채우기 (Cowork)
```
