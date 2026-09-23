import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { pgDb } from '@/lib/db/postgres';
import { checkIsClanAdmin } from '@/lib/admin/clan-data-service';

async function isAdmin(): Promise<boolean> {
	const session = await getSession();
	const user = session.user;
	if (!user || !user.isLoggedIn) return false;
	return checkIsClanAdmin(user.mezon_id);
}

// GET /api/admin/meetings/[id] - Full meeting detail, including every participant (not just the preview)
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
	try {
		if (!(await isAdmin())) {
			return NextResponse.json({ success: false, error: 'Unauthorized. Admin privileges required.' }, { status: 403 });
		}

		const { id } = await params;
		const meeting = await pgDb.getMeeting(id);

		if (!meeting) {
			return NextResponse.json({ success: false, error: 'Meeting not found' }, { status: 404 });
		}

		return NextResponse.json({ success: true, meeting });
	} catch (error) {
		console.error('[Admin Meeting GET Error]:', error);
		return NextResponse.json({ success: false, error: 'Failed to fetch meeting' }, { status: 500 });
	}
}
