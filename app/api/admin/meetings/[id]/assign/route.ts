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
// Body: { participants?: Omit<MeetingParticipant, 'joined_at'>[], room_id?: string, room_name?: string, replace_participants?: boolean }
// replace_participants opts into removal of deselected people; empty room_id clears the room.
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

		const body = await req.json().catch(() => null);
		const participants: Omit<MeetingParticipant, 'joined_at'>[] | undefined = body?.participants;
		const roomId: string | undefined = body?.room_id;
		const roomName: string | undefined = body?.room_name;

		if (!body || (participants === undefined && roomId === undefined)) {
			return NextResponse.json({ success: false, error: 'Provide participants and/or room_id to assign.' }, { status: 400 });
		}

		if (
			(participants !== undefined && !Array.isArray(participants)) ||
			(roomId !== undefined && typeof roomId !== 'string') ||
			(roomName !== undefined && typeof roomName !== 'string') ||
			(body.replace_participants !== undefined && typeof body.replace_participants !== 'boolean')
		) {
			return NextResponse.json({ success: false, error: 'Invalid assignment data.' }, { status: 400 });
		}
		if (participants) {
			for (const p of participants) {
				if (
					!p ||
					typeof p.mezon_id !== 'string' ||
					!p.mezon_id.trim() ||
					typeof p.display_name !== 'string' ||
					!p.display_name.trim() ||
					(p.role !== undefined && p.role !== 'student' && p.role !== 'teacher') ||
					(p.username !== undefined && typeof p.username !== 'string') ||
					(p.avatar_url !== undefined && typeof p.avatar_url !== 'string')
				) {
					return NextResponse.json({ success: false, error: 'Each participant needs mezon_id and display_name.' }, { status: 400 });
				}
			}
		}

		const meeting = await pgDb.saveMeetingAssignments(
			id,
			participants,
			roomId === undefined ? undefined : { id: roomId, name: roomName || roomId },
			body.replace_participants === true
		);
		if (!meeting) return NextResponse.json({ success: false, error: 'Meeting not found' }, { status: 404 });
		return NextResponse.json({ success: true, meeting });
	} catch (error) {
		console.error('[Admin Meeting Assign POST Error]:', error);
		return NextResponse.json({ success: false, error: 'Failed to assign meeting' }, { status: 500 });
	}
}
