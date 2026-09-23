import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { pgDb } from '@/lib/db/postgres';
import { checkIsClanAdmin } from '@/lib/admin/clan-data-service';

// GET /api/admin/meetings/rooms - Cached room list synced from the Mezon clan bot.
// Empty until the bot sync job has run at least once; the assign-room dropdown just shows nothing yet.
export async function GET() {
	try {
		const session = await getSession();
		const user = session.user;
		if (!user || !user.isLoggedIn || !(await checkIsClanAdmin(user.mezon_id))) {
			return NextResponse.json({ success: false, error: 'Unauthorized. Admin privileges required.' }, { status: 403 });
		}

		const rooms = await pgDb.getMeetingRoomsCache();
		return NextResponse.json({ success: true, rooms });
	} catch (error) {
		console.error('[Admin Meeting Rooms GET Error]:', error);
		return NextResponse.json({ success: false, error: 'Failed to fetch synced rooms' }, { status: 500 });
	}
}
