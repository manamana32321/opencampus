'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';

interface Material {
  id: string;
  name: string;
  type: string;
}

interface Week {
  id: string;
  label: string;
  materials: Material[];
}

interface CourseDetail {
  id: string;
  name: string;
  semester: string;
  weeks: Week[];
}

function WeekRow({ week }: { week: Week }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-zinc-800 transition-colors"
      >
        <span className="text-sm font-medium">{week.label}</span>
        <div className="flex items-center gap-3">
          <span className="rounded-full bg-blue-500/15 px-2 py-0.5 text-xs font-medium text-blue-400">
            {week.materials.length}
          </span>
          <svg
            className={`h-4 w-4 text-zinc-500 transition-transform ${open ? 'rotate-180' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {open && week.materials.length > 0 && (
        <ul className="border-t border-zinc-800 divide-y divide-zinc-800">
          {week.materials.map((material) => (
            <li
              key={material.id}
              className="flex items-center gap-3 px-4 py-2.5"
            >
              <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-xs text-zinc-400 font-mono shrink-0">
                {material.type}
              </span>
              <span className="text-sm text-zinc-300 truncate">{material.name}</span>
            </li>
          ))}
        </ul>
      )}

      {open && week.materials.length === 0 && (
        <div className="border-t border-zinc-800 px-4 py-3">
          <p className="text-xs text-zinc-500">No materials for this week.</p>
        </div>
      )}
    </div>
  );
}

export default function CourseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [course, setCourse] = useState<CourseDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    apiFetch<CourseDetail>(`/courses/${id}`)
      .then(setCourse)
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  return (
    <div className="px-6 py-8 max-w-3xl mx-auto">
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300 transition-colors mb-6"
      >
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        Back to Dashboard
      </Link>

      {loading && (
        <div className="space-y-3">
          <div className="h-7 w-64 rounded bg-zinc-900 animate-pulse" />
          <div className="h-4 w-32 rounded bg-zinc-900 animate-pulse" />
          <div className="mt-6 space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-12 rounded-lg bg-zinc-900 animate-pulse" />
            ))}
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3 text-sm text-red-400">
          Failed to load course: {error}
        </div>
      )}

      {!loading && !error && course && (
        <>
          <div className="mb-8">
            <h1 className="text-2xl font-semibold">{course.name}</h1>
            <p className="mt-1 text-sm text-zinc-500">{course.semester}</p>
          </div>

          {course.weeks.length === 0 ? (
            <div className="rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-10 text-center">
              <p className="text-sm text-zinc-500">No weeks available for this course.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {course.weeks.map((week) => (
                <WeekRow key={week.id} week={week} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
