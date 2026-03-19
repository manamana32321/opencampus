'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import TranscriptEditor from '@/components/transcript-editor';
import TranscriptPreview from '@/components/transcript-preview';
import JobStatus from '@/components/job-status';

interface MaterialDetail {
  id: string;
  name: string;
  type: string;
  size: number;
  mimeType: string;
  transcript?: string;
  extractedText?: string;
  jobId?: string;
  jobStatus?: 'pending' | 'processing' | 'done' | 'failed';
}

export default function MaterialEditPage() {
  const { id } = useParams<{ id: string }>();

  const [material, setMaterial] = useState<MaterialDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Editor state
  const [html, setHtml] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved' | 'error'>('idle');
  const [saveError, setSaveError] = useState<string | null>(null);

  // Summary generation
  const [summarizing, setSummarizing] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  // Auto-save debounce timer
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!id) return;
    apiFetch<MaterialDetail>(`/materials/${id}`)
      .then((mat) => {
        setMaterial(mat);
        // Prefer transcript; fall back to extractedText as plain text wrapped in <p>
        if (mat.transcript) {
          setHtml(mat.transcript);
        } else if (mat.extractedText) {
          // Wrap plain text paragraphs in <p> tags for tiptap
          const wrapped = mat.extractedText
            .split(/\n{2,}/)
            .map((para) => `<p>${para.trim()}</p>`)
            .join('');
          setHtml(wrapped);
        }
      })
      .catch((err: Error) => setFetchError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  const doSave = useCallback(
    async (htmlToSave: string) => {
      if (!material) return;
      setSaving(true);
      setSaveError(null);
      try {
        await apiFetch<MaterialDetail>(`/materials/${material.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ transcript: htmlToSave }),
        });
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus('idle'), 2500);
      } catch (err) {
        setSaveStatus('error');
        setSaveError(err instanceof Error ? err.message : 'Save failed');
      } finally {
        setSaving(false);
      }
    },
    [material],
  );

  // Auto-save with 2s debounce
  const handleEditorChange = useCallback(
    (newHtml: string) => {
      setHtml(newHtml);
      setSaveStatus('idle');
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
      autoSaveTimer.current = setTimeout(() => {
        doSave(newHtml);
      }, 2000);
    },
    [doSave],
  );

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    };
  }, []);

  const handleManualSave = () => {
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    doSave(html);
  };

  const handleGenerateSummary = async () => {
    if (!material) return;
    setSummarizing(true);
    setSummaryError(null);
    try {
      await apiFetch(`/materials/${material.id}/summarize`, {
        method: 'POST',
        body: JSON.stringify({ transcript: html }),
      });
    } catch (err) {
      setSummaryError(err instanceof Error ? err.message : 'Failed to start summary');
    } finally {
      setSummarizing(false);
    }
  };

  const isProcessing =
    material?.jobStatus === 'pending' || material?.jobStatus === 'processing';

  return (
    <div className="flex flex-col h-screen bg-zinc-950 text-zinc-100">
      {/* Top bar */}
      <header className="flex items-center justify-between gap-4 px-5 py-3 border-b border-zinc-800 bg-zinc-900 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <Link
            href={`/materials/${id}`}
            className="inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300 transition-colors shrink-0"
          >
            <svg
              className="h-3.5 w-3.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </Link>
          <span className="text-zinc-700 text-sm select-none">/</span>
          <h1 className="text-sm font-medium truncate text-zinc-200">
            {loading ? (
              <span className="inline-block h-4 w-48 rounded bg-zinc-800 animate-pulse" />
            ) : (
              material?.name ?? 'Edit Transcript'
            )}
          </h1>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {/* Save status indicator */}
          {saveStatus === 'saved' && (
            <span className="text-xs text-green-400">Saved</span>
          )}
          {saveStatus === 'error' && saveError && (
            <span className="text-xs text-red-400">{saveError}</span>
          )}
          {saving && (
            <span className="text-xs text-zinc-500">Saving…</span>
          )}

          <button
            type="button"
            onClick={handleGenerateSummary}
            disabled={summarizing || !material}
            className="inline-flex items-center gap-1.5 rounded-md border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-300 hover:bg-zinc-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {summarizing ? (
              <>
                <svg className="h-3 w-3 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Generating…
              </>
            ) : (
              <>
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                </svg>
                Generate AI Summary
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleManualSave}
            disabled={saving || !material}
            className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </header>

      {/* Content */}
      {loading && (
        <div className="flex-1 flex items-center justify-center">
          <div className="space-y-3 w-full max-w-xl px-6">
            <div className="h-5 w-3/4 rounded bg-zinc-800 animate-pulse" />
            <div className="h-4 w-full rounded bg-zinc-800 animate-pulse" />
            <div className="h-4 w-5/6 rounded bg-zinc-800 animate-pulse" />
            <div className="h-4 w-2/3 rounded bg-zinc-800 animate-pulse" />
          </div>
        </div>
      )}

      {fetchError && (
        <div className="flex-1 flex items-center justify-center px-6">
          <div className="rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3 text-sm text-red-400">
            {fetchError}
          </div>
        </div>
      )}

      {!loading && !fetchError && material && (
        <div className="flex flex-col flex-1 min-h-0 gap-3 p-4">
          {/* Job status banner */}
          {isProcessing && material.jobId && (
            <div className="shrink-0">
              <JobStatus jobId={material.jobId} />
            </div>
          )}

          {summaryError && (
            <div className="shrink-0 rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-2 text-xs text-red-400">
              {summaryError}
            </div>
          )}

          {/* Split editor / preview */}
          <div className="flex flex-1 min-h-0 gap-3">
            {/* Left: Editor */}
            <div className="flex flex-col flex-1 min-w-0 min-h-0">
              <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide mb-1.5 px-0.5">
                Editor
              </p>
              <div className="flex-1 min-h-0">
                <TranscriptEditor
                  content={html}
                  onChange={handleEditorChange}
                  readonly={isProcessing}
                />
              </div>
            </div>

            {/* Right: Preview */}
            <div className="flex flex-col flex-1 min-w-0 min-h-0">
              <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide mb-1.5 px-0.5">
                Preview
              </p>
              <div className="flex-1 min-h-0 rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden">
                <TranscriptPreview html={html} />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
