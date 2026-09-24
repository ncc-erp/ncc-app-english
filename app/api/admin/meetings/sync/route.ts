import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { checkIsClanAdmin } from '@/lib/admin/clan-data-service';
import { pgDb } from '@/lib/db/postgres';
import { getSharedBotClient } from '@/lib/bot/bot-messenger';
import { fullSyncMeetingRooms, fullSyncMeetingRoster } from '@/lib/bot/meeting-sync';

// POST /api/admin/meetings/sync - refresh the assign-room and assign-people options from Mezon now.
export async function POST() {
	try {
		const session = await getSession();
		const user = session.user;
		if (!user || !user.isLoggedIn || !(await checkIsClanAdmin(user.mezon_id))) {
			return NextResponse.json({ success: false, error: 'Unauthorized. Admin privileges required.' }, { status: 403 });
		}

		const client = await getSharedBotClient();
		if (!client) {
			return NextResponse.json({ success: false, error: 'The Mezon bot is unavailable. Try again after it connects.' }, { status: 503 });
		}

		await Promise.all([fullSyncMeetingRooms(client), fullSyncMeetingRoster(client)]);
		const [rooms, roster] = await Promise.all([pgDb.getMeetingRoomsCache(), pgDb.getMeetingRosterCache()]);

		return NextResponse.json(
			{ success: true, rooms, roster },
			{ headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate' } }
		);
	} catch (error) {
		console.error('[Admin Meeting Sync POST Error]:', error);
		return NextResponse.json({ success: false, error: 'Failed to synchronize Meeting data from Mezon.' }, { status: 500 });
	}
}
