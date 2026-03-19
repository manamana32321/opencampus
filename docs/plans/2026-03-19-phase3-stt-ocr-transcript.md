# Phase 3: STT/OCR Pipeline + Transcript Editor

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire job handlers to actually process files — STT for audio/video, OCR for photos, PDF text extraction, and PPT conversion. Build the transcript editor UI for reviewing STT results.

**Architecture:** Job handlers registered in the in-memory queue. Each handler: fetches file from MinIO → processes → writes result to DB → updates job status. Transcript editor uses tiptap for markdown editing.

**Tech Stack:** `openai` (Whisper STT, GPT-4o Vision), `fluent-ffmpeg`/`ffmpeg-static` (audio extraction), `pdfjs-dist` (PDF text), tiptap (markdown editor)

**Spec:** `docs/specs/2026-03-19-opencampus-full-pipeline-design.md` (Sections 6, 11)

**Depends on:** Phase 2 (materials + jobs modules)

---

## File Structure

```
apps/api/src/
├── processors/
│   ├── processors.module.ts           # Registers all processors
│   ├── stt.processor.ts               # Whisper STT (recording + video)
│   ├── ocr.processor.ts               # GPT-4o Vision OCR (photo)
│   ├── pdf.processor.ts               # pdf.js + fallback Vision OCR
│   ├── ppt.processor.ts               # LibreOffice conversion (deferred)
│   └── note.processor.ts              # Plain text read
└── processors/__tests__/
    └── stt.processor.spec.ts

apps/web/src/
├── app/
│   └── materials/[id]/
│       ├── page.tsx                    # (already exists from Phase 2)
│       └── edit/
│           └── page.tsx                # Transcript editor page
├── components/
│   ├── transcript-editor.tsx           # tiptap markdown editor
│   └── transcript-preview.tsx          # markdown preview panel
```

---

## Task 1: FFmpeg setup + STT processor

**Files:**
- Create: `apps/api/src/processors/stt.processor.ts`

- [ ] **Step 1: Install dependencies**
```bash
cd apps/api && pnpm add openai fluent-ffmpeg ffmpeg-static
pnpm add -D @types/fluent-ffmpeg
```

- [ ] **Step 2: Write STT processor**

Handles `recording` and `video` types:
1. Download file from MinIO (via StorageService signed URL or direct S3 GetObject)
2. For video: extract audio track with ffmpeg → temp file
3. Send audio to OpenAI Whisper API (`audio/transcriptions`)
4. Write transcript to `materials.transcript`
5. Update job progress (download=20%, ffmpeg=40%, whisper=80%, save=100%)

- [ ] **Step 3: Commit**

---

## Task 2: OCR processor (GPT-4o Vision)

**Files:**
- Create: `apps/api/src/processors/ocr.processor.ts`

- [ ] **Step 1: Write OCR processor**

Handles `photo` type:
1. Download image from MinIO
2. Convert to base64
3. Send to GPT-4o Vision: "Extract all text from this image. This is a photo of a university lecture (whiteboard, slide, or notes). Return the text in markdown format."
4. Write result to `materials.extracted_text`

- [ ] **Step 2: Commit**

---

## Task 3: PDF processor (2-stage)

**Files:**
- Create: `apps/api/src/processors/pdf.processor.ts`

- [ ] **Step 1: Install pdfjs-dist**
```bash
cd apps/api && pnpm add pdfjs-dist
```

- [ ] **Step 2: Write PDF processor**

2-stage strategy:
1. Download PDF from MinIO
2. Extract text with pdfjs-dist
3. If extracted text length < 100 chars per page → trigger Vision OCR fallback
4. Vision fallback: render each page as image → GPT-4o Vision OCR → concatenate
5. Write result to `materials.extracted_text`
6. Update job type to `pdf_vision` if fallback triggered

- [ ] **Step 3: Commit**

---

## Task 4: Note processor + processor registry

**Files:**
- Create: `apps/api/src/processors/note.processor.ts`, `apps/api/src/processors/processors.module.ts`

- [ ] **Step 1: Write note processor**

Simple: download file → read as UTF-8 → write to `materials.extracted_text`

- [ ] **Step 2: Write ProcessorsModule**

Registry that maps `material.type` → processor:
- `recording` → SttProcessor
- `video` → SttProcessor
- `photo` → OcrProcessor
- `pdf` → PdfProcessor
- `note` → NoteProcessor
- `ppt` → TODO (deferred, LibreOffice dependency)

Wire into JobQueue: when a job is created, the processor module provides the handler function.

- [ ] **Step 3: Update MaterialsService.upload()**

After creating a material, auto-create a job if the type has a processor:
```typescript
if (['recording', 'video', 'photo', 'pdf', 'note'].includes(material.type)) {
  const jobType = material.type === 'recording' || material.type === 'video' ? 'stt'
    : material.type === 'photo' ? 'ocr'
    : material.type === 'pdf' ? 'pdf_extract'
    : 'note_extract';
  await this.jobs.create(userId, material.id, jobType);
}
```

- [ ] **Step 4: Commit**

---

## Task 5: Web — Transcript editor

**Files:**
- Create: `apps/web/src/components/transcript-editor.tsx`, `apps/web/src/components/transcript-preview.tsx`, `apps/web/src/app/materials/[id]/edit/page.tsx`

- [ ] **Step 1: Install tiptap**
```bash
cd apps/web && pnpm add @tiptap/react @tiptap/starter-kit @tiptap/extension-placeholder
```

- [ ] **Step 2: Write TranscriptEditor component**

Client component. Tiptap editor with:
- Markdown input/output
- Toolbar: bold, italic, heading, list, undo/redo
- Placeholder: "Transcript will appear here after STT processing..."
- Auto-save debounce (PATCH /materials/:id with transcript)

- [ ] **Step 3: Write TranscriptPreview component**

Renders markdown to HTML preview. Side-by-side with editor.

- [ ] **Step 4: Write edit page**

`/materials/[id]/edit`:
- Left panel: TranscriptEditor (loaded from material.transcript)
- Right panel: TranscriptPreview (live preview)
- Bottom: "Save" button, "Generate AI Summary" button (POST /materials/:id/analyze)
- Job status indicator if STT is still running

- [ ] **Step 5: Commit**

---

## Task 6: Wire processors into job creation flow

- [ ] **Step 1: Update the upload flow end-to-end**

When a material is uploaded:
1. File → MinIO ✓ (Phase 2)
2. Inference → metadata ✓ (Phase 2)
3. Create material record ✓ (Phase 2)
4. Auto-create job → processor runs in background ✓ (this phase)
5. SSE streams progress to UI ✓ (Phase 2)
6. On completion → user edits transcript in editor ✓ (this phase)

- [ ] **Step 2: Full build verification**
```bash
pnpm build  # all packages
```

- [ ] **Step 3: Commit**

---

## Summary

After Phase 3:
- Audio/video → Whisper STT → transcript in DB
- Photos → GPT-4o Vision OCR → extracted_text in DB
- PDFs → pdfjs + Vision fallback → extracted_text in DB
- Tiptap markdown editor for transcript review
- Auto-job creation on upload
- End-to-end flow: upload → infer → process → review

**Next:** Phase 4 (Canvas sync — assignments, attendance, announcements + notifications)
