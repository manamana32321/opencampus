'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';

interface Assignment {
  id: number;
  title: string;
  courseId: number;
  dueAt: string | null;
  status: string;
  score: number | null;
  grade: string | null;
  pointsPossible: number | null;
  submissionTypes: string[];
  canvasUrl: string | null;
  submittedAt: string | null;
  syncedAt: string | null;
  createdAt: string;
}

interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

interface Course {
  id: number;
  name: string;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const abs = Math.abs(diff);
  const mins = Math.floor(abs / 60000);
  const hours = Math.floor(abs / 3600000);
  const days = Math.floor(abs / 86400000);
  const suffix = diff > 0 ? 'ago' : 'from now';
  if (mins < 60) return `${mins}m ${suffix}`;
  if (hours < 24) return `${hours}h ${suffix}`;
  return `${days}d ${suffix}`;
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

function getCardColor(assignment: Assignment): string {
  if (!assignment.dueAt) return 'border-zinc-800 bg-zinc-900';
  const now = Date.now();
  const due = new Date(assignment.dueAt).getTime();
  if (now > due && assignment.status === 'pending') return 'border-red-900/60 bg-red-950/30';
  if (due - now < 86400000 && assignment.status === 'pending') return 'border-yellow-900/60 bg-yellow-950/20';
  return 'border-zinc-800 bg-zinc-900';
}

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-zinc-800 text-zinc-300',
  submitted: 'bg-blue-500/15 text-blue-400',
  graded: 'bg-green-500/15 text-green-400',
  late: 'bg-orange-500/15 text-orange-400',
  missing: 'bg-red-500/15 text-red-400',
};

export default function AssignmentsPage() {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [courseMap, setCourseMap] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    Promise.all([
      apiFetch<PaginatedResponse<Assignment>>('/assignments?limit=100'),
      apiFetch<Course[]>('/courses'),
    ])
      .then(([data, courses]) => {
        const map: Record<number, string> = {};
        for (const c of courses) map[c.id] = c.name;
        setCourseMap(map);
        const sorted = [...data.items].sort((a, b) => {
          if (!a.dueAt) return 1;
          if (!b.dueAt) return -1;
          return new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime();
        });
        setAssignments(sorted);
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  async function handleSync() {
    setSyncing(true);
    try {
      await apiFetch('/assignments/sync', { method: 'POST' });
      const data = await apiFetch<PaginatedResponse<Assignment>>('/assignments?limit=100');
      const sorted = [...data.items].sort((a, b) => {
        if (!a.dueAt) return 1;
        if (!b.dueAt) return -1;
        return new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime();
      });
      setAssignments(sorted);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Sync failed');
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="px-6 py-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">Assignments</h1>
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
          Failed to load assignments: {error}
        </div>
      )}

      {!loading && !error && assignments.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900 py-16 text-center">
          <svg className="mb-3 h-8 w-8 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p className="text-sm text-zinc-400">No assignments yet.</p>
          <p className="mt-1 text-xs text-zinc-600">Sync from Canvas to load your assignments.</p>
        </div>
      )}

      {!loading && !error && assignments.length > 0 && (
        <div className="flex flex-col gap-3">
          {assignments.map((assignment) => (
            <div
              key={assignment.id}
              className={`rounded-lg border px-4 py-3.5 ${getCardColor(assignment)}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium leading-snug truncate">{assignment.title}</p>
                  <p className="mt-0.5 text-xs text-zinc-500">{courseMap[assignment.courseId] ?? `Course #${assignment.courseId}`}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {assignment.pointsPossible != null && (
                    <span className="text-xs text-zinc-500 font-mono">
                      {assignment.score != null ? `${assignment.score}/` : ''}{assignment.pointsPossible}pts
                    </span>
                  )}
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${STATUS_STYLES[assignment.status] ?? 'bg-zinc-800 text-zinc-300'}`}>
                    {assignment.status}
                  </span>
                </div>
              </div>
              {assignment.dueAt && (
                <p className="mt-2 text-xs text-zinc-500">
                  Due {timeAgo(assignment.dueAt)}
                  <span className="ml-1 text-zinc-600">· {formatAbsoluteDate(assignment.dueAt)}</span>
                </p>
              )}
              {!assignment.dueAt && (
                <p className="mt-2 text-xs text-zinc-600">No due date</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
