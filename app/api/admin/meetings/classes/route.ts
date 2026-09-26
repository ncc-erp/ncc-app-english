import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { checkIsClanAdmin, listMeetingClassChannels } from '@/lib/admin/clan-data-service';

// GET /api/admin/meetings/classes - Text channels ("Lớp cơ bản", "Lớp nâng cao", ...) that can
// be picked in the create/assign UI to narrow the people list to that channel's members.
export async function GET() {
	try {
		const session = await getSession();
		const user = session.user;
		if (!user || !user.isLoggedIn || !(await checkIsClanAdmin(user.mezon_id))) {
			return NextResponse.json({ success: false, error: 'Unauthorized. Admin privileges required.' }, { status: 403 });
		}

		const classes = await listMeetingClassChannels();
		return NextResponse.json(
			{ success: true, classes },
			{ headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate' } }
		);
	} catch (error) {
		console.error('[Admin Meeting Classes GET Error]:', error);
		return NextResponse.json({ success: false, error: 'Failed to list class channels' }, { status: 500 });
	}
}
