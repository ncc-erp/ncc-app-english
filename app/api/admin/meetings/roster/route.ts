import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { pgDb } from '@/lib/db/postgres';
import { checkIsClanAdmin } from '@/lib/admin/clan-data-service';

// GET /api/admin/meetings/roster - Cached Student/Teacher roster synced from the Mezon clan bot.
// Empty until the bot sync job has run at least once; the assign-people dropdown just shows nothing yet.
export async function GET() {
	try {
		const session = await getSession();
		const user = session.user;
		if (!user || !user.isLoggedIn || !(await checkIsClanAdmin(user.mezon_id))) {
			return NextResponse.json({ success: false, error: 'Unauthorized. Admin privileges required.' }, { status: 403 });
		}

		const roster = await pgDb.getMeetingRosterCache();
		return NextResponse.json({ success: true, roster });
	} catch (error) {
		console.error('[Admin Meeting Roster GET Error]:', error);
		return NextResponse.json({ success: false, error: 'Failed to fetch synced roster' }, { status: 500 });
	}
}
