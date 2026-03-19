# OpenCampus

강의 자료 통합 관리 허브 — 오프라인 녹음, 온라인 강의, PDF/PPT 전처리 및 메타데이터 관리

## 앱 구조

| 앱 | 설명 | 기술 스택 |
|---|---|---|
| `apps/web` | 프론트엔드 (PWA) | Next.js 15, TypeScript |
| `apps/api` | 백엔드 API | NestJS, TypeScript, PostgreSQL |
| `packages/mcp` | MCP 서버 | TypeScript |

## 개발 환경

```bash
pnpm install
pnpm dev
```

## 배포

- FE: opencampus.json-server.win
- BE: api.opencampus.json-server.win