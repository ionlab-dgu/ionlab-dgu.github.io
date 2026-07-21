---
# ── Model 레지스트리 스키마 ───────────────────────────────────
# 파일명: <slug>.md
# 랩에서 학습·유지하는 모델 체크포인트 registry.

slug: # 파일명과 동일
name: # 모델 이름
task: # 무슨 문제를 푸는가
architecture: # 예: 4-layer CNN + HSIC penalty
trained_on: [] # dataset slug 목록
checkpoint: # 체크포인트 위치 (서버 경로 / HF Hub URL)
code: # 학습 코드 저장소 URL + commit
metrics: {} # 예: {accuracy: 0.72, note: 'leave-one-subject-out 평균'}
added: # YYYY-MM-DD
maintainer: # member id
used_by: [] # 이 모델을 쓰는 프로젝트 slug 목록
---

## 설명

TODO: 어떤 모델이고 언제 쓰면 되는가.

## 재현 방법

TODO: 어떤 명령으로 학습·평가하는가. 시드·환경 포함.

## 한계

TODO: 어떤 조건에서 성능이 무너지는가.
