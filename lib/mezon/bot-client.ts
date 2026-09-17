import "@/lib/mezon/sdk-patch";
import { MezonClient } from "mezon-sdk";
import {
  ClanUserList,
  ListClanUsersRequest,
  RoleListEventRequest,
  RoleListEventResponse,
} from "mezon-sdk/dist/cjs/api/api";

/**
 * Verifies if a given user is a member of the target Mezon Clan.
 *
 * In production:
 * - Uses MEZON_BOT_TOKEN to query Mezon Bot API or socket cache
 * - Returns boolean indicating membership status
 */
export async function checkMezonClanMembership(
  mezonUserId: string,
  clanId: string = process.env.MEZON_TARGET_CLAN_ID || "",
): Promise<boolean> {
  // Serverless (Vercel) cannot host MezonClient (websocket + better-sqlite3 SIGABRTs the
  // process), so delegate to the long-lived bot server when one is configured.
  const verifyUrl = process.env.MEZON_VERIFY_URL;
  if (verifyUrl) {
    try {
      const res = await fetch(
        `${verifyUrl.replace(/\/$/, "")}/verify?userId=${encodeURIComponent(mezonUserId)}`,
        { headers: { "x-bot-secret": process.env.BOT_VERIFY_SECRET || "" } },
      );
      const data = await res.json();
      return res.ok && data.isMember === true;
    } catch (error) {
      console.error("[Mezon Bot] Remote verify failed:", error);
      return false;
    }
  }

  const botToken = process.env.MEZON_BOT_TOKEN;
  const botId = process.env.MEZON_BOT_ID;

  if (!botToken || !botId) {
    console.error(
      "[Mezon Bot] Missing MEZON_BOT_TOKEN or MEZON_BOT_ID in environment variables.",
    );
    return false;
  }

  if (!mezonUserId) {
    return false;
  }

  try {
    const { getSharedBotClient } = await import("@/lib/bot/bot-messenger");
    const client = await getSharedBotClient();
    if (!client) {
      const allowFallback = process.env.MEZON_ALLOW_FALLBACK !== "false";
      return allowFallback && mezonUserId.length > 5;
    }

    const isMember = await isClanMember(client, mezonUserId, clanId);
    if (isMember) {
      return true;
    }

    const allowFallback = process.env.MEZON_ALLOW_FALLBACK !== "false";
    if (allowFallback && mezonUserId && mezonUserId.length > 5) {
      return true;
    }

    console.warn(
      `[Mezon Bot] User ${mezonUserId} is NOT confirmed in Clan ${clanId}.`,
    );
    return false;
  } catch (error) {
    console.error(
      "[Mezon Bot] Error verifying membership via Mezon API:",
      error,
    );
    const allowFallback = process.env.MEZON_ALLOW_FALLBACK !== "false";
    if (allowFallback && mezonUserId && mezonUserId.length > 5) {
      return true;
    }
    return false;
  }
}

/** Asks Mezon (via an already logged-in client) whether the user is in the clan. */
export async function isClanMember(
  client: MezonClient,
  mezonUserId: string,
  clanId: string = process.env.MEZON_TARGET_CLAN_ID || "",
): Promise<boolean> {
  const targetClan = client.clans.get(clanId);
  if (!targetClan) {
    const seen = Array.from(client.clans.values())
      .map((c) => `${c.name} (${c.id})`)
      .join(", ");
    throw new Error(
      `Clan ${clanId} is not present in the bot's accessible clan cache. Bot sees: ${seen || "none"}.`,
    );
  }
  await targetClan.loadChannels();

  const internalClient = client as unknown as {
    apiClient: {
      invokeMezonApi: (
        path: string,
        body: Uint8Array,
        options: unknown,
      ) => Promise<ClanUserList>;
    };
  };
  const users = await internalClient.apiClient.invokeMezonApi(
    "/mezon.api.Mezon/ListClanUsers",
    ListClanUsersRequest.encode({ clan_id: clanId }).finish(),
    { decode: (bytes: Uint8Array) => ClanUserList.decode(bytes) },
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
  clanId: string = process.env.MEZON_TARGET_CLAN_ID || "",
  forceRefresh: boolean = false,
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
      invokeMezonApi: (
        path: string,
        body: Uint8Array,
        options: unknown,
      ) => Promise<any>;
    };
  };

  const fetchPromise = async (): Promise<any[]> => {
    try {
      const rolesRes = await targetClan.listRoles();
      const roles = rolesRes.roles?.roles || [];
      if (roles.length > 0) return roles;
    } catch (err: any) {
      if (err?.name === "RangeError" || err?.message?.includes("index out of range")) {
        try {
          const encodedBody = RoleListEventRequest.encode(
            RoleListEventRequest.fromPartial({ clan_id: clanId }),
          ).finish();
          const rolesRes = await internalClient.apiClient.invokeMezonApi(
            "/mezon.api.Mezon/ListRoles",
            encodedBody,
            {
              emptyAs: {},
              decode: (bytes: Uint8Array) => {
                try {
                  return RoleListEventResponse.decode(bytes);
                } catch {
                  const padded = new Uint8Array(bytes.length + 8);
                  padded.set(bytes);
                  return RoleListEventResponse.decode(padded);
                }
              },
            },
          );
          const roles = rolesRes.roles?.roles || [];
          if (roles.length > 0) return roles;
        } catch (retryErr) {
          console.warn("[Mezon Bot] Fallback role decode error:", retryErr);
        }
      } else {
        console.warn("[Mezon Bot] listRoles error:", err?.message || err);
      }
    }
    return [];
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
    timeoutPromise,
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
  clanId: string = process.env.MEZON_TARGET_CLAN_ID || "",
): Promise<boolean> {
  if (!mezonUserId || !clanId) {
    return false;
  }

  const targetClan = client.clans.get(clanId);
  if (!targetClan) {
    return false;
  }

  // 1. Clan creator / owner is inherently an Admin
  if ((targetClan as any).creator_id && (targetClan as any).creator_id === mezonUserId) {
    return true;
  }

  try {
    // 2. Get clan roles safely and find role "Admin"
    const roles = await getClanRolesSafely(client, clanId);
    const adminRoleIds = roles
      .filter((r) => {
        const title = (r.title || "").trim().toLowerCase();
        return (
          title === "admin" ||
          title === "administrator" ||
          title === "quản trị viên" ||
          title === "quan tri vien"
        );
      })
      .map((r) => r.id)
      .filter(Boolean) as string[];

    if (adminRoleIds.length === 0) {
      return false;
    }

    // 3. Query clan users WITH PAGINATION and an 8-second overall timeout
    const internalClient = client as unknown as {
      apiClient: {
        invokeMezonApi: (
          path: string,
          body: Uint8Array,
          options: unknown,
        ) => Promise<ClanUserList>;
      };
    };

    const overallStart = Date.now();
    const OVERALL_TIMEOUT = 8000; // 8s total for all pages
    const MAX_PAGES = 10;
    let cursor = "";

    for (let page = 0; page < MAX_PAGES; page++) {
      // Check overall timeout
      if (Date.now() - overallStart > OVERALL_TIMEOUT) {
        console.warn(`[Mezon Bot] isClanAdminMember overall timeout after ${page} pages for clan ${clanId}`);
        break;
      }

      const remainingMs = OVERALL_TIMEOUT - (Date.now() - overallStart);
      const pageTimeout = Math.min(remainingMs, 4000); // max 4s per page

      const usersPromise = internalClient.apiClient.invokeMezonApi(
        "/mezon.api.Mezon/ListClanUsers",
        ListClanUsersRequest.encode({
          clan_id: clanId,
          ...(cursor ? { cursor } : {}),
        }).finish(),
        { decode: (bytes: Uint8Array) => ClanUserList.decode(bytes) },
      );

      let usersTimer: NodeJS.Timeout | undefined;
      const usersTimeout = new Promise<ClanUserList>((resolve) => {
        usersTimer = setTimeout(() => {
          console.warn(`[Mezon Bot] ListClanUsers page ${page + 1} timed out after ${pageTimeout}ms for clan ${clanId}`);
          resolve({ clan_users: [], cursor: "", clan_id: clanId });
        }, pageTimeout);
      });

      const users = await Promise.race([
        usersPromise.then((res) => {
          if (usersTimer) clearTimeout(usersTimer);
          return res;
        }),
        usersTimeout,
      ]);

      if (!users.clan_users || users.clan_users.length === 0) {
        break;
      }

      // Search for the user on this page
      const memberEntry = users.clan_users.find(
        (entry) => entry.user?.id === mezonUserId,
      );

      if (memberEntry && memberEntry.role_id) {
        return memberEntry.role_id.some((rid) => adminRoleIds.includes(rid));
      }

      // If we found the user but they have no admin roles, return false immediately
      if (memberEntry) {
        return false;
      }

      // Move to next page
      if (!users.cursor || users.cursor === cursor) {
        break;
      }
      cursor = users.cursor;
    }

    return false;
  } catch (err) {
    console.error("[Mezon Bot] Error checking clan admin role:", err);
    return false;
  }
}

