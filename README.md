# BF_TRPG

무료 운영 구조:

1. 정적 웹게임은 GitHub Pages로 공개한다.
2. 멀티모드 방 서버는 Cloudflare Workers와 Durable Objects로 운영한다.
3. 유료 도메인, 유료 호스팅, 유료 DB는 사용하지 않는다.
4. 개인 PC가 꺼져 있어도 GitHub Pages와 Cloudflare Worker가 켜져 있으면 접속할 수 있다.

폴더 역할:

```text
Main       공통 로비, 화면, 스타일, 브라우저 실행 코드
SoloMode   솔로모드 진행 코드
MultiMode  멀티모드 클라이언트와 Cloudflare Worker 서버 코드
Data       GitHub Pages에서 읽는 사건 데이터
사건       사건 데이터 원문
규칙       솔로모드와 멀티모드 규칙 원문
```

GitHub Pages 주소:

```text
https://chikogadwaebeoryeo-rikolove.github.io/BF_TRPG/
```

Cloudflare Worker 배포:

```powershell
cd MultiMode
npm install
npm run deploy
```

배포 후 출력되는 Worker URL을 `MultiMode/config.js`에 넣는다.

```js
window.BF_TRPG_MULTI_SERVER = "https://배포된-worker주소";
```

그 다음 GitHub에 푸시하면 Pages 화면에서 멀티모드가 같은 방 코드로 동작한다.
