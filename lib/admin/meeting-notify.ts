// Shared helpers for meeting-related Mezon notifications - used by both the admin API routes
// (create/assign/delete, immediate notifications) and lib/bot/meeting-scheduler.ts (reminder/
// no-show jobs), so the room-hashtag/time-format logic isn't duplicated across the two.

export function formatMeetingTimeVi(iso: string): string {
	return new Date(iso).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' });
}

// "20:42 24-09 - 21:42" - start plus end time (if the meeting has one), for notifications that
// need to show a full before/after (e.g. "time changed from X to Y").
export function formatMeetingTimeRangeVi(meeting: { scheduled_at: string; ended_at?: string }): string {
	const start = formatMeetingTimeVi(meeting.scheduled_at);
	if (!meeting.ended_at) return start;
	const endTime = new Date(meeting.ended_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
	return `${start} - ${endTime}`;
}

// "#phòng học 1" instead of plain "phòng học 1" so sendDirectMessage/sendChannelMessage can
// render it as a clickable link straight into that voice room (see roomMention in bot-messenger.ts).
// The recipient's client may briefly show a generic "private channel" placeholder the very first
// time (before it has that clan's channels cached) - it self-corrects, including on old messages,
// once they've opened the clan once. Not a real access problem.
export function meetingRoomLabel(meeting: { room_id?: string; room_name?: string }): string {
	if (meeting.room_id && meeting.room_name) return `#${meeting.room_name}`;
	return meeting.room_name || meeting.room_id || 'chưa gán phòng';
}

export function meetingRoomMention(meeting: { room_id?: string; room_name?: string }): { roomMention: { channelId: string; label: string } } | undefined {
	if (!meeting.room_id || !meeting.room_name) return undefined;
	return { roomMention: { channelId: meeting.room_id, label: meeting.room_name } };
}

// Trailing sentence appended to notification messages when a class was picked at assign time
// (starts with a leading space so it concatenates cleanly onto the end of an existing sentence).
export function meetingClassLabel(meeting: { class_name?: string }): string {
	return meeting.class_name ? ` Lớp: ${meeting.class_name}.` : '';
}
