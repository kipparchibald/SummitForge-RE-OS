/**
 * Professional CMA export — Compass-inspired presentation.
 * Black / white / warm gray, refined typography, print → PDF ready.
 */

import type { CmaResult } from './engine';

const money = (n: number) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

export type CmaExportOptions = {
  agentName?: string;
  brokerage?: string;
  phone?: string;
  email?: string;
  logoText?: string;
};

export type CmaExportMode = 'print-window' | 'download';

function escapeHtml(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function safeFilename(address: string): string {
  const base = String(address || 'subject')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  return base || 'subject';
}

function metaChips(subject: CmaResult['subject']): string {
  const chips: string[] = [];
  if (subject.propertyType) chips.push(escapeHtml(subject.propertyType));
  if (subject.acres) chips.push(`${subject.acres} acres`);
  if (subject.sqft) chips.push(`${subject.sqft.toLocaleString()} sqft`);
  if (subject.beds != null) chips.push(`${subject.beds} bd`);
  if (subject.baths != null) chips.push(`${subject.baths} ba`);
  if (subject.yearBuilt) chips.push(`Built ${subject.yearBuilt}`);
  if (subject.pin) chips.push(`PIN ${escapeHtml(subject.pin)}`);
  return chips
    .map((c) => `<span class="chip">${c}</span>`)
    .join('');
}

export function buildCmaHtml(result: CmaResult, opts: CmaExportOptions = {}): string {
  const agent = opts.agentName || 'Kipp Archibald';
  const brokerage = opts.brokerage || 'Archibald-Bagley Real Estate';
  const phone = opts.phone || '(208) 521-2751';
  const email = opts.email || 'kipp@archibaldbagley.com';
  const logo = (opts.logoText || brokerage)
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || 'AB';
  const date = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const subject = result.subject;
  const mf = result.marketFactors;
  const weightedMean = result.weightedMean ?? result.indicatedValue;
  const medianValue = result.medianValue ?? result.indicatedValue;
  const comps = result.comps || [];
  const noteList = result.notes || [];

  const compsRows = comps
    .map(
      (c, i) => `
    <tr class="${i % 2 === 0 ? '' : 'alt'}">
      <td>
        <div class="comp-addr">${escapeHtml(c.address)}</div>
        <div class="comp-meta">${escapeHtml(c.propertyType || '')}${c.acres ? ` · ${c.acres} ac` : c.sqft ? ` · ${c.sqft.toLocaleString()} sqft` : ''}${c.monthsSinceSale != null ? ` · ${c.monthsSinceSale} mo ago` : ''}${c.status ? ` · ${escapeHtml(c.status)}` : ''}</div>
      </td>
      <td class="num">${money(c.price)}</td>
      <td class="num ${c.netAdjustment >= 0 ? 'pos' : 'neg'}">${c.netAdjustment >= 0 ? '+' : ''}${money(c.netAdjustment)}</td>
      <td class="num strong">${money(c.adjustedPrice)}</td>
      <td class="num muted">${Math.round(c.score * 100)}%</td>
    </tr>`
    )
    .join('');

  const notes = noteList.map((n) => `<li>${escapeHtml(n)}</li>`).join('');

  const marketLineParts: string[] = [];
  if (mf) {
    if (mf.sqftSample > 0) marketLineParts.push(`$${mf.dollarsPerSqFt}/sqft market (n=${mf.sqftSample})`);
    if (mf.acreSample > 0)
      marketLineParts.push(`$${mf.dollarsPerAcre.toLocaleString()}/acre market (n=${mf.acreSample})`);
    marketLineParts.push(`${(mf.monthlyDrift * 100).toFixed(2)}%/mo time drift`);
  }
  if (result.perAcre != null) marketLineParts.push(`$${result.perAcre.toLocaleString()}/ac subject`);
  if (result.perSqFt != null) marketLineParts.push(`$${result.perSqFt}/sqft subject`);
  if (subject.assessedValue != null) marketLineParts.push(`Assessed ${money(subject.assessedValue)}`);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>CMA — ${escapeHtml(subject.address)} | ${escapeHtml(brokerage)}</title>
  <style>
    :root {
      --ink: #0a0a0a;
      --ink-soft: #1a1a1a;
      --muted: #6b6b6b;
      --faint: #9a9a9a;
      --line: #e6e6e4;
      --line-strong: #0a0a0a;
      --soft: #f6f5f2;
      --paper: #ffffff;
      --pos: #1a5c3a;
      --neg: #9b1c1c;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html { -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; }
    body {
      font-family: "Helvetica Neue", Helvetica, Arial, system-ui, sans-serif;
      color: var(--ink);
      background: var(--soft);
      line-height: 1.45;
    }
    .sheet {
      max-width: 880px;
      margin: 28px auto;
      background: var(--paper);
      padding: 48px 52px 40px;
      box-shadow: 0 1px 0 rgba(0,0,0,0.04), 0 18px 48px rgba(0,0,0,0.06);
    }
    .toolbar {
      max-width: 880px;
      margin: 20px auto 0;
      display: flex;
      gap: 10px;
      justify-content: flex-end;
      padding: 0 4px;
    }
    .toolbar button {
      appearance: none;
      border: 1px solid var(--ink);
      background: var(--ink);
      color: #fff;
      font-size: 12px;
      font-weight: 600;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      padding: 11px 18px;
      cursor: pointer;
      border-radius: 0;
    }
    .toolbar button.secondary {
      background: transparent;
      color: var(--ink);
    }
    .toolbar button:hover { opacity: 0.88; }

    /* Top brand bar — Compass-like wordmark row */
    .topbar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-bottom: 22px;
      border-bottom: 1px solid var(--ink);
      margin-bottom: 36px;
    }
    .wordmark {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .mark {
      width: 36px;
      height: 36px;
      border: 1.5px solid var(--ink);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.06em;
    }
    .broker {
      font-size: 13px;
      font-weight: 600;
      letter-spacing: 0.14em;
      text-transform: uppercase;
    }
    .doc-label {
      text-align: right;
      font-size: 10px;
      letter-spacing: 0.18em;
      text-transform: uppercase;
      color: var(--muted);
      font-weight: 600;
    }
    .doc-label strong {
      display: block;
      margin-top: 4px;
      color: var(--ink);
      font-size: 11px;
      letter-spacing: 0.12em;
    }

    /* Hero subject */
    .eyebrow {
      font-size: 10px;
      letter-spacing: 0.2em;
      text-transform: uppercase;
      color: var(--muted);
      font-weight: 600;
      margin-bottom: 10px;
    }
    .address {
      font-family: "Iowan Old Style", "Palatino Linotype", Palatino, Georgia, "Times New Roman", serif;
      font-size: 34px;
      font-weight: 500;
      line-height: 1.15;
      letter-spacing: -0.01em;
      color: var(--ink);
      max-width: 18ch;
    }
    .chips {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-top: 16px;
    }
    .chip {
      font-size: 11px;
      letter-spacing: 0.04em;
      color: var(--ink-soft);
      border: 1px solid var(--line);
      padding: 5px 10px;
      background: var(--soft);
    }

    /* Valuation block */
    .valuation {
      display: grid;
      grid-template-columns: 1.35fr 1fr;
      gap: 28px;
      margin: 40px 0 36px;
      padding: 28px 0;
      border-top: 1px solid var(--line);
      border-bottom: 1px solid var(--line);
    }
    .indicated-label {
      font-size: 10px;
      letter-spacing: 0.18em;
      text-transform: uppercase;
      color: var(--muted);
      font-weight: 600;
      margin-bottom: 8px;
    }
    .indicated-value {
      font-family: "Iowan Old Style", "Palatino Linotype", Palatino, Georgia, "Times New Roman", serif;
      font-size: 48px;
      font-weight: 500;
      letter-spacing: -0.02em;
      line-height: 1;
    }
    .indicated-sub {
      margin-top: 10px;
      font-size: 12px;
      color: var(--muted);
      max-width: 36ch;
    }
    .side-metrics {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 14px 18px;
      align-content: center;
    }
    .metric label {
      display: block;
      font-size: 9px;
      letter-spacing: 0.16em;
      text-transform: uppercase;
      color: var(--faint);
      font-weight: 600;
      margin-bottom: 4px;
    }
    .metric .v {
      font-size: 16px;
      font-weight: 600;
      font-variant-numeric: tabular-nums;
      letter-spacing: -0.01em;
    }

    .market-strip {
      font-size: 12px;
      color: var(--muted);
      margin-bottom: 36px;
      line-height: 1.6;
    }
    .market-strip span + span::before {
      content: "·";
      margin: 0 8px;
      color: var(--faint);
    }

    /* Sections */
    .section-title {
      font-size: 11px;
      letter-spacing: 0.18em;
      text-transform: uppercase;
      font-weight: 700;
      margin: 0 0 14px;
      padding-bottom: 10px;
      border-bottom: 1px solid var(--ink);
    }

    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
      margin-bottom: 36px;
    }
    thead th {
      text-align: left;
      font-size: 9px;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      color: var(--faint);
      font-weight: 600;
      padding: 0 10px 10px 0;
      border-bottom: 1px solid var(--line);
    }
    thead th.num { text-align: right; padding-right: 0; padding-left: 10px; }
    tbody td {
      padding: 14px 10px 14px 0;
      border-bottom: 1px solid var(--line);
      vertical-align: top;
    }
    tbody td.num { text-align: right; padding-right: 0; padding-left: 10px; font-variant-numeric: tabular-nums; }
    tbody tr.alt { background: transparent; }
    .comp-addr { font-weight: 600; color: var(--ink); }
    .comp-meta { font-size: 11px; color: var(--faint); margin-top: 3px; }
    .strong { font-weight: 700; }
    .muted { color: var(--faint); }
    .pos { color: var(--pos); }
    .neg { color: var(--neg); }

    .notes {
      margin: 0 0 40px;
      padding-left: 18px;
      font-size: 12.5px;
      color: var(--ink-soft);
    }
    .notes li { margin-bottom: 6px; padding-left: 4px; }
    .notes li::marker { color: var(--faint); }

    /* Agent footer — Compass style contact */
    .agent-bar {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 24px;
      align-items: end;
      padding: 24px 0 0;
      border-top: 1px solid var(--ink);
      margin-top: 8px;
    }
    .agent-name {
      font-size: 16px;
      font-weight: 600;
      letter-spacing: -0.01em;
    }
    .agent-role {
      font-size: 11px;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: var(--muted);
      margin-top: 3px;
    }
    .agent-contact {
      margin-top: 10px;
      font-size: 12px;
      color: var(--ink-soft);
      line-height: 1.55;
    }
    .agent-contact a { color: inherit; text-decoration: none; border-bottom: 1px solid var(--line); }
    .prepared {
      text-align: right;
      font-size: 11px;
      color: var(--faint);
      line-height: 1.55;
    }
    .disclaimer {
      margin-top: 28px;
      font-size: 10px;
      color: var(--faint);
      line-height: 1.5;
      max-width: 62ch;
    }

    @media (max-width: 720px) {
      .sheet { margin: 0; padding: 28px 20px 32px; box-shadow: none; }
      .valuation { grid-template-columns: 1fr; gap: 22px; }
      .address { font-size: 26px; }
      .indicated-value { font-size: 36px; }
      .agent-bar { grid-template-columns: 1fr; }
      .prepared { text-align: left; }
    }

    @media print {
      body { background: #fff; }
      .sheet {
        margin: 0;
        max-width: none;
        box-shadow: none;
        padding: 0.4in 0.5in;
      }
      .no-print { display: none !important; }
      .toolbar { display: none !important; }
      tbody tr { break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="toolbar no-print">
    <button type="button" class="secondary" onclick="window.close()">Close</button>
    <button type="button" onclick="window.print()">Print / Save as PDF</button>
  </div>

  <div class="sheet">
    <header class="topbar">
      <div class="wordmark">
        <div class="mark">${escapeHtml(logo)}</div>
        <div class="broker">${escapeHtml(brokerage)}</div>
      </div>
      <div class="doc-label">
        Document
        <strong>Comparative Market Analysis</strong>
      </div>
    </header>

    <div class="eyebrow">Subject property</div>
    <h1 class="address">${escapeHtml(subject.address)}</h1>
    <div class="chips">${metaChips(subject) || '<span class="chip">Property</span>'}</div>

    <section class="valuation">
      <div>
        <div class="indicated-label">Indicated value</div>
        <div class="indicated-value">${money(result.indicatedValue)}</div>
        <p class="indicated-sub">
          Reconciled from score-weighted comparables${result.confidence != null ? ` · ${Math.round(result.confidence * 100)}% confidence` : ''}.
          Planning-grade analysis for pricing strategy.
        </p>
      </div>
      <div class="side-metrics">
        <div class="metric"><label>Weighted mean</label><div class="v">${money(weightedMean)}</div></div>
        <div class="metric"><label>Median</label><div class="v">${money(medianValue)}</div></div>
        <div class="metric"><label>Range low</label><div class="v">${money(result.low)}</div></div>
        <div class="metric"><label>Range high</label><div class="v">${money(result.high)}</div></div>
      </div>
    </section>

    ${
      marketLineParts.length
        ? `<div class="market-strip">${marketLineParts.map((p) => `<span>${p}</span>`).join('')}</div>`
        : ''
    }

    <h2 class="section-title">Adjusted comparables</h2>
    <table>
      <thead>
        <tr>
          <th>Address</th>
          <th class="num">Sale / list</th>
          <th class="num">Net adj</th>
          <th class="num">Adjusted</th>
          <th class="num">Score</th>
        </tr>
      </thead>
      <tbody>
        ${compsRows || '<tr><td colspan="5" class="muted">No comps selected</td></tr>'}
      </tbody>
    </table>

    <h2 class="section-title">Analysis notes</h2>
    <ul class="notes">${notes || '<li>No notes</li>'}</ul>

    <footer class="agent-bar">
      <div>
        <div class="agent-name">${escapeHtml(agent)}</div>
        <div class="agent-role">${escapeHtml(brokerage)} · Agent</div>
        <div class="agent-contact">
          <a href="tel:${phone.replace(/[^0-9]/g, '')}">${escapeHtml(phone)}</a><br/>
          <a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a>
        </div>
      </div>
      <div class="prepared">
        Prepared ${date}<br/>
        Method: ${escapeHtml(result.method || 'weighted comps')}<br/>
        Eastern Idaho
      </div>
    </footer>

    <p class="disclaimer">
      This comparative market analysis is a planning tool prepared with Voxli.dev for internal pricing strategy.
      It is not a formal appraisal and should not be relied upon as a certified valuation of real property.
    </p>
  </div>

  <script class="no-print">
    window.addEventListener('load', function () {
      setTimeout(function () {
        try { window.print(); } catch (e) {}
      }, 400);
    });
  </script>
</body>
</html>`;
}

/**
 * Open a print-ready CMA in a new tab, or download HTML if popups are blocked.
 * Do NOT pass `noopener` in window.open features — browsers return null Window.
 */
export function exportCmaPdf(result: CmaResult, opts?: CmaExportOptions): CmaExportMode {
  if (typeof window === 'undefined') {
    throw new Error('Export is only available in the browser');
  }
  if (!result?.subject?.address) {
    throw new Error('Run CMA first — no result to export');
  }

  const html = buildCmaHtml(result, opts);
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  const w = window.open(url, '_blank', 'width=960,height=1200');
  if (w) {
    try {
      w.focus();
    } catch {
      /* ignore */
    }
    setTimeout(() => URL.revokeObjectURL(url), 120_000);
    return 'print-window';
  }

  try {
    const a = document.createElement('a');
    a.href = url;
    a.download = `CMA-${safeFilename(result.subject.address)}.html`;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 120_000);
    return 'download';
  } catch {
    URL.revokeObjectURL(url);
    throw new Error('Could not open or download CMA. Allow popups for this site, then try again.');
  }
}
