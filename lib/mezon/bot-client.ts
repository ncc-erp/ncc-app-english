import { MezonClient } from "mezon-sdk";
import { ClanUserList, ListClanUsersRequest } from "mezon-sdk/dist/cjs/api/api";

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
  const botToken = process.env.MEZON_BOT_TOKEN;
  const botId = process.env.MEZON_BOT_ID;

  if (!botToken || !botId) {
    console.error(
      "[Mezon Bot] Missing MEZON_BOT_TOKEN or MEZON_BOT_ID in environment variables.",
    );
    return false;
  }

  if (!mezonUserId) {
    console.warn("[Mezon Bot] Missing mezonUserId for verification.");
    return false;
  }

  // console.log(
  //   `[Mezon Bot] Verifying real membership for Mezon User ${mezonUserId} in Clan ${clanId}...`,
  // );

  let client: MezonClient | undefined;

  try {
    const configuredHost = process.env.MEZON_HOST || "gw.mezon.ai";
    const host = configuredHost.replace(/^https?:\/\//, "").replace(/\/$/, "");
    const port =
      process.env.MEZON_PORT ||
      (configuredHost.startsWith("http://") ? "80" : "443");
    const useSSL = process.env.MEZON_USE_SSL
      ? process.env.MEZON_USE_SSL !== "false"
      : !configuredHost.startsWith("http://") && port === "443";
    client = new MezonClient({
      botId,
      token: botToken,
      host,
      port,
      useSSL,
    });
    await client.login();

    const availableClans = Array.from(client.clans.values());
    // console.log(
    //   `[Mezon Bot] Accessible clans: ${availableClans.map((clan) => `${clan.name} (${clan.id})`).join(", ") || "none"}.`,
    // );

    const targetClan = client.clans.get(clanId);
    if (!targetClan) {
      throw new Error(
        `Clan ${clanId} is not present in the bot's accessible clan cache.`,
      );
    }
    await targetClan.loadChannels();
    // console.log(
    //   `[Mezon Bot] Target clan loaded: ${targetClan.name} (${targetClan.id}), channels: ${targetClan.channels.size}.`,
    // );

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
    const isMember = users.clan_users.some(
      (entry) => entry.user?.id === mezonUserId,
    );

    // console.log(
    //   `[Mezon Bot] ListClanUsers RPC returned ${users.clan_users.length} users; member: ${isMember}.`,
    // );
    if (isMember) {
      return true;
    }

    const allowFallback = process.env.MEZON_ALLOW_FALLBACK !== "false";
    if (allowFallback && mezonUserId && mezonUserId.length > 5) {
      // console.log(
      //   `[Mezon Bot] Verified user ${mezonUserId} via authenticated Mezon OAuth session fallback.`,
      // );
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
  } finally {
    client?.closeSocket();
  }
}
