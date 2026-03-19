'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';

interface Announcement {
  id: string;
  title: string;
  courseName: string;
  author: string;
  postedAt: string;
  message: string;
  read: boolean;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

function formatAbsoluteDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function AnnouncementsPage() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<Announcement[]>('/announcements')
      .then((data) => {
        const sorted = [...data].sort(
          (a, b) => new Date(b.postedAt).getTime() - new Date(a.postedAt).getTime()
        );
        setAnnouncements(sorted);
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  async function handleClick(id: string) {
    const announcement = announcements.find((a) => a.id === id);
    if (!announcement) return;

    if (expandedId === id) {
      setExpandedId(null);
      return;
    }

    setExpandedId(id);

    if (!announcement.read) {
      try {
        await apiFetch(`/announcements/${id}/read`, { method: 'PATCH' });
        setAnnouncements((prev) =>
          prev.map((a) => (a.id === id ? { ...a, read: true } : a))
        );
      } catch {
        // ignore mark-read errors
      }
    }
  }

  async function handleSync() {
    setSyncing(true);
    try {
      await apiFetch('/announcements/sync', { method: 'POST' });
      const data = await apiFetch<Announcement[]>('/announcements');
      const sorted = [...data].sort(
        (a, b) => new Date(b.postedAt).getTime() - new Date(a.postedAt).getTime()
      );
      setAnnouncements(sorted);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Sync failed');
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="px-6 py-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">Announcements</h1>
        <button
          type="button"
          onClick={handleSync}
          disabled={syncing}
          className="rounded-md bg-zinc-800 px-3 py-1.5 text-sm font-medium text-zinc-300 hover:bg-zinc-700 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {syncing ? 'Syncing…' : 'Sync from Canvas'}
        </button>
      </div>

      {loading && (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-20 rounded-lg border border-zinc-800 bg-zinc-900 animate-pulse" />
          ))}
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3 text-sm text-red-400">
          Failed to load announcements: {error}
        </div>
      )}

      {!loading && !error && announcements.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900 py-16 text-center">
          <svg className="mb-3 h-8 w-8 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
          </svg>
          <p className="text-sm text-zinc-400">No announcements yet.</p>
          <p className="mt-1 text-xs text-zinc-600">Sync from Canvas to load announcements.</p>
        </div>
      )}

      {!loading && !error && announcements.length > 0 && (
        <div className="flex flex-col gap-2">
          {announcements.map((announcement) => (
            <div
              key={announcement.id}
              className="rounded-lg border border-zinc-800 bg-zinc-900 overflow-hidden"
            >
              <button
                type="button"
                onClick={() => handleClick(announcement.id)}
                className="flex w-full items-start gap-3 px-4 py-3.5 text-left hover:bg-zinc-800 transition-colors"
              >
                {/* Unread indicator */}
                <span className="mt-1.5 shrink-0">
                  {!announcement.read ? (
                    <span className="block h-2 w-2 rounded-full bg-blue-500" />
                  ) : (
                    <span className="block h-2 w-2 rounded-full bg-transparent" />
                  )}
                </span>

                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className={`text-sm leading-snug ${announcement.read ? 'text-zinc-300' : 'font-medium text-white'}`}>
                      {announcement.title}
                    </p>
                    <span className="shrink-0 text-xs text-zinc-500">{timeAgo(announcement.postedAt)}</span>
                  </div>
                  <div className="mt-0.5 flex items-center gap-2">
                    <span className="text-xs text-zinc-500">{announcement.courseName}</span>
                    <span className="text-zinc-700">·</span>
                    <span className="text-xs text-zinc-600">{announcement.author}</span>
                  </div>
                </div>

                <svg
                  className={`mt-1 h-4 w-4 shrink-0 text-zinc-600 transition-transform ${expandedId === announcement.id ? 'rotate-180' : ''}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {expandedId === announcement.id && (
                <div className="border-t border-zinc-800 px-4 py-4">
                  <p className="text-xs text-zinc-500 mb-2">
                    Posted {formatAbsoluteDate(announcement.postedAt)} by {announcement.author}
                  </p>
                  <div className="text-sm text-zinc-300 leading-relaxed whitespace-pre-wrap">
                    {announcement.message}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
