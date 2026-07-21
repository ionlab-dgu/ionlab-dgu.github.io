---
# 렌더 확인용 가상 프로젝트입니다. 실제 연구가 생기면 폴더째 삭제하세요.
slug: example-neural-decoding
title: Subject-Invariant Representations for Neural Decoding
status: active
lead: example-ms-gildong-hong
collaborators:
  - pi-hyeryung-jang
target_venue: NeurIPS 2027
start: 2026-03
grants:
  - example-nrf-young-researcher
tags:
  - neural decoding
  - representation learning
  - domain generalization
short: 피험자 간 분포 차이에 강건한 신경 신호 표현을 학습해, 재보정 없이 새 사용자에게 일반화한다.
---

## 문제

신경 신호 디코더는 피험자마다 신호 분포가 크게 달라, 새 사용자마다 수십 분의
재보정(calibration) 세션을 요구한다. 이 비용이 실사용을 막는 가장 큰 장벽이다.

## 접근

피험자 정체성과 무관한(subject-invariant) 표현을 학습해 재보정 없이 전이하는 것을 목표로 한다.
핵심 아이디어는 디코딩에 필요한 정보와 피험자 고유 정보를 분리하되, 분리 기준을
적대적 학습이 아니라 조건부 독립성 제약으로 두는 것이다.

## 현재 상태

베이스라인 재현 완료(EXP-001). 현재 불변성 제약의 형태를 비교 중.
다음 마일스톤: 3개 공개 데이터셋에서 zero-calibration 성능이 베이스라인을 넘는지 확인.

## 관련 연구

- Domain-adversarial training (Ganin et al.) — 가장 가까운 베이스라인. 우리는 적대적 목적함수의 불안정성을 피하려 한다.
- TODO: 두 번째 선행 연구
- TODO: 세 번째 선행 연구

자세한 정리는 [reading.md](./reading.md).
