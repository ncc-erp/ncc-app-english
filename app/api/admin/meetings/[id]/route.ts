import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { pgDb, RoomConflictError } from '@/lib/db/postgres';
import { checkIsClanAdmin } from '@/lib/admin/clan-data-service';
import { parseMeetingInput } from '@/lib/admin/meeting-validation';
import { sendDirectMessage } from '@/lib/bot/bot-messenger';
import { formatMeetingTimeVi, formatMeetingTimeRangeVi, meetingRoomLabel, meetingRoomMention, meetingClassLabel } from '@/lib/admin/meeting-notify';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
	try {
		if (!(await isAdmin())) return NextResponse.json({ success: false, error: 'Admin privileges required.' }, { status: 403 });
		const input = parseMeetingInput(await req.json().catch(() => null));
		if (!input)
			return NextResponse.json(
				{ success: false, error: 'Provide a title (1–200 characters), a valid scheduled_at, and an ended_at after it (both with timezone).' },
				{ status: 400 }
			);
		const { id } = await params;

		// Fetch before updating so we know whether the time actually moved - only worth notifying
		// participants for that, not for every edit-save (e.g. a title-only change).
		const existing = await pgDb.getMeeting(id);
		if (!existing) return NextResponse.json({ success: false, error: 'Meeting not found' }, { status: 404 });

		let meeting;
		try {
			meeting = await pgDb.updateMeeting(id, input.title, input.scheduled_at, input.ended_at);
		} catch (error) {
			if (error instanceof RoomConflictError) {
				return NextResponse.json(
					{
						success: false,
						error: `Phòng "${existing.room_name || existing.room_id}" đã được đặt cho buổi học "${error.conflict.title}" (${formatMeetingTimeRangeVi({ scheduled_at: error.conflict.scheduled_at, ended_at: error.conflict.ended_at ?? undefined })}) - trùng thời gian với buổi học này.`
					},
					{ status: 409 }
				);
			}
			throw error;
		}
		if (!meeting) return NextResponse.json({ success: false, error: 'Meeting not found' }, { status: 404 });

		const timeChanged = existing.scheduled_at !== meeting.scheduled_at || existing.ended_at !== meeting.ended_at;
		if (timeChanged && existing.participants.length) {
			const roomMention = meetingRoomMention(meeting);
			await Promise.all(
				existing.participants.map((p) =>
					sendDirectMessage(
						p.mezon_id,
						`🔄 Buổi học "${meeting.title}" đã đổi thời gian: từ ${formatMeetingTimeRangeVi(existing)} sang ${formatMeetingTimeRangeVi(meeting)}. Phòng: ${meetingRoomLabel(meeting)}.${meetingClassLabel(meeting)}`,
						roomMention
					).catch((err) => console.error(`[Admin Meeting PATCH] Failed to notify ${p.mezon_id}:`, err))
				)
			);
		}

		return NextResponse.json({ success: true, meeting });
	} catch (error) {
		console.error('[Admin Meeting PATCH Error]:', error);
		return NextResponse.json({ success: false, error: 'Failed to update meeting' }, { status: 500 });
	}
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
	try {
		if (!(await isAdmin())) return NextResponse.json({ success: false, error: 'Admin privileges required.' }, { status: 403 });
		const { id } = await params;

		// Fetch before deleting - need the title/time/participants to notify, which are gone once deleteMeeting cascades.
		const meeting = await pgDb.getMeeting(id);
		if (!meeting) return NextResponse.json({ success: false, error: 'Meeting not found' }, { status: 404 });

		if (!(await pgDb.deleteMeeting(id))) return NextResponse.json({ success: false, error: 'Meeting not found' }, { status: 404 });

		if (meeting.participants.length) {
			const roomMention = meetingRoomMention(meeting);
			await Promise.all(
				meeting.participants.map((p) =>
					sendDirectMessage(
						p.mezon_id,
						`❌ Buổi học "${meeting.title}" (${formatMeetingTimeVi(meeting.scheduled_at)}, phòng ${meetingRoomLabel(meeting)}) đã bị huỷ.${meetingClassLabel(meeting)}`,
						roomMention
					).catch((err) => console.error(`[Admin Meeting DELETE] Failed to notify ${p.mezon_id}:`, err))
				)
			);
		}

		return NextResponse.json({ success: true });
	} catch (error) {
		console.error('[Admin Meeting DELETE Error]:', error);
		return NextResponse.json({ success: false, error: 'Failed to delete meeting' }, { status: 500 });
	}
}

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
