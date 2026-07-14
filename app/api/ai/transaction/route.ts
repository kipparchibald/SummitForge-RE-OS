import { NextRequest, NextResponse } from 'next/server';
import { TransactionCoordinator } from '@/lib/transaction/coordinator';

const transactionCoordinator = new TransactionCoordinator();

export async function POST(request: NextRequest) {
  try {
    const { action, data } = await request.json();
    if (action === 'docusign') {
      const result = await transactionCoordinator.sendForSignature(data);
      return NextResponse.json(result);
    }
    const result = await transactionCoordinator.updateStatus(data.dealId || 'demo', data.status || 'under_contract');
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: 'Transaction assistant error' }, { status: 500 });
  }
}
