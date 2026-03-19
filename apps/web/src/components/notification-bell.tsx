'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
  link?: string;
}

interface NotificationMeta {
  total: number;
  unread: number;
  items: Notification[];
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

export function NotificationBell() {
  const [unreadCount, setUnreadCount] = useState(0);
  const [recentNotifications, setRecentNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = useCallback(async () => {
    try {
      const data = await apiFetch<NotificationMeta | Notification[]>('/notifications?limit=5');
      if (Array.isArray(data)) {
        setRecentNotifications(data.slice(0, 5));
        setUnreadCount(data.filter((n) => !n.read).length);
      } else {
        setRecentNotifications(data.items ?? []);
        setUnreadCount(data.unread ?? 0);
      }
    } catch {
      // silently ignore polling errors
    }
  }, []);

  // Initial fetch + 30s poll
  useEffect(() => {
    const interval = setInterval(fetchNotifications, 30000);
    // Kick off the first fetch via a zero-delay timeout so setState is called
    // inside a callback (not synchronously in the effect body).
    const initial = setTimeout(fetchNotifications, 0);
    return () => {
      clearTimeout(initial);
      clearInterval(interval);
    };
  }, [fetchNotifications]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  async function handleNotificationClick(id: string) {
    try {
      await apiFetch(`/notifications/${id}/read`, { method: 'PATCH' });
      setRecentNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch {
      // ignore
    }
  }

  return (
    <div ref={dropdownRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="relative flex h-8 w-8 items-center justify-center rounded-md text-zinc-400 hover:bg-zinc-800 hover:text-white transition-colors"
        aria-label="Notifications"
      >
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white leading-none">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-10 z-50 w-80 rounded-lg border border-zinc-800 bg-zinc-900 shadow-xl">
          <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-2.5">
            <span className="text-sm font-medium">Notifications</span>
            {unreadCount > 0 && (
              <span className="rounded-full bg-red-500/15 px-1.5 py-0.5 text-xs font-medium text-red-400">
                {unreadCount}
              </span>
            )}
          </div>

          {recentNotifications.length === 0 ? (
            <div className="px-4 py-6 text-center text-xs text-zinc-500">
              No notifications yet.
            </div>
          ) : (
            <ul className="divide-y divide-zinc-800">
              {recentNotifications.map((notification) => {
                const inner = (
                  <div
                    className={`flex items-start gap-3 px-4 py-3 hover:bg-zinc-800 transition-colors cursor-pointer ${
                      notification.read ? '' : 'bg-zinc-800/40'
                    }`}
                    onClick={() => handleNotificationClick(notification.id)}
                  >
                    <div className="min-w-0 flex-1">
                      <p className={`text-xs leading-snug ${notification.read ? 'text-zinc-400' : 'font-medium text-white'}`}>
                        {notification.title}
                      </p>
                      <p className="mt-0.5 text-xs text-zinc-500 truncate">{notification.message}</p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <span className="text-[10px] text-zinc-600">{timeAgo(notification.createdAt)}</span>
                      {!notification.read && (
                        <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                      )}
                    </div>
                  </div>
                );

                if (notification.link) {
                  return (
                    <li key={notification.id}>
                      <Link href={notification.link} onClick={() => setOpen(false)}>
                        {inner}
                      </Link>
                    </li>
                  );
                }
                return <li key={notification.id}>{inner}</li>;
              })}
            </ul>
          )}

          <div className="border-t border-zinc-800 px-4 py-2.5">
            <Link
              href="/dashboard/notifications"
              onClick={() => setOpen(false)}
              className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
            >
              View all notifications →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
