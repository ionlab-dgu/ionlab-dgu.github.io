---
# ── Publication 스키마 ────────────────────────────────────────
# 파일명: <year>-<venue-short>-<keyword>.md  (예: 2027-neurips-invariance.md)
#
# attributed_grants / attributed_projects 가 리포트 자동 집계의 근거입니다.
# 논문이 과제 실적으로 들어가면 반드시 해당 과제 slug를 적어주세요.

slug: # 파일명과 동일
title: # 논문 제목 (영문 원제)
authors: [] # 저자 순서대로. 랩 멤버는 member id, 외부인은 이름 문자열
venue: # 예: NeurIPS 2027 / IEEE TNSRE
year: # YYYY
type: # conference | journal | workshop | preprint
status: # under_review | accepted | published
attributed_grants: [] # 실적으로 귀속되는 과제 slug 목록
attributed_projects: [] # 이 논문이 나온 연구 프로젝트 slug 목록
arxiv: # arXiv ID 또는 URL
code: # 코드 저장소 URL
pdf: # PDF URL (있으면)
bibkey: # refs.bib 의 키

# ── type별 Metrics (선택) ──────────────────────────────────────
# type과 일치하는 블록만 채우세요. 다른 블록에 값을 넣어도 상세 페이지가 무시합니다.
# 자세한 안내: content/handbook/tutorials/publication-registration.md

# type: journal 일 때만
# journal:
#   index_type: SCIE # SCIE | SSCI | ESCI | SCOPUS | 기타 | none
#   quartile: # Q1 | Q2 | Q3 | Q4 (JCR 기준)
#   impact_factor: # 숫자
#   ranking:
#     category: # JCR 카테고리명. 예: Computer Science, Artificial Intelligence
#     percentile: # 카테고리 내 백분위. 작을수록 상위 (5 = 상위 5%)
#     rank: # 선택. 예: "12/197"

# type: conference | workshop 일 때만
# conference:
#   tier: # A* | A | B | C (CORE 등급 기준. 모르면 비워두세요)
#   acceptance_rate: # 숫자 (%). 공식 발표치가 있을 때만
#   h5_index: # 선택
#   main_or_findings: # main | findings | workshop | short

# type: preprint 일 때만
# preprint:
#   venue: # arXiv | OpenReview | 기타

# 수동 뱃지. best_paper | oral | highlight 는 전용 색이 있고, 그 외 문자열도 그대로 뜹니다.
badges: []
---

TODO: 초록 또는 2~3문장 요약. 목록 카드와 상세 페이지에 노출됩니다.
