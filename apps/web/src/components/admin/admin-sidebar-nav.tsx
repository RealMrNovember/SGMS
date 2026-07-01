'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export type AdminNavItem = {
  href: string;
  label: string;
  exact?: boolean;
  highlight?: boolean;
};

export type AdminNavGroup = {
  title: string;
  items: AdminNavItem[];
};

export function AdminSidebarNav({ groups }: { groups: AdminNavGroup[] }) {
  const pathname = usePathname();

  return (
    <div className="space-y-6">
      {groups.map((group) => (
        <div key={group.title}>
          <p className="admin-nav-group-title">{group.title}</p>
          <nav className="mt-2 space-y-1">
            {group.items.map((item) => {
              const active = item.exact
                ? pathname === item.href
                : pathname === item.href || pathname.startsWith(`${item.href}/`);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="admin-nav-link"
                  data-active={active ? 'true' : 'false'}
                  data-highlight={item.highlight ? 'true' : 'false'}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      ))}
    </div>
  );
}
