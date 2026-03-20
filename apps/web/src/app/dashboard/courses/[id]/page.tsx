'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';

// ── Types ────────────────────────────────────────────────────────

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

interface MaterialItem {
  id: number;
  originalFilename: string | null;
  type: string;
  courseWeekId: number;
  session: number | null;
  createdAt: string;
}

interface MaterialsResponse {
  items: MaterialItem[];
  total: number;
  page: number;
  limit: number;
}

// ── Helpers ──────────────────────────────────────────────────────

const TYPE_ICONS: Record<string, string> = {
  recording: '\uD83C\uDF99',
  photo: '\uD83D\uDCF8',
  video: '\uD83C\uDFA5',
  pdf: '\uD83D\uDCC4',
  ppt: '\uD83D\uDCCA',
  note: '\uD83D\uDCDD',
};

function typeIcon(type: string): string {
  return TYPE_ICONS[type] ?? '\uD83D\uDCC1';
}

function typeBadgeColor(type: string): string {
  switch (type) {
    case 'recording':
      return 'bg-purple-500/15 text-purple-400';
    case 'photo':
      return 'bg-green-500/15 text-green-400';
    case 'video':
      return 'bg-red-500/15 text-red-400';
    case 'pdf':
      return 'bg-orange-500/15 text-orange-400';
    case 'ppt':
      return 'bg-yellow-500/15 text-yellow-400';
    case 'note':
      return 'bg-blue-500/15 text-blue-400';
    default:
      return 'bg-zinc-500/15 text-zinc-400';
  }
}

// ── WeekSection ──────────────────────────────────────────────────

function WeekSection({
  week,
  materials,
}: {
  week: CourseWeek;
  materials: MaterialItem[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-zinc-800/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <svg
            className={`h-4 w-4 text-zinc-500 transition-transform ${open ? 'rotate-90' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
          <span className="text-sm font-medium">
            {week.week === 0 ? 'Unsorted' : `Week ${week.week}`}
            {week.dateStart && (
              <span className="ml-2 text-xs text-zinc-500">
                {new Date(week.dateStart).toLocaleDateString()}
              </span>
            )}
          </span>
        </div>
        <span className="rounded-full bg-blue-500/15 px-2 py-0.5 text-xs font-medium text-blue-400">
          {week.materialCount} material{week.materialCount !== 1 ? 's' : ''}
        </span>
      </button>

      {open && (
        <div className="border-t border-zinc-800">
          {materials.length === 0 ? (
            <p className="px-4 py-3 text-xs text-zinc-500">No materials uploaded yet.</p>
          ) : (
            <ul className="divide-y divide-zinc-800">
              {materials.map((mat) => (
                <li key={mat.id}>
                  <Link
                    href={`/materials/${mat.id}`}
                    className="flex items-center gap-3 px-4 py-2.5 hover:bg-zinc-800/40 transition-colors"
                  >
                    <span
                      className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium ${typeBadgeColor(mat.type)}`}
                    >
                      {typeIcon(mat.type)} {mat.type}
                    </span>
                    <span className="text-sm text-zinc-300 truncate">
                      {mat.originalFilename ?? `Material #${mat.id}`}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────

export default function CourseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [course, setCourse] = useState<CourseDetail | null>(null);
  const [weeks, setWeeks] = useState<CourseWeek[]>([]);
  const [materialsByWeek, setMaterialsByWeek] = useState<Record<number, MaterialItem[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!id) return;
    try {
      const [courseData, weeksData] = await Promise.all([
        apiFetch<CourseDetail>(`/courses/${id}`),
        apiFetch<CourseWeek[]>(`/courses/${id}/weeks`),
      ]);
      setCourse(courseData);
      setWeeks(weeksData);

      // Fetch all materials for this course (up to 200 — reasonable for a single course)
      const materialsData = await apiFetch<MaterialsResponse>(
        `/materials?course_id=${id}&limit=200`,
      );

      // Group materials by courseWeekId
      const grouped: Record<number, MaterialItem[]> = {};
      for (const mat of materialsData.items) {
        if (!grouped[mat.courseWeekId]) {
          grouped[mat.courseWeekId] = [];
        }
        grouped[mat.courseWeekId].push(mat);
      }
      setMaterialsByWeek(grouped);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load course');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

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
                <WeekSection
                  key={week.id}
                  week={week}
                  materials={materialsByWeek[week.id] ?? []}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
