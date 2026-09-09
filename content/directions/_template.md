---
# ── ResearchDirection 스키마 ──────────────────────────────────
# 파일명: <slug>.md  (slug는 kebab-case 영문, 폴더 아니고 단일 파일)
# 정본: src/lib/types.ts 의 ResearchDirection. 스키마를 바꾸면 이 주석도 고치세요.
#
# 방향(Direction)은 ResearchProject(개별 프로젝트)보다 한 단계 위의 분류이고,
# 자주 바뀌지 않습니다. 새 프로젝트가 하나 생겼다고 방향을 늘리지 마세요 — 자세한
# 기준은 이 폴더의 README.md를 보세요.

slug: # 파일명과 동일
order: # 화면 노출 순서. 낮을수록 먼저. 기존 방향과 겹치지 않게.
name_en: # 영문 이름 (필수)
name_ko: # 한글 이름 (선택 — 없으면 name_en만 노출)
short: # 카드에 노출되는 한 줄 요약
description: # 상세 페이지 본문 위에 노출되는 조금 더 긴 설명
topics: [] # 이 방향 아래 다루는 세부 주제 목록 (bullet로 노출)
status: active # active | emerging | paused
---

TODO: 이 방향에 대한 좀 더 긴 소개(선택). 왜 이 방향을 다루는지,
어떤 배경에서 나왔는지 등을 자유 형식으로 적어도 됩니다.
