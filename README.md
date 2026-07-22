# lab-os

ION Lab(동국대학교 컴퓨터·AI학과) 랩 운영 시스템.
공개 홈페이지와 내부 도구(출결·일정·데드라인·미팅 노트)를 겸합니다.

- 공개 사이트: https://ionlab-dgu.github.io
- 콘텐츠는 전부 마크다운입니다. **파일만 고치면 사이트가 바뀝니다.**

---

## 목차

- [빠른 시작](#빠른-시작)
- [저장소 구조](#저장소-구조)
- [콘텐츠 추가하기](#콘텐츠-추가하기)
- [private 오버레이](#private-오버레이)
- [설정](#설정)
- [배포](#배포)
- [자주 겪는 문제](#자주-겪는-문제)

---

## 빠른 시작

### 필요한 것

- **Node.js 22.12 이상** (Astro 7 요구사항)
- **pnpm**

```bash
node -v    # v22.12.0 이상
pnpm -v
```

없다면:

```bash
brew install node pnpm         # macOS
# 또는 nvm/fnm 으로 Node 22+ 설치
```

### 설치·실행

```bash
git clone git@github.com:ionlab-dgu/ionlab-dgu.github.io.git lab-os
cd lab-os
pnpm install
pnpm dev
```

http://localhost:4321 이 열립니다. 파일을 저장하면 즉시 반영됩니다.

### 명령어

| 명령                 | 설명                                            |
| -------------------- | ----------------------------------------------- |
| `pnpm dev`           | 개발 서버                                       |
| `pnpm build`         | 빌드 (private 오버레이가 연결돼 있으면 포함)    |
| `pnpm build:public`  | **공개 배포용 빌드** — private을 아예 읽지 않음 |
| `pnpm verify:public` | 공개 빌드에 private이 섞이지 않았는지 검사      |
| `pnpm preview`       | 빌드 결과 미리보기                              |
| `pnpm check`         | 타입 검사                                       |
| `pnpm format`        | 코드 정리 (Prettier)                            |
| `pnpm link:private`  | private 저장소를 `.private/`로 연결             |
| `pnpm new:member` 등 | 콘텐츠 스캐폴드 (아래 참고)                     |

> **커밋 전에 `pnpm check`와 `pnpm build`를 돌리세요.**
> `pnpm dev`에서는 되는데 빌드에서 깨지는 경우가 있습니다.

---

## 저장소 구조

```
content/          콘텐츠 (마크다운) — 대부분 여기만 고치면 됩니다
  members/          구성원 프로필
  research/         연구 프로젝트 (폴더마다 index + 실험 로그 + 미팅 노트)
  grants/           과제 (index + 산출물 + 보고서 일정)
  publications/     논문 + refs.bib
  news/             소식
  handbook/         핸드북 (온보딩·정책·튜토리얼)
  datasets/ models/ 데이터셋·모델 레지스트리
  seminars/         세미나·리딩 그룹 노트
  conferences.yaml  관심 학회 마감일

config/           사이트 설정 (이름·연락처·네비게이션·캘린더·권한)
data/attendance/  출결 기록 (append-only JSONL)

src/              사이트 코드
  lib/              데이터 로딩·도메인 로직
  layouts/          페이지 레이아웃
  components/       UI 컴포넌트
  pages/            라우팅

scripts/          콘텐츠 스캐폴드 CLI
```

각 콘텐츠 폴더에는 **`_template`**(스키마 설명 + 빈 필드)과
**`example-*`**(렌더 확인용 예시)가 들어 있습니다.
실제 콘텐츠가 쌓이면 `example-*`는 지우면 됩니다.

---

## 콘텐츠 추가하기

### 스크립트로 (권장)

질문에 답하면 필요한 파일이 한 번에 생깁니다.

```bash
pnpm new:member       # 새 구성원
pnpm new:project      # 새 연구 프로젝트 (부속 문서까지 함께 생성)
pnpm new:grant        # 새 과제
pnpm new:publication  # 새 논문 (refs.bib 엔트리도 함께)
```

### 직접 만들 때

해당 폴더의 `_template.md`(또는 `_template/`)를 복사해 이름을 바꾸고 채웁니다.
frontmatter 주석에 각 필드의 의미가 적혀 있습니다.

### 미팅 노트

파일명은 `YYYY-MM-DD-<종류>.md` 입니다.

| 종류      | 위치                                                    |
| --------- | ------------------------------------------------------- |
| 주간 진행 | `content/research/<slug>/meetings/2026-07-20-weekly.md` |
| 과제      | `content/grants/<slug>/meetings/2026-07-20-grant.md`    |
| 리딩 그룹 | `content/seminars/2026-07-15-reading.md`                |
| 1:1       | **private 저장소**의 `content/one-on-ones/<member-id>/` |

> 주간 미팅 노트는 **발표한 학생이** 미팅 당일에 씁니다.

### 반영 확인

```bash
pnpm dev
```

목록에 안 보인다면 대개 다음 중 하나입니다.

- 파일명이 `_`로 시작함 (템플릿·초안 취급이라 건너뜁니다)
- frontmatter의 `slug`/`id`가 파일명과 다름
- 연구 프로젝트에 `index.md`가 없음
- 공개 페이지인데 `visibility: internal`로 되어 있음

---

## private 오버레이

민감한 콘텐츠(1:1 노트, 예산 세부 등)는 별도의 private 저장소
`ionlab-dgu/lab-os-private`에 있습니다. 두 저장소는 빌드 시 하나로 합쳐집니다.

```
lab-os/           (public)
lab-os-private/   (private)  →  lab-os/.private 로 심볼릭 링크
```

### 연결하기 (권한이 있는 경우)

```bash
cd ..
git clone git@github.com:ionlab-dgu/lab-os-private.git
cd lab-os
pnpm link:private
```

이제 `pnpm dev`에서 내부 페이지에 private 콘텐츠가 함께 보입니다.

**연결하지 않아도 모든 것이 정상 동작합니다.** private이 없으면 해당 항목이 비어 보일 뿐,
빌드는 성공합니다. 권한이 없는 사람도 그대로 개발할 수 있습니다.

### 절대 하지 말 것

- `.private/` 안의 파일을 이 저장소로 복사·커밋하지 마세요.
- 1:1 노트를 `content/` 아래에 만들지 마세요.
- 공개 배포는 반드시 `pnpm build:public`으로 하세요 (private을 아예 읽지 않습니다).

자세한 규칙은 [CLAUDE.md](./CLAUDE.md)에 있습니다.

---

## 설정

`config/` 아래 YAML을 고치고 다시 빌드하면 반영됩니다.

| 파일             | 내용                                  |
| ---------------- | ------------------------------------- |
| `site.yaml`      | 랩 이름, 소개 문구, 연락처, 연구 분야 |
| `nav.yaml`       | 네비게이션 메뉴                       |
| `calendars.yaml` | Google Calendar 연동                  |
| `access.yaml`    | 접근 권한 (Phase 2 인증이 읽을 스펙)  |

> 값이 `TODO:` 로 시작하면 화면에 표시되지 않습니다.
> 아직 확정되지 않은 정보를 임시로 두기 위한 장치입니다.

### Google Calendar 연동

1. GCal → 캘린더 설정 → **캘린더 통합**에서 iCal 주소를 복사합니다.
2. 공개 캘린더면 `config/calendars.yaml`의 `ical_url`에 넣습니다.
3. **비공개 캘린더면 주소를 파일에 넣지 말고** 환경변수로 넘깁니다:

```bash
# .env (커밋되지 않습니다)
GCAL_ICAL_LAB_GENERAL=https://calendar.google.com/calendar/ical/.../basic.ics
```

Google Calendar가 정본이고 사이트는 읽기만 합니다. 일정 추가·수정은 GCal에서 하세요.

---

## 배포

이 저장소(`ionlab-dgu/ionlab-dgu.github.io`)가 곧 org 사이트입니다.
`main`에 푸시하면 GitHub Pages 네이티브 배포가 동작합니다 — 토큰이 필요 없습니다.

```
push to main ─▶ build job                        ─▶ deploy job ─▶ https://ionlab-dgu.github.io
                 │ 타입 검사
                 │ .private/ 부재 확인
                 │ pnpm build:public  (PUBLIC_ONLY=1)
                 │ 격리 검사 (verify:public)
                 └ upload-pages-artifact          deploy-pages
```

**공개 배포에는 private 콘텐츠가 포함되지 않습니다.** 워크플로가 private 저장소를
checkout 하지 않고, `PUBLIC_ONLY=1`로 빌드하며, **격리 검사를 통과해야만
아티팩트가 업로드**됩니다. 검사가 실패하면 배포 대상 자체가 만들어지지 않습니다.

### 최초 설정 (한 번만)

저장소 Settings → Pages → **Source: GitHub Actions** 로 지정합니다. 그게 전부입니다.
(`main` 브랜치 배포가 아니라 Actions 배포입니다 — 잘못 고르면 `dist/`가 아니라
저장소 소스가 그대로 서빙됩니다.)

공개 캘린더를 사이트에 노출하려면 `GCAL_ICAL_SEMINARS` 시크릿을 등록하세요.
**비공개 캘린더 주소는 등록하지 마세요** — 공개 사이트에 일정이 노출됩니다.

### 배포 전 로컬 확인

```bash
pnpm build:public    # 공개 빌드
pnpm verify:public   # 격리 검사 (CI와 동일)
pnpm preview         # 결과 미리보기
```

`pnpm verify:public`은 `.private/`가 연결돼 있으면 그 문서의 문장이 `dist/`에
나타나는지 실제로 대조합니다. 연결돼 있지 않으면 해당 검사는 건너뜁니다.

---

## 자주 겪는 문제

**`Unsupported engine` 경고가 뜹니다**
Node 버전이 낮습니다. 22.12 이상으로 올리세요 (`node -v`).

**새로 만든 문서가 사이트에 안 보입니다**
위 [반영 확인](#반영-확인) 항목을 보세요. 대개 파일명이 `_`로 시작하거나
`slug`가 파일명과 다른 경우입니다.

**날짜가 이상하게 표시됩니다**
날짜는 `YYYY-MM-DD` 형식으로 적으세요. 코드에서 YAML을 읽을 때는
`src/lib/yaml.ts`를 쓰고 `js-yaml`을 직접 import 하지 마세요.

**캘린더가 비어 있습니다**
`config/calendars.yaml`에 iCal 주소가 없거나 fetch가 실패한 것입니다.
**이 경우에도 빌드는 성공합니다** — 의도된 동작입니다.

**`.private/`를 연결했는데 내용이 안 보입니다**
`.private/content/` 아래에 있어야 합니다 (`.private/` 바로 아래가 아닙니다).
`pnpm link:private`이 인식한 파일 수를 알려줍니다.

---

## 문서

- [HANDOFF.md](./HANDOFF.md) — 아키텍처, 주요 결정 사항, 진행 상황, 겪은 함정
- [CLAUDE.md](./CLAUDE.md) — 콘텐츠 스키마, 명명 규칙, private 격리 원칙, 커밋·PR 컨벤션
- [핸드북](./content/handbook/) — 랩에서 일하는 방식 (온보딩·정책·튜토리얼)
