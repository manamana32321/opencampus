'use client';

import { useEffect, useState } from 'react';
import { useQueryState, parseAsString } from 'nuqs';
import { apiFetch } from '@/lib/api';

interface Semester {
  id: number;
  name: string;
  startDate: string | null;
}

function getDefaultSemesterName(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  return month >= 2 && month <= 7 ? `${year}-1` : `${year}-2`;
}

export function SemesterSelect() {
  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [loading, setLoading] = useState(true);
  const [semester, setSemester] = useQueryState(
    'semester',
    parseAsString.withDefault(getDefaultSemesterName()),
  );

  useEffect(() => {
    apiFetch<Semester[]>('/semesters')
      .then((data) => {
        const sorted = data.sort((a, b) => b.name.localeCompare(a.name));
        setSemesters(sorted);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function handleChange(value: string) {
    if (value === '') {
      void setSemester(null);
    } else {
      void setSemester(value);
    }
  }

  if (loading) {
    return (
      <div className="h-8 rounded bg-zinc-800 animate-pulse" />
    );
  }

  if (semesters.length === 0) return null;

  return (
    <select
      value={semester ?? ''}
      onChange={(e) => handleChange(e.target.value)}
      className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm text-zinc-300 focus:border-blue-500 focus:outline-none"
    >
      <option value="">전체 학기</option>
      {semesters.map((s) => (
        <option key={s.id} value={s.name}>
          {s.name}
        </option>
      ))}
    </select>
  );
}
