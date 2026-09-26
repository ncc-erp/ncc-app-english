import { sendDirectMessage, sendChannelMessage, getSharedBotClient } from './bot-messenger';
import { pgDb } from '@/lib/db/postgres';
import { getChannelMemberIds } from '@/lib/admin/clan-data-service';
import { Meeting } from '@/types/meeting';
import {
	formatMeetingTimeVi as formatMeetingTime,
	meetingRoomLabel as roomLabelText,
	meetingRoomMention as roomMentionOption,
	meetingClassLabel as classLabelText
} from '@/lib/admin/meeting-notify';

declare global {
	// eslint-disable-next-line no-var
	var __meetingSchedulerStarted: boolean | undefined;
}

const CHECK_INTERVAL_MS = 60 * 1000;

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
			console.log(`[Meeting Scheduler] [Reminder] Sending T-${minutesBefore}min DM to ${participant.display_name} for "${meeting.title}"...`);
			const sent = await sendDirectMessage(
				participant.mezon_id,
				`⏰ Buổi học "${meeting.title}" sẽ bắt đầu sau ${minutesBefore} phút (${formatMeetingTime(meeting.scheduled_at)}). Phòng: ${roomLabelText(meeting)}.${classLabelText(meeting)}`,
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
				`🔔 Buổi học "${meeting.title}" đang bắt đầu. Vào phòng: ${roomLabelText(meeting)}.${classLabelText(meeting)}`,
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

// How long after the end live presence still says anything about who sat through the class. A
// later finalize (bot was down at the end) only closes out end_at, without backfilling joins.
const FINALIZE_PRESENCE_GRACE_MS = 10 * 60 * 1000;

// Who is in each voice room right now, keyed by room id; null when the bot can't tell.
async function getLiveVoiceUsers(): Promise<Map<string, Set<string>> | null> {
	try {
		const client = await getSharedBotClient();
		const clanId = process.env.MEZON_TARGET_CLAN_ID || '';
		const clan = client && clanId ? client.clans.get(clanId) : undefined;
		if (!clan) return null;

		const voiceList = await clan.listChannelVoiceUsers();
		const byRoom = new Map<string, Set<string>>();
		for (const entry of voiceList.voice_channel_users || []) {
			if (entry.channel_id) byRoom.set(entry.channel_id, new Set(entry.user_ids || []));
		}
		return byRoom;
	} catch (err) {
		console.error('[Meeting Scheduler] [Presence] Listing live voice users failed:', err);
		return null;
	}
}

// onVoiceJoinedEvent only fires at the moment someone joins - it says nothing about people who
// were already sitting in the room before the bot's listener was attached (e.g. bot restarted
// mid-meeting). Ask Mezon who is ACTUALLY in the room right now and backfill joined_at for anyone
// we missed, so a genuinely-present participant is never wrongly flagged.
async function reconcileLiveVoicePresence(meeting: Meeting, voiceUsers: Map<string, Set<string>>): Promise<void> {
	if (!meeting.room_id) return;
	const present = voiceUsers.get(meeting.room_id);
	if (!present?.size) return;

	// Never checked in, or recorded as having left although they're back (rejoin event missed).
	const missed = meeting.participants.filter((p) => (!p.joined_at || p.end_at) && present.has(p.mezon_id));
	if (!missed.length) return;

	try {
		await pgDb.backfillMeetingParticipantsJoined(
			meeting.id,
			missed.map((p) => p.mezon_id)
		);
		console.log(
			`[Meeting Scheduler] [Presence] "${meeting.title}": ${missed.map((p) => p.display_name).join(', ')} in the room - backfilled joined_at / cleared end_at.`
		);
	} catch (err) {
		console.error(`[Meeting Scheduler] [Presence] Backfill failed for "${meeting.title}":`, err);
	}
}

// At the start (T+0), check in everyone already sitting in the room as on time - no join event
// fires for them since they came in before the class began. Runs once per meeting; if the bot
// can't list voice users yet, it retries on the next tick.
async function checkStartPresence(): Promise<void> {
	try {
		const meetings = await pgDb.getMeetingsInProgress({ startPresenceUnchecked: true });
		if (!meetings.length) return;
		console.log(`[Meeting Scheduler] [Presence] Start-of-class check for ${meetings.length} meeting(s).`);
		const voiceUsers = await getLiveVoiceUsers();
		if (!voiceUsers) return;
		for (const meeting of meetings) {
			await reconcileLiveVoicePresence(meeting, voiceUsers);
			await pgDb.markMeetingStartPresenceChecked(meeting.id);
		}
	} catch (err) {
		console.error('[Meeting Scheduler] [Presence] Start-of-class check failed:', err);
	}
}

// Runs once when the scheduler starts: joins that happened while the bot was down would otherwise
// only be caught at the T+5 check (if it hasn't passed yet) or at the end.
async function reconcileInProgressMeetings(): Promise<void> {
	try {
		const meetings = await pgDb.getMeetingsInProgress();
		console.log(`[Meeting Scheduler] [Presence] Startup: reconciling ${meetings.length} in-progress meeting(s).`);
		if (!meetings.length) return;
		const voiceUsers = await getLiveVoiceUsers();
		if (!voiceUsers) return;
		for (const meeting of meetings) await reconcileLiveVoicePresence(meeting, voiceUsers);
	} catch (err) {
		console.error('[Meeting Scheduler] [Presence] Startup reconciliation failed:', err);
	}
}

// Closes out attendance for meetings that just ended: backfills joins from live presence (only
// while the end is recent enough for presence to mean anything) and sets end_at = the class end
// for everyone who joined and has no end_at yet.
async function finalizeEndedMeetings(): Promise<void> {
	try {
		const meetings = await pgDb.getMeetingsNeedingPresenceFinalize();
		if (!meetings.length) return;
		console.log(`[Meeting Scheduler] [Presence] Finalizing attendance for ${meetings.length} ended meeting(s).`);
		const voiceUsers = await getLiveVoiceUsers();
		for (const meeting of meetings) {
			const endMs = meeting.ended_at ? new Date(meeting.ended_at).getTime() : new Date(meeting.scheduled_at).getTime() + 60 * 60 * 1000;
			const presenceStillMeaningful = Date.now() - endMs <= FINALIZE_PRESENCE_GRACE_MS;
			const present = presenceStillMeaningful && meeting.room_id ? voiceUsers?.get(meeting.room_id) : undefined;
			await pgDb.finalizeMeetingPresence(meeting.id, present ? [...present] : null);
			console.log(`[Meeting Scheduler] [Presence] Finalized "${meeting.title}" (live presence ${present ? 'used' : 'not used'}).`);
		}
	} catch (err) {
		console.error('[Meeting Scheduler] [Presence] Finalize pass failed:', err);
	}
}

async function checkNoShows(): Promise<void> {
	const minutesAfter = noShowMinutesAfter();
	console.log(`[Meeting Scheduler] [NoShow] Tick: checking for meetings ${minutesAfter}+ min past start...`);
	// The presence backfill runs regardless; only the admin-channel message needs this set.
	const adminChannelId = process.env.MEZON_MEETING_ADMIN_CHANNEL_ID;
	if (!adminChannelId) {
		console.warn('[Meeting Scheduler] [NoShow] MEZON_MEETING_ADMIN_CHANNEL_ID is not set - backfilling joins only, no no-show message.');
	}

	try {
		const meetings = await pgDb.getMeetingsNeedingNoShowCheck();
		console.log(`[Meeting Scheduler] [NoShow] Found ${meetings.length} meeting(s) to check.`);
		const voiceUsers = meetings.length ? await getLiveVoiceUsers() : null;
		// Only people who are actual members of the admin channel resolve as a real, clickable
		// @mention there - anyone else just needs to be resolvable, so skip mentioning them and
		// let their plain "@username" text render unstyled instead of a broken/misleading chip.
		const adminChannelMemberIds = meetings.length && adminChannelId ? await getChannelMemberIds(adminChannelId) : new Set<string>();
		for (let meeting of meetings) {
			if (voiceUsers) await reconcileLiveVoicePresence(meeting, voiceUsers);
			const refreshed = await pgDb.getMeeting(meeting.id);
			if (refreshed) meeting = refreshed;

			// Absent = not in the room right now: never joined, or left and hasn't come back (a
			// rejoin clears end_at, so end_at set means they are out).
			const notJoined = meeting.participants.filter((p) => !p.joined_at);
			const leftRoom = meeting.participants.filter((p) => p.joined_at && p.end_at);
			const noShows = [...notJoined, ...leftRoom];
			console.log(
				`[Meeting Scheduler] [NoShow] "${meeting.title}": ${notJoined.length} not joined, ${leftRoom.length} left, of ${meeting.participants.length} participant(s).`
			);
			if (adminChannelId && noShows.length > 0) {
				// @username where we have one (renders as a clickable/pinging mention), falling
				// back to the plain display name for participants synced without a username.
				const nameList = (people: typeof noShows) => people.map((p) => (p.username ? `@${p.username}` : p.display_name)).join(', ');
				const groups = [
					notJoined.length ? `chưa thấy join: ${nameList(notJoined)}` : '',
					leftRoom.length ? `đã rời phòng: ${nameList(leftRoom)}` : ''
				].filter(Boolean);
				console.log(`[Meeting Scheduler] [NoShow] Notifying admin channel ${adminChannelId}: ${groups.join(' | ')}`);
				await sendChannelMessage(
					adminChannelId,
					`⚠️ Buổi học "${meeting.title}" (${formatMeetingTime(meeting.scheduled_at)}) đã bắt đầu ${minutesAfter} phút, phòng ${roomLabelText(meeting)} - ${groups.join('; ')}.${classLabelText(meeting)}`,
					{
						...roomMentionOption(meeting),
						mentions: noShows
							.filter((p) => p.username && adminChannelMemberIds.has(p.mezon_id))
							.map((p) => ({ user_id: p.mezon_id, username: p.username }))
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

async function checkPresence(): Promise<void> {
	// Sequential so a meeting reaching T+0 and T+5 on the same tick (bot was down) is checked in
	// before no-shows are counted.
	await checkStartPresence();
	await checkNoShows();
	await finalizeEndedMeetings();
}

function runTick(): void {
	checkReminders();
	void checkPresence();
}

/**
 * Starts the meeting reminder (T-10min / T+0), start-of-class presence (T+0), no-show (T+5min)
 * and end-of-meeting attendance finalize loop, after a one-off presence reconciliation of
 * meetings already in progress.
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

	void reconcileInProgressMeetings();

	setTimeout(() => {
		runTick();
		setInterval(runTick, CHECK_INTERVAL_MS);
	}, msUntilNextMinute);

	console.log(`[Meeting Scheduler] Started - checking every ${CHECK_INTERVAL_MS / 1000}s, aligned to :00 seconds, for reminders / no-shows.`);
}
