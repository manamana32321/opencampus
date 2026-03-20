'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';

interface Semester {
  id: number;
  name: string;
  startDate: string | null;
  endDate: string | null;
}

interface CourseWeek {
  id: number;
  courseId: number;
  userId: number;
  week: number;
  dateStart: string | null;
  materialCount: number;
}

interface CourseDetail {
  id: number;
  name: string;
  shortName: string | null;
  semester: Semester;
  createdAt: string;
}

function WeekRow({ week }: { week: CourseWeek }) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900 overflow-hidden">
      <div className="flex w-full items-center justify-between px-4 py-3">
        <span className="text-sm font-medium">
          {week.week === 0 ? 'Unsorted' : `Week ${week.week}`}
          {week.dateStart && (
            <span className="ml-2 text-xs text-zinc-500">
              {new Date(week.dateStart).toLocaleDateString()}
            </span>
          )}
        </span>
        <span className="rounded-full bg-blue-500/15 px-2 py-0.5 text-xs font-medium text-blue-400">
          {week.materialCount} material{week.materialCount !== 1 ? 's' : ''}
        </span>
      </div>
    </div>
  );
}

export default function CourseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [course, setCourse] = useState<CourseDetail | null>(null);
  const [weeks, setWeeks] = useState<CourseWeek[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    Promise.all([
      apiFetch<CourseDetail>(`/courses/${id}`),
      apiFetch<CourseWeek[]>(`/courses/${id}/weeks`),
    ])
      .then(([courseData, weeksData]) => {
        setCourse(courseData);
        setWeeks(weeksData);
      })
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
            <p className="mt-1 text-sm text-zinc-500">{course.semester.name}</p>
          </div>

          {weeks.length === 0 ? (
            <div className="rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-10 text-center">
              <p className="text-sm text-zinc-500">No weeks available for this course.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {weeks.map((week) => (
                <WeekRow key={week.id} week={week} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
