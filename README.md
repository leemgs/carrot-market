# 🥕 당근마켓 신규 매물 알림 (Carrot Market Alert)

원하는 **제품 키워드**와 **구매 지역**을 등록하면, [당근마켓](https://www.daangn.com/kr/)에
조건에 맞는 **신규 매물**이 올라올 때 **Google SMTP(Gmail)** 로 이메일 알림을 보내주는 웹앱입니다.

> 예시) 제품 `가마솥`, 지역 `수원시` 를 등록 → 판매 위치가 수원이면서 제목에 "가마솥"이
> 포함된 새 매물이 올라오면, 지정한 이메일로 매물 정보와 당근마켓 구매 링크가 도착합니다.
> 모바일에서 링크를 눌러 빠르게 구매 문의를 할 수 있습니다.

---

## 구성

| 경로 | 설명 |
| --- | --- |
| `docs/` | 홈페이지(GitHub Pages). 키워드·지역·이메일을 입력해 감시 설정을 생성 |
| `docs/admin.html` | 웹 관리자. GitHub API로 감시 목록을 조회·추가·수정·삭제하고 커밋 |
| `docs/chat.html` | 빠른 채팅 도우미. 이메일에서 열려 인사말 복사 + 매물 채팅 화면으로 이동 |
| `config/watches.json` | 감시 목록(키워드/지역/이메일) |
| `scripts/` | 당근마켓 검색·파싱·이메일 발송 Node 스크립트 |
| `state/seen.json` | 이미 알림 보낸 매물 ID (중복 방지, 워크플로가 자동 커밋) |
| `.github/workflows/daangn-alert.yml` | 15분마다 실행되는 GitHub Actions |

## 동작 방식

```
GitHub Actions (매 15분, cron)
   └─ scripts/check_daangn.js
        ├─ config/watches.json 의 각 감시 항목 읽기
        ├─ 당근마켓에서 키워드로 검색 → 매물 파싱
        ├─ "제목에 키워드 포함 AND 지역 일치" 로 필터
        │    (지역 미입력 시 전국 대상)
        ├─ state/seen.json 과 비교해 신규 매물만 선별
        ├─ 신규 매물 발견 시:
        │    ├─ GitHub 이슈 등록 (라벨: 당근마켓-알림)
        │    └─ Gmail SMTP 로 이메일 발송
        └─ state/seen.json 갱신 후 커밋
```

---

## 설정 방법

### 1. Gmail 앱 비밀번호 발급
1. 발신용 Gmail 계정에서 **2단계 인증**을 켭니다.
2. [앱 비밀번호](https://support.google.com/accounts/answer/185833)에서 16자리 비밀번호를 발급합니다.

### 2. GitHub Secrets 등록
저장소 **Settings → Secrets and variables → Actions → New repository secret** 에서 등록:

| 이름 | 값 |
| --- | --- |
| `GMAIL_USER` | 발신 Gmail 주소 (예: `myname@gmail.com`) |
| `GMAIL_APP_PASSWORD` | 위에서 발급한 앱 비밀번호(16자리) |

(선택) **Variables** 탭에서 `MAIL_FROM_NAME` 을 등록하면 발신자 표시 이름을 바꿀 수 있습니다.

### 3. 감시 항목 등록

**방법 A — 웹 관리자 (권장):** [관리자 페이지](https://leemgs.github.io/carrot-market/admin.html)에서
감시 항목을 **조회·추가·수정·삭제**하고 GitHub에 바로 저장합니다.
파일을 직접 편집할 필요가 없습니다.

- GitHub **Fine-grained 토큰**(이 저장소, Contents Read and write)이 필요합니다.
  [토큰 만들기](https://github.com/settings/personal-access-tokens/new)
- 토큰은 브라우저 `localStorage` 에만 저장되며 서버로 전송되지 않습니다.
  공용 PC에서는 사용 후 "토큰 삭제"를 누르세요.

**방법 B — 수동 편집:** [홈페이지](https://leemgs.github.io/carrot-market/)에서 설정 코드를 생성하거나
`config/watches.json` 을 직접 편집합니다.

```json
{
  "defaultEmail": "myname@gmail.com",
  "watches": [
    {
      "id": "gamasot-suwon",
      "keyword": "가마솥",
      "location": "수원시",
      "email": "myname@gmail.com",
      "enabled": true
    }
  ]
}
```

| 필드 | 설명 |
| --- | --- |
| `keyword` | 조회할 제품 키워드 (매물 제목에 포함되면 매칭) |
| `location` | 구매 가능 지역 (매물 지역/제목에 포함되면 매칭). **비우면 전국** |
| `email` | 알림 수신 이메일 (없으면 `defaultEmail` 사용) |
| `chatMessage` | 채팅 도우미에 미리 채울 인사말 (없으면 `defaultChatMessage`) |
| `enabled` | `false` 면 검사 제외 |

최상위 옵션: `sendEmail`(기본 true) · `createIssues`(기본 true) 로
이메일/이슈 알림을 각각 켜고 끌 수 있습니다.

### 알림 채널 (이메일 + GitHub 이슈)
신규 매물이 발견되면 **GitHub 이슈 등록**과 **이메일 발송**을 함께 수행합니다.

- **GitHub 이슈**: 감시 항목별로 신규 매물 목록을 담은 이슈가 `당근마켓-알림` 라벨로
  생성됩니다. Actions 가 자동 제공하는 `GITHUB_TOKEN` 을 사용하므로 별도 설정이 필요 없고,
  워크플로에 `issues: write` 권한이 포함되어 있습니다. 거래 확인 후 이슈를 닫으면 됩니다.
- **이메일**: 위 Gmail SMTP 설정 필요.

### 지역(location) 매칭 규칙
- **비워두면 전국** 대상으로 조회합니다 (`전국`, `전체` 입력도 동일).
- 지역을 넣으면 매물 위치/제목에 그 지역명이 포함될 때 매칭됩니다.
  행정구역 접미사를 뗀 어간도 함께 비교합니다 (`수원시` → `수원`).
- ⚠️ 당근은 매물 위치를 동 이름(예: `영통동`)만 표시하는 경우가 있어, 시 단위 입력이
  일부 매물과 매칭되지 않을 수 있습니다. 이럴 땐 동 이름으로 등록하거나 지역을 비워
  전국으로 받은 뒤 이메일/이슈에서 위치를 확인하세요.
  (`DEBUG=true` 로 실행하면 파싱/매칭 건수를 로그로 확인할 수 있습니다.)

### 빠른 채팅 도우미 (💬)
이메일의 **"💬 빠른 채팅"** 버튼을 누르면 `docs/chat.html` 도우미 페이지가 열립니다.

1. **인사말 복사** 버튼으로 미리 준비된 문구(예: "안녕하세요. 제가 구매 가능할까요?")를 복사
2. **매물에서 채팅하기** 버튼으로 당근마켓 매물 페이지로 이동
3. 매물의 **"채팅하기"** 를 눌러 붙여넣기 후 전송

> ⚠️ 당근마켓은 전화번호+SMS 인증 기반이라 로그인/메시지 전송의 완전 자동화는
> 이용약관 위반과 계정 정지 위험이 있습니다. 그래서 이 도우미는 **인사말 복사와
> 채팅 화면 이동까지만** 자동화하고, 최종 전송은 사용자가 직접 누르도록 설계했습니다.

`CHAT_HELPER_URL` 환경변수로 도우미 페이지 주소를 바꿀 수 있습니다.
(기본값: `https://leemgs.github.io/carrot-market/chat.html`)

### 4. GitHub Pages 활성화 (홈페이지)
저장소 **Settings → Pages → Source** 를 `main` 브랜치 `/docs` 폴더로 지정하면
`https://<사용자>.github.io/carrot-market/` 에서 홈페이지가 열립니다.

---

## 로컬 테스트

```bash
cd scripts
npm install

# 이메일을 보내지 않고 검색 결과만 확인 (DRY_RUN)
DRY_RUN=true node check_daangn.js

# 실제 발송 테스트
GMAIL_USER=me@gmail.com GMAIL_APP_PASSWORD=xxxx node check_daangn.js
```

### 유용한 환경변수
| 변수 | 설명 |
| --- | --- |
| `DRY_RUN=true` | 이메일 발송 없이 신규 매물만 로그 출력 |
| `DAANGN_SEARCH_URL` | 검색 URL 템플릿 재정의 (`{kw}` 가 키워드로 치환) |
| `STRICT_REGION=false` | 매물에 지역 정보가 없을 때도 통과시킴(관대한 매칭) |

---

## 참고 / 한계
- 당근마켓은 공식 오픈 API 를 제공하지 않아, 웹 검색 페이지를 파싱합니다.
  사이트 마크업이 바뀌면 `scripts/daangn.js` 의 `parseItems()` 추출 로직만 수정하면 됩니다.
- 실행 주기(cron)는 `.github/workflows/daangn-alert.yml` 에서 조정할 수 있습니다.
  (GitHub Actions 스케줄은 부하에 따라 몇 분 지연될 수 있습니다.)
- 개인적/비상업적 용도로 사용하고, 당근마켓의 이용약관과 과도한 요청 자제를 준수하세요.
