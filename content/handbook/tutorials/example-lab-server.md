---
# 렌더 확인용 가상 튜토리얼입니다. 실제 서버 안내로 교체하세요.
slug: example-lab-server
title: (예시) 랩 서버에서 실험 돌리기
order: 41
visibility: internal
audience: []
updated: 2026-07-21
---

# 랩 서버에서 실험 돌리기

## 이 문서를 읽으면

랩 GPU 서버에 접속해 실험을 제출하고 결과를 가져올 수 있습니다.

## 사전 준비

- 서버 계정 (PI에게 신청)
- SSH 공개키 등록
- 학교 VPN (교외 접속 시)

## 단계

### 1. 접속

```bash
ssh <username>@TODO.dongguk.edu
```

### 2. 환경 준비

```bash
conda activate labenv     # TODO: 실제 환경 이름
nvidia-smi                # 비어 있는 GPU 확인
```

### 3. 실험 제출

```bash
CUDA_VISIBLE_DEVICES=0 python train.py --config configs/example.yaml --seed 0
```

긴 작업은 세션이 끊겨도 살아남도록 `tmux` 안에서 실행하세요.

### 4. 결과 가져오기

```bash
rsync -avz <username>@TODO.dongguk.edu:~/runs/<exp-id>/ ./runs/<exp-id>/
```

## 잘 안 될 때

| 증상 | 원인 | 해결 |
| --- | --- | --- |
| `CUDA out of memory` | 다른 사람이 GPU 사용 중 | `nvidia-smi`로 빈 GPU 확인 후 인덱스 변경 |
| SSH 연결 거부 | 교외에서 VPN 미접속 | 학교 VPN 연결 후 재시도 |
| 세션 끊기면 학습 중단 | tmux 미사용 | `tmux new -s exp` 안에서 실행 |

## 지켜야 할 것

- GPU를 점유한 채 방치하지 않습니다. 끝난 프로세스는 정리하세요.
- 대용량 데이터는 홈 디렉터리가 아니라 TODO: 지정 경로에 둡니다.
