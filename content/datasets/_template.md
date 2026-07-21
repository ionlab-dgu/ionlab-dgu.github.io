---
# ── Dataset 레지스트리 스키마 ─────────────────────────────────
# 파일명: <slug>.md (kebab-case)
# 전역 레지스트리입니다. 프로젝트별 사용법은 각 프로젝트의 datasets.md 에.

slug: # 파일명과 동일
name: # 데이터셋 이름
source: # 출처. 공개 데이터면 URL, 자체 수집이면 수집 주체
license: # 예: CC BY-NC 4.0 / 기관 협약 / 자체
size: # 예: 12GB, 노드 230만 / 엣지 6100만
modality: [] # 예: [graph, node features, text]
location: # 랩 서버 경로 또는 스토리지 위치
access: open # open | restricted | internal
added: # YYYY-MM-DD
maintainer: # member id
used_by: [] # 이 데이터를 쓰는 연구 프로젝트 slug 목록
---

## 설명

TODO: 무엇을 담은 데이터인가.

## 취득·사용 조건

TODO: 라이선스, IRB, 인용 요구사항 등. **재배포 가능 여부를 반드시 명시.**

## 알려진 문제

TODO: 결측, 라벨 노이즈, split 불일치, 중복 레코드 등.
