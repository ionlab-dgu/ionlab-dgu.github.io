---
type: reading_list
project: example-neural-decoding
---

# 읽은 논문

| 날짜 | 논문 | 한 줄 요약 | 우리와의 관계 |
| --- | --- | --- | --- |
| 2026-07-10 | Ganin et al., Domain-Adversarial Training of Neural Networks, JMLR 2016 | gradient reversal로 도메인 판별 불가능한 특징을 학습 | 주 베이스라인. 학습 불안정성이 우리의 출발점 |
| 2026-07-03 | TODO: 저자, 제목, venue | TODO | TODO |

## 읽을 것

- [ ] TODO: 조건부 독립성 기반 불변 표현 학습 관련 최신 논문
- [ ] TODO: 신경 신호 전이학습 서베이

## 깊게 본 논문

### Domain-Adversarial Training of Neural Networks

- **문제**: 라벨 있는 source와 라벨 없는 target의 분포가 다를 때 일반화가 무너진다.
- **기여**: gradient reversal layer로 도메인 분류기를 속이는 특징 추출기를 end-to-end 학습.
- **방법**: feature extractor + label predictor + domain classifier, GRL로 min-max.
- **한계**: min-max 최적화가 불안정하고, 도메인 수가 많을 때(피험자 = 도메인) 성능이 떨어진다.
- **우리에게**: 우리 세팅은 도메인이 곧 피험자라 수십 개에 이른다. 적대적 목적함수 대신
  조건부 독립성 제약을 쓰려는 동기가 여기서 나온다.
