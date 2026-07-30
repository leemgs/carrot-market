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
        ├─ state/seen.json 과 비교해 신규 매물만 선별
        ├─ Gmail SMTP 로 이메일 발송
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
[홈페이지](https://leemgs.github.io/carrot-market/)에서 키워드·지역·이메일을 입력해
설정을 생성하거나, `config/watches.json` 을 직접 편집합니다.

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
| `location` | 구매 가능 지역 (매물 지역/제목에 포함되면 매칭) |
| `email` | 알림 수신 이메일 (없으면 `defaultEmail` 사용) |
| `enabled` | `false` 면 검사 제외 |

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
