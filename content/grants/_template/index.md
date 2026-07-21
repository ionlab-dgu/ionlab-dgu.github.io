---
# ── Grant 스키마 ──────────────────────────────────────────────
# 폴더 규칙: content/grants/<slug>/
# 함께 두는 파일: deliverables.md, reports.md, meetings/
#
# 과제(Grant)는 "PI 주도 · 리포트 데드라인 엄격 · 산출 의무"입니다.
# 연구(Research)와 N:N으로 연결됩니다 (linked_research).
#
# 예산 금액 세부는 여기 적지 않습니다 — 학교 연구비 시스템이 정본입니다.
# 여기서는 대략적 일정·데드라인만 추적합니다.

slug: # 폴더명과 동일
title_ko: # 과제 국문명 (협약서 기준)
funder: # 지원기관. 예: 한국연구재단(NRF)
grant_number: # 과제번호
period:
  start: # YYYY-MM-DD
  end: # YYYY-MM-DD
pi: pi-hyeryung-jang
co_pis: [] # member id 또는 외부 연구자명
status: active # planned | active | reporting | closed
next_deadline:
  kind: # interim_report | final_report | 정산
  due: # YYYY-MM-DD
linked_research: [] # 이 과제로 지원되는 연구 프로젝트 slug 목록
---

## 과제 개요

TODO: 협약서 기준 목표를 2~3문장으로.

## 연차별 목표

- **1차년도**: TODO
- **2차년도**: TODO

## 참여 연구원

TODO: 누가 몇 % 참여인지. (정본은 협약서/학교 시스템)
