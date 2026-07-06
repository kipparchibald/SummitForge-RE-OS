import type { Metadata } from 'next';
import './globals.css';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Summit Forge',
  description: 'Real Estate Analytics & Operations Platform for Jefferson County, ID',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-gray-50 text-gray-900">
        <div className="flex min-h-screen">
          {/* Sidebar Navigation */}
          <div className="w-64 bg-white border-r border-gray-200 p-6 hidden lg:flex flex-col">
            <div className="mb-10">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-black rounded-2xl flex items-center justify-center">
                  <span className="text-white font-bold text-xl">S</span>
                </div>
                <div>
                  <div className="font-semibold text-2xl tracking-tight">Summit Forge</div>
                  <div className="text-[10px] text-gray-500 -mt-1">JEFFERSON COUNTY</div>
                </div>
              </div>
            </div>

            <nav className="space-y-1 text-sm">
              <Link href="/analytics" className="flex items-center gap-3 px-4 py-3 rounded-2xl hover:bg-gray-100 font-medium text-gray-700">
                Analytics
              </Link>
              <Link href="/cma" className="flex items-center gap-3 px-4 py-3 rounded-2xl hover:bg-gray-100 font-medium text-gray-700">
                CMA Builder
              </Link>
              <Link href="/land" className="flex items-center gap-3 px-4 py-3 rounded-2xl hover:bg-gray-100 font-medium text-gray-700">
                Land Development
              </Link>
              <Link href="/import" className="flex items-center gap-3 px-4 py-3 rounded-2xl hover:bg-gray-100 font-medium text-gray-700">
                Data Import
              </Link>
              <Link href="/mortgage" className="flex items-center gap-3 px-4 py-3 rounded-2xl hover:bg-gray-100 font-medium text-gray-700">
                Mortgage Calculator
              </Link>
              <Link href="/alerts" className="flex items-center gap-3 px-4 py-3 rounded-2xl hover:bg-gray-100 font-medium text-gray-700">
                Property Alerts
              </Link>
            </nav>

            <div className="mt-auto pt-8 border-t text-xs text-gray-400">
              v0.2 • July 2026
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1">
            {children}
          </div>
        </div>
      </body>
    </html>
  );
}
