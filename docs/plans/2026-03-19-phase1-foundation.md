# Phase 1: Foundation — Monorepo + Canvas Wrapper + DB + Auth

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scaffold the monorepo, implement the Canvas API TypeScript wrapper, set up Prisma schema with all tables, and implement Google OAuth + JWT auth — producing a running API that can authenticate users and query Canvas.

**Architecture:** pnpm + Turborepo monorepo with NestJS API (`apps/api`), Next.js 16 frontend (`apps/web`), and Canvas wrapper package (`packages/canvas`). Prisma ORM with PostgreSQL. Google OAuth 2.0 with JWT sessions.

**Tech Stack:** TypeScript, pnpm, Turborepo, NestJS 10, Next.js 16, Prisma, Passport (Google OAuth), jsonwebtoken, PostgreSQL 17

**Spec:** `docs/specs/2026-03-19-opencampus-full-pipeline-design.md`

**Legacy reference:** `client.py`, `server.py`, `video_dl.py`, `auth.py` (Python Canvas MCP server — port to TypeScript)

---

## File Structure

```
opencampus/
├── apps/
│   ├── api/
│   │   ├── src/
│   │   │   ├── main.ts                          # NestJS bootstrap
│   │   │   ├── app.module.ts                     # Root module
│   │   │   ├── prisma/
│   │   │   │   ├── prisma.module.ts              # Prisma module
│   │   │   │   └── prisma.service.ts             # PrismaClient wrapper
│   │   │   ├── auth/
│   │   │   │   ├── auth.module.ts                # Auth module
│   │   │   │   ├── auth.controller.ts            # /auth/google, /auth/google/callback, /auth/refresh
│   │   │   │   ├── auth.service.ts               # JWT sign/verify, user upsert
│   │   │   │   ├── google.strategy.ts            # Passport Google OAuth strategy
│   │   │   │   ├── jwt.strategy.ts               # Passport JWT strategy
│   │   │   │   ├── api-key.strategy.ts           # X-API-Key guard
│   │   │   │   ├── auth.guard.ts                 # Combined JWT | API-Key guard
│   │   │   │   └── auth.controller.spec.ts       # Tests
│   │   │   ├── users/
│   │   │   │   ├── users.module.ts
│   │   │   │   ├── users.controller.ts           # GET/PATCH /users/me
│   │   │   │   ├── users.service.ts
│   │   │   │   └── users.controller.spec.ts
│   │   │   ├── courses/
│   │   │   │   ├── courses.module.ts
│   │   │   │   ├── courses.controller.ts         # CRUD + /courses/sync
│   │   │   │   ├── courses.service.ts
│   │   │   │   └── courses.controller.spec.ts
│   │   │   └── health/
│   │   │       ├── health.module.ts
│   │   │       ├── health.controller.ts          # GET /health
│   │   │       └── health.controller.spec.ts
│   │   ├── prisma/
│   │   │   └── schema.prisma                     # Full schema (all 11 tables)
│   │   ├── test/
│   │   │   ├── app.e2e-spec.ts                   # E2E tests
│   │   │   └── jest-e2e.json
│   │   ├── Dockerfile                            # Multi-stage build
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── tsconfig.build.json
│   │   ├── nest-cli.json
│   │   └── .env.example
│   └── web/
│       ├── src/
│       │   ├── app/
│       │   │   ├── layout.tsx                    # Root layout
│       │   │   ├── page.tsx                      # Landing / redirect to dashboard
│       │   │   └── login/
│       │   │       └── page.tsx                  # Google login button
│       │   └── lib/
│       │       └── api.ts                        # API client helper
│       ├── public/
│       │   └── manifest.json                     # PWA manifest
│       ├── package.json
│       ├── tsconfig.json
│       └── next.config.ts
├── packages/
│   ├── canvas/
│   │   ├── src/
│   │   │   ├── index.ts                          # Public exports
│   │   │   ├── client.ts                         # CanvasClient class
│   │   │   ├── types.ts                          # All Canvas types
│   │   │   ├── learningx.ts                      # LearningX-specific API (attendance, xn_api_token)
│   │   │   └── __tests__/
│   │   │       ├── client.test.ts
│   │   │       └── learningx.test.ts
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── vitest.config.ts
│   ├── mcp/.gitkeep
│   └── openclaw-plugin/.gitkeep
├── package.json
├── pnpm-workspace.yaml
├── turbo.json
├── .gitignore
├── .github/
│   └── workflows/
│       └── ci.yaml                               # Lint + test + build
└── docker-compose.dev.yaml                       # Local PostgreSQL + MinIO
```

---

## Task 1: Clean up legacy files + update root config

**Files:**
- Delete: `auth.py`, `client.py`, `server.py`, `video_dl.py`, `requirements.txt`
- Modify: `package.json`, `turbo.json`, `.gitignore`

- [ ] **Step 1: Delete legacy Python files and create missing directories**

```bash
cd /home/json/opencampus-worktrees/main
rm auth.py client.py server.py video_dl.py requirements.txt
mkdir -p packages/openclaw-plugin
touch packages/openclaw-plugin/.gitkeep
```

- [ ] **Step 2: Update root package.json**

Replace `package.json` contents with:

```json
{
  "name": "opencampus",
  "private": true,
  "scripts": {
    "dev": "turbo dev",
    "build": "turbo build",
    "lint": "turbo lint",
    "test": "turbo test",
    "db:migrate": "pnpm --filter @opencampus/api prisma migrate dev",
    "db:generate": "pnpm --filter @opencampus/api prisma generate",
    "db:push": "pnpm --filter @opencampus/api prisma db push"
  },
  "devDependencies": {
    "turbo": "^2.5.0",
    "typescript": "^5.8.0"
  },
  "packageManager": "pnpm@9.15.0"
}
```

- [ ] **Step 3: Update turbo.json**

```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": [".next/**", "!.next/cache/**", "dist/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "lint": {
      "dependsOn": ["^build"]
    },
    "test": {
      "dependsOn": ["^build"],
      "cache": false
    }
  }
}
```

- [ ] **Step 4: Update .gitignore**

Append to existing `.gitignore`:

```
# Docker
docker-compose.override.yaml

# IDE
.idea/
.vscode/

# OS
.DS_Store
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: remove legacy Python files, update monorepo config"
```

---

## Task 2: Scaffold packages/canvas

**Files:**
- Create: `packages/canvas/package.json`, `packages/canvas/tsconfig.json`, `packages/canvas/vitest.config.ts`, `packages/canvas/src/types.ts`, `packages/canvas/src/client.ts`, `packages/canvas/src/learningx.ts`, `packages/canvas/src/index.ts`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "@opencampus/canvas",
  "version": "0.1.0",
  "private": true,
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "test": "vitest run",
    "test:watch": "vitest",
    "lint": "tsc --noEmit"
  },
  "dependencies": {},
  "devDependencies": {
    "typescript": "^5.8.0",
    "vitest": "^3.0.0",
    "@types/node": "^22.0.0"
  }
}
```

- [ ] **Step 2: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "lib": ["ES2022"],
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "resolveJsonModule": true
  },
  "include": ["src"],
  "exclude": ["dist", "node_modules", "src/__tests__"]
}
```

- [ ] **Step 3: Create vitest.config.ts**

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
  },
});
```

- [ ] **Step 4: Write types.ts**

Port all Canvas types from legacy `client.py`. Create `packages/canvas/src/types.ts`:

```typescript
// -- User --
export interface UserProfile {
  id: number;
  name: string;
  loginId: string;
  email: string;
  avatarUrl: string;
}

// -- Course --
export interface Course {
  id: number;
  name: string;
  courseCode: string;
  startDate: string | null;
  endDate: string | null;
  enrollmentTermId: number | null;
}

// -- Assignment --
export interface Assignment {
  id: number;
  name: string;
  description: string;
  dueAt: string | null;
  pointsPossible: number;
  submissionTypes: string[];
  htmlUrl: string;
  courseId: number;
}

// -- Enrollment / Grade --
export interface Enrollment {
  type: string;
  enrollmentState: string;
  currentScore: number | null;
  currentGrade: string | null;
  finalScore: number | null;
  finalGrade: string | null;
  courseId: number;
}

export interface Submission {
  assignmentId: number | null;
  score: number | null;
  grade: string | null;
  submittedAt: string | null;
  workflowState: string;
  late: boolean;
  missing: boolean;
}

// -- Quiz --
export interface Quiz {
  id: number;
  title: string;
  description: string;
  quizType: string;
  dueAt: string | null;
  timeLimit: number | null;
  pointsPossible: number | null;
  allowedAttempts: number;
  htmlUrl: string;
  courseId: number;
}

export interface QuizQuestion {
  id: number;
  questionName: string;
  questionType: string;
  questionText: string;
  pointsPossible: number;
  answers: unknown[];
  position: number | null;
}

export interface QuizSubmission {
  id: number;
  quizId: number;
  attempt: number | null;
  score: number | null;
  keptScore: number | null;
  startedAt: string | null;
  finishedAt: string | null;
  timeSpent: number | null;
  workflowState: string;
}

// -- Calendar --
export interface CalendarEvent {
  id: number;
  title: string;
  description: string;
  startAt: string | null;
  endAt: string | null;
  locationName: string;
  contextCode: string;
  htmlUrl: string;
}

export interface UpcomingEvent {
  id: number | null;
  title: string;
  type: string;
  startAt: string | null;
  endAt: string | null;
  htmlUrl: string;
  contextCode: string;
}

// -- Planner --
export interface PlannerItem {
  id: number;
  title: string;
  type: string;
  courseId: number | null;
  dueAt: string;
  pointsPossible: number | null;
  completed: boolean;
  submissions: Record<string, unknown>;
}

export interface PlannerOverride {
  id: number;
  plannableType: string;
  plannableId: number;
  markedComplete: boolean;
}

// -- Todo --
export interface TodoItem {
  type: string;
  assignmentId: number | null;
  courseId: number | null;
  contextName: string;
  htmlUrl: string;
  needsGradingCount: number;
}

// -- Discussion --
export interface DiscussionTopic {
  id: number;
  title: string;
  message: string;
  postedAt: string | null;
  author: string;
  discussionSubentryCount: number;
  htmlUrl: string;
  courseId: number;
}

export interface DiscussionEntry {
  id: number;
  userId: number | null;
  userName: string;
  message: string;
  createdAt: string | null;
  replies: DiscussionReply[];
}

export interface DiscussionReply {
  id: number;
  userId: number;
  userName: string;
  message: string;
  createdAt: string;
}

// -- Announcement (same shape as DiscussionTopic minus subentryCount) --
export interface Announcement {
  id: number;
  title: string;
  message: string;
  postedAt: string | null;
  author: string;
  htmlUrl: string;
  courseId: number;
}

// -- Module --
export interface Module {
  id: number;
  name: string;
  position: number;
  published: boolean;
  items: ModuleItem[];
}

export interface ModuleItem {
  id: number;
  title: string;
  type: string;
  externalUrl: string | null;
  url: string | null;
  contentId: number | null;
  published: boolean;
}

// -- Page --
export interface Page {
  pageId: number | null;
  url: string;
  title: string;
  createdAt: string | null;
  updatedAt: string | null;
  published: boolean;
  htmlUrl: string;
  courseId: number;
}

export interface PageContent {
  title: string;
  body: string;
  updatedAt: string | null;
  htmlUrl: string;
  courseId: number;
}

// -- File / Folder --
export interface CanvasFile {
  id: number;
  displayName: string;
  filename: string;
  contentType: string;
  size: number;
  url: string;
  courseId: number;
}

export interface Folder {
  id: number;
  name: string;
  fullName: string;
  filesCount: number;
  foldersCount: number;
  parentFolderId: number | null;
  courseId: number;
}

// -- Conversation --
export interface Conversation {
  id: number;
  subject: string;
  lastMessage: string;
  lastMessageAt: string | null;
  messageCount: number;
  participants: ConversationParticipant[];
  workflowState: string;
}

export interface ConversationParticipant {
  id: number;
  name: string;
}

export interface ConversationDetail {
  id: number;
  subject: string;
  participants: ConversationParticipant[];
  messages: ConversationMessage[];
}

export interface ConversationMessage {
  id: number;
  authorId: number;
  body: string;
  createdAt: string;
  attachments: ConversationAttachment[];
}

export interface ConversationAttachment {
  id: number;
  displayName: string;
  url: string;
}

// -- Group --
export interface Group {
  id: number;
  name: string;
  description: string;
  membersCount: number;
  contextType: string;
  courseId: number | null;
}

// -- Grading Period --
export interface GradingPeriod {
  id: number;
  title: string;
  startDate: string | null;
  endDate: string | null;
  closeDate: string | null;
  courseId: number;
}

// -- Rubric --
export interface Rubric {
  id: number;
  title: string;
  pointsPossible: number | null;
  criteriaCount: number;
}

export interface RubricDetail {
  id: number;
  title: string;
  pointsPossible: number | null;
  criteria: RubricCriterion[];
}

export interface RubricCriterion {
  id: string;
  description: string;
  longDescription: string;
  points: number;
  ratings: RubricRating[];
}

export interface RubricRating {
  description: string;
  points: number;
}

// -- Bookmark --
export interface Bookmark {
  id: number;
  name: string;
  url: string;
  position: number;
}

// -- Notification Preference --
export interface NotificationPreference {
  notification: string;
  frequency: string;
}

// -- Peer Review --
export interface PeerReview {
  id: number;
  userId: number;
  assessorId: number;
  assetId: number;
  workflowState: string;
}

// -- Activity Stream --
export interface ActivitySummary {
  type: string;
  count: number;
  unreadCount: number;
  notificationCategory: string;
}

// -- Course User --
export interface CourseUser {
  id: number;
  name: string;
  loginId: string;
  email: string;
}

// -- LearningX Attendance --
export interface AttendanceItem {
  id: number;
  title: string;
  type: string;
  attendanceStatus: string | null;
  dueAt: string | null;
  completed: boolean;
  useAttendance: boolean;
}

// -- Video (LearningX/LCMS) --
export interface VideoUrl {
  courseId: number;
  itemId: number;
  url: string;
  title: string;
}

export interface DownloadResult {
  courseId: number;
  itemId: number;
  outputPath: string;
  size: number;
}

// -- Client config --
export interface CanvasClientConfig {
  baseUrl: string;         // e.g. 'https://canvas.skku.edu'
  accessToken: string;     // Canvas PAT
}
```

- [ ] **Step 5: Write client.ts (core Canvas API methods)**

Create `packages/canvas/src/client.ts`. This is the main class — port of `client.py`. Use `fetch` (Node 22 built-in) instead of `undici` if available, with pagination helper.

See legacy `client.py` for all method signatures and response mapping. Key patterns:
- All methods return camelCase TypeScript types (mapped from Canvas snake_case JSON)
- Pagination: Canvas returns `Link` header with `rel="next"` — follow until exhausted
- Error handling: throw on non-2xx responses with status + body

Uses Node 22 built-in `fetch` (no external HTTP client needed). Full implementation is too large for this plan — the implementing agent should port method by method from `client.py` (available in git history: commit `9f42f90`), writing tests alongside each group.

Method groups to port (in order):
1. `getUserProfile` — simplest, validates auth
2. `getCourses`, `getFavorites`, `getCourseUsers` — core, needed for sync
3. `getAssignments`, `getEnrollments`, `getSubmissions`, `submitAssignment`
4. `getQuizzes`, `getQuizQuestions`, `getQuizSubmissions`
5. `getCalendarEvents`, `getUpcomingEvents`, `getPlannerItems`, `updatePlannerOverride`, `getTodoItems`
6. `getFiles`, `getFolders`
7. `getDiscussionTopics`, `getDiscussionEntries`, `postDiscussionEntry`, `getAnnouncements`
8. `getModules`, `getPages`, `getPageContent`
9. `getConversations`, `getConversation`, `sendConversation`
10. `getGroups`, `getGradingPeriods`, `getRubrics`, `getRubric`
11. `getBookmarks`, `createBookmark`, `deleteBookmark`
12. `getNotificationPreferences`, `getPeerReviews`, `getActivityStream`

- [ ] **Step 6: Write learningx.ts (LearningX-specific API)**

Create `packages/canvas/src/learningx.ts`. Port attendance-related methods from `video_dl.py`:
- `getAttendanceItems(courseId)` — LearningX attendance items
- Video download methods deferred to Phase 2

Reference: `video_dl.py` line 1-20 for constants, `get_attendance_items` method. The `xn_api_token` auth flow: navigate to course attendance page → extract token from cookie.

- [ ] **Step 7: Write index.ts**

```typescript
export { CanvasClient } from './client';
export { LearningXClient } from './learningx';
export * from './types';
```

- [ ] **Step 8: Write tests for client core methods**

Create `packages/canvas/src/__tests__/client.test.ts`. Mock `fetch` responses with Canvas JSON shapes. Test at minimum:
- `getUserProfile` returns mapped types
- `getCourses` handles pagination
- Error handling on 401/404

- [ ] **Step 9: Run tests**

```bash
cd packages/canvas && pnpm test
```

- [ ] **Step 10: Commit**

```bash
git add packages/canvas/
git commit -m "feat: add Canvas LMS TypeScript wrapper package"
```

---

## Task 3: Scaffold apps/api with NestJS + Prisma

**Files:**
- Create: `apps/api/` (NestJS project), `apps/api/prisma/schema.prisma`

- [ ] **Step 1: Clean up and initialize NestJS project**

```bash
cd /home/json/opencampus-worktrees/main
rm apps/api/.gitkeep
pnpm dlx @nestjs/cli new apps/api --package-manager pnpm --skip-git --strict
```

- [ ] **Step 2: Update apps/api/package.json**

Set package name to `@opencampus/api`. Add dependencies:

```bash
cd apps/api
pnpm add @prisma/client @nestjs/passport passport passport-google-oauth20 passport-jwt passport-custom jsonwebtoken cookie-parser @nestjs/config class-validator class-transformer @opencampus/canvas
pnpm add -D prisma @types/passport-google-oauth20 @types/passport-jwt @types/jsonwebtoken @types/cookie-parser
```

- [ ] **Step 3: Write Prisma schema**

Create `apps/api/prisma/schema.prisma` with all 11 tables from spec:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id                 Int       @id @default(autoincrement())
  email              String    @unique @db.VarChar(255)
  name               String?   @db.VarChar(100)
  picture            String?
  googleRefreshToken String?   @map("google_refresh_token")
  canvasAccessToken  String?   @map("canvas_access_token")
  createdAt          DateTime  @default(now()) @map("created_at")

  semesters      Semester[]
  courses        Course[]
  courseWeeks     CourseWeek[]
  materials      Material[]
  attendances    Attendance[]
  assignments    Assignment[]
  announcements  Announcement[]
  jobs           Job[]
  notifications  Notification[]
  notificationSettings NotificationSetting[]

  @@map("users")
}

model Semester {
  id        Int      @id @default(autoincrement())
  userId    Int      @map("user_id")
  name      String   @db.VarChar(20)
  startDate DateTime? @map("start_date") @db.Date
  endDate   DateTime? @map("end_date") @db.Date
  createdAt DateTime @default(now()) @map("created_at")

  user    User     @relation(fields: [userId], references: [id])
  courses Course[]

  @@unique([userId, name])
  @@map("semesters")
}

model Course {
  id          Int      @id @default(autoincrement())
  userId      Int      @map("user_id")
  semesterId  Int      @map("semester_id")
  name        String   @db.VarChar(100)
  shortName   String?  @map("short_name") @db.VarChar(20)
  canvasId    Int?     @map("canvas_id")
  metadata    Json     @default("{}")
  notes       String?
  createdAt   DateTime @default(now()) @map("created_at")

  user        User         @relation(fields: [userId], references: [id])
  semester    Semester     @relation(fields: [semesterId], references: [id])
  courseWeeks CourseWeek[]
  attendances Attendance[]
  assignments Assignment[]
  announcements Announcement[]

  @@map("courses")
}

model CourseWeek {
  id        Int       @id @default(autoincrement())
  courseId   Int       @map("course_id")
  userId    Int       @map("user_id")
  week      Int
  dateStart DateTime? @map("date_start") @db.Date

  course    Course     @relation(fields: [courseId], references: [id])
  user      User       @relation(fields: [userId], references: [id])
  materials Material[]

  @@unique([courseId, userId, week])
  @@map("course_weeks")
}

model Material {
  id             Int       @id @default(autoincrement())
  userId         Int       @map("user_id")
  courseWeekId    Int       @map("course_week_id")
  parentId       Int?      @map("parent_id")
  type           String    @db.VarChar(20)
  session        Int?
  filePath       String    @map("file_path")
  originalFilename String? @map("original_filename")
  transcript     String?
  extractedText  String?   @map("extracted_text")
  summary        String?
  durationMin    Int?      @map("duration_min")
  aiConfidence   Float?    @map("ai_confidence")
  groupId        String?   @map("group_id") @db.Uuid
  partNumber     Int       @default(1) @map("part_number")
  createdAt      DateTime  @default(now()) @map("created_at")
  updatedAt      DateTime  @updatedAt @map("updated_at")

  user       User       @relation(fields: [userId], references: [id])
  courseWeek CourseWeek @relation(fields: [courseWeekId], references: [id])
  parent     Material?  @relation("MaterialChildren", fields: [parentId], references: [id])
  children   Material[] @relation("MaterialChildren")
  jobs       Job[]

  @@map("materials")
}

model Attendance {
  id            Int       @id @default(autoincrement())
  userId        Int       @map("user_id")
  courseId       Int       @map("course_id")
  week          Int
  session       Int?
  status        String    @db.VarChar(20)
  source        String    @db.VarChar(20)
  note          String?
  canvasItemId  Int?      @map("canvas_item_id")
  checkedAt     DateTime? @map("checked_at")
  syncedAt      DateTime? @map("synced_at")

  user   User   @relation(fields: [userId], references: [id])
  course Course @relation(fields: [courseId], references: [id])

  @@unique([userId, courseId, week, session])
  @@map("attendances")
}

model Assignment {
  id              Int       @id @default(autoincrement())
  userId          Int       @map("user_id")
  courseId         Int       @map("course_id")
  canvasId        Int?      @map("canvas_id")
  title           String    @db.VarChar(500)
  description     String?
  dueAt           DateTime? @map("due_at")
  pointsPossible  Float?    @map("points_possible")
  submissionTypes String[]  @map("submission_types")
  status          String    @default("pending") @db.VarChar(20)
  score           Float?
  grade           String?   @db.VarChar(20)
  submittedAt     DateTime? @map("submitted_at")
  canvasUrl       String?   @map("canvas_url")
  syncedAt        DateTime? @map("synced_at")
  createdAt       DateTime  @default(now()) @map("created_at")

  user   User   @relation(fields: [userId], references: [id])
  course Course @relation(fields: [courseId], references: [id])

  @@map("assignments")
}

model Announcement {
  id         Int       @id @default(autoincrement())
  userId     Int       @map("user_id")
  courseId    Int       @map("course_id")
  canvasId   Int?      @map("canvas_id")
  title      String    @db.VarChar(500)
  message    String?
  author     String?   @db.VarChar(100)
  postedAt   DateTime? @map("posted_at")
  isRead     Boolean   @default(false) @map("is_read")
  readAt     DateTime? @map("read_at")
  canvasUrl  String?   @map("canvas_url")
  syncedAt   DateTime? @map("synced_at")
  createdAt  DateTime  @default(now()) @map("created_at")

  user   User   @relation(fields: [userId], references: [id])
  course Course @relation(fields: [courseId], references: [id])

  @@map("announcements")
}

model Job {
  id         Int      @id @default(autoincrement())
  userId     Int      @map("user_id")
  materialId Int      @map("material_id")
  type       String   @db.VarChar(20)
  status     String   @default("pending") @db.VarChar(20)
  progress   Int      @default(0)
  error      String?
  createdAt  DateTime @default(now()) @map("created_at")
  updatedAt  DateTime @updatedAt @map("updated_at")

  user     User     @relation(fields: [userId], references: [id])
  material Material @relation(fields: [materialId], references: [id])

  @@map("jobs")
}

model Notification {
  id            Int      @id @default(autoincrement())
  userId        Int      @map("user_id")
  type          String   @db.VarChar(30)
  title         String?  @db.VarChar(500)
  message       String?
  referenceType String?  @map("reference_type") @db.VarChar(20)
  referenceId   Int?     @map("reference_id")
  isRead        Boolean  @default(false) @map("is_read")
  sentAt        DateTime @default(now()) @map("sent_at")

  user User @relation(fields: [userId], references: [id])

  @@map("notifications")
}

model NotificationSetting {
  id              Int      @id @default(autoincrement())
  userId          Int      @map("user_id")
  type            String   @db.VarChar(30)
  enabled         Boolean  @default(true)
  advanceMinutes  Int      @default(60) @map("advance_minutes")
  channels        String[] @default(["web"])
  webhookUrl      String?  @map("webhook_url")

  user User @relation(fields: [userId], references: [id])

  @@unique([userId, type])
  @@map("notification_settings")
}
```

- [ ] **Step 4: Create .env.example**

```
DATABASE_URL=postgresql://opencampus:password@localhost:5432/opencampus
JWT_SECRET=change-me-in-production
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_CALLBACK_URL=http://localhost:4000/auth/google/callback
FRONTEND_URL=http://localhost:3000
OPENCAMPUS_API_KEY=change-me-in-production
MINIO_ENDPOINT=localhost
MINIO_PORT=9000
MINIO_USE_SSL=false
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_BUCKET=opencampus
```

- [ ] **Step 5: Create docker-compose.dev.yaml at repo root**

```yaml
services:
  postgres:
    image: postgres:17-alpine
    environment:
      POSTGRES_DB: opencampus
      POSTGRES_USER: opencampus
      POSTGRES_PASSWORD: password
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data

  minio:
    image: quay.io/minio/minio:latest
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: minioadmin
      MINIO_ROOT_PASSWORD: minioadmin
    ports:
      - "9000:9000"
      - "9001:9001"
    volumes:
      - miniodata:/data

volumes:
  pgdata:
  miniodata:
```

- [ ] **Step 6: Start local services and run Prisma migrate**

```bash
docker compose -f docker-compose.dev.yaml up -d
cd apps/api
cp .env.example .env
pnpm prisma generate
pnpm prisma db push
```

Expected: tables created in local PostgreSQL.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: scaffold NestJS API with Prisma schema (11 tables)"
```

---

## Task 4: Implement Prisma module + Health endpoint

**Files:**
- Create: `apps/api/src/prisma/prisma.module.ts`, `apps/api/src/prisma/prisma.service.ts`, `apps/api/src/health/health.module.ts`, `apps/api/src/health/health.controller.ts`

- [ ] **Step 1: Write PrismaService**

```typescript
// apps/api/src/prisma/prisma.service.ts
import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
```

```typescript
// apps/api/src/prisma/prisma.module.ts
import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
```

- [ ] **Step 2: Write Health controller**

```typescript
// apps/api/src/health/health.controller.ts
import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Controller('health')
export class HealthController {
  constructor(private prisma: PrismaService) {}

  @Get()
  async check() {
    const dbOk = await this.prisma.$queryRaw`SELECT 1`.then(() => true).catch(() => false);
    return {
      status: dbOk ? 'ok' : 'degraded',
      db: dbOk ? 'ok' : 'error',
      timestamp: new Date().toISOString(),
    };
  }
}
```

```typescript
// apps/api/src/health/health.module.ts
import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';

@Module({
  controllers: [HealthController],
})
export class HealthModule {}
```

- [ ] **Step 3: Wire into AppModule**

Update `apps/api/src/app.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    HealthModule,
  ],
})
export class AppModule {}
```

- [ ] **Step 4: Update main.ts with port, CORS, and cookie-parser**

Replace `apps/api/src/main.ts`:

```typescript
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  app.use(cookieParser());
  app.enableCors({
    origin: config.getOrThrow('FRONTEND_URL'),
    credentials: true,
  });

  const port = config.get('PORT') || 4000;
  await app.listen(port);
}
bootstrap();
```

- [ ] **Step 5: Test health endpoint**

```bash
cd apps/api && pnpm start:dev &
curl http://localhost:4000/health
```

Expected: `{"status":"ok","db":"ok","timestamp":"..."}`

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add Prisma module and health endpoint"
```

---

## Task 5: Implement Google OAuth + JWT auth

**Files:**
- Create: `apps/api/src/auth/` (all auth files)

- [ ] **Step 1: Write GoogleStrategy**

```typescript
// apps/api/src/auth/google.strategy.ts
import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback } from 'passport-google-oauth20';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(config: ConfigService) {
    super({
      clientID: config.getOrThrow('GOOGLE_CLIENT_ID'),
      clientSecret: config.getOrThrow('GOOGLE_CLIENT_SECRET'),
      callbackURL: config.getOrThrow('GOOGLE_CALLBACK_URL'),
      scope: ['openid', 'email', 'profile'],
    });
  }

  validate(accessToken: string, refreshToken: string, profile: any, done: VerifyCallback) {
    done(null, {
      email: profile.emails[0].value,
      name: profile.displayName,
      picture: profile.photos?.[0]?.value,
      googleRefreshToken: refreshToken,
    });
  }
}
```

- [ ] **Step 2: Write JwtStrategy**

```typescript
// apps/api/src/auth/jwt.strategy.ts
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (req: Request) => req?.cookies?.['token'] ?? null,
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      secretOrKey: config.getOrThrow('JWT_SECRET'),
    });
  }

  validate(payload: { sub: number; email: string }) {
    if (!payload.sub) throw new UnauthorizedException();
    return { userId: payload.sub, email: payload.email };
  }
}
```

- [ ] **Step 3: Write ApiKeyStrategy**

```typescript
// apps/api/src/auth/api-key.strategy.ts
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-custom';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

@Injectable()
export class ApiKeyStrategy extends PassportStrategy(Strategy, 'api-key') {
  private readonly apiKey: string;

  constructor(config: ConfigService) {
    super();
    this.apiKey = config.getOrThrow('OPENCAMPUS_API_KEY');
  }

  validate(req: Request) {
    const key = req.headers['x-api-key'] as string;
    if (key !== this.apiKey) throw new UnauthorizedException('Invalid API key');
    const userId = parseInt(req.headers['x-user-id'] as string, 10);
    if (!userId) throw new UnauthorizedException('X-User-Id header required with API key');
    return { userId, email: 'api-key' };
  }
}
```

Note: requires `pnpm add passport-custom`

- [ ] **Step 4: Write combined AuthGuard**

```typescript
// apps/api/src/auth/auth.guard.ts
import { Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard as PassportAuthGuard } from '@nestjs/passport';

@Injectable()
export class AuthGuard extends PassportAuthGuard(['jwt', 'api-key']) {
  canActivate(context: ExecutionContext) {
    return super.canActivate(context);
  }
}
```

- [ ] **Step 5: Write AuthService**

```typescript
// apps/api/src/auth/auth.service.ts
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import * as jwt from 'jsonwebtoken';

@Injectable()
export class AuthService {
  private readonly jwtSecret: string;

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {
    this.jwtSecret = config.getOrThrow('JWT_SECRET');
  }

  async upsertUser(profile: {
    email: string;
    name: string;
    picture?: string;
    googleRefreshToken?: string;
  }) {
    return this.prisma.user.upsert({
      where: { email: profile.email },
      update: {
        name: profile.name,
        picture: profile.picture,
        ...(profile.googleRefreshToken && {
          googleRefreshToken: profile.googleRefreshToken,
        }),
      },
      create: {
        email: profile.email,
        name: profile.name,
        picture: profile.picture,
        googleRefreshToken: profile.googleRefreshToken,
      },
    });
  }

  signJwt(userId: number, email: string): string {
    return jwt.sign({ sub: userId, email }, this.jwtSecret, { expiresIn: '7d' });
  }

  verifyJwt(token: string) {
    return jwt.verify(token, this.jwtSecret) as { sub: number; email: string };
  }
}
```

- [ ] **Step 6: Write AuthController**

```typescript
// apps/api/src/auth/auth.controller.ts
import { Controller, Get, Post, Req, Res, UseGuards, Body } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(
    private auth: AuthService,
    private config: ConfigService,
  ) {}

  @Get('google')
  @UseGuards(AuthGuard('google'))
  googleLogin() {
    // Passport redirects to Google
  }

  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  async googleCallback(@Req() req: Request, @Res() res: Response) {
    const profile = req.user as any;
    const user = await this.auth.upsertUser(profile);
    const token = this.auth.signJwt(user.id, user.email);
    const frontendUrl = this.config.getOrThrow('FRONTEND_URL');

    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    res.redirect(`${frontendUrl}/dashboard`);
  }

  @Post('refresh')
  async refresh(@Req() req: Request, @Res() res: Response) {
    const oldToken = req.cookies?.['token'];
    if (!oldToken) return res.status(401).json({ error: 'No token' });

    try {
      const payload = this.auth.verifyJwt(oldToken);
      const token = this.auth.signJwt(payload.sub, payload.email);
      res.cookie('token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });
      return res.json({ ok: true });
    } catch {
      return res.status(401).json({ error: 'Invalid token' });
    }
  }
}
```

- [ ] **Step 7: Write AuthModule and wire everything**

```typescript
// apps/api/src/auth/auth.module.ts
import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { GoogleStrategy } from './google.strategy';
import { JwtStrategy } from './jwt.strategy';
import { ApiKeyStrategy } from './api-key.strategy';

@Module({
  imports: [PassportModule],
  controllers: [AuthController],
  providers: [AuthService, GoogleStrategy, JwtStrategy, ApiKeyStrategy],
  exports: [AuthService],
})
export class AuthModule {}
```

Add to `AppModule` imports: `AuthModule`.

Also add `cookie-parser` middleware:

```bash
pnpm add cookie-parser
pnpm add -D @types/cookie-parser
```

Update `main.ts`:

```typescript
import * as cookieParser from 'cookie-parser';
// in bootstrap():
app.use(cookieParser());
```

- [ ] **Step 8: Write basic auth test**

Test that `/health` works without auth, and protected endpoints return 401.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat: implement Google OAuth + JWT + API key auth"
```

---

## Task 6: Implement Users + Courses modules

**Files:**
- Create: `apps/api/src/users/`, `apps/api/src/courses/`

- [ ] **Step 1: Write UsersService + Controller**

```typescript
// apps/api/src/users/users.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findById(id: number) {
    return this.prisma.user.findUniqueOrThrow({ where: { id } });
  }

  async update(id: number, data: { canvasAccessToken?: string; name?: string }) {
    return this.prisma.user.update({ where: { id }, data });
  }
}
```

```typescript
// apps/api/src/users/users.controller.ts
import { Controller, Get, Patch, Body, UseGuards, Req } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { UsersService } from './users.service';

@Controller('users')
@UseGuards(AuthGuard)
export class UsersController {
  constructor(private users: UsersService) {}

  @Get('me')
  async getMe(@Req() req: any) {
    const user = await this.users.findById(req.user.userId);
    const { googleRefreshToken, canvasAccessToken, ...safe } = user;
    return { ...safe, hasCanvasToken: !!canvasAccessToken };
  }

  @Patch('me')
  async updateMe(@Req() req: any, @Body() body: { canvasAccessToken?: string; name?: string }) {
    return this.users.update(req.user.userId, body);
  }
}
```

- [ ] **Step 2: Write CoursesService with Canvas sync logic**

```typescript
// apps/api/src/courses/courses.service.ts
import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CanvasClient } from '@opencampus/canvas';

@Injectable()
export class CoursesService {
  constructor(private prisma: PrismaService) {}

  async findAllByUser(userId: number) {
    return this.prisma.course.findMany({
      where: { userId },
      include: { semester: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(id: number, userId: number) {
    return this.prisma.course.findFirstOrThrow({ where: { id, userId } });
  }

  async update(id: number, userId: number, data: { shortName?: string; metadata?: any; notes?: string }) {
    return this.prisma.course.update({ where: { id }, data });
  }

  async syncFromCanvas(userId: number) {
    // 1. Get user's Canvas token
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (!user.canvasAccessToken) {
      throw new BadRequestException('Canvas access token not set. Update via PATCH /users/me');
    }

    // 2. Fetch courses from Canvas
    const canvas = new CanvasClient({ baseUrl: 'https://canvas.skku.edu', accessToken: user.canvasAccessToken });
    const canvasCourses = await canvas.getCourses();

    // 3. Group by enrollment_term → semester
    const results = [];
    for (const cc of canvasCourses) {
      // Derive semester name from term or date (e.g., "2026-1")
      const semesterName = this.deriveSemesterName(cc.startDate);
      if (!semesterName) continue;

      // Upsert semester
      const semester = await this.prisma.semester.upsert({
        where: { userId_name: { userId, name: semesterName } },
        update: {},
        create: { userId, name: semesterName, startDate: cc.startDate ? new Date(cc.startDate) : null, endDate: cc.endDate ? new Date(cc.endDate) : null },
      });

      // Upsert course
      const course = await this.prisma.course.upsert({
        where: { id: await this.findCanvasCourseId(userId, cc.id) ?? -1 },
        update: { name: cc.name },
        create: { userId, semesterId: semester.id, name: cc.name, canvasId: cc.id },
      });
      results.push(course);
    }
    return results;
  }

  private deriveSemesterName(startDate: string | null): string | null {
    if (!startDate) return null;
    const d = new Date(startDate);
    const year = d.getFullYear();
    const month = d.getMonth() + 1;
    // Korean university: Mar-Jun = 1학기, Sep-Dec = 2학기
    if (month >= 2 && month <= 7) return `${year}-1`;
    if (month >= 8) return `${year}-2`;
    return `${year - 1}-2`;
  }

  private async findCanvasCourseId(userId: number, canvasId: number): Promise<number | null> {
    const c = await this.prisma.course.findFirst({ where: { userId, canvasId } });
    return c?.id ?? null;
  }
}
```

- [ ] **Step 3: Write CoursesController**

```typescript
// apps/api/src/courses/courses.controller.ts
import { Controller, Get, Post, Patch, Param, Body, UseGuards, Req, ParseIntPipe } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { CoursesService } from './courses.service';

@Controller('courses')
@UseGuards(AuthGuard)
export class CoursesController {
  constructor(private courses: CoursesService) {}

  @Get()
  findAll(@Req() req: any) {
    return this.courses.findAllByUser(req.user.userId);
  }

  @Post('sync')
  sync(@Req() req: any) {
    return this.courses.syncFromCanvas(req.user.userId);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    return this.courses.findById(id, req.user.userId);
  }

  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Req() req: any, @Body() body: any) {
    return this.courses.update(id, req.user.userId, body);
  }
}
```

- [ ] **Step 4: Create modules and wire into AppModule**

Create `UsersModule`, `CoursesModule` following NestJS patterns. Add both to `AppModule` imports.

- [ ] **Step 5: Write tests**

Test: `/users/me` returns user without sensitive fields, `/courses` returns empty list for new user, `/courses/sync` returns 400 without Canvas token.

- [ ] **Step 6: Add test script to apps/web**

Add to `apps/web/package.json` scripts: `"test": "echo 'no tests yet'"` to prevent CI failure.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: add users and courses modules with Canvas sync"
```

---

## Task 7: Scaffold apps/web with Next.js 16

**Files:**
- Create: `apps/web/` (Next.js project)

- [ ] **Step 1: Clean up and initialize Next.js 16**

```bash
cd /home/json/opencampus-worktrees/main
rm apps/web/.gitkeep
pnpm create next-app@latest apps/web --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --turbopack
```

- [ ] **Step 2: Update package.json name**

Set to `@opencampus/web`.

- [ ] **Step 3: Create login page**

`apps/web/src/app/login/page.tsx` — simple Google login button that redirects to `API_URL/auth/google`.

- [ ] **Step 4: Create PWA manifest**

`apps/web/public/manifest.json`:

```json
{
  "name": "OpenCampus",
  "short_name": "OpenCampus",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#000000",
  "theme_color": "#000000",
  "icons": []
}
```

- [ ] **Step 5: Verify dev server**

```bash
pnpm --filter @opencampus/web dev
```

Expected: Next.js 16 dev server at http://localhost:3000

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: scaffold Next.js 16 web app with login page"
```

---

## Task 8: CI + Dockerfiles

**Files:**
- Create: `.github/workflows/ci.yaml`, `apps/api/Dockerfile`

- [ ] **Step 1: Create CI workflow**

```yaml
# .github/workflows/ci.yaml
name: CI
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  lint-test-build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm lint
      - run: pnpm test
      - run: pnpm build
```

- [ ] **Step 2: Create API Dockerfile**

```dockerfile
# apps/api/Dockerfile
# Uses `pnpm deploy` for clean standalone output with all dependencies resolved.
# Build context: repo root (not apps/api/).
FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

FROM base AS deps
WORKDIR /app
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/api/package.json apps/api/
COPY packages/canvas/package.json packages/canvas/
RUN pnpm install --frozen-lockfile

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/ ./
COPY . .
RUN pnpm --filter @opencampus/canvas build
RUN pnpm --filter @opencampus/api prisma generate
RUN pnpm --filter @opencampus/api build
RUN pnpm --filter @opencampus/api deploy /app/standalone --prod

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/standalone ./
COPY --from=builder /app/apps/api/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
EXPOSE 4000
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]
```

> **Note:** `pnpm deploy` creates a standalone directory with all production dependencies resolved. Prisma engine binaries are copied separately from the builder's `.prisma` cache.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "ci: add GitHub Actions workflow and API Dockerfile"
```

---

## Summary

After Phase 1 completion you will have:

- Clean monorepo: `apps/api`, `apps/web`, `packages/canvas`
- Full Prisma schema (11 tables) migrated to PostgreSQL
- Canvas LMS TypeScript wrapper with all methods
- Google OAuth login → JWT auth → protected endpoints
- Health check endpoint
- Courses CRUD + Canvas sync
- Login page (Next.js 16)
- CI pipeline + Docker build
- Local dev with docker-compose (PostgreSQL + MinIO)

**Next:** Phase 2 (file upload + MinIO + metadata inference + review UI)
