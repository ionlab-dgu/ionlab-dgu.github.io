---
# ── 튜토리얼 ─────────────────────────────────────────────────
slug: publication-registration
title: 논문 등록하는 법
order: 44
visibility: public
audience: []
updated: 2026-09-10
---

# 논문 등록하는 법

## 이 문서를 읽으면

논문이 나왔을 때 사이트에 어떻게 등록하는지, 그리고 등록하면 자동으로 뜨는
뱃지(Q1, A*, Top X% 등)가 어디서 오는 건지 알게 됩니다.

## 기본 등록

```bash
pnpm new:publication
```

제목·저자·발표처 등을 물어보고 `content/publications/<slug>.md`와 `refs.bib` 엔트리를
함께 만듭니다. **`attributed_grants`를 반드시 확인하세요** — 과제 실적 집계
(`/internal/grants/<slug>`)가 이 필드를 근거로 삼습니다. 여기까지가 스캐폴드가
자동으로 물어보는 부분입니다.

## Metrics — 저널/학회 지표 (수동으로 채우는 부분)

스캐폴드가 아직 물어보지 않는 필드입니다. 논문 파일을 열어서 `type`과 일치하는
블록만 채우세요 (다른 블록에 값이 있어도 상세 페이지가 무시합니다).

### 저널 논문 (`type: journal`)

```yaml
journal:
  index_type: SCIE # SCIE | SSCI | ESCI | SCOPUS | 기타 | none
  quartile: Q1 # Q1 | Q2 | Q3 | Q4 — JCR 기준
  impact_factor: 4.2
  ranking:
    category: Computer Science, Artificial Intelligence
    percentile: 8 # 카테고리 내 상위 8% — 작을수록 상위
    rank: '12/197' # 선택
```

`quartile: Q1`이면 자동으로 파란 **Q1** 뱃지가 붙습니다.
`ranking.percentile`이 10 이하이면 자동으로 금색 **Top X%** 뱃지가 붙습니다.

### 학회/워크숍 논문 (`type: conference` | `workshop`)

```yaml
conference:
  tier: A* # A* | A | B | C — CORE 등급 기준. 모르면 비워두세요
  acceptance_rate: 25.8 # 공식 발표치가 있을 때만 (%)
  h5_index: 250 # 선택
  main_or_findings: main # main | findings | workshop | short
```

`tier: A*`이면 자동으로 파란 **A\*** 뱃지가 붙습니다.

### 프리프린트 (`type: preprint`)

```yaml
preprint:
  venue: arXiv # arXiv | OpenReview | 기타
```

프리프린트는 자동으로 회색 **Preprint** 뱃지가 붙습니다.

## 수동 뱃지

지표로 계산되지 않는 것(수상 등)은 `badges`에 직접 적습니다.

```yaml
badges: [best_paper, oral]
```

`best_paper`(금색) · `oral`(파랑) · `highlight`(초록)은 전용 색이 있습니다.
목록에 없는 문자열을 적어도 회색 뱃지로 그대로 뜹니다 — 오타를 내도 빌드가
깨지지 않지만, 색이 안 입혀지니 위 세 개 중 하나인지 다시 확인하세요.

## 확인하는 법

```bash
pnpm build
```

`/publications/<slug>`를 열어 Metrics 섹션과 뱃지가 원하는 대로 나오는지 봅니다.
지표를 아직 모르면 필드를 통째로 비워두세요 — `journal`/`conference`/`preprint`
전부 선택 필드라 하나도 없어도 정상 렌더됩니다.
