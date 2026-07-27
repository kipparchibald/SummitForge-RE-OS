'use client';

import React, { useState } from 'react';
import { exportCmaPdf } from '@/lib/cma/export';
import type { CmaResult } from '@/lib/cma/engine';
import { loadPersistedBranding } from '@/lib/branding/apply';
import { toastSuccess, toastError, toastInfo } from '@/lib/toast/store';

const DEFAULTS = {
  agentName: 'Kipp Archibald',
  brokerage: 'Archibald-Bagley Real Estate',
  phone: '(208) 521-2751',
  email: 'kipp@archibaldbagley.com',
};

export default function ExportCmaButton({
  result,
  className = '',
  label = 'Export professional PDF',
}: {
  result: CmaResult;
  className?: string;
  label?: string;
}) {
  const [busy, setBusy] = useState(false);

  const onExport = () => {
    if (busy) return;
    setBusy(true);
    try {
      const brand = loadPersistedBranding();
      const company = brand?.companyName || DEFAULTS.brokerage;
      const mode = exportCmaPdf(result, {
        agentName: DEFAULTS.agentName,
        brokerage: company,
        phone: brand?.phone || DEFAULTS.phone,
        email: DEFAULTS.email,
        logoText: company
          .split(/\s+/)
          .filter(Boolean)
          .map((w) => w[0])
          .join('')
          .slice(0, 3)
          .toUpperCase() || 'SF',
      });

      if (mode === 'print-window') {
        toastSuccess('CMA opened — choose Print → Save as PDF');
      } else {
        toastInfo('Popup blocked — CMA HTML downloaded. Open the file, then Print → Save as PDF.');
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Export failed';
      toastError(msg);
    } finally {
      // Allow a second click after a beat (avoids double-open spam)
      setTimeout(() => setBusy(false), 600);
    }
  };

  return (
    <button
      type="button"
      onClick={onExport}
      disabled={busy}
      title="Opens a print-ready CMA. Use your browser Print dialog → Save as PDF."
      className={
        className ||
        'w-full py-2.5 bg-neutral-900 text-white rounded-none text-sm font-semibold tracking-wide uppercase text-[11px] letter-spacing hover:bg-black transition disabled:opacity-60'
      }
    >
      {busy ? 'Exporting…' : label}
    </button>
  );
}
