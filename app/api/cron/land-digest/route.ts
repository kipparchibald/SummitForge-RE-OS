import { NextRequest, NextResponse } from 'next/server';
import { scanLandDeals } from '@/lib/development/land-scan';
import { getSupabaseAdmin } from '@/lib/supabase/client';
import { authorizeCron } from '@/lib/auth/cron';

export const dynamic = 'force-dynamic';

/**
 * Nightly land-deal digest. Same cron-auth pattern as sync-navica:
 * secured by CRON_SECRET when set; open in DEMO/local. Vercel injects the Bearer header.
 *
 * Persists the day's penciling deals to Supabase ('land_deals', upsert) and,
 * if RESEND_API_KEY + DIGEST_TO + DIGEST_FROM are set, emails a digest.
 */
export async function GET(request: NextRequest) {
  // Fail-closed in production; open only in demo mode. See lib/auth/cron.ts.
  if (!authorizeCron(request).ok) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const result = await scanLandDeals({ minAcres: 5 });

    // Persist (graceful — table may not exist yet)
    try {
      const rows = result.penciling.map(d => ({
        external_id: d.id || `${(d.address || '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 30)}-${Math.round(d.price)}`,
        address: d.address, county: d.county, acres: d.acres, lots: d.lots,
        list_price: d.price, max_offer: d.maxOffer, spread: d.spread, verdict: d.verdict,
        scanned_at: result.scannedAt, raw: d,
      }));
      if (rows.length) await getSupabaseAdmin().from('land_deals').upsert(rows, { onConflict: 'external_id' });
    } catch (e: any) { console.log('[land-digest] persist skipped:', e?.message); }

    // Optional email digest via Resend (no SDK needed)
    const key = process.env.RESEND_API_KEY, to = process.env.DIGEST_TO, from = process.env.DIGEST_FROM;
    let emailed = false;
    if (key && to && from && result.penciling.length) {
      const esc = (s: any) => String(s ?? '').replace(/[&<>"']/g, (c) => (
        { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string
      ));
      const rowsHtml = result.penciling.slice(0, 25).map((d, i) => `
        <tr style="background:${i % 2 ? '#f2f6f8' : '#fff'}">
          <td style="padding:6px 8px">${esc(d.address)}</td><td style="padding:6px 8px">${esc(d.county)}</td>
          <td style="padding:6px 8px;text-align:right">${d.acres} ac</td><td style="padding:6px 8px;text-align:right">${d.lots}</td>
          <td style="padding:6px 8px;text-align:right">$${Math.round(d.price).toLocaleString()}</td>
          <td style="padding:6px 8px;text-align:right">$${Math.round(d.maxOffer).toLocaleString()}</td>
          <td style="padding:6px 8px;text-align:right;color:${d.spread >= 0 ? '#3d6b3d' : '#a33'};font-weight:700">
            ${d.spread >= 0 ? '+' : '-'}$${Math.abs(Math.round(d.spread)).toLocaleString()}</td></tr>`).join('');
      const html = `<div style="font-family:Arial,sans-serif;color:#222;max-width:720px">
        <h2 style="color:#1F4E5F;margin-bottom:2px">SummitForge — Land Deals That Pencil</h2>
        <p style="color:#666;font-size:13px;margin-top:0">${new Date(result.scannedAt).toLocaleString()} · ${result.listingsScanned} scanned · <b>${result.penciling.length} pencil</b></p>
        <table style="border-collapse:collapse;width:100%;font-size:13px;border:1px solid #ddd">
        <thead><tr style="background:#1F4E5F;color:#fff">
        <th style="padding:6px 8px;text-align:left">Listing</th><th style="padding:6px 8px;text-align:left">County</th>
        <th style="padding:6px 8px">Acres</th><th style="padding:6px 8px">Lots</th><th style="padding:6px 8px">List</th>
        <th style="padding:6px 8px">Max offer</th><th style="padding:6px 8px">Spread</th></tr></thead>
        <tbody>${rowsHtml}</tbody></table>
        <p style="color:#888;font-size:11px">Planning-grade — verify with SOLD comps, a PLS/PE, and county P&amp;Z before offering.</p></div>`;
      try {
        const r = await fetch('https://api.resend.com/emails', {
          method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ from, to: to.split(',').map(s => s.trim()),
            subject: `SummitForge land digest — ${result.penciling.length} deals pencil`, html }),
        });
        emailed = r.ok;
      } catch (e: any) { console.log('[land-digest] email skipped:', e?.message); }
    }

    return NextResponse.json({
      success: true, source: result.source, scanned: result.listingsScanned,
      penciling: result.penciling.length, emailed,
    });
  } catch (error: any) {
    console.error('[land-digest] failed:', error);
    return NextResponse.json({ success: false, error: 'Land digest failed' }, { status: 500 });
  }
}
