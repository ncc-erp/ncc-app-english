import { MezonClient, ChannelType } from 'mezon-sdk';
import { ClanUserList, ListClanUsersRequest } from 'mezon-sdk/dist/cjs/api/api';
import { getClanRolesSafely } from '@/lib/mezon/bot-client';
import { isStudentRole, isTeacherRole } from '@/lib/admin/clan-data-service';
import { pgDb } from '@/lib/db/postgres';
import { MeetingParticipantRole } from '@/types/meeting';

function targetClanId(): string {
	return process.env.MEZON_TARGET_CLAN_ID || '';
}

/** One-time scan to seed meeting_rooms_cache on bot startup; real-time updates come from registerMeetingRoomListeners. */
export async function fullSyncMeetingRooms(client: MezonClient): Promise<void> {
	console.log('[Meeting Sync] [Room] Initial full scan starting...');
	const clanId = targetClanId();
	if (!clanId) {
		console.warn('[Meeting Sync] [Room] Skipped: MEZON_TARGET_CLAN_ID is not set.');
		return;
	}
	const clan = client.clans.get(clanId);
	if (!clan) {
		console.warn(`[Meeting Sync] [Room] Skipped: clan ${clanId} not found on this bot client.`);
		return;
	}

	try {
		console.log(`[Meeting Sync] [Room] Loading channel list for clan ${clanId}...`);
		await clan.loadChannels();
		console.log(`[Meeting Sync] [Room] ${clan.channels.size} total channel(s) loaded, filtering for voice type...`);

		const rooms = Array.from(clan.channels.values())
			.filter((ch) => ch.channel_type === ChannelType.CHANNEL_TYPE_MEZON_VOICE && ch.id && ch.name)
			.map((ch) => ({ room_id: ch.id as string, room_name: ch.name as string, clan_id: clanId }));
		console.log(`[Meeting Sync] [Room] Found ${rooms.length} voice room(s): ${rooms.map((r) => r.room_name).join(', ') || '(none)'}`);

		if (rooms.length > 0) {
			console.log('[Meeting Sync] [Room] Writing to meeting_rooms_cache...');
			await pgDb.upsertMeetingRoomsCache(rooms);
		}
		console.log(`[Meeting Sync] [Room] Done. Seeded ${rooms.length} voice room(s) from clan ${clanId}.`);
	} catch (err) {
		console.error('[Meeting Sync] [Room] Initial sync failed:', err);
	}
}

/** One-time scan to seed meeting_roster_cache on bot startup; real-time updates come from registerMeetingRosterListener. */
export async function fullSyncMeetingRoster(client: MezonClient): Promise<void> {
	console.log('[Meeting Sync] [Roster] Initial full scan starting...');
	const clanId = targetClanId();
	if (!clanId) {
		console.warn('[Meeting Sync] [Roster] Skipped: MEZON_TARGET_CLAN_ID is not set.');
		return;
	}

	try {
		console.log(`[Meeting Sync] [Roster] Fetching clan role list for clan ${clanId}...`);
		const roles = await getClanRolesSafely(client, clanId, true);
		const studentRoleIds = new Set(roles.filter((r) => isStudentRole(r.title)).map((r) => String(r.id)));
		const teacherRoleIds = new Set(roles.filter((r) => isTeacherRole(r.title)).map((r) => String(r.id)));
		console.log(
			`[Meeting Sync] [Roster] ${roles.length} role(s) found; Student role id(s): [${[...studentRoleIds].join(', ')}], Teacher role id(s): [${[...teacherRoleIds].join(', ')}]`
		);

		console.log('[Meeting Sync] [Roster] Fetching full clan member list...');
		const internalClient = client as unknown as {
			apiClient: { invokeMezonApi: (path: string, body: Uint8Array, options: unknown) => Promise<ClanUserList> };
		};
		const res = await internalClient.apiClient.invokeMezonApi(
			'/mezon.api.Mezon/ListClanUsers',
			ListClanUsersRequest.encode({ clan_id: clanId }).finish(),
			{ decode: (bytes: Uint8Array) => ClanUserList.decode(bytes) }
		);
		console.log(`[Meeting Sync] [Roster] ${res.clan_users?.length || 0} clan member(s) returned, classifying by role...`);

		const members: { mezon_id: string; username?: string; display_name: string; avatar_url?: string; role: MeetingParticipantRole; clan_id: string }[] =
			[];

		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		for (const entry of (res.clan_users || []) as any[]) {
			const user = entry.user;
			if (!user?.id) continue;
			const roleIds: string[] = (Array.isArray(entry.role_id) ? entry.role_id : []).map(String);

			let role: MeetingParticipantRole | null = null;
			if (roleIds.some((rid) => teacherRoleIds.has(rid))) role = 'teacher';
			else if (roleIds.some((rid) => studentRoleIds.has(rid))) role = 'student';
			if (!role) continue;

			members.push({
				mezon_id: user.id,
				username: user.username || undefined,
				display_name: entry.clan_nick || user.display_name || user.username || `user_${user.id}`,
				avatar_url: entry.clan_avatar || user.avatar_url || undefined,
				role,
				clan_id: clanId
			});
		}
		console.log(
			`[Meeting Sync] [Roster] Classified ${members.length} member(s): ${members.map((m) => `${m.display_name}(${m.role})`).join(', ') || '(none)'}`
		);

		if (members.length > 0) {
			console.log('[Meeting Sync] [Roster] Writing to meeting_roster_cache...');
			await pgDb.upsertMeetingRosterCache(members);
		}
		console.log(`[Meeting Sync] [Roster] Done. Seeded ${members.length} Student/Teacher roster entrie(s) from clan ${clanId}.`);
	} catch (err) {
		console.error('[Meeting Sync] [Roster] Initial sync failed:', err);
	}
}

/** Keeps meeting_rooms_cache current as voice channels are created/renamed/removed in Mezon. */
export function registerMeetingRoomListeners(client: MezonClient): void {
	const clanId = targetClanId();
	console.log('[Meeting Sync] [Room] Listening for onChannelCreated / onChannelUpdated / onChannelDeleted...');

	client.onChannelCreated(async (e) => {
		console.log(`[Meeting Sync] [Room] onChannelCreated: "${e.channel_label}" (${e.channel_id}), type=${e.channel_type}, clan=${e.clan_id}`);
		if (clanId && e.clan_id !== clanId) {
			console.log('[Meeting Sync] [Room] Ignored: different clan.');
			return;
		}
		if (e.channel_type !== ChannelType.CHANNEL_TYPE_MEZON_VOICE) {
			console.log('[Meeting Sync] [Room] Ignored: not a voice channel.');
			return;
		}
		try {
			await pgDb.upsertMeetingRoomsCache([{ room_id: e.channel_id, room_name: e.channel_label, clan_id: e.clan_id }]);
			console.log(`[Meeting Sync] [Room] Cached new room "${e.channel_label}".`);
		} catch (err) {
			console.error('[Meeting Sync] [Room] Failed to cache newly created room:', err);
		}
	});

	client.onChannelUpdated(async (e) => {
		console.log(`[Meeting Sync] [Room] onChannelUpdated: "${e.channel_label}" (${e.channel_id}), type=${e.channel_type}, clan=${e.clan_id}`);
		if (clanId && e.clan_id !== clanId) {
			console.log('[Meeting Sync] [Room] Ignored: different clan.');
			return;
		}
		if (e.channel_type !== ChannelType.CHANNEL_TYPE_MEZON_VOICE) {
			console.log('[Meeting Sync] [Room] Ignored: not a voice channel.');
			return;
		}
		try {
			await pgDb.upsertMeetingRoomsCache([{ room_id: e.channel_id, room_name: e.channel_label, clan_id: e.clan_id }]);
			console.log(`[Meeting Sync] [Room] Updated cached room "${e.channel_label}".`);
		} catch (err) {
			console.error('[Meeting Sync] [Room] Failed to update cached room:', err);
		}
	});

	client.onChannelDeleted(async (e) => {
		console.log(`[Meeting Sync] [Room] onChannelDeleted: ${e.channel_id}, clan=${e.clan_id}`);
		if (clanId && e.clan_id !== clanId) {
			console.log('[Meeting Sync] [Room] Ignored: different clan.');
			return;
		}
		try {
			await pgDb.deleteMeetingRoomCache(e.channel_id);
			console.log(`[Meeting Sync] [Room] Removed room ${e.channel_id} from cache (no-op if it wasn't a tracked voice room).`);
		} catch (err) {
			console.error('[Meeting Sync] [Room] Failed to remove deleted room from cache:', err);
		}
	});
}

/** Keeps meeting_roster_cache current as the Student/Teacher roles are (un)assigned in Mezon. */
export function registerMeetingRosterListener(client: MezonClient): void {
	const clanId = targetClanId();
	console.log('[Meeting Sync] [Roster] Listening for onRoleAssign...');

	client.onRoleAssign(async (e) => {
		console.log(
			`[Meeting Sync] [Roster] onRoleAssign: role=${e.role_id}, clan=${e.ClanId}, assigned=[${(e.user_ids_assigned || []).join(', ')}], removed=[${(e.user_ids_removed || []).join(', ')}]`
		);
		if (clanId && e.ClanId !== clanId) {
			console.log('[Meeting Sync] [Roster] Ignored: different clan.');
			return;
		}

		try {
			const roles = await getClanRolesSafely(client, e.ClanId);
			const roleTitle = roles.find((r) => String(r.id) === String(e.role_id))?.title;
			const isTrackedRole = isTeacherRole(roleTitle) || isStudentRole(roleTitle);
			console.log(`[Meeting Sync] [Roster] Role "${roleTitle}" is ${isTrackedRole ? '' : 'NOT '}Student/Teacher.`);
			if (!isTrackedRole) return;

			const role: MeetingParticipantRole = isTeacherRole(roleTitle) ? 'teacher' : 'student';

			if (e.user_ids_assigned?.length) {
				const members: {
					mezon_id: string;
					username?: string;
					display_name: string;
					avatar_url?: string;
					role: MeetingParticipantRole;
					clan_id: string;
				}[] = [];
				for (const userId of e.user_ids_assigned) {
					const user = client.users.get(userId) || (await client.users.fetch(userId));
					if (!user) {
						console.warn(`[Meeting Sync] [Roster] Could not resolve user ${userId}, skipping.`);
						continue;
					}
					members.push({
						mezon_id: userId,
						username: user.username || undefined,
						display_name: user.display_name || user.username || `user_${userId}`,
						avatar_url: user.clan_avatar || user.avartar || undefined,
						role,
						clan_id: e.ClanId
					});
				}
				if (members.length > 0) {
					await pgDb.upsertMeetingRosterCache(members);
					console.log(`[Meeting Sync] [Roster] Cached as ${role}: ${members.map((m) => m.display_name).join(', ')}`);
				}
			}

			if (e.user_ids_removed?.length) {
				for (const userId of e.user_ids_removed) {
					await pgDb.deleteMeetingRosterCache(userId);
				}
				console.log(`[Meeting Sync] [Roster] Removed from cache: ${e.user_ids_removed.join(', ')}`);
			}
		} catch (err) {
			console.error('[Meeting Sync] [Roster] Failed to process onRoleAssign event:', err);
		}
	});
}

/** Records when an assigned participant actually joins their meeting's voice room. */
export function registerMeetingJoinListener(client: MezonClient): void {
	console.log('[Meeting Sync] [Join] Listening for onVoiceJoinedEvent...');

	client.onVoiceJoinedEvent(async (e) => {
		console.log(`[Meeting Sync] [Join] onVoiceJoinedEvent: user=${e.user_id}, room=${e.voice_channel_label} (${e.voice_channel_id})`);
		try {
			const matched = await pgDb.markMeetingParticipantJoinedByRoom(e.voice_channel_id, e.user_id);
			console.log(
				matched
					? `[Meeting Sync] [Join] Marked ${e.user_id} as joined for the meeting in room ${e.voice_channel_id}.`
					: `[Meeting Sync] [Join] No matching meeting participant found for ${e.user_id} in room ${e.voice_channel_id} (not a tracked meeting right now).`
			);
		} catch (err) {
			console.error('[Meeting Sync] [Join] Failed to process onVoiceJoinedEvent:', err);
		}
	});
}
