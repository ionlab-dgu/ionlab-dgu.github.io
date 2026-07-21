---
# 렌더 확인용 가상 리딩 그룹 노트입니다.
date: 2026-07-15
type: reading
title:
paper: 'Hamilton et al., Inductive Representation Learning on Large Graphs, NeurIPS 2017'
paper_url: https://arxiv.org/abs/1706.02216
presenter: example-ms-gildong-hong
affiliation:
attendees:
  - example-ms-gildong-hong
  - pi-hyeryung-jang
visibility: internal
---

## 논문 요약

- **문제**: 그래프가 너무 커서 전체를 한 번에 다룰 수 없고, 학습 때 못 본 노드도 처리해야 한다.
- **기여**: 이웃을 고정 개수로 샘플링해 집계하는 귀납적 학습 프레임워크(GraphSAGE)를 제시.
- **방법**: 층마다 이웃 k개를 샘플링하고 mean/LSTM/pool 집계기로 노드 표현을 갱신.
- **결과**: 대규모 그래프에서 전이 학습 기반 방법 대비 확장성과 일반화를 모두 확보.
- **한계**: 샘플 수 k를 줄였을 때 정확도가 얼마나 떨어질지에 대한 보장이 없다.

## 토론

- k를 층마다 다르게 두는 게 자연스러워 보이는데(깊은 층일수록 이웃이 많으므로),
  논문은 이를 다루지 않는다. 실제로 이득이 있는지 확인해 볼 만하다는 의견.
- 집계기 선택(mean vs pool)이 결과에 미치는 영향이 데이터셋마다 달라 보이는데,
  그 차이가 그래프의 어떤 성질에서 오는지는 결론이 나지 않았음.

## 우리 연구와 연결

example-efficient-gnn-inference의 주 베이스라인. EXP-001에서 재현했고,
"k를 튜닝 대상이 아니라 예산 제약으로 두자"는 우리 문제 설정이 이 논문의 빈틈에서 나왔다.

## Take-aways

- 비용을 다루는 논문은 지연 측정 프로토콜(워밍업·배치·하드웨어)을 반드시 확인할 것.
  정확도만 재현하고 넘어가면 비용 주장을 비교할 수 없다.
- 하이퍼파라미터로 남겨진 것이 무엇인지 보면 다음 연구 주제가 보인다.
