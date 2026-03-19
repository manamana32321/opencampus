'use client';

import { useState } from 'react';
import { apiFetch } from '@/lib/api';

interface Material {
  id: string;
  name: string;
  type: string;
  size: number;
  mimeType: string;
}

interface Inference {
  courseId?: string;
  week?: number;
  session?: number;
  type?: string;
  date?: string;
  confidence?: number;
}

interface Course {
  id: string;
  name: string;
  semester: string;
}

interface ReviewFormProps {
  material: Material;
  inference: Inference;
  courses: Course[];
  onSave: (updated: Material) => void;
  onSkip: () => void;
}

const MATERIAL_TYPES = [
  { value: 'recording', label: 'Recording' },
  { value: 'video', label: 'Video' },
  { value: 'photo', label: 'Photo' },
  { value: 'pdf', label: 'PDF' },
  { value: 'ppt', label: 'PPT' },
  { value: 'note', label: 'Note' },
];

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function ConfidenceBar({ value }: { value: number }) {
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  const colorClass =
    pct >= 80 ? 'bg-green-500' : pct >= 50 ? 'bg-yellow-500' : 'bg-red-500';
  const labelColor =
    pct >= 80 ? 'text-green-400' : pct >= 50 ? 'text-yellow-400' : 'text-red-400';

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-zinc-400">AI Confidence</span>
        <span className={`text-xs font-medium ${labelColor}`}>{pct}%</span>
      </div>
      <div className="h-2 w-full rounded-full bg-zinc-700">
        <div
          className={`h-2 rounded-full transition-all ${colorClass}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export default function ReviewForm({
  material,
  inference,
  courses,
  onSave,
  onSkip,
}: ReviewFormProps) {
  const [courseId, setCourseId] = useState(inference.courseId ?? '');
  const [week, setWeek] = useState(inference.week?.toString() ?? '');
  const [session, setSession] = useState(inference.session?.toString() ?? '');
  const [type, setType] = useState(inference.type ?? material.type ?? '');
  const [date, setDate] = useState(inference.date ?? '');
  const [saving, setSaving] = useState(false);
  const [reanalyzing, setReanalyzing] = useState(false);
  const [currentInference, setCurrentInference] = useState<Inference>(inference);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const body: Record<string, unknown> = {};
      if (courseId) body.courseId = courseId;
      if (week) body.week = parseInt(week, 10);
      if (session) body.session = parseInt(session, 10);
      if (type) body.type = type;
      if (date) body.date = date;

      const updated = await apiFetch<Material>(`/materials/${material.id}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      });
      onSave(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleReanalyze = async () => {
    setReanalyzing(true);
    setError(null);
    try {
      const result = await apiFetch<{ inference: Inference }>(
        `/materials/${material.id}/analyze`,
        { method: 'POST' },
      );
      const inf = result.inference;
      setCurrentInference(inf);
      if (inf.courseId) setCourseId(inf.courseId);
      if (inf.week != null) setWeek(inf.week.toString());
      if (inf.session != null) setSession(inf.session.toString());
      if (inf.type) setType(inf.type);
      if (inf.date) setDate(inf.date);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Re-analysis failed');
    } finally {
      setReanalyzing(false);
    }
  };

  const inputClass =
    'w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500';

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
      <h2 className="text-base font-semibold mb-5">Review Metadata</h2>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: form */}
        <div className="space-y-4">
          {/* Course */}
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">
              Course
            </label>
            <select
              value={courseId}
              onChange={(e) => setCourseId(e.target.value)}
              className={inputClass}
            >
              <option value="">— Select a course —</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.semester})
                </option>
              ))}
            </select>
          </div>

          {/* Week + Session */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1.5">
                Week
              </label>
              <input
                type="number"
                min={1}
                value={week}
                onChange={(e) => setWeek(e.target.value)}
                placeholder="e.g. 3"
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1.5">
                Session <span className="text-zinc-600">(optional)</span>
              </label>
              <input
                type="number"
                min={1}
                value={session}
                onChange={(e) => setSession(e.target.value)}
                placeholder="e.g. 1"
                className={inputClass}
              />
            </div>
          </div>

          {/* Type */}
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">
              Type
            </label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className={inputClass}
            >
              <option value="">— Select type —</option>
              {MATERIAL_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          {/* Date */}
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">
              Date
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className={inputClass}
            />
          </div>

          {/* Confidence */}
          {currentInference.confidence != null && (
            <ConfidenceBar value={currentInference.confidence * 100} />
          )}
        </div>

        {/* Right: file preview */}
        <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-4 flex flex-col gap-3">
          <h3 className="text-xs font-medium text-zinc-400 uppercase tracking-wide">
            File Info
          </h3>
          <div className="space-y-2 text-sm">
            <div className="flex gap-2">
              <span className="text-zinc-500 w-16 shrink-0">Name</span>
              <span className="text-zinc-200 truncate">{material.name}</span>
            </div>
            <div className="flex gap-2">
              <span className="text-zinc-500 w-16 shrink-0">Type</span>
              <span className="text-zinc-200">{material.mimeType || '—'}</span>
            </div>
            <div className="flex gap-2">
              <span className="text-zinc-500 w-16 shrink-0">Size</span>
              <span className="text-zinc-200">{formatSize(material.size)}</span>
            </div>
            <div className="flex gap-2">
              <span className="text-zinc-500 w-16 shrink-0">ID</span>
              <span className="text-zinc-500 font-mono text-xs truncate">{material.id}</span>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <p className="mt-4 text-sm text-red-400">{error}</p>
      )}

      {/* Actions */}
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || reanalyzing}
          className="inline-flex items-center gap-2 rounded-md bg-blue-500 px-4 py-2 text-sm font-medium text-white hover:bg-blue-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving && (
            <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          )}
          {saving ? 'Saving…' : 'Save'}
        </button>

        <button
          type="button"
          onClick={handleReanalyze}
          disabled={saving || reanalyzing}
          className="inline-flex items-center gap-2 rounded-md border border-zinc-700 bg-zinc-800 px-4 py-2 text-sm font-medium text-zinc-300 hover:bg-zinc-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {reanalyzing && (
            <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          )}
          {reanalyzing ? 'Analyzing…' : 'Re-analyze'}
        </button>

        <button
          type="button"
          onClick={onSkip}
          disabled={saving || reanalyzing}
          className="ml-auto text-sm text-zinc-500 hover:text-zinc-300 transition-colors disabled:opacity-40"
        >
          Skip
        </button>
      </div>
    </div>
  );
}
