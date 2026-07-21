---
type: datasets
project: example-efficient-gnn-inference
---

# 이 프로젝트가 쓰는 데이터

## Example Graph Benchmark

- **레지스트리**: [content/datasets/example-graph-bench.md](../../datasets/example-graph-bench.md)
- **위치**: TODO: 랩 서버 경로
- **전처리**: 무방향화, 자기 루프 제거, 노드 특징 행 단위 정규화.
  CSR 인접 캐시를 미리 생성해 둡니다 (EXP-001 참고 — 이걸 빠뜨리면 지연 측정이 왜곡됩니다).
- **Split**: 공개 벤치마크의 표준 split을 그대로 사용. **직접 나누지 말 것** — 비교가 불가능해집니다.
- **주의**: 전이(transductive) 설정과 귀납(inductive) 설정의 split이 다릅니다.
  우리는 귀납 설정을 씁니다. 논문 수치와 비교할 때 어느 쪽인지 반드시 확인하세요.
