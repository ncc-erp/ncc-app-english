import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { pgDb } from '@/lib/db/postgres';
import { checkIsClanAdmin } from '@/lib/admin/clan-data-service';
import { MeetingParticipant } from '@/types/meeting';

async function isAdmin(): Promise<boolean> {
	const session = await getSession();
	const user = session.user;
	if (!user || !user.isLoggedIn) return false;
	return checkIsClanAdmin(user.mezon_id);
}

// POST /api/admin/meetings/[id]/assign - Assign participants and/or a room to an existing meeting.
// Body: { participants?: Omit<MeetingParticipant, 'joined_at'>[], room_id?: string, room_name?: string }
// Either field can be sent alone (e.g. assign people first, assign the room later).
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
	try {
		if (!(await isAdmin())) {
			return NextResponse.json({ success: false, error: 'Unauthorized. Admin privileges required.' }, { status: 403 });
		}

		const { id } = await params;
		const existing = await pgDb.getMeeting(id);
		if (!existing) {
			return NextResponse.json({ success: false, error: 'Meeting not found' }, { status: 404 });
		}

		const body = await req.json();
		const participants: Omit<MeetingParticipant, 'joined_at'>[] | undefined = body?.participants;
		const roomId: string | undefined = body?.room_id;
		const roomName: string | undefined = body?.room_name;

		if (!participants?.length && !roomId) {
			return NextResponse.json({ success: false, error: 'Provide participants and/or room_id to assign.' }, { status: 400 });
		}

		if (participants?.length) {
			for (const p of participants) {
				if (!p.mezon_id || !p.display_name) {
					return NextResponse.json({ success: false, error: 'Each participant needs mezon_id and display_name.' }, { status: 400 });
				}
			}
			await pgDb.assignMeetingParticipants(id, participants);
		}

		if (roomId) {
			await pgDb.assignMeetingRoom(id, roomId, roomName || roomId);
		}

		const meeting = await pgDb.getMeeting(id);
		return NextResponse.json({ success: true, meeting });
	} catch (error) {
		console.error('[Admin Meeting Assign POST Error]:', error);
		return NextResponse.json({ success: false, error: 'Failed to assign meeting' }, { status: 500 });
	}
}
