'use client';

import Link from 'next/link';
import { useQueryState, parseAsString } from 'nuqs';

interface NavLink {
  href: string;
  label: string;
}

function getDefaultSemesterName(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  return month >= 2 && month <= 7 ? `${year}-1` : `${year}-2`;
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
  const [semester] = useQueryState(
    'semester',
    parseAsString.withDefault(getDefaultSemesterName()),
  );

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
