---
type: experiments
project: example-neural-decoding
---

# 실험 로그

**규칙: 실패한 실험도 지우지 않습니다.**

## EXP-002 — 조건부 독립성 제약 (HSIC) 도입

- **날짜**: 2026-07-18
- **가설**: 적대적 목적함수를 HSIC 페널티로 바꾸면 학습이 안정되고 zero-calibration 정확도가 오른다.
- **설정**: example-dataset-a, 4-layer CNN, lr 1e-3, seed 0/1/2, leave-one-subject-out
- **코드**: TODO: commit hash
- **결과**: 진행 중.
- **해석**: —
- **다음**: —

---

## EXP-001 — DANN 베이스라인 재현

- **날짜**: 2026-07-08
- **가설**: 공개 구현 설정 그대로면 논문 보고치(±2%p) 안에 들어온다.
- **설정**: example-dataset-a, 4-layer CNN, lr 1e-3, seed 0/1/2, leave-one-subject-out
- **코드**: TODO: commit hash
- **결과**: 평균 정확도가 보고치보다 3.4%p 낮음. 시드 간 분산이 큼(±4.1%p).
- **해석**: 분산이 큰 것 자체가 적대적 학습 불안정성의 증거로 보인다.
  전처리 차이 가능성도 남아 있어 배제 필요.
- **다음**: 전처리를 논문과 일치시킨 뒤 재측정(→ 완료, 차이 1.1%p로 축소).
  이후 EXP-002로 진행.
