---
# ── ResearchProject 스키마 ────────────────────────────────────
# 폴더 규칙: content/research/<slug>/  (slug는 kebab-case 영문)
# 이 폴더에 함께 두는 파일: reading.md, experiments.md, datasets.md, ideas.md, meetings/
#
# 연구(Research)는 "학생 주도 · 논문 기여 목표 · 라이프사이클 유동적"입니다.
# 과제(Grant, PI 주도 · 리포트 의무)와는 별개이며 N:N으로 연결됩니다.

slug: # 폴더명과 동일
title: # 영문 제목 (논문 제목 초안이어도 좋음)
status: idea # idea | active | writing | submitted | accepted | paused | archived
lead: # 주도 학생의 member id
collaborators: [] # 참여자 member id 목록 (lead 제외)
target_venue: # 목표 학회/저널. 예: NeurIPS 2027
start: # YYYY-MM
grants: [] # 이 연구를 지원하는 과제 slug 목록 (없으면 빈 배열)
tags: []
short: # 한 줄 요약. 카드/목록에 노출됩니다.
---

## 문제

TODO: 무엇이 풀리지 않았는가. 왜 중요한가.

## 접근

TODO: 어떤 방법으로 풀 것인가. 핵심 아이디어 한 문단.

## 현재 상태

TODO: 지금 어디까지 왔는가. 다음 마일스톤은 무엇인가.

## 관련 연구

TODO: 가장 가까운 선행 연구 2~3개와, 우리가 다른 점.
자세한 정리는 reading.md 에.
