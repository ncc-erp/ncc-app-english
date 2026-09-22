//clan-data-service.ts
import '@/lib/mezon/sdk-patch';
import { getSharedBotClient } from '@/lib/bot/bot-messenger';
import { isClanAdminMember, getClanRolesSafely } from '@/lib/mezon/bot-client';
import { pgDb } from '@/lib/db/postgres';
import { ClanUserList, ListClanUsersRequest, ChannelUserList, ListChannelUsersRequest } from 'mezon-sdk/dist/cjs/api/api';

export interface ClassroomData {
	id: string;
	name: string;
	category_id?: string;
	category_name?: string;
	student_count?: number;
	is_private?: boolean;
}

export interface StudentData {
	mezon_id: string;
	username: string;
	display_name: string;
	avatar_url?: string;
	clan_nick?: string;
	class_ids?: string[];
	total_speaking_attempts: number;
	average_speaking_band: number | null;
	highest_speaking_band: number | null;
	latest_attempt_at: string | null;
}

// Dedupes concurrent admin checks for the same user (e.g. the several /api/admin/* requests
// a single /admin page load fires in parallel) without caching the result over time - this is
// an access-control gate, so a user whose admin role is revoked must be blocked immediately,
// not after some TTL expires.
const inFlightAdminChecks = new Map<string, Promise<boolean>>();

/**
 * Normalizes text for case-insensitive and accent-tolerant comparisons
 */
function normalizeText(str: string): string {
	return str
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '')
		.toLowerCase()
		.trim();
}

/**
 * Checks whether a category name corresponds to "LỚP HỌC"
 */
function isLopHocCategory(categoryName?: string): boolean {
	if (!categoryName) return false;
	const norm = normalizeText(categoryName);
	return norm === 'lop hoc' || norm === 'lớp học' || norm.includes('lop hoc');
}

/**
 * Checks whether a role title represents an "Admin"
 */
function isAdminRole(title?: string): boolean {
	if (!title) return false;
	const norm = normalizeText(title);
	return norm === 'admin' || norm === 'administrator' || norm === 'quan tri vien';
}

/**
 * Checks whether a role title represents a "Student"
 */
function isStudentRole(title?: string): boolean {
	if (!title) return false;
	const norm = normalizeText(title);
	return (
		norm === 'student' ||
		norm === 'students' ||
		norm === 'hoc sinh' ||
		norm === 'hoc vien' ||
		norm === 'sinh vien' ||
		norm.includes('student') ||
		norm.includes('hoc sinh') ||
		norm.includes('hoc vien') ||
		norm.includes('sinh vien')
	);
}

/**
 * Checks whether a channel name matches a role title for classroom assignment
 */
function matchChannelAndRole(channelName: string, roleTitle: string): boolean {
	if (!channelName || !roleTitle) return false;
	const normChan = normalizeText(channelName).replace(/[-_]/g, ' ').replace(/\s+/g, ' ');
	const normRole = normalizeText(roleTitle).replace(/[-_]/g, ' ').replace(/\s+/g, ' ');

	if (normChan === normRole) return true;
	if (normChan.length >= 3 && normRole.includes(normChan)) return true;
	if (normRole.length >= 3 && normChan.includes(normRole)) return true;

	const cleanChan = normChan.replace(/^(lop|class|kenh)\s+/, '').trim();
	const cleanRole = normRole.replace(/^(lop|class|role|hoc vien|sinh vien)\s+/, '').trim();

	if (cleanChan.length >= 3 && cleanRole.length >= 3) {
		if (cleanChan === cleanRole || cleanChan.includes(cleanRole) || cleanRole.includes(cleanChan)) {
			return true;
		}
	}
	return false;
}

/**
 * Checks if a given Mezon User has the role "Admin" in the Clan.
 * Strictly queries the user's role in the Mezon Clan, NEVER from the database, and NEVER
 * caches the result over time - concurrent calls for the same user share one in-flight
 * check, but each new request re-verifies against Mezon.
 */
export async function checkIsClanAdmin(mezonUserId: string): Promise<boolean> {
	if (!mezonUserId) return false;

	const existing = inFlightAdminChecks.get(mezonUserId);
	if (existing) return existing;

	const promise = resolveIsClanAdmin(mezonUserId).finally(() => {
		inFlightAdminChecks.delete(mezonUserId);
	});
	inFlightAdminChecks.set(mezonUserId, promise);
	return promise;
}

async function resolveIsClanAdmin(mezonUserId: string): Promise<boolean> {
	// 1. Allow dev user in local development mode without Mezon bot
	if (process.env.NODE_ENV === 'development' && mezonUserId === 'dev_user_1001') {
		return true;
	}

	// 2. Delegate to remote bot server if configured (e.g. Vercel deployment)
	const verifyUrl = process.env.MEZON_VERIFY_URL;
	if (verifyUrl) {
		try {
			const res = await fetch(`${verifyUrl.replace(/\/$/, '')}/verify-admin?userId=${encodeURIComponent(mezonUserId)}`, {
				headers: { 'x-bot-secret': process.env.BOT_VERIFY_SECRET || '' }
			});
			const data = await res.json();
			return res.ok && data.isAdmin === true;
		} catch (error) {
			console.error('[Clan Data Service] Remote verify-admin failed:', error);
		}
	}

	// 3. Query live Mezon Clan roles directly via bot client
	try {
		const client = await getSharedBotClient();
		const clanId = process.env.MEZON_TARGET_CLAN_ID || '';

		if (client && clanId) {
			return await isClanAdminMember(client, mezonUserId, clanId);
		}
	} catch (error) {
		console.error('[Clan Data Service] Error checking clan admin role:', error);
	}

	return false;
}

/**
 * Fetches all Classroom channels from Category "LỚP HỌC"
 */
export async function getClanClassrooms(forceRefresh: boolean = false): Promise<ClassroomData[]> {
	const classrooms: ClassroomData[] = [];

	try {
		const client = await getSharedBotClient();
		const clanId = process.env.MEZON_TARGET_CLAN_ID || '';

		if (client && clanId) {
			const targetClan = client.clans.get(clanId);
			if (targetClan) {
				if (forceRefresh || !(targetClan as any)._channelsLoaded) {
					(targetClan as any)._channelsLoaded = false;
					let timer: NodeJS.Timeout | undefined;
					const timeoutPromise = new Promise<void>((resolve) => {
						timer = setTimeout(resolve, 8000);
					});
					const loadAction =
						typeof (targetClan as any).reloadChannels === 'function' ? (targetClan as any).reloadChannels() : targetClan.loadChannels();

					await Promise.race([
						loadAction.then(() => {
							if (timer) clearTimeout(timer);
						}),
						timeoutPromise
					]);
				}
				const allChannels = Array.from(targetClan.channels.values());

				for (const ch of allChannels) {
					if (isLopHocCategory(ch.category_name)) {
						classrooms.push({
							id: ch.id || '',
							name: ch.name || 'Lớp học',
							category_id: ch.category_id,
							category_name: ch.category_name,
							is_private: Boolean(ch.is_private)
						});
					}
				}
			}
		}
	} catch (err) {
		console.warn('[Clan Data Service] Failed to load clan channels:', err);
	}

	return classrooms;
}

interface ScannedChannelData {
	channelId: string;
	isPrivate: boolean;
	memberUserIds: Set<string>;
	memberRoleIds: Set<string>;
	users: Map<
		string,
		{
			userId: string;
			clanNick?: string;
			clanAvatar?: string;
			roleIds: string[];
		}
	>;
}

/**
 * Safely decodes ChannelUserList protobuf payload with fallback
 */
function safeDecodeChannelUserList(bytes: Uint8Array): ChannelUserList {
	try {
		return ChannelUserList.decode(bytes);
	} catch (err: any) {
		console.warn('[Clan Data Service] Rescued ChannelUserList decode error:', err?.message);
		try {
			return ChannelUserList.decode(bytes, bytes.length);
		} catch {
			return { channel_users: [], cursor: '', channel_id: '' };
		}
	}
}

/**
 * Scans members and assigned roles of a channel via Mezon RPC ListChannelUsers.
 * This accurately retrieves members of both private and public channels.
 */
async function scanChannelMembers(
	internalClient: any,
	clanId: string,
	channel: {
		id?: string;
		channel_type?: number;
		is_private?: boolean;
		name?: string;
	}
): Promise<ScannedChannelData> {
	const channelId = channel.id || '';
	const result: ScannedChannelData = {
		channelId,
		isPrivate: Boolean(channel.is_private),
		memberUserIds: new Set<string>(),
		memberRoleIds: new Set<string>(),
		users: new Map()
	};

	if (!channelId || !internalClient?.apiClient?.invokeMezonApi) {
		return result;
	}

	let cursor = '';
	let page = 0;
	const maxPages = 5; // Scan up to 500 members per channel

	while (page < maxPages) {
		page++;
		try {
			const requestPayload = {
				clan_id: clanId,
				channel_id: channelId,
				channel_type: channel.channel_type || 1,
				limit: 100,
				state: 0,
				cursor: cursor
			};

			const requestBody = ListChannelUsersRequest.encode(ListChannelUsersRequest.fromPartial(requestPayload)).finish();

			let timer: NodeJS.Timeout | undefined;
			const timeoutPromise = new Promise<ChannelUserList>((resolve) => {
				timer = setTimeout(() => {
					resolve({ channel_users: [], cursor: '', channel_id: channelId });
				}, 5000);
			});

			const invokePromise = internalClient.apiClient.invokeMezonApi('/mezon.api.Mezon/ListChannelUsers', requestBody, {
				decode: (bytes: Uint8Array) => safeDecodeChannelUserList(bytes)
			});

			const res: ChannelUserList = await Promise.race([
				invokePromise.then((data: ChannelUserList) => {
					if (timer) clearTimeout(timer);
					return data;
				}),
				timeoutPromise
			]);

			if (!res || !Array.isArray(res.channel_users) || res.channel_users.length === 0) {
				break;
			}

			for (const cu of res.channel_users) {
				if (cu.user_id) {
					result.memberUserIds.add(cu.user_id);
					const rIds = Array.isArray(cu.role_id) ? cu.role_id.map(String) : [];
					result.users.set(cu.user_id, {
						userId: cu.user_id,
						clanNick: cu.clan_nick || undefined,
						clanAvatar: cu.clan_avatar || undefined,
						roleIds: rIds
					});
				}
				if (Array.isArray(cu.role_id)) {
					for (const rid of cu.role_id) {
						if (rid) {
							result.memberRoleIds.add(String(rid));
						}
					}
				}
			}

			if (!res.cursor || res.cursor === cursor) {
				break;
			}
			cursor = res.cursor;
		} catch (err) {
			console.warn(`[Clan Data Service] Failed to scan members for channel ${channel.name || channelId}:`, err);
			break;
		}
	}

	return result;
}

/**
 * Fetches all Clan users with role = "Student" and their speaking exam stats.
 * Accurately scans both private and public classroom channels.
 * Optionally filtered by a specific classroom channel.
 */
export async function getClanStudents(classId?: string, forceRefresh: boolean = false): Promise<StudentData[]> {
	const studentsMap = new Map<
		string,
		{
			mezon_id: string;
			username: string;
			display_name: string;
			avatar_url?: string;
			clan_nick?: string;
			class_ids: string[];
		}
	>();

	try {
		const client = await getSharedBotClient();
		const clanId = process.env.MEZON_TARGET_CLAN_ID || '';

		if (client && clanId) {
			const targetClan = client.clans.get(clanId);
			if (targetClan) {
				// Ensure channels are loaded into targetClan.channels
				if (forceRefresh || !(targetClan as any)._channelsLoaded || targetClan.channels.size === 0) {
					try {
						(targetClan as any)._channelsLoaded = false;
						let timer: NodeJS.Timeout | undefined;
						const timeoutPromise = new Promise<void>((resolve) => {
							timer = setTimeout(resolve, 6000);
						});
						const loadAction =
							typeof (targetClan as any).reloadChannels === 'function' ? (targetClan as any).reloadChannels() : targetClan.loadChannels();

						await Promise.race([
							loadAction.then(() => {
								if (timer) clearTimeout(timer);
							}),
							timeoutPromise
						]);
					} catch (loadErr) {
						console.warn('[Clan Data Service] Failed to load clan channels:', loadErr);
					}
				}

				// 1. Find role IDs corresponding to "Student" and index all clan roles
				const roles = await getClanRolesSafely(client, clanId, forceRefresh);
				const rolesMap = new Map<string, string>();
				for (const r of roles) {
					if (r?.id) rolesMap.set(String(r.id), r.title || '');
				}

				const studentRoleIds = roles
					.filter((r) => isStudentRole(r.title))
					.map((r) => String(r.id))
					.filter(Boolean);

				// Get channels in category "LỚP HỌC" to map classrooms
				const classroomChannels = Array.from(targetClan.channels.values()).filter((ch) => isLopHocCategory(ch.category_name));

				// 2. Setup internalClient for Mezon RPC APIs
				const internalClient = client as unknown as {
					apiClient: {
						invokeMezonApi: (path: string, body: Uint8Array, options: unknown) => Promise<any>;
					};
				};

				// 3. Scan members of all classroom channels (including private channels) in parallel
				const channelScanPromises = classroomChannels.map((ch) => scanChannelMembers(internalClient, clanId, ch));

				// 4. Concurrently fetch clan-wide users
				const clanUsersPromise = internalClient.apiClient.invokeMezonApi(
					'/mezon.api.Mezon/ListClanUsers',
					ListClanUsersRequest.encode({ clan_id: clanId }).finish(),
					{ decode: (bytes: Uint8Array) => ClanUserList.decode(bytes) }
				);

				let usersTimer: NodeJS.Timeout | undefined;
				const usersTimeout = new Promise<ClanUserList>((resolve) => {
					usersTimer = setTimeout(() => {
						console.warn(`[Clan Data Service] ListClanUsers timed out after 10000ms for clan ${clanId}`);
						resolve({ clan_users: [], cursor: '', clan_id: clanId });
					}, 10000);
				});

				const [scanResults, clanUsersRes] = await Promise.all([
					Promise.allSettled(channelScanPromises),
					Promise.race([
						clanUsersPromise.then((res) => {
							if (usersTimer) clearTimeout(usersTimer);
							return res;
						}),
						usersTimeout
					])
				]);

				// Build a lookup map of channel scans
				const channelScansMap = new Map<string, ScannedChannelData>();
				for (const res of scanResults) {
					if (res.status === 'fulfilled' && res.value?.channelId) {
						channelScansMap.set(res.value.channelId, res.value);
					}
				}

				// Process clan-wide users list
				for (const entry of clanUsersRes.clan_users) {
					const user = entry.user;
					if (!user?.id) continue;

					// Exclude bot user itself
					if (user.id === client.clientId || (user as any).bot === true) continue;

					// Collect user role IDs
					const userRoleIds: string[] = [
						...(Array.isArray(entry.role_id) ? entry.role_id : []),
						...(Array.isArray((entry as any).role_ids) ? (entry as any).role_ids : []),
						...(Array.isArray((entry as any).roles) ? (entry as any).roles.map((r: any) => r?.id || r) : [])
					].map(String);

					// User is a Student ONLY if they have a Student role in the clan.
					// Being present in a classroom channel alone is NOT sufficient —
					// admins/teachers who join private channels should not be listed.
					const hasClanStudentRole = studentRoleIds.length > 0 ? userRoleIds.some((rid) => studentRoleIds.includes(rid)) : true; // fallback: if no student roles defined, treat all as students

					const isStudent = hasClanStudentRole;

					if (isStudent) {
						const userRoleTitles = userRoleIds.map((rid) => rolesMap.get(rid) || '').filter(Boolean);

						// Determine which classrooms this student belongs to
						const studentClassIds: string[] = [];
						for (const ch of classroomChannels) {
							const chId: string = ch.id || '';
							if (!chId) continue;

							const scanData = channelScansMap.get(chId);
							const isPrivate = scanData ? scanData.isPrivate : Boolean(ch.is_private);

							let belongs = false;

							// 1. Direct membership from channel scan (Crucial for private channels!)
							if (scanData && scanData.memberUserIds.has(user.id)) {
								belongs = true;
							}

							// 2. Role granted to this channel
							if (!belongs && scanData && scanData.memberRoleIds.size > 0) {
								if (userRoleIds.some((rid) => scanData.memberRoleIds.has(rid))) {
									belongs = true;
								}
							}

							// 3. Role text matching: user has a role corresponding to this classroom channel name
							if (!belongs) {
								const roleMatched = userRoleTitles.some((title) => matchChannelAndRole(ch.name || '', title));
								if (roleMatched) {
									belongs = true;
								}
							}

							// 4. Fallback for public channels without restricted members/roles:
							if (!belongs && !isPrivate && (!scanData || scanData.memberUserIds.size === 0)) {
								const anyRoleMatchesChannel = roles.some((r) => matchChannelAndRole(ch.name || '', r.title || ''));
								// If this channel has specific class roles in the clan, do not let everyone in
								if (!anyRoleMatchesChannel) {
									belongs = true;
								}
							}

							if (belongs) {
								studentClassIds.push(chId);
							}
						}

						studentsMap.set(user.id, {
							mezon_id: user.id,
							username: user.username || `user_${user.id}`,
							display_name: entry.clan_nick || user.display_name || user.username || 'Học viên',
							avatar_url: entry.clan_avatar || user.avatar_url || undefined,
							clan_nick: entry.clan_nick,
							class_ids: studentClassIds
						});
					}
				}

				// Also incorporate any user enrolled in private channels who was not in clanUsersRes
				// BUT only if they have a Student role — skip admins/teachers/observers
				for (const [chId, scanData] of channelScansMap.entries()) {
					for (const [userId, uInfo] of scanData.users.entries()) {
						if (userId === client.clientId) continue;

						// Only add users who have a student role in their channel scan roles
						const userScanRoleIds = (uInfo.roleIds || []).map(String);
						const hasStudentRole = studentRoleIds.length > 0 ? userScanRoleIds.some((rid) => studentRoleIds.includes(rid)) : false; // If no student roles defined in clan, don't blindly add
						if (!hasStudentRole) continue;

						const existing = studentsMap.get(userId);
						if (existing) {
							if (!existing.class_ids.includes(chId)) {
								existing.class_ids.push(chId);
							}
						} else {
							const cachedUser = client.users?.get?.(userId);
							studentsMap.set(userId, {
								mezon_id: userId,
								username: cachedUser?.username || uInfo.clanNick || `user_${userId}`,
								display_name: uInfo.clanNick || cachedUser?.display_name || cachedUser?.username || `Student_${userId.slice(-4)}`,
								avatar_url: uInfo.clanAvatar || undefined,
								clan_nick: uInfo.clanNick,
								class_ids: [chId]
							});
						}
					}
				}
			}
		}
	} catch (err) {
		console.warn('[Clan Data Service] Failed to load clan students:', err);
	}

	// 3. Batch query Speaking test statistics from PostgreSQL
	const studentIds = Array.from(studentsMap.keys());
	const statsMap = await pgDb.getStudentsSpeakingStatsBatch(studentIds);

	const studentsList: StudentData[] = [];

	studentsMap.forEach((student, mezonId) => {
		// If filtering by classId, ensure student belongs to class
		if (classId && classId !== 'all' && !student.class_ids.includes(classId)) {
			return;
		}

		const stats = statsMap[mezonId] || {
			total_attempts: 0,
			average_band: null,
			highest_band: null,
			latest_attempt_at: null
		};

		studentsList.push({
			mezon_id: student.mezon_id,
			username: student.username,
			display_name: student.display_name,
			avatar_url: student.avatar_url,
			clan_nick: student.clan_nick,
			class_ids: student.class_ids,
			total_speaking_attempts: stats.total_attempts,
			average_speaking_band: stats.average_band,
			highest_speaking_band: stats.highest_band,
			latest_attempt_at: stats.latest_attempt_at
		});
	});

	return studentsList;
}
