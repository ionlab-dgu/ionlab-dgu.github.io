---
# 렌더 확인용 가상 모델입니다.
slug: example-invariant-decoder-v1
name: Invariant Decoder v1
task: 재보정 없는 피험자 간 신경 신호 디코딩
architecture: 4-layer CNN + HSIC 조건부 독립성 페널티
trained_on:
  - example-dataset-a
checkpoint: 'TODO: /models/example-invariant-decoder-v1/ (랩 서버)'
code: https://github.com/ionlab-dgu/example-subject-invariant
metrics:
  accuracy: 0.72
  note: 'leave-one-subject-out 5시드 평균, ±1.3%p'
added: 2026-07-18
maintainer: example-ms-gildong-hong
used_by:
  - example-neural-decoding
---

## 설명

EXP-002에서 학습한 첫 불변 표현 디코더. DANN 베이스라인 대비 정확도가 높고
시드 간 분산이 작다. 현재 프로젝트의 기준 모델.

## 재현 방법

```bash
python train.py --config configs/invariant_v1.yaml --seed 0
```

시드 0~4를 각각 학습해 평균을 낸다. 단일 GPU 기준 약 3시간.

## 한계

- 데이터셋 A에만 학습됨. 다른 기록 프로토콜에서의 성능은 미검증.
- HSIC bandwidth를 고정값으로 두었기 때문에 배치 크기를 크게 바꾸면 재조정이 필요하다.
