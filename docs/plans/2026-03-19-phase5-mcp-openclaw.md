# Phase 5: MCP Server + OpenClaw Plugin Scaffold

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create an MCP server package that exposes OpenCampus data to external AI agents (Claude, GPT), and scaffold the OpenClaw plugin directory.

**Architecture:** `packages/mcp` uses the MCP SDK to expose tools that call the OpenCampus REST API. OpenClaw plugin at `packages/openclaw-plugin` uses the REST API directly.

**Tech Stack:** `@modelcontextprotocol/sdk`, `fetch`

**Spec:** `docs/specs/2026-03-19-opencampus-full-pipeline-design.md` (Section 8)

**Depends on:** Phase 1-4 (all API endpoints)

---

## Task 1: MCP Server package

**Files:** `packages/mcp/`

- [ ] Initialize package with `@modelcontextprotocol/sdk`
- [ ] Implement MCP tools:
  - `search_lectures(query, course?, week?)` → GET /materials with filters
  - `get_transcript(materialId)` → GET /materials/:id, return transcript
  - `get_course_summary(courseId, week?)` → aggregate materials + attendance for course/week
  - `list_courses(semester?)` → GET /courses with semester filter
  - `get_upcoming_assignments()` → GET /assignments with due_at filter
  - `get_announcements(courseId?)` → GET /announcements
  - `get_attendance_status(courseId?)` → GET /courses/:id/attendances
- [ ] Auth: X-API-Key header for all API calls
- [ ] Build + test

---

## Task 2: OpenClaw plugin scaffold

**Files:** `packages/openclaw-plugin/`

- [ ] Create `openclaw.plugin.json` manifest
- [ ] Create `package.json`
- [ ] Create `index.ts` with `search_lectures` and `get_transcript` tools
- [ ] Reference: `docs/specs/2026-03-19-opencampus-full-pipeline-design.md` handoff Section 11

---

## Summary

After Phase 5:
- MCP server exposable to any MCP-compatible AI client
- OpenClaw plugin ready for deployment to `~/.openclaw/plugins/opencampus/`
- Full stack complete: upload → process → review → search → AI access
