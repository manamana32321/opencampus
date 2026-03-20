'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { apiFetch } from '@/lib/api';

interface Semester {
  id: number;
  name: string;
  startDate: string | null;
}

export function SemesterSelect() {
  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const searchParams = useSearchParams();
  const current = searchParams.get('semester');

  useEffect(() => {
    apiFetch<Semester[]>('/semesters')
      .then((data) => {
        const sorted = data.sort((a, b) => b.name.localeCompare(a.name));
        setSemesters(sorted);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Determine default semester (current date or closest)
  const defaultSemester = getDefaultSemester(semesters);
  const selected = current ?? defaultSemester;

  function handleChange(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === 'all') {
      params.delete('semester');
    } else {
      params.set('semester', value);
    }
    const query = params.toString();
    router.push(`${window.location.pathname}${query ? `?${query}` : ''}`);
  }

  if (loading) {
    return (
      <div className="h-8 rounded bg-zinc-800 animate-pulse" />
    );
  }

  if (semesters.length === 0) return null;

  return (
    <select
      value={selected ?? 'all'}
      onChange={(e) => handleChange(e.target.value)}
      className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm text-zinc-300 focus:border-blue-500 focus:outline-none"
    >
      <option value="all">전체 학기</option>
      {semesters.map((s) => (
        <option key={s.id} value={s.name}>
          {s.name}
        </option>
      ))}
    </select>
  );
}

function getDefaultSemester(semesters: Semester[]): string | null {
  if (semesters.length === 0) return null;

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const currentName = month >= 2 && month <= 7 ? `${year}-1` : `${year}-2`;

  // Exact match for current semester
  const exact = semesters.find((s) => s.name === currentName);
  if (exact) return exact.name;

  // Closest by name (sorted desc, first is most recent)
  return semesters[0]?.name ?? null;
}
