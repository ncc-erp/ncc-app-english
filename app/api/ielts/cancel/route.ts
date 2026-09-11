import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { pgDb } from '@/lib/db/postgres';

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session.user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    let attemptId = '';
    try {
      const body = await req.json();
      attemptId = body.attemptId;
    } catch {
      const text = await req.text();
      if (text) {
        try {
          const parsed = JSON.parse(text);
          attemptId = parsed.attemptId;
        } catch {
          // ignore
        }
      }
    }

    if (attemptId) {
      // Scoped to the session user: nobody can cancel someone else's test
      await pgDb.cancelIELTSAttempt(attemptId, session.user.user_id);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ success: false, error: (err as Error).message }, { status: 500 });
  }
}
