import '@/lib/mezon/sdk-patch';
import { MezonClient } from 'mezon-sdk';
import {
	ClanUserList,
	ListClanUsersRequest,
	ListRoleUsersRequest,
	RoleListEventRequest,
	RoleListEventResponse,
	RoleUserList
} from 'mezon-sdk/dist/cjs/api/api';

/**
 * Verifies if a given user is a member of the target Mezon Clan.
 *
 * In production:
 * - Uses MEZON_BOT_TOKEN to query Mezon Bot API or socket cache
 * - Returns boolean indicating membership status
 */
export async function checkMezonClanMembership(mezonUserId: string, clanId: string = process.env.MEZON_TARGET_CLAN_ID || ''): Promise<boolean> {
	if (!mezonUserId) {
		return false;
	}

	// 1. Check in-process bot client directly if available
	try {
		const { getSharedBotClient } = await import('@/lib/bot/bot-messenger');
		const client = await getSharedBotClient();
		if (client) {
			const isMember = await isClanMember(client, mezonUserId, clanId);
			if (isMember) {
				return true;
			}
			console.warn(`[Mezon Bot] User ${mezonUserId} is NOT confirmed in Clan ${clanId}.`);
			const allowFallback = process.env.MEZON_ALLOW_FALLBACK !== 'false';
			return allowFallback && mezonUserId.length > 5;
		}
	} catch (error) {
		console.error('[Mezon Bot] Error checking membership via in-process bot:', error);
	}

	// 2. Fallback: Delegate to remote bot server if configured (e.g. Vercel deployment)
	const verifyUrl = process.env.MEZON_VERIFY_URL;
	if (verifyUrl) {
		try {
			const res = await fetch(`${verifyUrl.replace(/\/$/, '')}/verify?userId=${encodeURIComponent(mezonUserId)}`, {
				headers: { 'x-bot-secret': process.env.BOT_VERIFY_SECRET || '' }
			});
			const data = await res.json();
			return res.ok && data.isMember === true;
		} catch (error) {
			console.error('[Mezon Bot] Remote verify failed:', error);
		}
	}

	const allowFallback = process.env.MEZON_ALLOW_FALLBACK !== 'false';
	return allowFallback && mezonUserId.length > 5;
}

/** Asks Mezon (via an already logged-in client) whether the user is in the clan. */
export async function isClanMember(
	client: MezonClient,
	mezonUserId: string,
	clanId: string = process.env.MEZON_TARGET_CLAN_ID || ''
): Promise<boolean> {
	const targetClan = client.clans.get(clanId);
	if (!targetClan) {
		const seen = Array.from(client.clans.values())
			.map((c) => `${c.name} (${c.id})`)
			.join(', ');
		throw new Error(`Clan ${clanId} is not present in the bot's accessible clan cache. Bot sees: ${seen || 'none'}.`);
	}
	await targetClan.loadChannels();

	const internalClient = client as unknown as {
		apiClient: {
			invokeMezonApi: (path: string, body: Uint8Array, options: unknown) => Promise<ClanUserList>;
		};
	};
	const users = await internalClient.apiClient.invokeMezonApi(
		'/mezon.api.Mezon/ListClanUsers',
		ListClanUsersRequest.encode({ clan_id: clanId }).finish(),
		{ decode: (bytes: Uint8Array) => ClanUserList.decode(bytes) }
	);
	return users.clan_users.some((entry) => entry.user?.id === mezonUserId);
}

const clanRolesCache = new Map<string, { roles: any[]; expiresAt: number }>();

export function clearClanRolesCache(clanId?: string) {
	if (clanId) {
		clanRolesCache.delete(clanId);
	} else {
		clanRolesCache.clear();
	}
}

/**
 * Safely fetches clan roles with an 8s timeout, handles abridged protobuf padding
 * issues, and caches roles for 60 seconds (unless forceRefresh is true).
 */
export async function getClanRolesSafely(
	client: MezonClient,
	clanId: string = process.env.MEZON_TARGET_CLAN_ID || '',
	forceRefresh: boolean = false
): Promise<any[]> {
	if (!clanId) return [];

	if (forceRefresh) {
		clanRolesCache.delete(clanId);
	} else {
		const cached = clanRolesCache.get(clanId);
		if (cached && Date.now() < cached.expiresAt) {
			return cached.roles;
		}
	}

	const targetClan = client.clans.get(clanId);
	if (!targetClan) {
		return [];
	}

	const internalClient = client as unknown as {
		apiClient: {
			invokeMezonApi: (path: string, body: Uint8Array, options: unknown) => Promise<any>;
		};
	};

	// ListRoles is paginated by Mezon (same as ListClanUsers) - a single call only
	// returns one page, so we must follow `cursor` until it's exhausted or a page is empty.
	const fetchPromise = async (): Promise<any[]> => {
		const collected: any[] = [];
		let cursor = '';
		const MAX_PAGES = 10;

		for (let page = 0; page < MAX_PAGES; page++) {
			try {
				const encodedBody = RoleListEventRequest.encode(RoleListEventRequest.fromPartial({ clan_id: clanId, cursor })).finish();
				const rolesRes = await internalClient.apiClient.invokeMezonApi('/mezon.api.Mezon/ListRoles', encodedBody, {
					emptyAs: {},
					decode: (bytes: Uint8Array) => RoleListEventResponse.decode(bytes)
				});
				const pageRoles = rolesRes.roles?.roles || [];
				collected.push(...pageRoles);

				if (!rolesRes.cursor || rolesRes.cursor === cursor || pageRoles.length === 0) {
					break;
				}
				cursor = rolesRes.cursor;
			} catch (err: any) {
				console.warn('[Mezon Bot] listRoles page error:', err?.message || err);
				break;
			}
		}

		return collected;
	};

	let timer: NodeJS.Timeout | undefined;
	const timeoutPromise = new Promise<any[]>((resolve) => {
		timer = setTimeout(() => {
			console.warn(`[Mezon Bot] getClanRolesSafely timed out after 8000ms for clan ${clanId}`);
			resolve([]);
		}, 8000);
	});

	const roles = await Promise.race([
		fetchPromise().then((res) => {
			if (timer) clearTimeout(timer);
			return res;
		}),
		timeoutPromise
	]);

	if (roles.length > 0) {
		clanRolesCache.set(clanId, { roles, expiresAt: Date.now() + 60_000 });
	}

	return roles;
}

/** Asks Mezon whether the user has the role "Admin" in the clan. */
export async function isClanAdminMember(
	client: MezonClient,
	mezonUserId: string,
	clanId: string = process.env.MEZON_TARGET_CLAN_ID || ''
): Promise<boolean> {
	if (!mezonUserId || !clanId) {
		return false;
	}

	const targetClan = client.clans.get(clanId);
	if (!targetClan) {
		return false;
	}

	// 1. Clan creator / owner is inherently an Admin.
	// Note: the SDK's `Clan` object never carries `creator_id` (dropped when it builds
	// Clan instances from ClanDesc), so it has to be looked up via listClanDescs instead.
	try {
		const clanDescs: any = await (targetClan as any).apiClient.listClanDescs((targetClan as any).sessionToken);
		const clanDesc = clanDescs?.clandesc?.find((c: any) => c.clan_id === clanId);
		if (clanDesc?.creator_id && clanDesc.creator_id === mezonUserId) {
			return true;
		}
	} catch (err) {
		console.warn('[Mezon Bot] Could not verify clan creator:', err);
	}

	try {
		// 2. Get clan roles safely and find roles carrying the active "Administrator" permission.
		// This is an access-control gate, so always bypass getClanRolesSafely's 60s cache -
		// a role change (e.g. revoking admin) must take effect on the very next check.
		const roles = await getClanRolesSafely(client, clanId, true);

		// Drop roles with no permission data at all (e.g. an incomplete/unsaved role)
		// before looking for the admin one.
		const rolesWithPermissions = roles.filter((r) => (r.permission_list?.permissions || []).length > 0);

		const adminRoleIds = rolesWithPermissions
			.filter((r) => {
				const permissions = r.permission_list?.permissions || [];
				return permissions.some((p: any) => {
					const slug = (p.slug || '').trim().toLowerCase();
					const title = (p.title || '').trim().toLowerCase();
					return (slug === 'administrator' || title === 'administrator') && Number(p.active) === 1;
				});
			})
			.map((r) => r.id)
			.filter(Boolean) as string[];

		if (adminRoleIds.length === 0) {
			return false;
		}

		// 3. For each admin role, list ONLY the users holding that role (small set,
		// independent of total clan size) instead of paginating through every clan member.
		const internalClient = client as unknown as {
			apiClient: {
				invokeMezonApi: (path: string, body: Uint8Array, options: unknown) => Promise<RoleUserList>;
			};
		};

		const overallStart = Date.now();
		const OVERALL_TIMEOUT = 8000; // 8s total across all roles/pages
		const MAX_PAGES_PER_ROLE = 10;

		for (const roleId of adminRoleIds) {
			let cursor = '';

			for (let page = 0; page < MAX_PAGES_PER_ROLE; page++) {
				if (Date.now() - overallStart > OVERALL_TIMEOUT) {
					console.warn(`[Mezon Bot] isClanAdminMember overall timeout while scanning role ${roleId} for clan ${clanId}`);
					return false;
				}

				const remainingMs = OVERALL_TIMEOUT - (Date.now() - overallStart);
				const pageTimeout = Math.min(remainingMs, 4000);

				const usersPromise = internalClient.apiClient.invokeMezonApi(
					'/mezon.api.Mezon/ListRoleUsers',
					ListRoleUsersRequest.encode({
						role_id: roleId,
						limit: 100,
						cursor
					}).finish(),
					{ decode: (bytes: Uint8Array) => RoleUserList.decode(bytes) }
				);

				let usersTimer: NodeJS.Timeout | undefined;
				const usersTimeout = new Promise<RoleUserList>((resolve) => {
					usersTimer = setTimeout(() => {
						console.warn(`[Mezon Bot] ListRoleUsers page ${page + 1} timed out after ${pageTimeout}ms for role ${roleId}`);
						resolve({ role_users: [], cursor: '' });
					}, pageTimeout);
				});

				const res = await Promise.race([
					usersPromise.then((r) => {
						if (usersTimer) clearTimeout(usersTimer);
						return r;
					}),
					usersTimeout
				]);

				if (res.role_users?.some((u) => u.id === mezonUserId)) {
					return true;
				}

				if (!res.cursor || res.cursor === cursor) {
					break;
				}
				cursor = res.cursor;
			}
		}

		return false;
	} catch (err) {
		console.error('[Mezon Bot] Error checking clan admin role:', err);
		return false;
	}
}
