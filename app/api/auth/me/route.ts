import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { checkIsClanAdmin } from '@/lib/admin/clan-data-service';

export async function GET() {
  const session = await getSession();

  if (!session.user) {
    return NextResponse.json({ isLoggedIn: false });
  }

  const isClanAdmin = await checkIsClanAdmin(session.user.mezon_id);

  return NextResponse.json({
    isLoggedIn: true,
    user: {
      ...session.user,
      role: isClanAdmin ? 'admin' : 'user',
    },
  });
}

