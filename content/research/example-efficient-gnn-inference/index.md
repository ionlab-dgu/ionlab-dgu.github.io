---
# 렌더 확인용 가상 프로젝트입니다. 실제 연구가 생기면 폴더째 삭제하세요.
slug: example-efficient-gnn-inference
title: Budget-Aware Sparsification for Scalable GNN Inference
status: active
lead: example-ms-gildong-hong
collaborators:
  - pi-hyeryung-jang
target_venue: NeurIPS 2027
start: 2026-03
grants:
  - example-nrf-graph-optimization
tags:
  - graph neural networks
  - efficient inference
  - sparsification
short: 정확도 손실의 상한을 보장하면서 대규모 그래프에서 GNN 추론 비용을 줄인다.
---

## 문제

GNN 추론 비용은 이웃 확장(neighborhood explosion) 때문에 층수에 따라 급격히 커진다.
샘플링·희소화로 비용을 줄일 수 있지만, **얼마나 줄이면 정확도가 얼마나 떨어지는지**를
미리 알 수 없다는 것이 실제 배포의 걸림돌이다. 엣지 기기처럼 연산 예산이 고정된
환경에서는 "이 예산 안에서 최선"임을 말할 수 있어야 한다.

## 접근

주어진 연산 예산을 제약으로 두고 어떤 엣지를 남길지를 최적화 문제로 정식화한다.
핵심 아이디어는 엣지를 중요도 순으로 자르는 대신 **예측 변화량의 상한**을 기준으로
자를 엣지를 고르는 것이다. 이렇게 하면 희소화 비율마다 정확도 손실의 보장이 함께 나온다.

## 현재 상태

균일 샘플링과 중요도 기반 희소화 베이스라인 재현 완료(EXP-001).
현재 상한 기반 선택 규칙을 구현해 비교 중.
다음 마일스톤: 3개 벤치마크에서 동일 예산 대비 정확도 우위와 보장의 유효성 확인.

## 관련 연구

- GraphSAGE (Hamilton et al.) — 이웃 샘플링의 출발점. 우리는 샘플링을 무작위가 아니라 예산 제약 최적화로 본다.
- TODO: 그래프 희소화 이론 쪽 선행 연구
- TODO: 엣지 환경 GNN 배포 관련 연구

자세한 정리는 [reading.md](./reading.md).
