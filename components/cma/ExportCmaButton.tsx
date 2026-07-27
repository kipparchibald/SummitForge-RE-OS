'use client';

import React from 'react';
import { exportCmaPdf } from '@/lib/cma/export';
import type { CmaResult } from '@/lib/cma/engine';

export default function ExportCmaButton({
  result,
  className = '',
}: {
  result: CmaResult;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={() =>
        exportCmaPdf(result, {
          agentName: 'Kipp Archibald',
          brokerage: 'Archibald-Bagley Real Estate',
          phone: '(208) 521-2751',
          email: 'kipp@archibaldbagley.com',
        })
      }
      className={
        className ||
        'w-full py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-medium hover:bg-emerald-500 transition'
      }
    >
      Export professional PDF
    </button>
  );
}
