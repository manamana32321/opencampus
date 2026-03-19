# Phase 4: Canvas Sync + Attendance + Assignments + Announcements + Notifications

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Canvas data synchronization (assignments, attendance, announcements), attendance management, notification system with user-customizable policies and webhook support.

**Architecture:** NestJS modules for each domain. Canvas sync uses `@opencampus/canvas` wrapper. Notifications via polling scheduler (setInterval). Webhooks via HTTP POST.

**Tech Stack:** `@opencampus/canvas`, NestJS scheduler, fetch (webhooks)

**Spec:** `docs/specs/2026-03-19-opencampus-full-pipeline-design.md` (Sections 9, 10)

**Depends on:** Phase 1 (auth, courses), Phase 2 (jobs)

---

## Task 1: Assignments module + Canvas sync

**Files:** `apps/api/src/assignments/`

- [ ] **AssignmentsService**: findAll(userId, courseId?), findById, syncFromCanvas(userId) — fetches assignments per course via Canvas wrapper, upserts by canvasId
- [ ] **AssignmentsController**: `GET /assignments`, `GET /assignments/:id`, `POST /assignments/sync`
- [ ] Add to AppModule

---

## Task 2: Attendance module

**Files:** `apps/api/src/attendances/`

- [ ] **AttendancesService**: findByCourse(userId, courseId), create (manual check), update, syncFromCanvas(userId) — uses LearningXClient.getAttendanceItems
- [ ] **AttendancesController**: `GET /courses/:id/attendances`, `POST /attendances`, `PATCH /attendances/:id`, `POST /attendances/sync`
- [ ] Add to AppModule

---

## Task 3: Announcements module + Canvas sync

**Files:** `apps/api/src/announcements/`

- [ ] **AnnouncementsService**: findAll(userId, courseId?), markRead(id, userId), syncFromCanvas(userId) — fetches announcements per course, upserts by canvasId, detects new ones
- [ ] **AnnouncementsController**: `GET /announcements`, `PATCH /announcements/:id/read`, `POST /announcements/sync`
- [ ] Add to AppModule

---

## Task 4: Notifications module

**Files:** `apps/api/src/notifications/`

- [ ] **NotificationsService**: findAll(userId, page, limit), markRead(id, userId), markAllRead(userId), createNotification(userId, type, title, message, ref)
- [ ] **NotificationSettingsService**: findAll(userId), update(userId, type, data)
- [ ] **NotificationsController**: `GET /notifications`, `PATCH /notifications/:id/read`, `PATCH /notifications/read-all`, `GET /notification-settings`, `PATCH /notification-settings/:type`
- [ ] Add to AppModule

---

## Task 5: Notification scheduler + webhook dispatcher

**Files:** `apps/api/src/notifications/notification-scheduler.ts`, `apps/api/src/notifications/webhook.service.ts`

- [ ] **NotificationScheduler**: Injectable with `onModuleInit` → `setInterval` every 60s
  - Check upcoming assignment deadlines (advance_minutes from settings)
  - Check upcoming attendance deadlines
  - Create notification records for matching users
  - Skip if notification already sent for this reference
- [ ] **WebhookService**: `dispatch(url, payload)` — POST JSON to user-configured webhook URL, timeout 10s, ignore failures
- [ ] Wire: when creating a notification, check user's settings → if webhook channel enabled, dispatch

---

## Task 6: Web — Assignments + Announcements + Notifications pages

**Files:** `apps/web/src/app/dashboard/assignments/`, `apps/web/src/app/dashboard/announcements/`, `apps/web/src/app/dashboard/notifications/`, `apps/web/src/components/notification-bell.tsx`

- [ ] **Assignments page**: list with due dates, status badges, sync button
- [ ] **Announcements page**: list with read/unread badges, mark as read
- [ ] **Notifications page**: list, mark read, mark all read
- [ ] **NotificationBell component**: in dashboard header, shows unread count badge, dropdown with recent notifications
- [ ] **Settings page**: `apps/web/src/app/dashboard/settings/page.tsx` — notification settings (per-type toggles, advance_minutes, webhook URL), Canvas token input, course metadata editor

---

## Summary

After Phase 4:
- Canvas assignments synced + displayed with due dates
- Attendance tracking (Canvas online sync + manual offline check)
- Canvas announcements synced with read tracking
- Notification system (in-app + webhook)
- User-customizable notification policies
- Settings page for Canvas token, notification preferences, course metadata

**Next:** Phase 5 (MCP server + OpenClaw plugin)
