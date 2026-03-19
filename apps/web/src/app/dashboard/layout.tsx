import Link from 'next/link';
import { NotificationBell } from '@/components/notification-bell';

const navLinks = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/dashboard/assignments', label: 'Assignments' },
  { href: '/dashboard/announcements', label: 'Announcements' },
  { href: '/dashboard/upload', label: 'Upload' },
  { href: '/dashboard/settings', label: 'Settings' },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen bg-zinc-950 text-white overflow-hidden">
      {/* Sidebar */}
      <aside className="hidden md:flex w-56 flex-col shrink-0 border-r border-zinc-800 bg-zinc-950">
        <div className="px-5 py-5 border-b border-zinc-800 flex items-center justify-between">
          <span className="text-base font-semibold tracking-tight">OpenCampus</span>
          <NotificationBell />
        </div>
        <nav className="flex flex-col gap-1 px-3 py-4">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-md px-3 py-2 text-sm text-zinc-400 hover:bg-zinc-800 hover:text-white transition-colors"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </aside>

      {/* Mobile top bar */}
      <div className="md:hidden fixed top-0 inset-x-0 z-10 flex items-center justify-between px-4 h-12 border-b border-zinc-800 bg-zinc-950">
        <span className="text-sm font-semibold">OpenCampus</span>
        <div className="flex items-center gap-2">
          <NotificationBell />
          <nav className="flex gap-3">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-xs text-zinc-400 hover:text-white transition-colors"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      </div>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto md:pt-0 pt-12">
        {children}
      </main>
    </div>
  );
}
