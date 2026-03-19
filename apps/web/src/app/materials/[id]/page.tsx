'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';

interface MaterialDetail {
  id: string;
  name: string;
  type: string;
  size: number;
  mimeType: string;
  courseId?: string;
  courseName?: string;
  week?: number;
  session?: number;
  date?: string;
  transcript?: string;
  extractedText?: string;
  children?: ChildMaterial[];
  createdAt?: string;
}

interface ChildMaterial {
  id: string;
  name: string;
  type: string;
  url?: string;
}

interface Course {
  id: string;
  name: string;
  semester: string;
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

function MetaRow({ label, value }: { label: string; value?: string | number | null }) {
  if (value == null || value === '') return null;
  return (
    <div className="flex gap-3 py-2 border-b border-zinc-800 last:border-0">
      <span className="w-28 shrink-0 text-xs text-zinc-500">{label}</span>
      <span className="text-sm text-zinc-200">{String(value)}</span>
    </div>
  );
}

export default function MaterialDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [material, setMaterial] = useState<MaterialDetail | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Edit state
  const [editing, setEditing] = useState(false);
  const [editCourseId, setEditCourseId] = useState('');
  const [editWeek, setEditWeek] = useState('');
  const [editSession, setEditSession] = useState('');
  const [editType, setEditType] = useState('');
  const [editDate, setEditDate] = useState('');
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Delete state
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!id) return;
    Promise.all([
      apiFetch<MaterialDetail>(`/materials/${id}`),
      apiFetch<Course[]>('/courses').catch(() => [] as Course[]),
    ])
      .then(([mat, crs]) => {
        setMaterial(mat);
        setCourses(crs);
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  const startEdit = () => {
    if (!material) return;
    setEditCourseId(material.courseId ?? '');
    setEditWeek(material.week?.toString() ?? '');
    setEditSession(material.session?.toString() ?? '');
    setEditType(material.type ?? '');
    setEditDate(material.date ?? '');
    setEditError(null);
    setEditing(true);
  };

  const cancelEdit = () => {
    setEditing(false);
    setEditError(null);
  };

  const handleSave = async () => {
    if (!material) return;
    setSaving(true);
    setEditError(null);
    try {
      const body: Record<string, unknown> = {};
      if (editCourseId) body.courseId = editCourseId;
      if (editWeek) body.week = parseInt(editWeek, 10);
      if (editSession) body.session = parseInt(editSession, 10);
      if (editType) body.type = editType;
      if (editDate) body.date = editDate;

      const updated = await apiFetch<MaterialDetail>(`/materials/${material.id}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      });
      setMaterial(updated);
      setEditing(false);
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!material) return;
    setDeleting(true);
    try {
      await apiFetch(`/materials/${material.id}`, { method: 'DELETE' });
      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  const inputClass =
    'w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500';

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
        <div className="space-y-4">
          <div className="h-7 w-64 rounded bg-zinc-900 animate-pulse" />
          <div className="h-4 w-40 rounded bg-zinc-900 animate-pulse" />
          <div className="mt-6 rounded-xl border border-zinc-800 bg-zinc-900 p-5 space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-4 w-full rounded bg-zinc-800 animate-pulse" />
            ))}
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {!loading && !error && material && (
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h1 className="text-2xl font-semibold truncate">{material.name}</h1>
              <p className="mt-1 text-xs text-zinc-500">
                {material.mimeType} &middot; {formatSize(material.size)}
                {material.createdAt && (
                  <> &middot; {new Date(material.createdAt).toLocaleDateString()}</>
                )}
              </p>
            </div>
            <div className="flex shrink-0 gap-2">
              {!editing && (
                <button
                  type="button"
                  onClick={startEdit}
                  className="rounded-md border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-sm font-medium text-zinc-300 hover:bg-zinc-700 transition-colors"
                >
                  Edit
                </button>
              )}
              {!confirmDelete ? (
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  className="rounded-md border border-red-900 bg-red-950 px-3 py-1.5 text-sm font-medium text-red-400 hover:bg-red-900 transition-colors"
                >
                  Delete
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-zinc-400">Are you sure?</span>
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={deleting}
                    className="rounded-md bg-red-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-400 transition-colors disabled:opacity-50"
                  >
                    {deleting ? 'Deleting…' : 'Confirm'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(false)}
                    className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Metadata card */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
            <h2 className="text-xs font-medium text-zinc-400 uppercase tracking-wide mb-3">
              Metadata
            </h2>

            {!editing ? (
              <div>
                <MetaRow label="Course" value={material.courseName ?? material.courseId} />
                <MetaRow label="Week" value={material.week} />
                <MetaRow label="Session" value={material.session} />
                <MetaRow label="Type" value={material.type} />
                <MetaRow label="Date" value={material.date} />
              </div>
            ) : (
              <div className="space-y-4">
                {/* Course */}
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1.5">Course</label>
                  <select
                    value={editCourseId}
                    onChange={(e) => setEditCourseId(e.target.value)}
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
                    <label className="block text-xs font-medium text-zinc-400 mb-1.5">Week</label>
                    <input
                      type="number"
                      min={1}
                      value={editWeek}
                      onChange={(e) => setEditWeek(e.target.value)}
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
                      value={editSession}
                      onChange={(e) => setEditSession(e.target.value)}
                      placeholder="e.g. 1"
                      className={inputClass}
                    />
                  </div>
                </div>

                {/* Type */}
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1.5">Type</label>
                  <select
                    value={editType}
                    onChange={(e) => setEditType(e.target.value)}
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
                  <label className="block text-xs font-medium text-zinc-400 mb-1.5">Date</label>
                  <input
                    type="date"
                    value={editDate}
                    onChange={(e) => setEditDate(e.target.value)}
                    className={inputClass}
                  />
                </div>

                {editError && (
                  <p className="text-sm text-red-400">{editError}</p>
                )}

                <div className="flex gap-3 pt-1">
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={saving}
                    className="inline-flex items-center gap-2 rounded-md bg-blue-500 px-4 py-2 text-sm font-medium text-white hover:bg-blue-400 transition-colors disabled:opacity-50"
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
                    onClick={cancelEdit}
                    disabled={saving}
                    className="rounded-md border border-zinc-700 bg-zinc-800 px-4 py-2 text-sm font-medium text-zinc-300 hover:bg-zinc-700 transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Transcript */}
          {material.transcript && (
            <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
              <h2 className="text-xs font-medium text-zinc-400 uppercase tracking-wide mb-3">
                Transcript
              </h2>
              <pre className="whitespace-pre-wrap text-sm text-zinc-300 leading-relaxed font-sans">
                {material.transcript}
              </pre>
            </div>
          )}

          {/* Extracted text */}
          {material.extractedText && (
            <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
              <h2 className="text-xs font-medium text-zinc-400 uppercase tracking-wide mb-3">
                Extracted Text
              </h2>
              <pre className="whitespace-pre-wrap text-sm text-zinc-300 leading-relaxed font-sans">
                {material.extractedText}
              </pre>
            </div>
          )}

          {/* Attached photos */}
          {material.children && material.children.length > 0 && (
            <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
              <h2 className="text-xs font-medium text-zinc-400 uppercase tracking-wide mb-3">
                Attached Photos
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {material.children.map((child) => (
                  <div key={child.id} className="rounded-lg border border-zinc-800 bg-zinc-950 overflow-hidden">
                    {child.url ? (
                      <img
                        src={child.url}
                        alt={child.name}
                        className="w-full h-32 object-cover"
                      />
                    ) : (
                      <div className="h-32 flex items-center justify-center">
                        <svg className="h-8 w-8 text-zinc-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                        </svg>
                      </div>
                    )}
                    <div className="px-2 py-1.5">
                      <p className="text-xs text-zinc-400 truncate">{child.name}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
