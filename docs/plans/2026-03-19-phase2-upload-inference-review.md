# Phase 2: File Upload + MinIO + Metadata Inference + Review UI

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Users can upload files (drag & drop), files are stored in MinIO, metadata is auto-inferred (filename parsing + GPT-4o), users review/correct metadata in a form, and materials are saved to the database. Jobs infrastructure for background processing is also set up.

**Architecture:** NestJS materials module with MinIO integration (S3-compatible via `@aws-sdk/client-s3`). Metadata inference service (rule-based + GPT-4o). Next.js 16 upload page with drag & drop, review form. SSE for job progress.

**Tech Stack:** `@aws-sdk/client-s3` (MinIO), `openai` (GPT-4o), `multer` (file upload), Next.js 16 App Router, React hooks

**Spec:** `docs/specs/2026-03-19-opencampus-full-pipeline-design.md` (Sections 5, 6, 7, 9-Materials, 9-Jobs, 11)

**Depends on:** Phase 1 (auth, prisma, courses module)

---

## File Structure (new/modified files)

```
apps/api/src/
├── storage/
│   ├── storage.module.ts              # MinIO S3 client provider
│   └── storage.service.ts             # upload, delete, getSignedUrl
├── materials/
│   ├── materials.module.ts
│   ├── materials.controller.ts        # CRUD + upload + photos
│   ├── materials.service.ts           # business logic
│   └── materials.controller.spec.ts
├── inference/
│   ├── inference.module.ts
│   ├── inference.service.ts           # metadata auto-inference orchestrator
│   ├── filename-parser.ts             # rule-based filename parsing
│   ├── filename-parser.spec.ts        # unit tests for parser
│   └── gpt-inference.ts              # GPT-4o metadata inference
├── jobs/
│   ├── jobs.module.ts
│   ├── jobs.controller.ts             # GET /jobs, GET /jobs/:id/stream (SSE)
│   ├── jobs.service.ts                # job CRUD + status updates
│   └── job-queue.ts                   # in-memory queue runner
└── weeks/
    ├── weeks.module.ts
    ├── weeks.controller.ts            # GET /courses/:id/weeks
    └── weeks.service.ts               # auto-create on material upload

apps/web/src/
├── app/
│   ├── dashboard/
│   │   ├── layout.tsx                 # Dashboard shell (sidebar + header)
│   │   ├── page.tsx                   # Course list → week list
│   │   └── courses/[id]/
│   │       └── page.tsx               # Course detail with weeks + materials
│   ├── upload/
│   │   └── page.tsx                   # Drag & drop upload → review form
│   └── materials/[id]/
│       └── page.tsx                   # Material detail view
├── components/
│   ├── upload-dropzone.tsx            # Drag & drop file zone
│   ├── review-form.tsx                # Metadata review/correction form
│   └── job-status.tsx                 # SSE job progress indicator
└── lib/
    └── api.ts                         # API client (fetch wrapper with auth)
```

---

## Task 1: Storage service (MinIO/S3)

**Files:**
- Create: `apps/api/src/storage/storage.service.ts`, `apps/api/src/storage/storage.module.ts`

- [ ] **Step 1: Install S3 client**

```bash
cd apps/api && pnpm add @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
```

- [ ] **Step 2: Write StorageService**

```typescript
// apps/api/src/storage/storage.service.ts
import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  CreateBucketCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

@Injectable()
export class StorageService implements OnModuleInit {
  private client: S3Client;
  private bucket: string;

  constructor(private config: ConfigService) {
    this.bucket = config.getOrThrow('MINIO_BUCKET');
    this.client = new S3Client({
      endpoint: `http${config.get('MINIO_USE_SSL') === 'true' ? 's' : ''}://${config.getOrThrow('MINIO_ENDPOINT')}:${config.getOrThrow('MINIO_PORT')}`,
      region: 'us-east-1',
      credentials: {
        accessKeyId: config.getOrThrow('MINIO_ACCESS_KEY'),
        secretAccessKey: config.getOrThrow('MINIO_SECRET_KEY'),
      },
      forcePathStyle: true, // Required for MinIO
    });
  }

  async onModuleInit() {
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
    } catch {
      await this.client.send(new CreateBucketCommand({ Bucket: this.bucket }));
    }
  }

  async upload(key: string, body: Buffer, contentType: string): Promise<string> {
    await this.client.send(new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
    }));
    return `s3://${this.bucket}/${key}`;
  }

  async delete(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({
      Bucket: this.bucket,
      Key: key,
    }));
  }

  async getSignedUrl(key: string, expiresIn = 3600): Promise<string> {
    return getSignedUrl(this.client, new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    }), { expiresIn });
  }

  /** Extract S3 key from file_path like 's3://bucket/path/to/file' */
  extractKey(filePath: string): string {
    const match = filePath.match(/^s3:\/\/[^/]+\/(.+)$/);
    if (!match) throw new Error(`Invalid file path: ${filePath}`);
    return match[1];
  }
}
```

- [ ] **Step 3: Write StorageModule**

```typescript
// apps/api/src/storage/storage.module.ts
import { Global, Module } from '@nestjs/common';
import { StorageService } from './storage.service';

@Global()
@Module({
  providers: [StorageService],
  exports: [StorageService],
})
export class StorageModule {}
```

- [ ] **Step 4: Add StorageModule to AppModule imports**

- [ ] **Step 5: Verify build**

```bash
cd apps/api && pnpm build
```

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat: add MinIO/S3 storage service"
```

---

## Task 2: Weeks module (auto-create on material upload)

**Files:**
- Create: `apps/api/src/weeks/weeks.service.ts`, `apps/api/src/weeks/weeks.controller.ts`, `apps/api/src/weeks/weeks.module.ts`

- [ ] **Step 1: Write WeeksService**

```typescript
// apps/api/src/weeks/weeks.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class WeeksService {
  constructor(private prisma: PrismaService) {}

  async findByCourse(courseId: number, userId: number) {
    // Verify ownership
    await this.prisma.course.findFirstOrThrow({ where: { id: courseId, userId } });

    return this.prisma.courseWeek.findMany({
      where: { courseId, userId },
      include: { materials: { where: { parentId: null }, orderBy: { createdAt: 'desc' } } },
      orderBy: { week: 'asc' },
    });
  }

  /** Upsert: create week if it doesn't exist, return existing if it does */
  async getOrCreate(courseId: number, userId: number, week: number) {
    const existing = await this.prisma.courseWeek.findUnique({
      where: { courseId_userId_week: { courseId, userId, week } },
    });
    if (existing) return existing;
    return this.prisma.courseWeek.create({
      data: { courseId, userId, week },
    });
  }
}
```

- [ ] **Step 2: Write WeeksController**

```typescript
// apps/api/src/weeks/weeks.controller.ts
import { Controller, Get, Param, UseGuards, Req, ParseIntPipe } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { WeeksService } from './weeks.service';

@Controller('courses/:courseId/weeks')
@UseGuards(AuthGuard)
export class WeeksController {
  constructor(private weeks: WeeksService) {}

  @Get()
  findAll(@Param('courseId', ParseIntPipe) courseId: number, @Req() req: any) {
    return this.weeks.findByCourse(courseId, req.user.userId);
  }
}
```

- [ ] **Step 3: Write WeeksModule, add to AppModule**

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat: add weeks module with auto-create"
```

---

## Task 3: Filename parser (rule-based metadata inference)

**Files:**
- Create: `apps/api/src/inference/filename-parser.ts`, `apps/api/src/inference/filename-parser.spec.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// apps/api/src/inference/filename-parser.spec.ts
import { parseFilename } from './filename-parser';

describe('parseFilename', () => {
  it('parses "최적설계 2-2.m4a"', () => {
    const result = parseFilename('최적설계 2-2.m4a');
    expect(result.courseName).toBe('최적설계');
    expect(result.week).toBe(2);
    expect(result.session).toBe(2);
    expect(result.type).toBe('recording');
  });

  it('parses "확랜프 3-1.m4a"', () => {
    const result = parseFilename('확랜프 3-1.m4a');
    expect(result.courseName).toBe('확랜프');
    expect(result.week).toBe(3);
    expect(result.session).toBe(1);
  });

  it('parses "기경개 Ch2.pdf"', () => {
    const result = parseFilename('기경개 Ch2.pdf');
    expect(result.courseName).toBe('기경개');
    expect(result.week).toBe(2);
    expect(result.type).toBe('pdf');
  });

  it('handles split recording "확랜프 3-2-1.m4a"', () => {
    const result = parseFilename('확랜프 3-2-1.m4a');
    expect(result.courseName).toBe('확랜프');
    expect(result.week).toBe(3);
    expect(result.session).toBe(2);
    expect(result.partNumber).toBe(1);
  });

  it('detects type from extension', () => {
    expect(parseFilename('test.mp4').type).toBe('video');
    expect(parseFilename('test.jpg').type).toBe('photo');
    expect(parseFilename('test.pptx').type).toBe('ppt');
    expect(parseFilename('test.md').type).toBe('note');
  });

  it('returns nulls for unparseable filename', () => {
    const result = parseFilename('random_file.m4a');
    expect(result.courseName).toBeNull();
    expect(result.week).toBeNull();
  });
});
```

- [ ] **Step 2: Implement filename-parser.ts**

```typescript
// apps/api/src/inference/filename-parser.ts

export interface ParsedFilename {
  courseName: string | null;
  week: number | null;
  session: number | null;
  partNumber: number | null;
  type: string;
}

const EXTENSION_TYPE_MAP: Record<string, string> = {
  m4a: 'recording', mp3: 'recording', wav: 'recording',
  mp4: 'video', mkv: 'video',
  jpg: 'photo', jpeg: 'photo', png: 'photo', heic: 'photo',
  pdf: 'pdf',
  ppt: 'ppt', pptx: 'ppt',
  md: 'note', txt: 'note',
};

export function parseFilename(filename: string): ParsedFilename {
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';
  const type = EXTENSION_TYPE_MAP[ext] ?? 'note';
  const nameWithoutExt = filename.replace(/\.[^.]+$/, '').trim();

  let courseName: string | null = null;
  let week: number | null = null;
  let session: number | null = null;
  let partNumber: number | null = null;

  // Pattern 1: "과목명 W-S-P" (e.g., "확랜프 3-2-1")
  const splitMatch = nameWithoutExt.match(/^(.+?)\s+(\d+)-(\d+)-(\d+)$/);
  if (splitMatch) {
    courseName = splitMatch[1].trim();
    week = parseInt(splitMatch[2], 10);
    session = parseInt(splitMatch[3], 10);
    partNumber = parseInt(splitMatch[4], 10);
    return { courseName, week, session, partNumber, type };
  }

  // Pattern 2: "과목명 W-S" (e.g., "최적설계 2-2")
  const wsMatch = nameWithoutExt.match(/^(.+?)\s+(\d+)-(\d+)$/);
  if (wsMatch) {
    courseName = wsMatch[1].trim();
    week = parseInt(wsMatch[2], 10);
    session = parseInt(wsMatch[3], 10);
    return { courseName, week, session, partNumber, type };
  }

  // Pattern 3: "과목명 ChN" or "과목명 N" (e.g., "기경개 Ch2")
  const chMatch = nameWithoutExt.match(/^(.+?)\s+(?:Ch|ch|chapter\s*)?(\d+)$/i);
  if (chMatch) {
    courseName = chMatch[1].trim();
    week = parseInt(chMatch[2], 10);
    return { courseName, week, session, partNumber, type };
  }

  return { courseName, week, session, partNumber, type };
}
```

- [ ] **Step 3: Run tests**

```bash
cd apps/api && pnpm jest src/inference/filename-parser.spec.ts --verbose
```

Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat: add filename parser for metadata inference"
```

---

## Task 4: GPT-4o metadata inference

**Files:**
- Create: `apps/api/src/inference/gpt-inference.ts`, `apps/api/src/inference/inference.service.ts`, `apps/api/src/inference/inference.module.ts`

- [ ] **Step 1: Install OpenAI SDK**

```bash
cd apps/api && pnpm add openai
```

- [ ] **Step 2: Write gpt-inference.ts**

```typescript
// apps/api/src/inference/gpt-inference.ts
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';

export interface GptInferenceInput {
  filename: string;
  fileType: string;
  courses: { name: string; shortName: string | null }[];
  currentDate: string;
  semesterStart?: string;
  parsedHints: {
    courseName: string | null;
    week: number | null;
    session: number | null;
  };
}

export interface GptInferenceResult {
  courseName: string;
  week: number;
  session: number | null;
  date: string | null;
  confidence: number; // 0-1
  reasoning: string;
}

@Injectable()
export class GptInferenceService {
  private openai: OpenAI;

  constructor(config: ConfigService) {
    this.openai = new OpenAI({ apiKey: config.getOrThrow('OPENAI_API_KEY') });
  }

  async infer(input: GptInferenceInput): Promise<GptInferenceResult> {
    const courseList = input.courses.map(c =>
      `- ${c.name}${c.shortName ? ` (약어: ${c.shortName})` : ''}`
    ).join('\n');

    const prompt = `You are a metadata inference engine for university lecture materials.

Given a file, infer which course, week, and session it belongs to.

Available courses:
${courseList}

File: "${input.filename}" (type: ${input.fileType})
Current date: ${input.currentDate}
${input.semesterStart ? `Semester start: ${input.semesterStart}` : ''}

Filename parsing hints:
- Course name hint: ${input.parsedHints.courseName ?? 'unknown'}
- Week hint: ${input.parsedHints.week ?? 'unknown'}
- Session hint: ${input.parsedHints.session ?? 'unknown'}

Respond in JSON:
{
  "courseName": "exact course name from the list",
  "week": number,
  "session": number or null,
  "date": "YYYY-MM-DD" or null,
  "confidence": 0.0-1.0,
  "reasoning": "brief explanation"
}`;

    const response = await this.openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature: 0.1,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) throw new Error('Empty GPT response');
    return JSON.parse(content) as GptInferenceResult;
  }
}
```

- [ ] **Step 3: Write InferenceService (orchestrator)**

```typescript
// apps/api/src/inference/inference.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { parseFilename } from './filename-parser';
import { GptInferenceService } from './gpt-inference';

export interface InferenceResult {
  courseId: number | null;
  courseName: string | null;
  week: number | null;
  session: number | null;
  type: string;
  partNumber: number | null;
  confidence: number;
  date: string | null;
}

@Injectable()
export class InferenceService {
  constructor(
    private prisma: PrismaService,
    private gpt: GptInferenceService,
  ) {}

  async infer(userId: number, filename: string): Promise<InferenceResult> {
    // Step 1: Filename parsing (rule-based)
    const parsed = parseFilename(filename);

    // Step 2: Load user's courses for matching
    const courses = await this.prisma.course.findMany({
      where: { userId },
      select: { id: true, name: true, shortName: true },
    });

    // Step 3: Try short_name matching
    let matchedCourse = parsed.courseName
      ? courses.find(c =>
          c.name === parsed.courseName ||
          c.shortName === parsed.courseName
        )
      : null;

    // Step 4: If we have enough from parsing, skip GPT
    if (matchedCourse && parsed.week) {
      return {
        courseId: matchedCourse.id,
        courseName: matchedCourse.name,
        week: parsed.week,
        session: parsed.session,
        type: parsed.type,
        partNumber: parsed.partNumber,
        confidence: 0.9,
        date: null,
      };
    }

    // Step 5: GPT-4o inference
    try {
      const gptResult = await this.gpt.infer({
        filename,
        fileType: parsed.type,
        courses: courses.map(c => ({ name: c.name, shortName: c.shortName })),
        currentDate: new Date().toISOString().split('T')[0],
        parsedHints: {
          courseName: parsed.courseName,
          week: parsed.week,
          session: parsed.session,
        },
      });

      const gptCourse = courses.find(c => c.name === gptResult.courseName);
      return {
        courseId: gptCourse?.id ?? null,
        courseName: gptResult.courseName,
        week: gptResult.week,
        session: gptResult.session,
        type: parsed.type,
        partNumber: parsed.partNumber,
        confidence: gptResult.confidence,
        date: gptResult.date,
      };
    } catch {
      // GPT failed — return what we have from parsing
      return {
        courseId: matchedCourse?.id ?? null,
        courseName: parsed.courseName,
        week: parsed.week,
        session: parsed.session,
        type: parsed.type,
        partNumber: parsed.partNumber,
        confidence: parsed.courseName ? 0.5 : 0.1,
        date: null,
      };
    }
  }
}
```

- [ ] **Step 4: Write InferenceModule**

- [ ] **Step 5: Verify build**

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat: add metadata inference (filename parser + GPT-4o)"
```

---

## Task 5: Materials module (upload + CRUD)

**Files:**
- Create: `apps/api/src/materials/materials.service.ts`, `apps/api/src/materials/materials.controller.ts`, `apps/api/src/materials/materials.module.ts`

- [ ] **Step 1: Install multer for file uploads**

```bash
cd apps/api && pnpm add multer @nestjs/platform-express
pnpm add -D @types/multer
```

- [ ] **Step 2: Write MaterialsService**

Key methods:
- `findAll(userId, filters: { courseId?, week?, type? })` — with pagination (`page`, `limit`)
- `findById(id, userId)` — with children (attached photos)
- `create(userId, data)` — create material + auto-create course_week
- `update(id, userId, data)` — update metadata/transcript
- `delete(id, userId)` — delete from DB + MinIO
- `attachPhoto(parentId, userId, file)` — upload photo with parent_id set

Upload flow:
1. Receive file via multer
2. Generate S3 key: `{semester}/{course}/week{week:02d}-{session}_{type}_{date}_{uuid}.{ext}`
3. Upload to MinIO via StorageService
4. Run InferenceService to get metadata suggestions
5. Create material record (status: pending review)
6. Return material with inference results

- [ ] **Step 3: Write MaterialsController**

Endpoints:
- `GET /materials` — list with query filters + pagination
- `POST /materials/upload` — multipart file upload, returns material + inference
- `GET /materials/:id` — detail with children
- `PATCH /materials/:id` — update metadata (review form save)
- `DELETE /materials/:id` — delete material + MinIO file
- `POST /materials/:id/analyze` — re-run inference
- `POST /materials/:id/photos` — attach photo to existing material

- [ ] **Step 4: Write MaterialsModule, add to AppModule**

- [ ] **Step 5: Verify build**

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat: add materials module with upload, inference, CRUD"
```

---

## Task 6: Jobs module (queue + SSE)

**Files:**
- Create: `apps/api/src/jobs/job-queue.ts`, `apps/api/src/jobs/jobs.service.ts`, `apps/api/src/jobs/jobs.controller.ts`, `apps/api/src/jobs/jobs.module.ts`

- [ ] **Step 1: Write in-memory job queue**

```typescript
// apps/api/src/jobs/job-queue.ts
import { Injectable } from '@nestjs/common';
import { EventEmitter } from 'events';

export interface QueuedJob {
  jobId: number;
  type: string;
  handler: () => Promise<void>;
}

@Injectable()
export class JobQueue extends EventEmitter {
  private queue: QueuedJob[] = [];
  private running = false;
  private concurrency = 2;
  private active = 0;

  enqueue(job: QueuedJob) {
    this.queue.push(job);
    this.process();
  }

  private async process() {
    while (this.queue.length > 0 && this.active < this.concurrency) {
      const job = this.queue.shift();
      if (!job) break;
      this.active++;
      this.emit('start', job.jobId);
      job.handler()
        .then(() => this.emit('complete', job.jobId))
        .catch((err) => this.emit('error', job.jobId, err))
        .finally(() => { this.active--; this.process(); });
    }
  }
}
```

- [ ] **Step 2: Write JobsService**

Methods:
- `create(userId, materialId, type)` — create job record + enqueue
- `findAll(userId, filters)` — with pagination
- `findById(id, userId)`
- `updateProgress(id, progress)` — update + emit SSE event
- `complete(id)` — set status=done
- `fail(id, error)` — set status=failed

- [ ] **Step 3: Write JobsController with SSE**

```typescript
// SSE endpoint pattern
@Get(':id/stream')
@UseGuards(AuthGuard)
stream(@Param('id', ParseIntPipe) id: number, @Req() req: any, @Res() res: Response) {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const onProgress = (jobId: number, progress: number) => {
    if (jobId === id) res.write(`data: ${JSON.stringify({ jobId, progress })}\n\n`);
  };
  const onComplete = (jobId: number) => {
    if (jobId === id) { res.write(`data: ${JSON.stringify({ jobId, status: 'done' })}\n\n`); res.end(); }
  };
  const onError = (jobId: number, error: string) => {
    if (jobId === id) { res.write(`data: ${JSON.stringify({ jobId, status: 'failed', error })}\n\n`); res.end(); }
  };

  this.jobQueue.on('progress', onProgress);
  this.jobQueue.on('complete', onComplete);
  this.jobQueue.on('error', onError);

  req.on('close', () => {
    this.jobQueue.off('progress', onProgress);
    this.jobQueue.off('complete', onComplete);
    this.jobQueue.off('error', onError);
  });
}
```

- [ ] **Step 4: Write JobsModule, add to AppModule**

- [ ] **Step 5: Verify build**

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat: add jobs module with in-memory queue and SSE"
```

---

## Task 7: Web — API client + Dashboard layout

**Files:**
- Create: `apps/web/src/lib/api.ts`, `apps/web/src/app/dashboard/layout.tsx`, `apps/web/src/app/dashboard/page.tsx`

- [ ] **Step 1: Write API client**

```typescript
// apps/web/src/lib/api.ts
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    credentials: 'include', // send JWT cookie
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`API ${res.status}: ${body}`);
  }
  return res.json();
}

export async function apiUpload<T>(path: string, formData: FormData): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    credentials: 'include',
    body: formData, // no Content-Type header — browser sets multipart boundary
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`API ${res.status}: ${body}`);
  }
  return res.json();
}
```

- [ ] **Step 2: Write Dashboard layout**

Dark mode, sidebar with course list, header with user info. Use Tailwind CSS (already installed).

- [ ] **Step 3: Write Dashboard page**

Fetch courses from API, show list. Each course links to `/dashboard/courses/[id]`.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat: add web API client and dashboard layout"
```

---

## Task 8: Web — Upload page + Review form

**Files:**
- Create: `apps/web/src/components/upload-dropzone.tsx`, `apps/web/src/components/review-form.tsx`, `apps/web/src/app/upload/page.tsx`

- [ ] **Step 1: Write UploadDropzone component**

Client component (`'use client'`). Drag & drop zone that:
- Accepts audio, video, image, pdf, ppt, txt, md files
- Shows file name + size after drop
- Calls `apiUpload('/materials/upload', formData)` on submit
- Returns the material + inference result to parent

- [ ] **Step 2: Write ReviewForm component**

Client component. Shows the inference result as a pre-filled form:
- Course dropdown (from user's courses)
- Week number input
- Session number input
- Type dropdown (recording, video, photo, pdf, ppt, note)
- Date picker
- AI confidence bar
- "Save" → `PATCH /materials/:id`
- "Skip" → move to next file
- "Re-analyze" → `POST /materials/:id/analyze`

- [ ] **Step 3: Write Upload page**

Combines UploadDropzone + ReviewForm:
1. Upload file → get inference result
2. Show ReviewForm with pre-filled data
3. User reviews/corrects → saves
4. Ready for next file

- [ ] **Step 4: Write Course detail page**

`apps/web/src/app/dashboard/courses/[id]/page.tsx`:
- Fetch weeks for course
- Show week list with material counts
- Link to materials within each week

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: add upload page with drag-drop and review form"
```

---

## Summary

After Phase 2 completion:

- Files uploaded via drag & drop → stored in MinIO
- Metadata auto-inferred (filename parsing + GPT-4o)
- Users review/correct metadata in a form
- Materials CRUD (list, detail, update, delete)
- Photo attachments on materials
- In-memory job queue with SSE progress
- Dashboard with course list → week list → materials
- Upload page with inference → review → save flow

**Next:** Phase 3 (STT/OCR pipeline — actual file processing in job workers)
