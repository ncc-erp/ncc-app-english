import { NextRequest, NextResponse } from 'next/server';
import { parseMezonHashData, validateMezonHash } from '@/lib/mezon/hash-verifier';
import { getSession } from '@/lib/auth/session';
import { pgDb } from '@/lib/db/postgres';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { hashData } = body;

    if (!hashData) {
      return NextResponse.json({ success: false, error: 'Missing hashData' }, { status: 400 });
    }

    // Decode base64 if needed
    let rawHashData = hashData;
    try {
      if (!hashData.includes('user=') && !hashData.includes('&hash=')) {
        rawHashData = Buffer.from(hashData, 'base64').toString('utf-8');
      }
    } catch {
      rawHashData = hashData;
    }

    const appSecret = process.env.MEZON_APP_SECRET || '';
    // Fail closed: without a secret we cannot tell a real Mezon payload from a forged one
    if (!appSecret || appSecret === 'your_mezon_app_secret') {
      console.error('[POST /api/auth/mezon-hash] MEZON_APP_SECRET is not configured; refusing hash auth.');
      return NextResponse.json(
        { success: false, error: 'Mezon hash authentication is not configured on this deployment.' },
        { status: 503 }
      );
    }

    if (!validateMezonHash(appSecret, rawHashData)) {
      return NextResponse.json({ success: false, error: 'Invalid hash signature' }, { status: 401 });
    }

    const parsed = parseMezonHashData(rawHashData);
    if (!parsed || !parsed.user) {
      return NextResponse.json({ success: false, error: 'Failed to parse user data' }, { status: 400 });
    }

    const mezonId = String(parsed.user.user_id || parsed.user.id || parsed.user.mezon_id);
    const username = parsed.user.username || `user_${mezonId}`;
    const displayName = parsed.user.display_name || username;
    const avatarUrl = parsed.user.avatar || parsed.user.avatar_url;

    // Find or create user
    const userSession = await pgDb.findOrCreateUser({
      mezon_id: mezonId,
      username,
      display_name: displayName,
      avatar_url: avatarUrl,
    });

    // Save session
    const session = await getSession();
    session.user = userSession;
    await session.save();

    return NextResponse.json({
      success: true,
      user: userSession,
    });
  } catch (error) {
    console.error('[POST /api/auth/mezon-hash] Error:', error);
    return NextResponse.json({ success: false, error: 'Internal auth error' }, { status: 500 });
  }
}
