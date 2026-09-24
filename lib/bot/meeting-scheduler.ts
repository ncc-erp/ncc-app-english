import { sendDirectMessage, sendChannelMessage, getSharedBotClient } from './bot-messenger';
import { pgDb } from '@/lib/db/postgres';
import { Meeting } from '@/types/meeting';

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

// "#phòng học 1" instead of plain "phòng học 1" so sendDirectMessage/sendChannelMessage can
// render it as a clickable link straight into that voice room (see roomMention in bot-messenger.ts).
// The recipient's client may briefly show a generic "private channel" placeholder the very first
// time (before it has that clan's channels cached) - it self-corrects, including on old messages,
// once they've opened the clan once. Not a real access problem.
function roomLabelText(meeting: { room_id?: string; room_name?: string }): string {
	if (meeting.room_id && meeting.room_name) return `#${meeting.room_name}`;
	return meeting.room_name || meeting.room_id || 'chưa gán phòng';
}

function roomMentionOption(meeting: { room_id?: string; room_name?: string }): { roomMention: { channelId: string; label: string } } | undefined {
	if (!meeting.room_id || !meeting.room_name) return undefined;
	return { roomMention: { channelId: meeting.room_id, label: meeting.room_name } };
}

async function checkReminders(): Promise<void> {
	const minutesBefore = reminderMinutesBefore();
	console.log(`[Meeting Scheduler] [Reminder] Tick: checking for meetings needing a T-${minutesBefore}min reminder...`);
	try {
		const need10Min = await pgDb.getParticipantsNeeding10MinReminder();
		console.log(`[Meeting Scheduler] [Reminder] Found ${need10Min.length} participant(s) needing the T-${minutesBefore}min reminder.`);
		for (const { meeting, participant } of need10Min) {
			console.log(`[Meeting Scheduler] [Reminder] Sending T-${minutesBefore}min DM to ${participant.display_name} for "${meeting.title}"...`);
			const sent = await sendDirectMessage(
				participant.mezon_id,
				`⏰ Buổi học "${meeting.title}" sẽ bắt đầu sau ${minutesBefore} phút (${formatMeetingTime(meeting.scheduled_at)}). Phòng: ${roomLabelText(meeting)}.`,
				roomMentionOption(meeting)
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
			console.log(`[Meeting Scheduler] [Reminder] Sending "starting now" DM to ${participant.display_name} for "${meeting.title}"...`);
			const sent = await sendDirectMessage(
				participant.mezon_id,
				`🔔 Buổi học "${meeting.title}" đang bắt đầu. Vào phòng: ${roomLabelText(meeting)}.`,
				roomMentionOption(meeting)
			);
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

// onVoiceJoinedEvent only fires at the moment someone joins - it says nothing about people who
// were already sitting in the room before the bot's listener was attached (e.g. bot restarted
// mid-meeting). Right before declaring a no-show, ask Mezon who is ACTUALLY in the room right
// now and backfill joined_at for anyone we missed, so a genuinely-present participant is never
// wrongly flagged.
async function reconcileLiveVoicePresence(meeting: Meeting): Promise<void> {
	if (!meeting.room_id) return;
	const stillUnjoined = meeting.participants.filter((p) => !p.joined_at);
	if (stillUnjoined.length === 0) return;

	try {
		const client = await getSharedBotClient();
		const clanId = process.env.MEZON_TARGET_CLAN_ID || '';
		const clan = client && clanId ? client.clans.get(clanId) : undefined;
		if (!clan) return;

		const voiceList = await clan.listChannelVoiceUsers();
		const entry = voiceList.voice_channel_users?.find((c) => c.channel_id === meeting.room_id);
		const presentUserIds = new Set(entry?.user_ids || []);
		if (presentUserIds.size === 0) return;

		for (const p of stillUnjoined) {
			if (presentUserIds.has(p.mezon_id)) {
				await pgDb.markMeetingParticipantJoinedByRoom(meeting.room_id, p.mezon_id);
				console.log(`[Meeting Scheduler] [NoShow] Live presence check found ${p.display_name} already in the room - backfilled joined_at.`);
			}
		}
	} catch (err) {
		console.error('[Meeting Scheduler] [NoShow] Live voice presence reconciliation failed:', err);
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
		for (let meeting of meetings) {
			await reconcileLiveVoicePresence(meeting);
			const refreshed = await pgDb.getMeeting(meeting.id);
			if (refreshed) meeting = refreshed;

			const noShows = meeting.participants.filter((p) => !p.joined_at);
			console.log(`[Meeting Scheduler] [NoShow] "${meeting.title}": ${noShows.length}/${meeting.participants.length} participant(s) not joined.`);
			if (noShows.length > 0) {
				// @username where we have one (renders as a clickable/pinging mention), falling
				// back to the plain display name for participants synced without a username.
				const names = noShows.map((p) => (p.username ? `@${p.username}` : p.display_name)).join(', ');
				console.log(`[Meeting Scheduler] [NoShow] Notifying admin channel ${adminChannelId} about: ${names}`);
				await sendChannelMessage(
					adminChannelId,
					`⚠️ Buổi học "${meeting.title}" (${formatMeetingTime(meeting.scheduled_at)}) đã bắt đầu ${minutesAfter} phút nhưng chưa thấy join phòng ${roomLabelText(meeting)}: ${names}.`,
					{
						...roomMentionOption(meeting),
						mentions: noShows.filter((p) => p.username).map((p) => ({ user_id: p.mezon_id, username: p.username }))
					}
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

function runTick(): void {
	checkReminders();
	checkNoShows();
}

/**
 * Starts the meeting reminder (T-10min / T+0) and no-show (T+5min) check loop.
 * Safe to call multiple times - guarded by a global so Next.js HMR doesn't stack intervals.
 *
 * Ticks are aligned to wall-clock minute boundaries (:00 seconds) rather than to whenever the
 * server happened to start, so a reminder due "at 09:30" actually fires within ~1s of 09:30:00
 * instead of up to 59s late depending on the interval's arbitrary phase offset.
 */
export function startMeetingScheduler(): void {
	if (globalThis.__meetingSchedulerStarted) {
		console.log('[Meeting Scheduler] Already running, skipping duplicate start.');
		return;
	}
	globalThis.__meetingSchedulerStarted = true;

	const msUntilNextMinute = CHECK_INTERVAL_MS - (Date.now() % CHECK_INTERVAL_MS);
	console.log(`[Meeting Scheduler] Aligning first tick to the next minute boundary (in ${Math.round(msUntilNextMinute / 1000)}s)...`);

	setTimeout(() => {
		runTick();
		setInterval(runTick, CHECK_INTERVAL_MS);
	}, msUntilNextMinute);

	console.log(`[Meeting Scheduler] Started - checking every ${CHECK_INTERVAL_MS / 1000}s, aligned to :00 seconds, for reminders / no-shows.`);
}
