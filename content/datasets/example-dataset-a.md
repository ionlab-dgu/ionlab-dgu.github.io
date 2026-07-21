---
# 렌더 확인용 가상 데이터셋입니다.
slug: example-dataset-a
name: Example Neural Decoding Dataset A
source: https://example.com/dataset-a
license: CC BY-NC 4.0
size: 피험자 20명 × 5세션, 약 40GB
modality:
  - EEG
location: 'TODO: /data/example-dataset-a (랩 서버)'
access: open
added: 2026-07-01
maintainer: example-ms-gildong-hong
used_by:
  - example-neural-decoding
---

## 설명

20명의 피험자가 5회 세션에 걸쳐 수행한 운동 상상 과제의 EEG 기록.
피험자 간 신호 분포 차이가 커 도메인 일반화 벤치마크로 자주 쓰인다.

## 취득·사용 조건

비영리 연구 목적에 한해 사용 가능. 논문에 사용 시 원 데이터 논문 인용 필수.
**재배포 불가** — 각자 원 출처에서 내려받을 것.

## 알려진 문제

- 피험자 7번 3번 세션: 전극 접촉 불량으로 채널 절반 소실. 분석에서 제외 권장.
- 세션 간 임피던스 차이로 인한 스케일 드리프트가 있어 세션별 정규화 필요.
