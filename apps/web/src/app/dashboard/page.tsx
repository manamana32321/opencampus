'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';

interface Course {
  id: string;
  name: string;
  semester: string;
  materialCount: number;
}

export default function DashboardPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<Course[]>('/courses')
      .then(setCourses)
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="px-6 py-8 max-w-5xl mx-auto">
      <h1 className="text-2xl font-semibold mb-6">Dashboard</h1>

      {loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="h-28 rounded-lg bg-zinc-900 border border-zinc-800 animate-pulse"
            />
          ))}
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3 text-sm text-red-400">
          Failed to load courses: {error}
        </div>
      )}

      {!loading && !error && courses.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900 py-16 text-center">
          <p className="text-zinc-400 text-sm">
            No courses yet. Sync from Canvas in Settings.
          </p>
          <Link
            href="/dashboard/settings"
            className="mt-4 rounded-md bg-blue-500 px-4 py-2 text-sm font-medium text-white hover:bg-blue-400 transition-colors"
          >
            Go to Settings
          </Link>
        </div>
      )}

      {!loading && !error && courses.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {courses.map((course) => (
            <Link
              key={course.id}
              href={`/dashboard/courses/${course.id}`}
              className="group rounded-lg border border-zinc-800 bg-zinc-900 p-5 hover:border-zinc-700 hover:bg-zinc-800 transition-colors"
            >
              <div className="flex items-start justify-between gap-3">
                <h2 className="text-sm font-medium leading-snug group-hover:text-white transition-colors line-clamp-2">
                  {course.name}
                </h2>
                <span className="shrink-0 rounded-full bg-blue-500/15 px-2 py-0.5 text-xs font-medium text-blue-400">
                  {course.materialCount}
                </span>
              </div>
              <p className="mt-2 text-xs text-zinc-500">{course.semester}</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
