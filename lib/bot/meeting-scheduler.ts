import { sendDirectMessage, sendChannelMessage } from './bot-messenger';
import { pgDb } from '@/lib/db/postgres';

declare global {
	// eslint-disable-next-line no-var
	var __meetingSchedulerStarted: boolean | undefined;
}

const CHECK_INTERVAL_MS = 60 * 1000;

function formatMeetingTime(iso: string): string {
	return new Date(iso).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' });
}

function reminderMinutesBefore(): number {
	return parseInt(process.env.MEETING_REMINDER_MINUTES_BEFORE || '10', 10);
}

function noShowMinutesAfter(): number {
	return parseInt(process.env.MEETING_NOSHOW_CHECK_MINUTES_AFTER || '5', 10);
}

async function checkReminders(): Promise<void> {
	const minutesBefore = reminderMinutesBefore();
	console.log(`[Meeting Scheduler] [Reminder] Tick: checking for meetings needing a T-${minutesBefore}min reminder...`);
	try {
		const need10Min = await pgDb.getParticipantsNeeding10MinReminder();
		console.log(`[Meeting Scheduler] [Reminder] Found ${need10Min.length} participant(s) needing the T-${minutesBefore}min reminder.`);
		for (const { meeting, participant } of need10Min) {
			const roomLabel = meeting.room_name || meeting.room_id || 'chưa gán phòng';
			console.log(`[Meeting Scheduler] [Reminder] Sending T-${minutesBefore}min DM to ${participant.display_name} for "${meeting.title}"...`);
			const sent = await sendDirectMessage(
				participant.mezon_id,
				`⏰ Buổi học "${meeting.title}" sẽ bắt đầu sau ${minutesBefore} phút (${formatMeetingTime(meeting.scheduled_at)}). Phòng: ${roomLabel}.`
			);
			if (sent) {
				await pgDb.markParticipantReminded10Min(meeting.id, participant.mezon_id);
				console.log(`[Meeting Scheduler] [Reminder] Sent + marked reminded_10min_at for ${participant.display_name}.`);
			} else {
				console.warn(`[Meeting Scheduler] [Reminder] Send FAILED for ${participant.display_name} - will retry next tick.`);
			}
		}
	} catch (err) {
		console.error('[Meeting Scheduler] [Reminder] T-10min pass failed:', err);
	}

	console.log('[Meeting Scheduler] [Reminder] Checking for meetings that just started (T+0)...');
	try {
		const needStart = await pgDb.getParticipantsNeedingStartReminder();
		console.log(`[Meeting Scheduler] [Reminder] Found ${needStart.length} participant(s) needing the "starting now" reminder.`);
		for (const { meeting, participant } of needStart) {
			const roomLabel = meeting.room_name || meeting.room_id || 'chưa gán phòng';
			console.log(`[Meeting Scheduler] [Reminder] Sending "starting now" DM to ${participant.display_name} for "${meeting.title}"...`);
			const sent = await sendDirectMessage(participant.mezon_id, `🔔 Buổi học "${meeting.title}" đang bắt đầu. Vào phòng: ${roomLabel}.`);
			if (sent) {
				await pgDb.markParticipantRemindedStart(meeting.id, participant.mezon_id);
				console.log(`[Meeting Scheduler] [Reminder] Sent + marked reminded_start_at for ${participant.display_name}.`);
			} else {
				console.warn(`[Meeting Scheduler] [Reminder] Send FAILED for ${participant.display_name} - will retry next tick.`);
			}
		}
	} catch (err) {
		console.error('[Meeting Scheduler] [Reminder] Start-reminder pass failed:', err);
	}
}

async function checkNoShows(): Promise<void> {
	const minutesAfter = noShowMinutesAfter();
	console.log(`[Meeting Scheduler] [NoShow] Tick: checking for meetings ${minutesAfter}+ min past start...`);
	const adminChannelId = process.env.MEZON_MEETING_ADMIN_CHANNEL_ID;
	if (!adminChannelId) {
		console.warn('[Meeting Scheduler] [NoShow] Skipped: MEZON_MEETING_ADMIN_CHANNEL_ID is not set.');
		return;
	}

	try {
		const meetings = await pgDb.getMeetingsNeedingNoShowCheck();
		console.log(`[Meeting Scheduler] [NoShow] Found ${meetings.length} meeting(s) to check.`);
		for (const meeting of meetings) {
			const noShows = meeting.participants.filter((p) => !p.joined_at);
			console.log(`[Meeting Scheduler] [NoShow] "${meeting.title}": ${noShows.length}/${meeting.participants.length} participant(s) not joined.`);
			if (noShows.length > 0) {
				const names = noShows.map((p) => p.display_name).join(', ');
				console.log(`[Meeting Scheduler] [NoShow] Notifying admin channel ${adminChannelId} about: ${names}`);
				await sendChannelMessage(
					adminChannelId,
					`⚠️ Buổi học "${meeting.title}" (${formatMeetingTime(meeting.scheduled_at)}) đã bắt đầu ${minutesAfter} phút nhưng chưa thấy join phòng: ${names}.`
				);
			}
			// Marked once regardless of whether anyone was actually missing, so this meeting
			// isn't re-checked every minute forever.
			await pgDb.markMeetingNoShowNotified(meeting.id);
			console.log(`[Meeting Scheduler] [NoShow] Marked "${meeting.title}" as checked (noshow_notified_at set).`);
		}
	} catch (err) {
		console.error('[Meeting Scheduler] [NoShow] Check pass failed:', err);
	}
}

/**
 * Starts the meeting reminder (T-10min / T+0) and no-show (T+5min) check loop.
 * Safe to call multiple times - guarded by a global so Next.js HMR doesn't stack intervals.
 */
export function startMeetingScheduler(): void {
	if (globalThis.__meetingSchedulerStarted) {
		console.log('[Meeting Scheduler] Already running, skipping duplicate start.');
		return;
	}
	globalThis.__meetingSchedulerStarted = true;

	setInterval(() => {
		checkReminders();
		checkNoShows();
	}, CHECK_INTERVAL_MS);

	console.log(`[Meeting Scheduler] Started - checking every ${CHECK_INTERVAL_MS / 1000}s for reminders / no-shows.`);
}
