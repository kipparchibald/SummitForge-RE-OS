/**
 * One-click professional CMA export (print / PDF-ready HTML).
 * MoxiWorks-style branded presentation for Archibald-Bagley.
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

export function buildCmaHtml(result: CmaResult, opts: CmaExportOptions = {}): string {
  const agent = opts.agentName || 'Kipp Archibald';
  const brokerage = opts.brokerage || 'Archibald-Bagley Real Estate';
  const phone = opts.phone || '(208) 521-2751';
  const email = opts.email || 'kipp@archibaldbagley.com';
  const logo = opts.logoText || 'SF';
  const date = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const subject = result.subject;
  const mf = result.marketFactors;
  const weightedMean = result.weightedMean ?? result.indicatedValue;
  const medianValue = result.medianValue ?? result.indicatedValue;

  const compsRows = result.comps
    .map(
      (c) => `
    <tr>
      <td>
        <strong>${escapeHtml(c.address)}</strong><br/>
        <span class="muted">${escapeHtml(c.propertyType || '')}${c.acres ? ` · ${c.acres} ac` : c.sqft ? ` · ${c.sqft} sqft` : ''}${c.monthsSinceSale != null ? ` · ${c.monthsSinceSale} mo ago` : ''}</span>
      </td>
      <td class="num">${money(c.price)}</td>
      <td class="num ${c.netAdjustment >= 0 ? 'pos' : 'neg'}">${c.netAdjustment >= 0 ? '+' : ''}${money(c.netAdjustment)}</td>
      <td class="num"><strong>${money(c.adjustedPrice)}</strong></td>
      <td class="num">${Math.round(c.score * 100)}%</td>
    </tr>`
    )
    .join('');

  const notes = result.notes.map((n) => `<li>${escapeHtml(n)}</li>`).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>CMA — ${escapeHtml(subject.address)} | ${escapeHtml(brokerage)}</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; color: #0f172a; margin: 0; padding: 32px; line-height: 1.45; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #059669; padding-bottom: 20px; margin-bottom: 28px; }
    .logo { width: 48px; height: 48px; background: #059669; color: #fff; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 18px; }
    .brand h1 { margin: 0; font-size: 20px; }
    .brand p { margin: 4px 0 0; color: #64748b; font-size: 13px; }
    .meta { text-align: right; font-size: 13px; color: #64748b; }
    h2 { font-size: 16px; margin: 28px 0 12px; color: #0f172a; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px; }
    .hero { background: linear-gradient(135deg, #ecfdf5 0%, #f8fafc 100%); border: 1px solid #a7f3d0; border-radius: 16px; padding: 20px 24px; margin-bottom: 24px; }
    .hero .addr { font-size: 18px; font-weight: 600; }
    .stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin: 20px 0; }
    .stat { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px; }
    .stat.accent { background: #ecfdf5; border-color: #a7f3d0; }
    .stat label { display: block; font-size: 10px; text-transform: uppercase; letter-spacing: 0.06em; color: #64748b; }
    .stat value { display: block; font-size: 18px; font-weight: 700; margin-top: 4px; font-variant-numeric: tabular-nums; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th { text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em; color: #64748b; padding: 8px 10px; border-bottom: 2px solid #e2e8f0; }
    td { padding: 10px; border-bottom: 1px solid #f1f5f9; vertical-align: top; }
    .num { text-align: right; font-variant-numeric: tabular-nums; }
    .pos { color: #047857; }
    .neg { color: #be123c; }
    .muted { color: #94a3b8; font-size: 11px; }
    ul { margin: 8px 0; padding-left: 18px; font-size: 12px; color: #475569; }
    .footer { margin-top: 36px; padding-top: 16px; border-top: 1px solid #e2e8f0; font-size: 11px; color: #94a3b8; display: flex; justify-content: space-between; }
    @media print {
      body { padding: 16px; }
      .no-print { display: none !important; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div style="display:flex;gap:14px;align-items:center">
      <div class="logo">${escapeHtml(logo)}</div>
      <div class="brand">
        <h1>Comparative Market Analysis</h1>
        <p>${escapeHtml(brokerage)} · Eastern Idaho</p>
      </div>
    </div>
    <div class="meta">
      <div><strong>${escapeHtml(agent)}</strong></div>
      <div>${escapeHtml(phone)}</div>
      <div>${escapeHtml(email)}</div>
      <div style="margin-top:6px">${date}</div>
    </div>
  </div>

  <div class="hero">
    <div class="addr">${escapeHtml(subject.address)}</div>
    <div class="muted" style="margin-top:6px">
      ${subject.propertyType ? escapeHtml(subject.propertyType) : 'Property'}
      ${subject.acres ? ` · ${subject.acres} acres` : ''}
      ${subject.sqft ? ` · ${subject.sqft.toLocaleString()} sqft` : ''}
      ${subject.yearBuilt ? ` · Built ${subject.yearBuilt}` : ''}
      ${subject.pin ? ` · PIN ${escapeHtml(subject.pin)}` : ''}
    </div>
  </div>

  <div class="stats">
    <div class="stat accent"><label>Indicated (reconciled)</label><value>${money(result.indicatedValue)}</value></div>
    <div class="stat"><label>Weighted mean</label><value>${money(weightedMean)}</value></div>
    <div class="stat"><label>Median</label><value>${money(medianValue)}</value></div>
    <div class="stat"><label>Range low</label><value>${money(result.low)}</value></div>
    <div class="stat"><label>Range high</label><value>${money(result.high)}</value></div>
    <div class="stat"><label>Confidence</label><value>${Math.round(result.confidence * 100)}%</value></div>
  </div>

  <p style="font-size:13px;color:#475569">
    ${mf ? `Market: <strong>$${mf.dollarsPerSqFt}/sqft</strong> (n=${mf.sqftSample}) · <strong>$${mf.dollarsPerAcre.toLocaleString()}/acre</strong> (n=${mf.acreSample}) · time drift <strong>${(mf.monthlyDrift * 100).toFixed(2)}%/mo</strong> · ` : ''}
    ${result.perAcre != null ? `<strong>$${result.perAcre.toLocaleString()}</strong>/acre subject · ` : ''}
    ${result.perSqFt != null ? `<strong>$${result.perSqFt}</strong>/sqft subject · ` : ''}
    ${subject.assessedValue != null ? `County assessed: <strong>${money(subject.assessedValue)}</strong>` : ''}
  </p>

  <h2>Adjusted comparables</h2>
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
      ${compsRows || '<tr><td colspan="5">No comps selected</td></tr>'}
    </tbody>
  </table>

  <h2>Analysis notes</h2>
  <ul>${notes}</ul>

  <div class="footer">
    <div>Prepared with SummitForge · Method: ${escapeHtml(result.method)}</div>
    <div>Planning-grade analysis — not a formal appraisal</div>
  </div>

  <script class="no-print">
    window.onload = function () {
      setTimeout(function () { window.print(); }, 400);
    };
  </script>
</body>
</html>`;
}

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, '&')
    .replace(/</g, '<')
    .replace(/>/g, '>')
    .replace(/"/g, '"');
}

export function exportCmaPdf(result: CmaResult, opts?: CmaExportOptions): void {
  if (typeof window === 'undefined') return;
  const html = buildCmaHtml(result, opts);
  const w = window.open('', '_blank', 'noopener,noreferrer,width=900,height=1100');
  if (!w) {
    console.warn('[CMA export] Popup blocked — allow popups to export PDF');
    return;
  }
  w.document.open();
  w.document.write(html);
  w.document.close();
}
