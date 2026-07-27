'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

type NavItem = {
  href: string;
  label: string;
  hint?: string;
  highlight?: boolean;
};

type NavGroup = {
  id: string;
  label: string;
  items: NavItem[];
};

export const NAV_GROUPS: NavGroup[] = [
  {
    id: 'command',
    label: 'Command',
    items: [
      { href: '/', label: 'Command Center', hint: 'Dashboard' },
      { href: '/ai-assistants', label: 'AI Assistants', highlight: true },
    ],
  },
  {
    id: 'inventory',
    label: 'Inventory',
    items: [
      { href: '/import', label: 'MLS Import', hint: 'Full board' },
      { href: '/alerts', label: 'Property Alerts' },
      { href: '/analytics', label: 'Analytics' },
      { href: '/cma', label: 'CMA Builder' },
      { href: '/offer', label: 'Offer Engine', hint: 'Win odds', highlight: true },
    ],
  },
  {
    id: 'land',
    label: 'Land & GIS',
    items: [
      { href: '/development/plat', label: 'AI Plat Studio', highlight: true },
      { href: '/development/land-deals', label: 'Land Deals' },
      { href: '/monitoring', label: 'GIS Parcel Map' },
      { href: '/reports/land-analysis', label: 'Land Reports' },
    ],
  },
  {
    id: 'pipeline',
    label: 'Pipeline',
    items: [
      { href: '/crm', label: 'CRM Pipeline' },
      { href: '/transactions', label: 'Transactions' },
      { href: '/forms', label: 'Idaho Forms & E-Sign' },
      { href: '/mortgage', label: 'Mortgage' },
    ],
  },
  {
    id: 'growth',
    label: 'Growth',
    items: [
      { href: '/marketing', label: 'Marketing Agent', highlight: true },
      { href: '/portal', label: 'Client Portal' },
      { href: '/publish', label: 'White-Label Publish' },
    ],
  },
  {
    id: 'system',
    label: 'System',
    items: [
      { href: '/settings/branding', label: 'Branding' },
      { href: '/pricing', label: 'Pricing & Plans' },
      { href: '/setup', label: 'Setup Guide' },
    ],
  },
];

function isActive(pathname: string, href: string) {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(href + '/');
}

const ICONS: Record<string, string> = {
  '/': '◆',
  '/ai-assistants': '✦',
  '/import': '⬇',
  '/alerts': '◎',
  '/analytics': '▴',
  '/cma': '▣',
  '/offer': '◎',
  '/development/plat': '⬡',
  '/development/land-deals': '▤',
  '/monitoring': '⌖',
  '/reports/land-analysis': '☰',
  '/crm': '◎',
  '/transactions': '→',
  '/forms': '✎',
  '/mortgage': '%',
  '/marketing': '◈',
  '/portal': '○',
  '/publish': '↑',
  '/settings/branding': '◐',
  '/pricing': '$',
  '/setup': '?',
};

export function AppNavLinks({
  onNavigate,
  compact = false,
}: {
  onNavigate?: () => void;
  compact?: boolean;
}) {
  const pathname = usePathname() || '/';

  return (
    <nav className="space-y-5" aria-label="Primary">
      {NAV_GROUPS.map((group) => (
        <div key={group.id}>
          <div
            className={`px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400 ${
              compact ? 'sr-only' : ''
            }`}
          >
            {group.label}
          </div>
          <ul className="space-y-0.5">
            {group.items.map((item) => {
              const active = isActive(pathname, item.href);
              const highlight = !!item.highlight;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    aria-current={active ? 'page' : undefined}
                    className={[
                      'group flex items-center gap-2.5 px-3 py-2 rounded-xl text-[13px] transition-all',
                      active
                        ? 'bg-slate-900 text-white font-medium shadow-sm'
                        : highlight
                          ? 'text-emerald-800 font-semibold hover:bg-emerald-50'
                          : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900',
                    ].join(' ')}
                  >
                    <span
                      className={[
                        'w-5 text-center text-[11px] shrink-0',
                        active ? 'text-emerald-300' : 'text-slate-400 group-hover:text-slate-600',
                      ].join(' ')}
                      aria-hidden
                    >
                      {ICONS[item.href] || '·'}
                    </span>
                    <span className="truncate flex-1">{item.label}</span>
                    {item.hint && !active && (
                      <span className="text-[10px] text-slate-400 hidden xl:inline">{item.hint}</span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
