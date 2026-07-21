---
# ── Member 스키마 ─────────────────────────────────────────────
# 파일명 규칙: <role-prefix>-<name-en-kebab>.md  (예: ms-gildong-hong.md)
#   ug_intern → intern- / ms → ms- / phd → phd- / postdoc → postdoc- / pi → pi-
# 졸업 시: role을 alumni로 바꾸고 alumni_since 추가. 파일명·id는 그대로 둡니다.

id: # 파일명(확장자 제외)과 반드시 동일. 예: ms-gildong-hong
name_ko: # 홍길동
name_en: # Gildong Hong
role: # ug_intern | ms | phd | postdoc | pi | alumni
cohort: # 합류 연월 YYYY-MM. 예: 2026-03
advisor: pi-hyeryung-jang # 지도교수 member id

# 참여 중인 연구 프로젝트 slug 목록 (content/research/<slug>/)
projects: []

# 참여 중인 과제. participation_pct는 참여율(%)
grants: []
# 예:
# grants:
#   - grant_slug: example-nrf-young-researcher
#     participation_pct: 50

interests: [] # 자유 키워드. 예: [neural decoding, bayesian inference]

github: # GitHub 사용자명 (@ 없이). 인증·권한 매핑에 쓰입니다.
email:
photo: # public/images/members/<id>.jpg 기준 경로. 없으면 이니셜 아바타로 대체
homepage: # 개인 홈페이지/구글 스칼라 URL

# 졸업생만:
# alumni_since: 2028-02
# current_position: 'OOO 연구원'
---

TODO: 2~4문장 자기소개. 어떤 문제에 관심이 있고, 어떤 방법을 쓰는지.
공개 페이지(/members/<id>)에 그대로 노출됩니다.
