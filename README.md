# 치지직 멀티뷰 — 설치 안내

파일 구성
- `index.html` : 멀티뷰 앱 본체 (단일 HTML, Windows/iOS/Android 브라우저 공통)
- `worker.js`  : 치지직 API 중계 서버 (Cloudflare Workers 무료 플랜). **검색·재생에 필요**
- `README.md`  : 이 문서

---

## 1단계. 중계 서버 배포 (5분, 무료)

치지직은 공식 임베드 플레이어가 없고 브라우저에서 API를 직접 호출하면 CORS로 차단되기 때문에 작은 중계 서버가 필요합니다.

1. https://dash.cloudflare.com 가입/로그인 → **Workers & Pages** → **Create** → **Create Worker**
2. 이름 아무거나(예: `chzzk-mv`) → **Deploy** → **Edit code**
3. 기존 코드를 모두 지우고 `worker.js` 내용을 붙여넣기 → **Deploy**
4. 주소 복사: `https://chzzk-mv.<내계정>.workers.dev`
5. 멀티뷰 ⚙️ 설정 → **중계 서버 주소**에 붙여넣고 저장

선택 사항
- **성인 인증 방송**: Worker → Settings → Variables and Secrets 에 `NID_AUT`, `NID_SES` 를 Secret으로 추가 (본인 네이버 로그인 쿠키. 치지직 접속 후 브라우저 개발자도구 → Application → Cookies 에서 확인). 네이버 로그인 자체를 앱 안에 넣는 것은 치지직이 허용하지 않아, 이것이 유일한 방법입니다.
- **외부 사용 방지**: 변수 `ALLOWED_ORIGIN` 에 멀티뷰 페이지 주소(예: `https://내아이디.github.io`) 설정

---

## 2단계. index.html 열기

가장 추천: **GitHub Pages / Cloudflare Pages 에 올려서 URL로 접속** (모든 기기에서 같은 주소, 홈화면 추가 가능, 클라우드 로그인 가능)

- Cloudflare: Workers & Pages → Create → Pages → Upload assets → `index.html` 업로드
- GitHub: 저장소 만들고 `index.html` 업로드 → Settings → Pages → 배포

PC에서는 파일을 더블클릭해서 바로 열어도 됩니다. (이 경우 Firebase 로그인은 동작하지 않을 수 있으니 로컬 저장/백업 파일 방식 사용)

---

## 3단계. (선택) 기기 간 동기화 — Firebase

채널 목록·분할 설정·음량 설정을 PC/폰에서 공유하려면:

1. https://console.firebase.google.com → 프로젝트 추가 (애널리틱스 불필요)
2. **Authentication** → 시작하기 → Sign-in method → **Google** 사용 설정
3. Authentication → Settings → **승인된 도메인**에 멀티뷰 페이지 도메인 추가 (예: `내아이디.github.io`)
4. **Firestore Database** → 데이터베이스 만들기 → 프로덕션 모드 → 규칙 탭에 아래 입력 후 게시
   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /multiview/{uid} {
         allow read, write: if request.auth != null && request.auth.uid == uid;
       }
     }
   }
   ```
5. 프로젝트 설정(톱니) → 일반 → 내 앱 → **웹 앱 추가(</>)** → `firebaseConfig` 의 `{ ... }` 부분 복사
6. 멀티뷰 ⚙️ 설정 → **클라우드 동기화** 칸에 붙여넣고 저장 → **☁️ 로그인** (Google 계정)

이후에는 브라우저를 닫았다 열어도 로그인이 유지되며, 다른 기기에서 같은 계정으로 로그인하면 자동으로 동기화됩니다.

---

## 사용법 요약

| 동작 | 방법 |
|---|---|
| 분할 변경 | 상단 `1 / 2 / 4 / 6 / 9 / 12` 버튼. 줄일 때 채널이 넘치면 닫을 화면 선택 창이 뜸 |
| 빈 화면에 채널 넣기 | 🚫 화면 클릭 → 내 채널 목록에서 선택 |
| 채널 추가/삭제 | 📋 채널 목록 → 검색/추가 탭 (채널명 검색 또는 채널 URL 붙여넣기), 🗑 로 삭제 |
| 주목 모드 | 화면 클릭 = 켜기/끄기, 여러 화면 동시 가능. 나머지 화면은 어두워지고 음량 비율만큼 줄어듦 |
| 음량 비율·밝기 | ⚙️ 설정 슬라이더 (움직이면 바로 적용) |
| 화면 해제 | 화면 위에 마우스 올리면 우상단 ✕ |
| 전체화면 | 좌하단 ⛶ (다시 누르거나 ESC로 복귀, 주목 모드 등 상태 유지) |
| 개별 음소거 | 좌하단 🔊 |
| 모바일 소리 | 브라우저 자동재생 정책상 처음엔 무음 → 상단 **🔊 소리 켜기** 한 번 터치 |

## 알려진 제한
- 네이버 계정으로 치지직 자체에 로그인하는 기능은 치지직이 외부 사이트에 제공하지 않습니다. (성인 방송은 위 쿠키 방식, 설정 저장은 Google 로그인)
- 비공식 API를 사용하므로 치지직 측 변경 시 `worker.js` 수정이 필요할 수 있습니다.
- iOS Safari는 화면 요소 전체화면 API가 없어 "유사 전체화면"(앱 내 전체 표시)으로 동작합니다.
- 12분할 동시 재생은 네트워크/기기 성능에 따라 끊길 수 있습니다.
