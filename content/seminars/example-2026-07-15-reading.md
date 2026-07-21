---
# 렌더 확인용 가상 리딩 그룹 노트입니다.
date: 2026-07-15
type: reading
title:
paper: 'Ganin et al., Domain-Adversarial Training of Neural Networks, JMLR 2016'
paper_url: https://arxiv.org/abs/1505.07818
presenter: example-ms-gildong-hong
affiliation:
attendees:
  - example-ms-gildong-hong
  - pi-hyeryung-jang
visibility: internal
---

## 논문 요약

- **문제**: source에는 라벨이 있고 target에는 없을 때, 분포 차이로 일반화가 무너진다.
- **기여**: gradient reversal layer 하나로 도메인 불변 특징 학습을 end-to-end로 가능하게 함.
- **방법**: feature extractor를 공유하고 label predictor는 최소화, domain classifier는 최대화(GRL).
- **결과**: 여러 이미지 도메인 적응 벤치마크에서 당시 SOTA.
- **한계**: min-max가 불안정하고 도메인 수가 많으면 성능이 떨어진다.

## 토론

- 도메인이 곧 피험자인 우리 세팅에서는 도메인이 수십 개다. 이때 domain classifier가
  실제로 무엇을 학습하는지 확인이 필요하다는 지적.
- GRL의 lambda 스케줄이 결과를 크게 좌우한다는 점에서, 보고된 성능이
  튜닝에 얼마나 의존하는지 논쟁이 있었음 (결론 미도출).

## 우리 연구와 연결

example-neural-decoding의 주 베이스라인. EXP-001에서 재현했고,
불안정성을 회피하려는 시도가 EXP-002(HSIC)로 이어졌다.

## Take-aways

- 적대적 목적함수의 분산을 리포트하지 않는 논문은 재현 시 주의할 것
- 도메인 수가 많은 세팅에서는 적대적 방식 외의 대안을 먼저 검토
