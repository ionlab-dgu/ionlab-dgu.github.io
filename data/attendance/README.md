# 출결 데이터 (append-only JSONL)

## 형식

`data/attendance/YYYY-MM.jsonl` — 한 달에 한 파일, 한 줄에 한 이벤트.

```json
{"user":"ms-gildong-hong","action":"checkin","at":"2026-07-21T09:12:03+09:00"}
{"user":"ms-gildong-hong","action":"break_out","at":"2026-07-21T12:30:00+09:00","note":"점심"}
{"user":"ms-gildong-hong","action":"break_in","at":"2026-07-21T13:24:11+09:00"}
{"user":"ms-gildong-hong","action":"checkout","at":"2026-07-21T18:40:52+09:00"}
```

| 필드     | 타입    | 설명                                                             |
| -------- | ------- | ---------------------------------------------------------------- |
| `user`   | string  | member id (`content/members/<id>.md`)                            |
| `action` | enum    | `checkin` \| `break_out` \| `break_in` \| `checkout` \| `remote` |
| `at`     | string  | ISO 8601, 오프셋 포함 (`+09:00`)                                 |
| `note`   | string? | 선택. 짧은 메모                                                  |

## 규칙

- **Append-only.** 기존 줄을 수정하거나 삭제하지 않습니다.
  잘못 눌렀다면 정정 이벤트를 새로 추가하세요.
- 자기 보고입니다. 자동 추적하지 않습니다.
- **통계·랭킹·리더보드를 만들지 않습니다.** 출결 데이터는 "지금 누가 연구실에 있는가"를
  보여주기 위한 것이지, 성실도를 측정하기 위한 것이 아닙니다.
- 개인 로그는 본인만 열람합니다. 집계 뷰는 현재 상태(재실/재택/외출/미출근 인원)만 노출합니다.

## Phase

- **Phase 1 (현재)**: 파일 기반. 읽기 헬퍼는 `src/lib/attendance.ts`.
  정적 빌드이므로 쓰기는 아직 동작하지 않습니다 (UI는 스텁).
- **Phase 2**: 인증 도입 후 서버 엔드포인트 또는 GitHub API 커밋으로 append.
