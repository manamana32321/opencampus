# OpenCampus 풀 파이프라인 설계

> 작성일: 2026-03-19
> 상태: Approved

---

## 1. 개요

강의 자료 통합 관리 허브. 파일 업로드 → 메타데이터 자동추론 → 사용자 검수 → STT/OCR 백그라운드 처리 → 저장. Canvas LMS 연동으로 과목/과제/출석/공지를 동기화하고, MCP 서버로 외부 AI 에이전트에 노출.

### 핵심 목표

- 다중 유저 (Google OAuth)
- 파일 업로드 → AI 메타데이터 추론 → 검수 → 저장
- STT/OCR 백그라운드 처리 → 내장 마크다운 에디터에서 transcript 검수
- Canvas LMS 동기화 (과목, 과제, 출석, 공지)
- 출석 현황 추적 (온라인: Canvas 동기화, 오프라인: 수동)
- 과제 마감/출석 마감/공지 알림 (유저 커스터마이징 + 웹훅)
- MCP 서버로 외부 AI 에이전트 접근

---

## 2. 아키텍처

```
┌──────────────────────────────────────────────────────┐
│  manamana32321/opencampus (pnpm + Turborepo)         │
│                                                       │
│  apps/web           Next.js 16 PWA (App Router)      │
│  apps/api           NestJS + Prisma                   │
│  packages/canvas    Canvas LMS API TypeScript 래퍼    │
│  packages/mcp       MCP Server                        │
│  packages/openclaw-plugin/.gitkeep  (후순위)          │
└──────────────────────────────────────────────────────┘
               ↕ REST + SSE (JWT / API Key)
┌──────────────────────────────────────────────────────┐
│  k8s namespace: opencampus                            │
│  ├── opencampus-web        (Next.js 16)              │
│  ├── opencampus-api        (NestJS)                   │
│  ├── opencampus-postgres   (17 Alpine, longhorn-ssd)  │
│  └── minio tenant          (longhorn-ssd)             │
└──────────────────────────────────────────────────────┘

DNS (json-server.win)
  opencampus.json-server.win         FE   proxied=true
  api.opencampus.json-server.win     BE   proxied=true
  s3.opencampus.json-server.win      MinIO S3    proxied=false
  minio.opencampus.json-server.win   MinIO Console  proxied=false
```

### 기술 스택

| 레이어 | 기술 | 비고 |
|--------|------|------|
| FE | Next.js 16 (App Router) | PWA, proxy.ts, Turbopack |
| BE | NestJS + Prisma | REST API |
| 실시간 | SSE (Server-Sent Events) | 작업 진행률 |
| 작업 큐 | 인메모리 큐 (MVP) | 추후 pg-boss 전환 |
| DB | PostgreSQL 17 Alpine | longhorn-ssd |
| Object Storage | MinIO tenant | longhorn-ssd |
| AI | OpenAI Whisper (STT), GPT-4o (메타데이터 추론, Vision OCR) | |
| Canvas 래퍼 | packages/canvas (TypeScript) | 레거시 Python 전체 포팅 |
| MCP | packages/mcp | 후순위 |
| Auth | Google OAuth 2.0 | 다중 유저 |
| GitOps | ArgoCD | Apps-of-Apps |
| Secret | SealedSecrets | kubeseal |

---

## 3. 인증

### Google OAuth 2.0

- 첫 로그인 = 자동 회원가입 (별도 가입 플로우 없음)
- Scopes: `openid`, `email`, `profile`, `calendar` (읽기+쓰기), `tasks` (읽기+쓰기)
- `google_refresh_token` 저장 → 캘린더/태스크 연동
- g.skku.edu 제한 없음 (일반 gmail 사용)

### 토큰 전략

| 클라이언트 | 인증 방식 |
|-----------|----------|
| Web (Next.js) | httpOnly JWT cookie |
| API 직접 호출 | `Authorization: Bearer <JWT>` (userId claim) |
| MCP / OpenClaw | `X-API-Key` 헤더 (static, env var `OPENCAMPUS_API_KEY`) |

### API Guard

모든 엔드포인트에서 JWT Bearer **또는** X-API-Key 둘 다 허용. `/health`와 `/auth/*`는 제외.

---

## 4. DB 스키마

### users

```sql
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(100),
  picture TEXT,
  google_refresh_token TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### semesters

```sql
CREATE TABLE semesters (
  id SERIAL PRIMARY KEY,
  name VARCHAR(20) NOT NULL,       -- '2026-1'
  start_date DATE,
  end_date DATE
);
```

### courses

```sql
CREATE TABLE courses (
  id SERIAL PRIMARY KEY,
  user_id INT REFERENCES users(id),
  semester_id INT REFERENCES semesters(id),
  name VARCHAR(100) NOT NULL,
  short_name VARCHAR(20),          -- '확랜프', '기경개' (파일명 매칭용)
  canvas_id INT,
  metadata JSONB DEFAULT '{}',     -- 출석/시험/소통 정책 등 비정형
  notes TEXT,                       -- 자유 메모 (LLM 컨텍스트용)
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

`metadata` 예시:
```json
{
  "attendance_policy": {
    "type": "random_call",
    "sessions_per_week": 2,
    "notes": "1달에 1번 무작위 호명"
  },
  "exam_policy": {
    "midterm": true,
    "final": true,
    "notes": "중간 30% 기말 40% 과제 20% 출석 10%"
  },
  "communication": {
    "primary": "canvas_message",
    "notes": "교수님 이메일 안 봄"
  }
}
```

### course_weeks

```sql
CREATE TABLE course_weeks (
  id SERIAL PRIMARY KEY,
  course_id INT REFERENCES courses(id),
  user_id INT REFERENCES users(id),
  week INT NOT NULL,
  date_start DATE,
  UNIQUE(course_id, user_id, week)
);
```

### materials

```sql
CREATE TABLE materials (
  id SERIAL PRIMARY KEY,
  user_id INT REFERENCES users(id),
  course_week_id INT REFERENCES course_weeks(id),
  parent_id INT REFERENCES materials(id),   -- 사진 첨부 시 부모 material
  type VARCHAR(20) NOT NULL,                 -- recording | photo | video | pdf | ppt | note
  session INT,                                -- 교시 (recording, video)
  file_path TEXT NOT NULL,                    -- 's3://opencampus/...'
  original_filename TEXT,
  transcript TEXT,                             -- STT 결과 (recording, video)
  extracted_text TEXT,                         -- OCR/텍스트 추출 (photo, pdf, ppt, note)
  summary TEXT,                                -- AI 요약
  duration_min INT,                            -- recording, video
  ai_confidence FLOAT,                         -- 메타데이터 추론 신뢰도
  group_id UUID,                               -- 분할 녹음 그룹핑 (3-2-1, 3-2-2 → 같은 UUID)
  part_number INT DEFAULT 1,                   -- 파트 번호
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

- `parent_id = NULL` → 독립 자료
- `parent_id = 녹음ID` → 해당 녹음에 첨부된 사진
- `group_id` → 분할 녹음 그룹핑 (이어붙이기 기능용)

### attendances

```sql
CREATE TABLE attendances (
  id SERIAL PRIMARY KEY,
  user_id INT REFERENCES users(id),
  course_id INT REFERENCES courses(id),
  week INT NOT NULL,
  session INT,                               -- null이면 주차 전체
  status VARCHAR(20) NOT NULL,               -- present | absent | late | excused | cancelled
  source VARCHAR(20) NOT NULL,               -- canvas_sync | manual
  note TEXT,                                  -- "휴강", "랜덤 호명 통과" 등
  canvas_item_id INT,
  checked_at TIMESTAMPTZ,
  synced_at TIMESTAMPTZ,
  UNIQUE(user_id, course_id, week, session)
);
```

- 출석 정책은 `courses.metadata`에 비정형으로 저장
- 출석 결과만 기록, 정책 모델링 안 함
- 온라인 출석: Canvas LearningX 동기화 (읽기만)
- 오프라인 출석: 유저 수동 체크
- SKKU 전자출결 앱 API 리버스 엔지니어링 조사 중 (읽기만, 후순위)

### assignments

```sql
CREATE TABLE assignments (
  id SERIAL PRIMARY KEY,
  user_id INT REFERENCES users(id),
  course_id INT REFERENCES courses(id),
  canvas_id INT,
  title VARCHAR(500) NOT NULL,
  description TEXT,
  due_at TIMESTAMPTZ,
  points_possible FLOAT,
  submission_types TEXT[],
  status VARCHAR(20) DEFAULT 'pending',      -- pending | submitted | graded | late | missing
  score FLOAT,
  grade VARCHAR(20),
  submitted_at TIMESTAMPTZ,
  canvas_url TEXT,
  synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### announcements

```sql
CREATE TABLE announcements (
  id SERIAL PRIMARY KEY,
  user_id INT REFERENCES users(id),
  course_id INT REFERENCES courses(id),
  canvas_id INT,
  title VARCHAR(500) NOT NULL,
  message TEXT,
  author VARCHAR(100),
  posted_at TIMESTAMPTZ,
  is_read BOOLEAN DEFAULT false,
  read_at TIMESTAMPTZ,
  canvas_url TEXT,
  synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### jobs

```sql
CREATE TABLE jobs (
  id SERIAL PRIMARY KEY,
  user_id INT REFERENCES users(id),
  material_id INT REFERENCES materials(id),
  type VARCHAR(20) NOT NULL,                 -- stt | ocr | pdf_extract | pdf_vision | ppt_convert
  status VARCHAR(20) DEFAULT 'pending',      -- pending | running | done | failed
  progress INT DEFAULT 0,
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### notifications

```sql
CREATE TABLE notifications (
  id SERIAL PRIMARY KEY,
  user_id INT REFERENCES users(id),
  type VARCHAR(30) NOT NULL,                 -- assignment_due | attendance_due | announcement_new | stt_complete
  title VARCHAR(500),
  message TEXT,
  reference_type VARCHAR(20),                -- assignment | attendance | announcement | material
  reference_id INT,
  is_read BOOLEAN DEFAULT false,
  sent_at TIMESTAMPTZ DEFAULT NOW()
);
```

### notification_settings

```sql
CREATE TABLE notification_settings (
  id SERIAL PRIMARY KEY,
  user_id INT REFERENCES users(id),
  type VARCHAR(30) NOT NULL,
  enabled BOOLEAN DEFAULT true,
  advance_minutes INT DEFAULT 60,
  channels TEXT[] DEFAULT '{web}',           -- web | webhook
  webhook_url TEXT,
  UNIQUE(user_id, type)
);
```

---

## 5. 저장소 전략

| 저장소 | 용도 |
|--------|------|
| MinIO | 원본 파일만 (오디오/영상/PDF/PPT/이미지) |
| PostgreSQL | 메타데이터, transcript, extracted_text, summary, 모든 엔티티 |

- 마크다운 파일 생성 안 함 (필요 시 export 기능)
- `file_path`는 `s3://opencampus/...` 형태 (스토리지 추상화, 추후 S3 전환 가능)
- Seafile 연동 후순위

---

## 6. 파일 처리 파이프라인

| type | 확장자 | 처리 | 결과 저장 |
|------|--------|------|----------|
| recording | m4a, mp3, wav | ffmpeg 전처리 → Whisper API STT | materials.transcript |
| video | mp4, mkv | 오디오 추출 → Whisper API STT | materials.transcript |
| photo | jpg, png, heic | GPT-4o Vision OCR | materials.extracted_text |
| pdf | pdf | 1차: pdf.js → 텍스트 빈약 시 2차: 페이지별 GPT-4o Vision | materials.extracted_text |
| ppt | ppt, pptx | LibreOffice 변환 → 텍스트 추출 | materials.extracted_text |
| note | md, txt | 그대로 저장 | materials.extracted_text |

### PDF 2단계 전략

레거시 PDF (스캔, 이미지 기반, 접근성 미고려) 대응:

1. `pdf.js` 텍스트 추출 시도
2. 추출된 텍스트가 임계값 미만 → `pdf_vision` job 생성
3. 페이지별 이미지 렌더링 → GPT-4o Vision OCR
4. 결과를 `materials.extracted_text`에 저장

### 분할 녹음 처리

- 같은 세션의 분할 파일 → 동일 `group_id` (UUID)
- `part_number`로 순서 관리
- 전처리 UI에서 이어붙이기(ffmpeg concat) → 새 material 생성, 원본 보존
- 이어붙이기 기능은 별도 PR

---

## 7. 메타데이터 자동추론

우선순위:

1. **파일명 파싱** (룰베이스) — `최적설계 2-2.m4a` → 과목+주차+교시
2. **courses.short_name 매칭** — `확랜프` → 확률및랜덤프로세스
3. **파일 생성 시각** → 학기 주차 역산
4. **Canvas 과목/캘린더** → 수업 시간표 매칭
5. **GPT-4o 종합 추론** → 위 정보 + 컨텍스트 → confidence 점수
6. **드롭다운 수동 선택** (폴백)

---

## 8. Canvas 래퍼 (packages/canvas)

레거시 Python 코드(`client.py`, `server.py`, `video_dl.py`) 전체를 TypeScript로 포팅.

### 메서드 목록

**사용자**: getUserProfile

**과목**: getCourses, getFavorites, getCourseUsers

**과제/성적**: getAssignments, getEnrollments, getSubmissions, submitAssignment

**퀴즈**: getQuizzes, getQuizQuestions, getQuizSubmissions

**캘린더/플래너**: getCalendarEvents, getUpcomingEvents, getPlannerItems, updatePlannerOverride, getTodoItems

**출석**: getAttendanceItems (LearningX)

**파일/폴더**: getFiles, getFolders

**토론/공지**: getDiscussionTopics, getDiscussionEntries, postDiscussionEntry, getAnnouncements

**모듈/페이지**: getModules, getPages, getPageContent

**메시지**: getConversations, getConversation, sendConversation

**기타**: getGroups, getGradingPeriods, getRubrics, getRubric, getBookmarks, createBookmark, deleteBookmark, getNotificationPreferences, getPeerReviews, getActivityStream

**영상**: getVideoUrl, downloadVideo (LearningX/LCMS 6단계 인증 체인)

`apps/api`와 `packages/mcp` 모두에서 import.

---

## 9. API 엔드포인트

### Auth

```
GET  /auth/google            Google OAuth 시작
GET  /auth/google/callback   콜백 → JWT 발급 → 리다이렉트
POST /auth/refresh           JWT 갱신
```

### Health

```
GET  /health                 { status, db, minio, timestamp }
```

### Courses

```
GET  /courses                내 과목 목록
POST /courses/sync           Canvas에서 과목 동기화
GET  /courses/:id            과목 상세 (metadata, notes 포함)
PATCH /courses/:id           과목 정보 수정 (metadata, notes, short_name)
```

### Weeks

```
GET  /courses/:id/weeks      주차 목록
```

### Attendances

```
GET  /courses/:id/attendances       출석 현황
POST /attendances                    수동 출석 체크
PATCH /attendances/:id               출석 수정
POST /attendances/sync               Canvas LearningX 출석 동기화 (읽기만)
```

### Materials

```
POST /materials/upload               파일 업로드 → MinIO → 자동추론
GET  /materials/:id                  자료 조회
PATCH /materials/:id                 메타데이터/transcript 수정 (검수)
GET  /materials/:id/status           SSE 작업 진행률
POST /materials/:id/analyze          AI 메타데이터 재추론
POST /materials/:id/photos           사진 첨부
```

### Assignments

```
GET  /assignments                    내 과제 목록
POST /assignments/sync               Canvas 과제 동기화
GET  /assignments/:id                과제 상세
```

### Announcements

```
GET  /announcements                  내 공지 목록
POST /announcements/sync             Canvas 공지 동기화
PATCH /announcements/:id/read        읽음 처리
```

### Jobs

```
GET  /jobs                           내 작업 목록
GET  /jobs/:id/stream                SSE 진행률
```

### Notifications

```
GET  /notifications                  내 알림 목록
PATCH /notifications/:id/read        읽음 처리
PATCH /notifications/read-all        전체 읽음
GET  /notification-settings          알림 정책 조회
PATCH /notification-settings/:type   알림 정책 수정
```

---

## 10. 알림 시스템

### 알림 유형

| type | 트리거 | 기본 advance_minutes |
|------|--------|---------------------|
| assignment_due | 과제 마감 전 | 60 (1시간) |
| attendance_due | 온라인 출석 마감 전 | 360 (6시간) |
| announcement_new | 새 공지 감지 | 즉시 |
| stt_complete | STT/OCR 작업 완료 | 즉시 |

### 채널

- **web**: 인앱 알림 (notifications 테이블) + 후순위 웹 푸시
- **webhook**: 유저가 URL 등록 → JSON POST → 텔레그램 봇, Slack, Discord 등 자유 연결

### 유저 커스터마이징

`notification_settings` 테이블에서 유형별:
- enabled (on/off)
- advance_minutes (마감 N분 전)
- channels (web, webhook)
- webhook_url

---

## 11. 검수 UI (Next.js 16)

### 페이지 구성

- **대시보드** — 과목 탭 → 주차 리스트 (출석 상태, 자료 개수)
- **업로드** — drag & drop → 자동추론 → 검수 폼
- **검수 폼** — 과목/주차/교시/유형/날짜 + AI confidence + 저장
- **Transcript 에디터** — 좌: 마크다운 에디터 (tiptap/milkdown), 우: 실시간 프리뷰, 하단: 저장/AI 요약
- **작업 대시보드** — 진행 중인 STT/OCR 작업 (SSE 실시간)
- **과제 목록** — Canvas 동기화 과제, 마감일 표시
- **공지 목록** — Canvas 동기화 공지, 읽음/안읽음
- **출석 히트맵** — 학기별 과목×주차 히트맵 (후순위)
- **알림 설정** — 유형별 on/off, advance_minutes, 웹훅 URL
- **과목 설정** — metadata (출석/시험/소통 정책), notes, short_name

### PWA

- `manifest.json` + Service Worker (next-pwa 플러그인)
- 안드로이드: Chrome "홈 화면에 추가" → 앱처럼 동작
- APK 불필요. 앱스토어 배포는 TWA 래핑으로 후순위

---

## 12. 모노레포 구조

```
opencampus/
├── apps/
│   ├── web/                  Next.js 16 (App Router, PWA)
│   └── api/                  NestJS + Prisma
├── packages/
│   ├── canvas/               Canvas LMS API TypeScript 래퍼
│   ├── mcp/                  MCP Server (후순위)
│   └── openclaw-plugin/      .gitkeep (후순위)
├── package.json              pnpm workspace root
├── pnpm-workspace.yaml
├── turbo.json
└── .gitignore
```

---

## 13. 인프라 (배포 완료)

- **namespace**: opencampus
- **ArgoCD apps**: opencampus (app), opencampus-minio (별도)
- **SealedSecret** `opencampus-api-secrets`: DATABASE_URL, POSTGRES_PASSWORD, MINIO_ACCESS_KEY, MINIO_SECRET_KEY, OPENAI_API_KEY, CANVAS_ACCESS_TOKEN, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, JWT_SECRET, OPENCAMPUS_API_KEY
- **ConfigMap**: NODE_ENV, PORT, MINIO_ENDPOINT, MINIO_PORT, MINIO_USE_SSL, MINIO_BUCKET, GOOGLE_CALLBACK_URL, FRONTEND_URL
- **StorageClass**: longhorn-ssd (PostgreSQL, MinIO)
- **Authentik**: 미사용 (자체 Google OAuth)

---

## 14. 후순위

1. Seafile 브라우저 연동 (파일 입력 경로 추가)
2. Google Calendar 메타데이터 추론 연동
3. Google Tasks 연동 (과제 → 태스크 등록)
4. 알림: 웹 푸시 (Service Worker)
5. OpenClaw 커스텀 플러그인 (packages/openclaw-plugin)
6. MCP 서버 (packages/mcp)
7. 출석 히트맵 대시보드
8. 분할 녹음 이어붙이기 UI
9. SKKU 전자출결 앱 API 리버스 엔지니어링 (오프라인 출석 자동 동기화)
10. PWA → 네이티브 앱 전환 (TWA)
