import { auth } from '@/lib/auth';
import { getBillingStatusForClient } from '@/actions/billing';
import { NextResponse } from 'next/server';

export async function GET() {
  const session = await auth();
  if (!session?.user?.organizationId || session.user.isSuperAdmin) {
    return NextResponse.json({ ok: false, error: 'Yetkisiz.' }, { status: 401 });
  }

  const status = await getBillingStatusForClient(session.user.organizationId);

  return NextResponse.json({
    ok: true,
    data: status,
  });
}
