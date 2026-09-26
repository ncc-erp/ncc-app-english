import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { checkIsClanAdmin, getMeetingClassRoster } from '@/lib/admin/clan-data-service';

// GET /api/admin/meetings/classes/[channelId] - Student/Teacher roster narrowed to members of
// that one text channel (e.g. only people in "Lớp nâng cao").
export async function GET(_req: NextRequest, { params }: { params: Promise<{ channelId: string }> }) {
	try {
		const session = await getSession();
		const user = session.user;
		if (!user || !user.isLoggedIn || !(await checkIsClanAdmin(user.mezon_id))) {
			return NextResponse.json({ success: false, error: 'Unauthorized. Admin privileges required.' }, { status: 403 });
		}

		const { channelId } = await params;
		const roster = await getMeetingClassRoster(channelId);
		return NextResponse.json(
			{ success: true, roster },
			{ headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate' } }
		);
	} catch (error) {
		console.error('[Admin Meeting Class Roster GET Error]:', error);
		return NextResponse.json({ success: false, error: 'Failed to fetch class roster' }, { status: 500 });
	}
}
