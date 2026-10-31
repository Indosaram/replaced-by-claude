# replaced-by-claude 출시 키트

이 폴더는 출시 직전 상태까지만 준비된 자료다. 아무것도 자동으로 게시되지 않았고, 예약도 걸려 있지 않다. 게시는 직접 한다.

## 사이트

- 주소: https://indosaram.github.io/replaced-by-claude/
- 호스팅: GitHub Pages (저장소 `Indosaram/replaced-by-claude`, main에 push하면 Actions가 배포)
- 왜 GitHub Pages인가: 기본값으로 정했고 배포, HTTPS, OG 이미지 모두 정상이라 Cloudflare로 넘어갈 이유가 없었다. 서버도 비용도 없다.
- 동작: 방문자 브라우저가 GitHub 공개 API를 직접 부른다(조회당 최대 2회, IP당 시간당 60회 제한). 같은 아이디는 24시간 캐시된다. 런타임에 AI 호출은 없다.
- 공유 링크 `?u=<아이디>` 로 들어오면 결과가 바로 뜬다.

## 게시 방법

1. `posts.md` 의 **1. Launch post** 문안을 그대로 복사한다.
2. 이미지로 `cards/Indosaram.png` 를 첨부한다.
3. 게시 후 바로 이어서 **2. Build-in-public thread** 3개를 그 글의 답글로 단다.
4. 출시 글을 프로필에 고정하고, 바이오에 사이트 링크를 넣는다.

## 답글 플레이북

`posts.md` 의 **3. Reply templates** 에 아래 계정용 템플릿이 있다. 각자의 카드 이미지는 `cards/<아이디>.png` 다.

> **X 핸들은 아직 아무도 확인하지 않았다.** 아래 X 아이디는 전부 각자의 GitHub 프로필 `twitter_username` 칸에서 자동으로 가져온 값이다 (`cards.json` 의 `handle_source: "github_profile"`, `owner_verified: false`). 답글을 달기 전에 x.com 에서 그 사람 본인 계정이 맞는지 직접 확인한다. 특히 GitHub 아이디와 X 아이디가 다른 **yyx990803 → evanyou**, **t3dotgg → theo**, **developit → _developit**, **jakearchibald → jaffathecake** 는 꼭 확인한다.

| GitHub | X (확인 필요) |
| --- | --- |
| sindresorhus | sindresorhus |
| yyx990803 | evanyou |
| antirez | antirez |
| mitchellh | mitchellh |
| kentcdodds | kentcdodds |
| addyosmani | addyosmani |
| ThePrimeagen | ThePrimeagen |
| t3dotgg | theo |
| shadcn | shadcn |
| dhh | dhh |
| jaredpalmer | jaredpalmer |
| wesbos | wesbos |
| developit | _developit |
| kettanaito | kettanaito |
| tannerlinsley | tannerlinsley |
| colinhacks | colinhacks |
| simonw | simonw |
| jakearchibald | jaffathecake |
| mjackson | mjackson |
| ryanflorence | ryanflorence |

사용법:

- 그 사람이 **24시간 안에** 올린, 개발이나 만들기에 관한 글 아래에만 단다.
- `{context}` 자리에 그 글 내용에 맞는 짧은 말을 직접 넣는다. 템플릿을 그대로 붙이지 않는다.
- 카드 이미지를 반드시 첨부한다. 링크는 넣지 않는다. 다른 사람을 @로 부르지 않는다.
- 하루 **최대 5개**까지만 단다.

## 안전 규칙

- 답글은 이미지 중심, 링크 없음, 하루 최대 5개, 24시간 이내 글에만.
- 자동 팔로우, 자동 좋아요, 자동 답글은 하지 않는다. 계정 정지 위험이 크다.
- 신고, 경고, 기능 제한 알림이 하나라도 오면 **즉시 답글을 멈춘다.**
- 상대가 불쾌해하면 사과하고 그 답글은 지운다.
- 카드의 문장은 코드와 GitHub 습관만 다루도록 두 번 검사했다(AI 티 검사, 개인 공격 검사). 그래도 실명 대상 농담이니 상대 분위기를 보고 판단한다.

## 기준 지표

- 팔로워 수: **약 3명** (2026-10-25 기준 메모 기록, **직접 확인 필요**). x.com을 긁어서 확인하지 않았다.
- 출시 직전에 현재 팔로워 수를 직접 적어 둔다: ______

## 48시간 뒤에 볼 것

- 팔로워 증가 수 (출시 직전 대비)
- 출시 글 노출수, 링크 클릭수, 리포스트/인용 수 (X 애널리틱스)
- 답글 단 계정 중 반응(좋아요, 답글, 인용)한 계정 수
- 다른 사람이 자기 카드를 올린 인용/게시 수 (`replaced-by-claude` 로 X 검색)
- GitHub 저장소 스타 수

## 파일

- `posts.md`: 출시 글, 스레드 3개, 답글 템플릿
- `review.json`: 문안별 AI 티 점수와 Jev 점수, 통과 여부
- `jev-instructions.md`: Jev 판정에 쓴 기준
- `cards.json`: 20명 카드 데이터 (라벨, 문장, X 핸들)
- `cards-owner.json`, `cards/Indosaram.png`: 내 카드
- `cards/*.png`: 1200x675 공유 카드 21장
