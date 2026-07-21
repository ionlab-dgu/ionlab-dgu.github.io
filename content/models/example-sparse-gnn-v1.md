---
# 렌더 확인용 가상 모델입니다.
slug: example-sparse-gnn-v1
name: Sparse GNN v1
task: 예산 제약 하의 대규모 그래프 노드 분류
architecture: 3-layer GraphSAGE + 상한 기반 엣지 선택
trained_on:
  - example-graph-bench
checkpoint: 'TODO: /models/example-sparse-gnn-v1/ (랩 서버)'
code: https://github.com/ionlab-dgu/example-efficient-gnn
metrics:
  accuracy: 0.782
  latency_ms: 41
  note: '엣지 예산 50%, 3시드 평균 ±0.4%p. A100 배치 1024 기준'
added: 2026-07-18
maintainer: example-ms-gildong-hong
used_by:
  - example-efficient-gnn-inference
---

## 설명

EXP-002에서 학습한 첫 예산 제약 모델. 엣지의 50%만 남기고도 전체 그래프 대비
정확도 하락이 0.9%p에 그치며, 추론 지연은 절반 수준. 현재 프로젝트의 기준 모델.

## 재현 방법

```bash
python train.py --config configs/sparse_v1.yaml --budget 0.5 --seed 0
```

시드 0~2를 각각 학습해 평균을 낸다. 단일 GPU 기준 약 4시간.
**지연을 측정할 때는 워밍업 20회 후 100회 평균**을 쓰세요 (EXP-001 참고).

## 한계

- 그래프가 고정된 설정만 검증했습니다. 엣지가 계속 추가되는 동적 그래프에서는
  상한 캐시가 무효화되어 이득이 사라집니다.
- 벤치마크 하나에만 학습했습니다. 차수 분포가 크게 다른 그래프에서의 성능은 미검증.
