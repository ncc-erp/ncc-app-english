import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { pgDb } from '@/lib/db/postgres';

const ADMIN_MEZON_ID = 'admin_sys_001';

// Compare via SHA-256 digests so the inputs are always the same length,
// then timing-safe compare. Avoids leaking the password through timing.
function secretsMatch(a: string, b: string): boolean {
  const digestA = crypto.createHash('sha256').update(a).digest();
  const digestB = crypto.createHash('sha256').update(b).digest();
  return crypto.timingSafeEqual(digestA, digestB);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { username, password } = body || {};

    if (!username || !password) {
      return NextResponse.json({ success: false, error: 'Username and password are required.' }, { status: 400 });
    }

    const adminUsername = process.env.ADMIN_USERNAME?.trim();
    const adminPassword = process.env.ADMIN_PASSWORD;

    if (!adminUsername || !adminPassword) {
      console.error('[Login Password] ADMIN_USERNAME / ADMIN_PASSWORD are not configured.');
      return NextResponse.json(
        { success: false, error: 'Password login is not configured on this deployment.' },
        { status: 503 }
      );
    }

    const trimmedUsername = String(username).trim();

    if (!secretsMatch(trimmedUsername, adminUsername) || !secretsMatch(String(password), adminPassword)) {
      return NextResponse.json({ success: false, error: 'Invalid username or password.' }, { status: 401 });
    }

    const userSession = await pgDb.findOrCreateUser({
      mezon_id: ADMIN_MEZON_ID,
      username: adminUsername,
      display_name: 'Administrator',
    });

    // The admin role lives in the DB, never in the username
    await pgDb.setUserRole(ADMIN_MEZON_ID, 'admin');
    userSession.role = 'admin';

    const session = await getSession();
    session.user = userSession;
    await session.save();

    return NextResponse.json({ success: true, user: userSession });
  } catch (error) {
    console.error('[Login Password Error]:', error);
    return NextResponse.json({ success: false, error: 'System error occurred. Please try again later.' }, { status: 500 });
  }
}
