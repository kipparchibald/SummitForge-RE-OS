import { NextRequest, NextResponse } from 'next/server';
import { TransactionCoordinator, type Transaction } from '@/lib/transaction/coordinator';
import { rateLimit, rateLimitResponse } from '@/lib/security/rateLimit';
import {
  clampString,
  guardErrorResponse,
  readJsonBody,
  RequestGuardError,
} from '@/lib/security/request';

const transactionCoordinator = new TransactionCoordinator();

const STATUSES = new Set<Transaction['status']>([
  'new',
  'under_contract',
  'inspection',
  'appraisal',
  'lending',
  'title',
  'closing',
  'closed',
]);

export async function POST(request: NextRequest) {
  const rl = rateLimit(request, { limit: 40, windowMs: 60_000, key: 'ai-tx' });
  if (!rl.ok) return rateLimitResponse(rl);

  try {
    const body = await readJsonBody<{
      action?: string;
      data?: { dealId?: string; status?: string; [k: string]: unknown };
    }>(request, 64 * 1024);

    const action = clampString(body.action, 64);
    const data = body.data || {};

    if (action === 'docusign') {
      const result = await transactionCoordinator.sendForSignature(data as any);
      return NextResponse.json(result);
    }

    const dealId = clampString(data.dealId || 'demo', 128) || 'demo';
    const rawStatus = clampString(data.status || 'under_contract', 64) || 'under_contract';
    if (!STATUSES.has(rawStatus as Transaction['status'])) {
      throw new RequestGuardError('Invalid transaction status');
    }
    const status = rawStatus as Transaction['status'];
    transactionCoordinator.updateStatus(dealId, status);
    return NextResponse.json({ success: true, dealId, status });
  } catch (error) {
    if (error instanceof RequestGuardError) return guardErrorResponse(error);
    return NextResponse.json({ error: 'Transaction assistant error' }, { status: 500 });
  }
}
