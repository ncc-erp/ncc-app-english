import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { pgDb } from '@/lib/db/postgres';

async function isAdmin(): Promise<boolean> {
  const session = await getSession();
  const user = session.user;
  return Boolean(user?.isLoggedIn && (user?.mezon_username === 'admin' || user?.mezon_id === 'admin_sys_001'));
}

// PUT /api/admin/topics/[id] - Update an existing topic set
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!(await isAdmin())) {
      return NextResponse.json({ success: false, error: 'Unauthorized. Admin privileges required.' }, { status: 403 });
    }

    const { id } = await params;
    const body = await req.json();

    const updatedTopic = await pgDb.updateIELTSTopic(id, body);

    if (!updatedTopic) {
      return NextResponse.json({ success: false, error: 'Topic not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, topic: updatedTopic });
  } catch (error) {
    console.error('[Admin Topic PUT Error]:', error);
    return NextResponse.json({ success: false, error: 'Failed to update topic' }, { status: 500 });
  }
}

// DELETE /api/admin/topics/[id] - Remove a topic set
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!(await isAdmin())) {
      return NextResponse.json({ success: false, error: 'Unauthorized. Admin privileges required.' }, { status: 403 });
    }

    const { id } = await params;
    const deleted = await pgDb.deleteIELTSTopic(id);

    if (!deleted) {
      return NextResponse.json({ success: false, error: 'Topic not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: 'Topic deleted successfully' });
  } catch (error) {
    console.error('[Admin Topic DELETE Error]:', error);
    return NextResponse.json({ success: false, error: 'Failed to delete topic' }, { status: 500 });
  }
}
