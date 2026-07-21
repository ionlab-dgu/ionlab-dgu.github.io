---
type: datasets
project: example-neural-decoding
---

# 이 프로젝트가 쓰는 데이터

## Example Dataset A

- **레지스트리**: [content/datasets/example-dataset-a.md](../../datasets/example-dataset-a.md)
- **위치**: TODO: 랩 서버 경로
- **전처리**: 0.5–40Hz 밴드패스, 250Hz 리샘플, 세션별 z-score
- **Split**: leave-one-subject-out. **사람 단위**로 나눔 (세션 단위로 나누면 누수)
- **주의**: 피험자 7번은 3번 세션에 기록 결함이 있어 제외.
