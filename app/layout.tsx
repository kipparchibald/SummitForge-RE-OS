import type { Metadata } from 'next';
import './globals.css';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Summit Forge — Archibald-Bagley',
  description: 'AI Real Estate Operating System for Jefferson County, Idaho',
};

const nav = [
  { href: '/', label: 'Dashboard' },
  { href: '/analytics', label: 'Analytics' },
  { href: '/alerts', label: 'Property Alerts' },
  { href: '/transactions', label: 'Transactions' },
  { href: '/forms', label: 'Idaho Forms' },
  { href: '/portal', label: 'Client Portal' },
  { href: '/cma', label: 'CMA Builder' },
  { href: '/land', label: 'Land Development' },
  { href: '/import', label: 'Data Import' },
  { href: '/mortgage', label: 'Mortgage' },
  { href: '/marketing', label: 'Marketing' },
  { href: '/monitoring', label: 'GIS Monitor' },
  { href: '/publish', label: 'Publish / White-Label' },
  { href: '/settings/branding', label: 'Branding' },
];

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-[var(--sf-bg,#f9fafb)] text-[var(--sf-fg,#111827)] antialiased">
        <div className="flex min-h-screen">
          <aside className="w-64 bg-white border-r border-gray-200 p-6 hidden lg:flex flex-col sticky top-0 h-screen">
            <div className="mb-10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-black rounded-2xl flex items-center justify-center shadow-sm">
                  <span className="text-white font-bold text-xl">S</span>
                </div>
                <div>
                  <div className="font-semibold text-xl tracking-tight leading-none">Summit Forge</div>
                  <div className="text-[10px] text-gray-500 mt-0.5 tracking-wider">ARCHIBALD-BAGLEY</div>
                </div>
              </div>
            </div>

            <nav className="space-y-0.5 text-sm flex-1 overflow-y-auto">
              {nav.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex items-center gap-3 px-4 py-2.5 rounded-2xl hover:bg-gray-100 font-medium text-gray-700 transition"
                >
                  {item.label}
                </Link>
              ))}
            </nav>

            <div className="pt-6 border-t text-xs text-gray-400">
              <div>v0.4 • July 2026</div>
              <div className="mt-1">Jefferson County, ID</div>
            </div>
          </aside>

          <main className="flex-1 min-w-0">{children}</main>
        </div>
      </body>
    </html>
  );
}
