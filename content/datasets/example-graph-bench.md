---
# 렌더 확인용 가상 데이터셋입니다.
slug: example-graph-bench
name: Example Graph Benchmark
source: https://example.com/graph-bench
license: CC BY 4.0
size: 노드 230만, 엣지 6100만, 약 12GB
modality:
  - graph
  - node features
location: 'TODO: /data/example-graph-bench (랩 서버)'
access: open
added: 2026-07-01
maintainer: example-ms-gildong-hong
used_by:
  - example-efficient-gnn-inference
---

## 설명

대규모 인용 네트워크 형태의 노드 분류 벤치마크. 전체 그래프를 한 번에 올리기 어려운 규모라,
샘플링·희소화 기법의 비용 대비 성능을 비교하는 표준 벤치마크로 쓰인다.

## 취득·사용 조건

CC BY 4.0 — 출처 표시 시 자유롭게 사용 가능. 논문에 사용 시 원 데이터 논문 인용.
재배포는 가능하나 용량이 크므로 각자 원 출처에서 내려받는 것을 권장.

## 알려진 문제

- 전이(transductive)·귀납(inductive) 두 가지 표준 split이 있고 수치가 다릅니다.
  논문 수치와 비교할 때 어느 쪽인지 반드시 확인하세요.
- 원본 엣지 목록에 중복과 자기 루프가 있습니다. 전처리에서 제거해야 차수 통계가 맞습니다.
- 노드 특징이 희소 행렬로 배포됩니다. dense로 변환하면 메모리가 급증하니 그대로 쓰세요.
