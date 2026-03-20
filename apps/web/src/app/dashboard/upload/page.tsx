'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import UploadDropzone from '@/components/upload-dropzone';
import ReviewForm from '@/components/review-form';

interface CourseWeekWithCourse {
  id: number;
  courseId: number;
  week: number;
  course: {
    id: number;
    name: string;
  };
}

interface Material {
  id: number;
  originalFilename: string | null;
  type: string;
  filePath: string;
  session: number | null;
  courseWeekId: number;
  courseWeek: CourseWeekWithCourse;
  children: Material[];
  aiConfidence: number | null;
  createdAt: string;
}

interface Inference {
  courseId?: number;
  week?: number;
  session?: number;
  type?: string;
  date?: string;
  confidence?: number;
  partNumber?: number;
}

interface UploadResult {
  material: Material;
  inference: Inference;
}

interface Semester {
  id: number;
  name: string;
}

interface Course {
  id: number;
  name: string;
  semester: Semester;
}

type Step = 'dropzone' | 'processing' | 'review' | 'success';

export default function UploadPage() {
  const [step, setStep] = useState<Step>('dropzone');
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [savedMaterial, setSavedMaterial] = useState<Material | null>(null);

  useEffect(() => {
    apiFetch<Course[]>('/courses').then(setCourses).catch(() => {
      // non-fatal; courses just won't pre-fill
    });
  }, []);

  const handleUploadSuccess = (result: UploadResult) => {
    setUploadResult(result);
    // Upload response doesn't include job info; go straight to review
    setStep('review');
  };

  const handleJobDone = () => {
    setStep('review');
  };

  const handleSave = (updated: Material) => {
    setSavedMaterial(updated);
    setStep('success');
  };

  const handleSkip = () => {
    setUploadResult(null);
    setStep('dropzone');
  };

  const handleUploadAnother = () => {
    setUploadResult(null);
    setSavedMaterial(null);
    setStep('dropzone');
  };

  return (
    <div className="px-6 py-8 max-w-3xl mx-auto">
      <div className="mb-6">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Back to Dashboard
        </Link>
        <h1 className="mt-3 text-2xl font-semibold">Upload Material</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Upload a lecture recording, slide deck, or note. AI will infer metadata automatically.
        </p>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-8">
        {(['dropzone', 'review', 'success'] as const).map((s, i) => {
          const labels: Record<string, string> = {
            dropzone: 'Upload',
            review: 'Review',
            success: 'Done',
          };
          const isActive = step === s || (step === 'processing' && s === 'review');
          const isPast =
            (s === 'dropzone' && (step === 'review' || step === 'processing' || step === 'success')) ||
            (s === 'review' && step === 'success');
          return (
            <div key={s} className="flex items-center gap-2">
              {i > 0 && <div className="h-px w-8 bg-zinc-800" />}
              <div
                className={`flex items-center gap-1.5 text-xs font-medium ${
                  isPast
                    ? 'text-green-400'
                    : isActive
                    ? 'text-white'
                    : 'text-zinc-600'
                }`}
              >
                <span
                  className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-xs ${
                    isPast
                      ? 'bg-green-500/20 text-green-400'
                      : isActive
                      ? 'bg-blue-500 text-white'
                      : 'bg-zinc-800 text-zinc-600'
                  }`}
                >
                  {isPast ? (
                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    i + 1
                  )}
                </span>
                {labels[s]}
              </div>
            </div>
          );
        })}
      </div>

      {step === 'dropzone' && (
        <UploadDropzone onUploadSuccess={handleUploadSuccess} />
      )}

      {step === 'processing' && uploadResult && (
        <div className="space-y-4">
          <p className="text-sm text-zinc-400">
            Your file is being processed. This may take a moment.
          </p>
          <button
            type="button"
            onClick={handleJobDone}
            className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            Skip waiting and review now
          </button>
        </div>
      )}

      {step === 'review' && uploadResult && (
        <ReviewForm
          material={uploadResult.material}
          inference={uploadResult.inference}
          courses={courses}
          onSave={handleSave}
          onSkip={handleSkip}
        />
      )}

      {step === 'success' && savedMaterial && (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 px-6 py-10 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-500/15 mb-4">
            <svg className="h-6 w-6 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-white">Saved successfully</h2>
          <p className="mt-1 text-sm text-zinc-500">
            {savedMaterial.originalFilename ?? 'Material'} has been added to your materials.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link
              href={`/materials/${savedMaterial.id}`}
              className="rounded-md border border-zinc-700 bg-zinc-800 px-4 py-2 text-sm font-medium text-zinc-300 hover:bg-zinc-700 transition-colors"
            >
              View material
            </Link>
            <button
              type="button"
              onClick={handleUploadAnother}
              className="rounded-md bg-blue-500 px-4 py-2 text-sm font-medium text-white hover:bg-blue-400 transition-colors"
            >
              Upload another
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
