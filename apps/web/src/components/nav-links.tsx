'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

interface NavLink {
  href: string;
  label: string;
}

export function NavLinks({
  links,
  className,
  linkClassName,
}: {
  links: NavLink[];
  className?: string;
  linkClassName?: string;
}) {
  const searchParams = useSearchParams();
  const semester = searchParams.get('semester');

  function buildHref(base: string): string {
    if (!semester) return base;
    const params = new URLSearchParams();
    params.set('semester', semester);
    return `${base}?${params.toString()}`;
  }

  return (
    <nav className={className}>
      {links.map((link) => (
        <Link
          key={link.href}
          href={buildHref(link.href)}
          className={linkClassName}
        >
          {link.label}
        </Link>
      ))}
    </nav>
  );
}
