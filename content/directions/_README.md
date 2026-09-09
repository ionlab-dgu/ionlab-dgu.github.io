# content/directions/

랩의 상위 연구 방향(Research Direction)을 정의하는 폴더입니다.

## 이게 뭔가요

`content/research/<slug>/`(개별 연구 프로젝트, 학생 주도)보다 한 단계 위의 분류입니다.
"ION Lab이 어떤 방향의 문제를 다루는가"를 홈·`/research` 페이지에서 보여주는 용도이고,
각 방향 아래 여러 프로젝트가 느슨하게 연결됩니다(연구 프로젝트의 `direction` 필드로).

과제(Grant)나 개별 연구(ResearchProject)와 달리 **자주 바뀌지 않습니다.** 랩의 정체성에
가까운 분류이므로, 새 프로젝트 하나 생겼다고 방향을 늘리지 마세요 — 기존 방향 중 하나에
`direction:`으로 연결하는 쪽이 기본입니다.

## 파일 구조

```
content/directions/
  _template.md              # 새 방향 추가용 (로더가 건너뜁니다)
  generative-ai.md
  efficient-learning-inference.md
  applied-ai.md
```

파일 하나 = 방향 하나. 폴더가 아니라 단일 마크다운 파일입니다 (Publication과 같은 형태).

## 새 방향을 추가하려면

1. `_template.md`를 복사해 `<slug>.md`로 저장합니다 (slug는 kebab-case 영문).
2. frontmatter를 채웁니다. `order`는 기존 방향들과 겹치지 않게 다음 번호를 씁니다.
3. `src/pages/research/directions/index.astro`와 `[slug].astro`는 파일을 자동으로
   읽으므로 코드를 고칠 필요는 없습니다.

## 프로세스 — 방향을 늘리는 기준

새 방향은 "이미 진행 중인 연구 프로젝트가 여러 개 있고, 기존 방향 어디에도 잘 안 맞을 때"
추가합니다. 아이디어 단계의 주제 하나만으로는 추가하지 않습니다 — 그런 주제는 먼저
`content/research/<slug>/`로 시작해서, `direction:` 없이(= 미분류) 두면 됩니다.

방향을 뺄 때는 파일을 지우지 말고 `status: paused`로 바꿔 둡니다. 그 방향을 참조하는
연구 프로젝트가 있을 수 있어서, 링크가 끊기지 않게 하려는 것입니다.
