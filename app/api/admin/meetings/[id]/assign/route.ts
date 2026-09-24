import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { pgDb, RoomConflictError } from '@/lib/db/postgres';
import { checkIsClanAdmin } from '@/lib/admin/clan-data-service';
import { MeetingParticipant } from '@/types/meeting';
import { sendDirectMessage } from '@/lib/bot/bot-messenger';
import { formatMeetingTimeVi, formatMeetingTimeRangeVi, meetingRoomLabel, meetingRoomMention, meetingClassLabel } from '@/lib/admin/meeting-notify';

async function isAdmin(): Promise<boolean> {
	const session = await getSession();
	const user = session.user;
	if (!user || !user.isLoggedIn) return false;
	return checkIsClanAdmin(user.mezon_id);
}

// POST /api/admin/meetings/[id]/assign - Assign participants and/or a room to an existing meeting.
// Body: { participants?: Omit<MeetingParticipant, 'joined_at'>[], room_id?: string, room_name?: string, class_id?: string, class_name?: string, user_id?: string, user_name?: string, replace_participants?: boolean }
// user_id/user_name identify the teacher in charge (separate from participants). replace_participants opts
// into removal of deselected people; empty room_id/class_id/user_id clears it. Any of
// participants/room/class/user can be sent alone (e.g. assign people first, assign the room later).
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
		const classId: string | undefined = body?.class_id;
		const className: string | undefined = body?.class_name;
		const userId: string | undefined = body?.user_id;
		const userName: string | undefined = body?.user_name;

		if (!body || (participants === undefined && roomId === undefined && classId === undefined && userId === undefined)) {
			return NextResponse.json({ success: false, error: 'Provide participants, room_id, class_id and/or user_id to assign.' }, { status: 400 });
		}

		if (
			(participants !== undefined && !Array.isArray(participants)) ||
			(roomId !== undefined && typeof roomId !== 'string') ||
			(roomName !== undefined && typeof roomName !== 'string') ||
			(classId !== undefined && typeof classId !== 'string') ||
			(className !== undefined && typeof className !== 'string') ||
			(userId !== undefined && typeof userId !== 'string') ||
			(userName !== undefined && typeof userName !== 'string') ||
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

		let meeting;
		try {
			meeting = await pgDb.saveMeetingAssignments(
				id,
				participants,
				roomId === undefined ? undefined : { id: roomId, name: roomName || roomId },
				body.replace_participants === true,
				classId === undefined ? undefined : { id: classId, name: className || classId },
				userId === undefined ? undefined : { id: userId, name: userName || userId }
			);
		} catch (error) {
			if (error instanceof RoomConflictError) {
				return NextResponse.json(
					{
						success: false,
						error: `Phòng "${roomName || roomId}" đã được đặt cho buổi học "${error.conflict.title}" (${formatMeetingTimeRangeVi({ scheduled_at: error.conflict.scheduled_at, ended_at: error.conflict.ended_at ?? undefined })}) - trùng thời gian với buổi học này.`
					},
					{ status: 409 }
				);
			}
			throw error;
		}
		if (!meeting) return NextResponse.json({ success: false, error: 'Meeting not found' }, { status: 404 });

		// Only notify people newly added in this call - covers "assigned at creation" and the
		// standalone assign flow, without re-spamming already-assigned people on every edit-save
		// (edit always re-sends the full participant list, most of whom haven't actually changed).
		if (participants?.length) {
			const previouslyAssignedIds = new Set(existing.participants.map((p) => p.mezon_id));
			const newlyAdded = participants.filter((p) => !previouslyAssignedIds.has(p.mezon_id));
			if (newlyAdded.length) {
				const roomMention = meetingRoomMention(meeting);
				await Promise.all(
					newlyAdded.map((p) =>
						sendDirectMessage(
							p.mezon_id,
							`📅 Bạn được mời tham gia buổi học "${meeting.title}" lúc ${formatMeetingTimeVi(meeting.scheduled_at)}. Phòng: ${meetingRoomLabel(meeting)}.${meetingClassLabel(meeting)}`,
							roomMention
						).catch((err) => console.error(`[Admin Meeting Assign] Failed to notify ${p.mezon_id}:`, err))
					)
				);
			}
		}

		return NextResponse.json({ success: true, meeting });
	} catch (error) {
		console.error('[Admin Meeting Assign POST Error]:', error);
		return NextResponse.json({ success: false, error: 'Failed to assign meeting' }, { status: 500 });
	}
}
