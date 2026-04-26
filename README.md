# 썸톡 시뮬레이터

카카오톡 스타일 AI 연애 시뮬레이션 앱입니다. 캐릭터 설정은 `config/characters.json`에서 관리하고, 캐릭터 이미지는 `public/characters`에 파일을 추가하면 반영됩니다.

## Getting Started

개발 서버 실행:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Environment Variables

`.env.local`과 Vercel Environment Variables에 아래 값을 설정합니다.

```env
OPENROUTER_API_KEY=sk-or-v1-...
POSTGRES_URL=...
```

`POSTGRES_URL`이 없으면 앱은 정상 동작하지만 공용 랭킹과 서버 대화기록 저장은 비활성화됩니다.

## 캐릭터 이미지

캐릭터별 이미지는 아래 경로에 추가합니다.

```text
public/characters/jieun.png
public/characters/soohyun.png
public/characters/harin.png
```

이미지가 없으면 `public/characters/default-avatar.svg`가 표시됩니다.

## 공용 랭킹 저장

게임 종료 시 `/api/session/complete`가 호출되어 다음 데이터를 저장합니다.

- 플레이어 닉네임과 브라우저별 `playerId`
- 캐릭터별 성공 여부, 최종 호감도, 턴 수
- 해당 판의 전체 대화 메시지

`/api/leaderboard`는 전체 플레이어의 성공 수, 최고 호감도, 평균 호감도를 기준으로 TOP 10을 반환합니다. 테이블은 API 최초 호출 시 자동 생성됩니다.

## Deploy on Vercel

1. Vercel 프로젝트를 생성합니다.
2. Vercel Storage에서 Postgres 또는 Neon Postgres를 연결합니다.
3. `OPENROUTER_API_KEY`, `POSTGRES_URL` 환경 변수를 등록합니다.
4. 재배포합니다.

현재 프로젝트 경로에 한글/이모지가 포함되어 있어 `Turbopack` 대신 `webpack` 빌드를 사용합니다.
