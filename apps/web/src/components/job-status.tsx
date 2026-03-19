'use client';

import { useEffect, useRef, useState } from 'react';

interface JobStatusProps {
  jobId: string;
}

type Status = 'pending' | 'processing' | 'done' | 'failed';

interface JobEvent {
  status: Status;
  progress?: number;
  message?: string;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

const STATUS_LABEL: Record<Status, string> = {
  pending: 'Waiting…',
  processing: 'Processing…',
  done: 'Done',
  failed: 'Failed',
};

export default function JobStatus({ jobId }: JobStatusProps) {
  const [status, setStatus] = useState<Status>('pending');
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!jobId) return;

    const es = new EventSource(`${API_URL}/jobs/${jobId}/stream`, {
      withCredentials: true,
    });
    esRef.current = es;

    es.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data) as JobEvent;
        if (data.status) setStatus(data.status);
        if (data.progress != null) setProgress(data.progress);
        if (data.message) setMessage(data.message);
        if (data.status === 'done' || data.status === 'failed') {
          es.close();
        }
      } catch {
        // ignore parse errors
      }
    };

    es.onerror = () => {
      setStatus('failed');
      setMessage('Connection lost');
      es.close();
    };

    return () => {
      es.close();
    };
  }, [jobId]);

  const isTerminal = status === 'done' || status === 'failed';
  const pct = Math.max(0, Math.min(100, Math.round(progress)));

  const barColor =
    status === 'failed'
      ? 'bg-red-500'
      : status === 'done'
      ? 'bg-green-500'
      : 'bg-blue-500';

  const statusColor =
    status === 'failed'
      ? 'text-red-400'
      : status === 'done'
      ? 'text-green-400'
      : 'text-zinc-400';

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
      <div className="flex items-center justify-between mb-2">
        <span className={`text-sm font-medium ${statusColor}`}>
          {STATUS_LABEL[status]}
        </span>
        <span className="text-xs text-zinc-500">{pct}%</span>
      </div>

      <div className="h-2 w-full rounded-full bg-zinc-700">
        <div
          className={`h-2 rounded-full transition-all duration-300 ${barColor}`}
          style={{ width: `${isTerminal && status === 'done' ? 100 : pct}%` }}
        />
      </div>

      {message && (
        <p className="mt-2 text-xs text-zinc-500">{message}</p>
      )}
    </div>
  );
}
