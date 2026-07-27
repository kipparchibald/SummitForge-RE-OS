'use client';

import React from 'react';
import { exportCmaPdf } from '@/lib/cma/export';
import type { CmaResult } from '@/lib/cma/engine';
import { loadPersistedBranding } from '@/lib/branding/apply';

const DEFAULTS = {
  agentName: 'Kipp Archibald',
  brokerage: 'Archibald-Bagley Real Estate',
  phone: '(208) 521-2751',
  email: 'kipp@archibaldbagley.com',
};

export default function ExportCmaButton({
  result,
  className = '',
}: {
  result: CmaResult;
  className?: string;
}) {
  const onExport = () => {
    const brand = loadPersistedBranding();
    const company = brand?.companyName || DEFAULTS.brokerage;
    exportCmaPdf(result, {
      agentName: DEFAULTS.agentName,
      brokerage: company,
      phone: brand?.phone || DEFAULTS.phone,
      email: DEFAULTS.email,
      logoText: company
        .split(/\s+/)
        .map((w) => w[0])
        .join('')
        .slice(0, 3)
        .toUpperCase(),
    });
  };

  return (
    <button
      type="button"
      onClick={onExport}
      className={
        className ||
        'w-full py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-medium hover:bg-emerald-500 transition'
      }
    >
      Export professional PDF
    </button>
  );
}
