import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { pgDb } from '@/lib/db/postgres';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { username, password } = body || {};

    if (!username || !password) {
      return NextResponse.json({ success: false, error: 'Tên đăng nhập và mật khẩu là bắt buộc' }, { status: 400 });
    }

    const trimmedUsername = username.trim();

    // Verify Admin Credentials
    if (trimmedUsername === 'admin' && password === 'P@s5w0rd!') {
      const userSession = await pgDb.findOrCreateUser({
        mezon_id: 'admin_sys_001',
        username: 'admin',
        display_name: 'Administrator',
        avatar_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
      });

      const session = await getSession();
      session.user = userSession;
      await session.save();

      return NextResponse.json({ success: true, user: userSession });
    }

    // Default error for invalid credentials
    return NextResponse.json(
      { success: false, error: 'Tên đăng nhập hoặc mật khẩu không chính xác' },
      { status: 401 }
    );
  } catch (error) {
    console.error('[Login Password Error]:', error);
    return NextResponse.json({ success: false, error: 'Đã xảy ra lỗi hệ thống' }, { status: 500 });
  }
}
