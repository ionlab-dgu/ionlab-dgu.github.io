# ION Lab OS — HANDOFF

랩 관리 시스템 `lab-os` 아키텍처·결정사항·현황 정리 문서.
새 Claude 세션에서 컨텍스트 로딩용, 학생 온보딩용, 결정 기록용.

Last updated: 2026-08 (세션 2 결정 반영)

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
```

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
```

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

## 15. 캘린더 & 컨퍼런스 데드라인

### 캘린더
- **Google Calendar가 primary**, 사이트는 read-only 표시
- `config/calendars.yaml`에 GCal ID 목록

### 컨퍼런스 데드라인
- `content/conferences.yaml`에 관심 venue subset 관리
- 대시보드에 D-30 이내 강조
- Phase 3에서 Slack 알림 (D-14, D-7, D-3)

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

- [x] 아키텍처 결정
- [x] GitHub org (`ionlab-dgu`) + 두 repo 생성
- [x] Astro scaffold, 콘텐츠 폴더 구조
- [x] GitHub Pages 배포 (native Actions)
- [x] Private 격리 3층 방어
- [x] 사이트 라이브: https://ionlab-dgu.github.io/
- [x] Handbook policies 3개 문서화 (graduation, operations, authorship — draft)
- [x] Lab Brain Claude Project 구축·테스트
- [x] 참조 사이트 조사·확정 (MILAB, KIXLAB, al-folio)
- [x] 미팅 프랙티스 결정 (랩 세미나 수 15:00, 연구 1:1 매주, Personal 1-on-1 월 1회)

---

## 20. 진행 중 (다음 Claude Code 세션)

- [ ] Research Plan 인프라 (`lab-os-private/research-plans/`)
- [ ] Lab Seminar 인프라 (`content/lab-seminars/`)
- [ ] Handbook operations.md의 §1 랩 세미나 개편 반영 (**수요일 15:00** 로 시간 변경 포함)
- [ ] research-plan-guide.md 작성

⚠️ **중요**: 이전에 준비한 Claude Code 프롬프트는 "화 16:00" 기준이었으니, 세션 시작 시 **"수 15:00"** 로 수정 후 실행 필요. 로테이션 파일 위치는 **public** (`content/lab-seminars/_rotation-YYYY-학기.yaml`).

---

## 21. 로드맵

**Phase 1 (거의 완료)**: Public 홈페이지 + 기본 콘텐츠
- [x] 사이트 라이브
- [x] Handbook 3 policies 초안
- [ ] Research plan / Lab seminar 인프라 (진행 중)
- [ ] **2026 가을 학기 시작 시 학생 전원 Research Plan 안내** (다음 주)

**Phase 2 (4~6주 후)**: Internal dashboard
- GitHub OAuth 인증
- 출결 체크인 UI
- GCal 실제 연동
- 컨퍼런스 데드라인
- **1:1 아젠다·이력 트래킹 시스템**

**Phase 3 (이후)**: Claude 통합·자동화
- arXiv 다이제스트
- 논문 게재 시 자동 sync
- 주간 랩 리포트
- Slack 알림

**병행**: Lab Brain 학생 접근 방식 결정·구축

### 다음 세션 후보
1. **wandb 도입 계획** (Phase B 재개, Research Plan 이후)
2. Lab Brain 학생 접근 결정 (Notion 검토, DIY 등)
3. Publications 카드 UI 실험
4. ION Lab 로고 제작
5. Handbook 나머지 (온보딩, 튜토리얼)
6. 콘텐츠 채우기 (Cowork 모드)

---

## 22. 미확정 사항

- **Lab Brain 학생 접근 방식** — Notion·DIY·다른 옵션 검토
- **wandb 도입 시점·컨벤션** (다음 세션)
- **Slack #daily-log 도입 여부**
- **랩 세미나 심화 개편** — 30/20 분리, 지정 discussant 등 (일단 최소 개편만)
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
