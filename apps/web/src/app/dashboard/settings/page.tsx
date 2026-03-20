'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';

// ─── Types ───────────────────────────────────────────────────────────────────

interface UserMe {
  id: number;
  name: string | null;
  email: string;
  picture: string | null;
  hasCanvasToken: boolean;
  createdAt: string;
}

interface NotificationSetting {
  id: number;
  type: string;
  enabled: boolean;
  advanceMinutes: number;
  channels: string[];
  webhookUrl: string | null;
}

interface Semester {
  id: number;
  name: string;
}

interface Course {
  id: number;
  name: string;
  shortName: string | null;
  notes: string | null;
  metadata: Record<string, unknown>;
  semester: Semester;
}

// ─── Canvas Integration Section ───────────────────────────────────────────────

function CanvasSection() {
  const [user, setUser] = useState<UserMe | null>(null);
  const [token, setToken] = useState('');
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'ok' | 'error'>('idle');
  const [syncStatus, setSyncStatus] = useState<'idle' | 'ok' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<UserMe>('/users/me')
      .then(setUser)
      .catch((err: Error) => setError(err.message));
  }, []);

  async function handleSaveToken() {
    if (!token.trim()) return;
    setSaving(true);
    setSaveStatus('idle');
    try {
      await apiFetch('/users/me', {
        method: 'PATCH',
        body: JSON.stringify({ canvasAccessToken: token }),
      });
      setToken('');
      setSaveStatus('ok');
      setUser((prev) => prev ? { ...prev, hasCanvasToken: true } : prev);
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch (err: unknown) {
      setSaveStatus('error');
      setError(err instanceof Error ? err.message : 'Failed to save token');
    } finally {
      setSaving(false);
    }
  }

  async function handleSyncAll() {
    setSyncing(true);
    setSyncStatus('idle');
    try {
      await Promise.all([
        apiFetch('/courses/sync', { method: 'POST' }),
        apiFetch('/assignments/sync', { method: 'POST' }),
        apiFetch('/announcements/sync', { method: 'POST' }),
        apiFetch('/attendances/sync', { method: 'POST' }),
      ]);
      setSyncStatus('ok');
      setTimeout(() => setSyncStatus('idle'), 3000);
    } catch (err: unknown) {
      setSyncStatus('error');
      setError(err instanceof Error ? err.message : 'Sync failed');
    } finally {
      setSyncing(false);
    }
  }

  return (
    <section>
      <h2 className="text-base font-semibold mb-4">Canvas Integration</h2>
      <div className="rounded-lg border border-zinc-800 bg-zinc-900 divide-y divide-zinc-800">
        {/* Token status */}
        <div className="px-4 py-3 flex items-center justify-between">
          <span className="text-sm text-zinc-400">Canvas Token</span>
          {user ? (
            <span className={`text-xs font-medium ${user.hasCanvasToken ? 'text-green-400' : 'text-zinc-500'}`}>
              {user.hasCanvasToken ? 'Configured' : 'Not set'}
            </span>
          ) : (
            <span className="text-xs text-zinc-600">Loading…</span>
          )}
        </div>

        {/* Token input */}
        <div className="px-4 py-4">
          <label className="mb-1.5 block text-xs text-zinc-500">New Access Token</label>
          <div className="flex gap-2">
            <input
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="Paste Canvas access token…"
              className="flex-1 rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:border-zinc-500 focus:outline-none transition-colors"
            />
            <button
              type="button"
              onClick={handleSaveToken}
              disabled={saving || !token.trim()}
              className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {saving ? 'Saving…' : 'Save Token'}
            </button>
          </div>
          {saveStatus === 'ok' && <p className="mt-1.5 text-xs text-green-400">Token saved.</p>}
          {saveStatus === 'error' && <p className="mt-1.5 text-xs text-red-400">{error}</p>}
        </div>

        {/* Sync all */}
        <div className="px-4 py-4 flex items-center justify-between">
          <div>
            <p className="text-sm text-zinc-300">Sync All</p>
            <p className="text-xs text-zinc-500">Courses, assignments, announcements, attendance</p>
          </div>
          <button
            type="button"
            onClick={handleSyncAll}
            disabled={syncing}
            className="rounded-md bg-zinc-800 px-3 py-1.5 text-sm font-medium text-zinc-300 hover:bg-zinc-700 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {syncing ? 'Syncing…' : 'Sync All'}
          </button>
        </div>
        {syncStatus === 'ok' && (
          <div className="px-4 py-2 text-xs text-green-400">All synced successfully.</div>
        )}
        {syncStatus === 'error' && (
          <div className="px-4 py-2 text-xs text-red-400">{error}</div>
        )}
      </div>
    </section>
  );
}

// ─── Notification Settings Section ───────────────────────────────────────────

const CHANNEL_OPTIONS = ['web', 'webhook'];

function NotificationSettingRow({ setting, onSaved }: {
  setting: NotificationSetting;
  onSaved: (updated: NotificationSetting) => void;
}) {
  const [enabled, setEnabled] = useState(setting.enabled);
  const [advanceMinutes, setAdvanceMinutes] = useState(String(setting.advanceMinutes));
  const [channels, setChannels] = useState<string[]>(setting.channels);
  const [webhookUrl, setWebhookUrl] = useState(setting.webhookUrl ?? '');
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<'idle' | 'ok' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  function toggleChannel(ch: string) {
    setChannels((prev) =>
      prev.includes(ch) ? prev.filter((c) => c !== ch) : [...prev, ch]
    );
  }

  async function handleSave() {
    setSaving(true);
    setStatus('idle');
    try {
      const updated = await apiFetch<NotificationSetting>(`/notification-settings/${setting.type}`, {
        method: 'PATCH',
        body: JSON.stringify({
          enabled,
          advanceMinutes: parseInt(advanceMinutes, 10) || 0,
          channels,
          webhookUrl: channels.includes('webhook') ? webhookUrl : undefined,
        }),
      });
      setStatus('ok');
      onSaved(updated);
      setTimeout(() => setStatus('idle'), 2000);
    } catch (err: unknown) {
      setStatus('error');
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="px-4 py-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          {/* Toggle */}
          <button
            type="button"
            role="switch"
            aria-checked={enabled}
            onClick={() => setEnabled((v) => !v)}
            className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
              enabled ? 'bg-blue-500' : 'bg-zinc-700'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${
                enabled ? 'translate-x-4' : 'translate-x-0'
              }`}
            />
          </button>
          <span className="text-sm text-zinc-300 capitalize">{setting.type.replace(/_/g, ' ')}</span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <label className="text-xs text-zinc-500">Advance (min)</label>
          <input
            type="number"
            min="0"
            value={advanceMinutes}
            onChange={(e) => setAdvanceMinutes(e.target.value)}
            className="w-16 rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs text-white focus:border-zinc-500 focus:outline-none transition-colors"
          />
        </div>
      </div>

      {/* Channels */}
      <div className="mt-3 flex flex-wrap gap-3">
        {CHANNEL_OPTIONS.map((ch) => (
          <label key={ch} className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={channels.includes(ch)}
              onChange={() => toggleChannel(ch)}
              className="h-3.5 w-3.5 rounded border-zinc-600 bg-zinc-800 accent-blue-500"
            />
            <span className="text-xs text-zinc-400 capitalize">{ch}</span>
          </label>
        ))}
      </div>

      {/* Webhook URL */}
      {channels.includes('webhook') && (
        <div className="mt-3">
          <input
            type="url"
            value={webhookUrl}
            onChange={(e) => setWebhookUrl(e.target.value)}
            placeholder="https://hooks.example.com/…"
            className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-1.5 text-xs text-white placeholder:text-zinc-600 focus:border-zinc-500 focus:outline-none transition-colors"
          />
        </div>
      )}

      {/* Save button */}
      <div className="mt-3 flex items-center gap-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="rounded-md bg-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-300 hover:bg-zinc-700 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
        {status === 'ok' && <span className="text-xs text-green-400">Saved</span>}
        {status === 'error' && <span className="text-xs text-red-400">{error}</span>}
      </div>
    </div>
  );
}

function NotificationSettingsSection() {
  const [settings, setSettings] = useState<NotificationSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<NotificationSetting[]>('/notification-settings')
      .then(setSettings)
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  function handleSaved(updated: NotificationSetting) {
    setSettings((prev) =>
      prev.map((s) => (s.type === updated.type ? updated : s))
    );
  }

  return (
    <section>
      <h2 className="text-base font-semibold mb-4">Notification Settings</h2>

      {loading && (
        <div className="h-32 rounded-lg border border-zinc-800 bg-zinc-900 animate-pulse" />
      )}

      {error && (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3 text-sm text-red-400">
          Failed to load notification settings: {error}
        </div>
      )}

      {!loading && !error && settings.length === 0 && (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-6 text-center text-sm text-zinc-500">
          No notification settings configured.
        </div>
      )}

      {!loading && !error && settings.length > 0 && (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 divide-y divide-zinc-800">
          {settings.map((setting) => (
            <NotificationSettingRow
              key={setting.type}
              setting={setting}
              onSaved={handleSaved}
            />
          ))}
        </div>
      )}
    </section>
  );
}

// ─── Course Settings Section ──────────────────────────────────────────────────

function CourseRow({ course, onSaved }: {
  course: Course;
  onSaved: (updated: Course) => void;
}) {
  const [shortName, setShortName] = useState(course.shortName ?? '');
  const [notes, setNotes] = useState(course.notes ?? '');
  const [metadataStr, setMetadataStr] = useState(
    course.metadata ? JSON.stringify(course.metadata, null, 2) : '{}'
  );
  const [metadataError, setMetadataError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<'idle' | 'ok' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  function validateMetadata(str: string): Record<string, unknown> | null {
    try {
      const parsed = JSON.parse(str);
      if (typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Must be an object');
      setMetadataError(null);
      return parsed as Record<string, unknown>;
    } catch (e: unknown) {
      setMetadataError(e instanceof Error ? e.message : 'Invalid JSON');
      return null;
    }
  }

  async function handleSave() {
    const metadata = validateMetadata(metadataStr);
    if (metadata === null) return;
    setSaving(true);
    setStatus('idle');
    try {
      const updated = await apiFetch<Partial<Course>>(`/courses/${course.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ shortName, notes, metadata }),
      });
      setStatus('ok');
      onSaved({ ...course, ...updated });
      setTimeout(() => setStatus('idle'), 2000);
    } catch (err: unknown) {
      setStatus('error');
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-zinc-800 transition-colors"
      >
        <div>
          <p className="text-sm font-medium">{course.name}</p>
          {course.shortName && (
            <p className="text-xs text-zinc-500">{course.shortName}</p>
          )}
        </div>
        <svg
          className={`h-4 w-4 text-zinc-600 transition-transform ${expanded ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {expanded && (
        <div className="border-t border-zinc-800 px-4 py-4 space-y-4">
          {/* Short name */}
          <div>
            <label className="mb-1 block text-xs text-zinc-500">Short Name</label>
            <input
              type="text"
              value={shortName}
              onChange={(e) => setShortName(e.target.value)}
              placeholder="e.g. CS101"
              className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:border-zinc-500 focus:outline-none transition-colors"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="mb-1 block text-xs text-zinc-500">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Personal notes about this course…"
              className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:border-zinc-500 focus:outline-none transition-colors resize-none"
            />
          </div>

          {/* Metadata */}
          <div>
            <label className="mb-1 block text-xs text-zinc-500">Metadata (JSON)</label>
            <textarea
              value={metadataStr}
              onChange={(e) => {
                setMetadataStr(e.target.value);
                validateMetadata(e.target.value);
              }}
              rows={4}
              spellCheck={false}
              className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 font-mono text-xs text-white placeholder:text-zinc-600 focus:border-zinc-500 focus:outline-none transition-colors resize-none"
            />
            {metadataError && (
              <p className="mt-1 text-xs text-red-400">{metadataError}</p>
            )}
          </div>

          {/* Save */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || metadataError !== null}
              className="rounded-md bg-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-300 hover:bg-zinc-700 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
            {status === 'ok' && <span className="text-xs text-green-400">Saved</span>}
            {status === 'error' && <span className="text-xs text-red-400">{error}</span>}
          </div>
        </div>
      )}
    </div>
  );
}

function CourseSettingsSection() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<Course[]>('/courses')
      .then(setCourses)
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  function handleSaved(updated: Course) {
    setCourses((prev) =>
      prev.map((c) => (c.id === updated.id ? updated : c))
    );
  }

  return (
    <section>
      <h2 className="text-base font-semibold mb-4">Course Settings</h2>

      {loading && (
        <div className="h-32 rounded-lg border border-zinc-800 bg-zinc-900 animate-pulse" />
      )}

      {error && (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3 text-sm text-red-400">
          Failed to load courses: {error}
        </div>
      )}

      {!loading && !error && courses.length === 0 && (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-6 text-center text-sm text-zinc-500">
          No courses yet. Sync from Canvas above.
        </div>
      )}

      {!loading && !error && courses.length > 0 && (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 divide-y divide-zinc-800">
          {courses.map((course) => (
            <CourseRow key={course.id} course={course} onSaved={handleSaved} />
          ))}
        </div>
      )}
    </section>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  return (
    <div className="px-6 py-8 max-w-3xl mx-auto">
      <h1 className="text-2xl font-semibold mb-8">Settings</h1>
      <div className="flex flex-col gap-10">
        <CanvasSection />
        <NotificationSettingsSection />
        <CourseSettingsSection />
      </div>
    </div>
  );
}
