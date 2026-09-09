import { MezonClient, ChannelMessageContent, ApiMessageMention } from "mezon-sdk";
import type { TextChannel } from "mezon-sdk/dist/cjs/mezon-client/structures/TextChannel";
import { pgDb } from "@/lib/db/postgres";
import { formatIELTSResult } from "./bot-formatter";

let sharedClient: MezonClient | null = null;
let connectionPromise: Promise<MezonClient | null> | null = null;

export function setSharedBotClient(client: MezonClient) {
  sharedClient = client;
}

export async function getSharedBotClient(): Promise<MezonClient | null> {
  const botToken = process.env.MEZON_BOT_TOKEN;
  const botId = process.env.MEZON_BOT_ID;

  if (!botToken || !botId) {
    console.error(
      "[Mezon Bot Messenger] Missing MEZON_BOT_TOKEN or MEZON_BOT_ID in env.",
    );
    return null;
  }

  if (sharedClient) {
    return sharedClient;
  }

  if (connectionPromise) {
    return connectionPromise;
  }

  connectionPromise = (async () => {
    try {
      const configuredHost = process.env.MEZON_HOST || "gw.mezon.ai";
      const host = configuredHost
        .replace(/^https?:\/\//, "")
        .replace(/\/$/, "");
      const port =
        process.env.MEZON_PORT ||
        (configuredHost.startsWith("http://") ? "80" : "443");
      const useSSL = process.env.MEZON_USE_SSL
        ? process.env.MEZON_USE_SSL !== "false"
        : !configuredHost.startsWith("http://") && port === "443";

      const client = new MezonClient({
        botId,
        token: botToken,
        host,
        port,
        useSSL,
      });

      await client.login();
      sharedClient = client;
      return client;
    } catch (err) {
      console.error(
        "[Mezon Bot Messenger] Failed to authenticate MezonClient:",
        err,
      );
      return null;
    } finally {
      connectionPromise = null;
    }
  })();

  return connectionPromise;
}

/**
 * Helper to resolve a channel by ID from clan cache or client cache
 */
export async function resolveChannel(
  client: MezonClient,
  channelId: string,
  clanId?: string,
): Promise<TextChannel | null> {
  const targetClanId = clanId || process.env.MEZON_TARGET_CLAN_ID || "";
  if (targetClanId) {
    const clan = client.clans.get(targetClanId);
    if (clan) {
      await clan.loadChannels();
      const channel = clan.channels.get(channelId);
      if (channel) return channel;
    }
  }

  // Search across clans
  for (const clan of client.clans.values()) {
    try {
      await clan.loadChannels();
      const channel = clan.channels.get(channelId);
      if (channel) return channel;
    } catch {
      // ignore
    }
  }

  // Direct fetch via client channels cache manager
  try {
    const channel =
      client.channels.get(channelId) ||
      (await client.channels.fetch(channelId));
    if (channel) return channel;
  } catch {
    // ignore
  }

  return null;
}

/**
 * Sends an ephemeral message (only visible to the receiver) to a channel.
 */
export async function sendEphemeralMessage(
  channel: TextChannel,
  receiverId: string,
  content: ChannelMessageContent,
  replyToMessageId?: string,
) {
  try {
    const response = await channel.sendEphemeral(
      receiverId,
      content,
      replyToMessageId,
    );
    console.log(`[Mezon Bot Messenger] Ephemeral message sent to ${receiverId}`);
    return response;
  } catch (error) {
    console.error(`[Mezon Bot Messenger] Failed to send ephemeral message:`, error);
    throw error;
  }
}

/**
 * Safely splits a message into chunks under maxChunkLength (default: 3500 chars).
 * Prioritizes splitting on explicit ===SPLIT_MESSAGE=== delimiter, followed by
 * section divider lines or double linebreaks to avoid mid-sentence cuts.
 */
function splitTextIntoChunks(text: string, maxChunkLength = 3500): string[] {
  if (!text) return [];

  // 1. If explicit split marker is present, split by it first
  const explicitParts = text
    .split(/\n*===SPLIT_MESSAGE===\n*/)
    .map((p) => p.trim())
    .filter(Boolean);

  const finalChunks: string[] = [];

  for (const part of explicitParts) {
    if (part.length <= maxChunkLength) {
      finalChunks.push(part);
      continue;
    }

    // Subdivide if any individual part still exceeds maxChunkLength
    let remaining = part;
    while (remaining.length > maxChunkLength) {
      let splitIdx = remaining.lastIndexOf("\n━━━━━━━━━━━━━━━━━━━━━━━━━━\n", maxChunkLength);
      if (splitIdx === -1 || splitIdx < maxChunkLength / 2) {
        splitIdx = remaining.lastIndexOf("\n\n", maxChunkLength);
      }
      if (splitIdx === -1 || splitIdx < maxChunkLength / 2) {
        splitIdx = remaining.lastIndexOf("\n", maxChunkLength);
      }
      if (splitIdx === -1) {
        splitIdx = maxChunkLength;
      }
      finalChunks.push(remaining.slice(0, splitIdx).trim());
      remaining = remaining.slice(splitIdx).trim();
    }
    if (remaining.length > 0) {
      finalChunks.push(remaining);
    }
  }

  return finalChunks;
}

/**
 * Detects standalone URLs in text and generates Mezon LinkOnMessage { s, e } ranges
 * so that the Mezon client renders them as active clickable links.
 */
function extractLinksFromText(text: string): Array<{ s: number; e: number }> {
  const lk: Array<{ s: number; e: number }> = [];
  const urlRegex = /(https?:\/\/[^\s\)\>]+)/g;
  let match;
  while ((match = urlRegex.exec(text)) !== null) {
    lk.push({
      s: match.index,
      e: match.index + match[0].length,
    });
  }
  return lk;
}

/**
 * Builds a ChannelMessageContent object with text, link ranges (lk), and components.
 */
function buildMessageContent(
  text: string,
  components?: any[],
): ChannelMessageContent {
  const content: any = { t: text };
  const lk = extractLinksFromText(text);
  if (lk.length > 0) {
    content.lk = lk;
  }
  if (components && components.length > 0) {
    content.components = components;
  }
  return content;
}

/**
 * Sends a message to a clan channel (public or ephemeral/private)
 */
export async function sendChannelMessage(
  channelId: string,
  text: string,
  options?: {
    clanId?: string;
    isPublic?: boolean;
    mentions?: Array<{ user_id: string; username?: string }>;
    replyToMessageId?: string;
    components?: any[];
  },
): Promise<boolean> {
  const client = await getSharedBotClient();
  if (!client) return false;

  const channel = await resolveChannel(client, channelId, options?.clanId);
  if (!channel) {
    console.warn(`[Mezon Bot Messenger] Channel ${channelId} not found.`);
    return false;
  }

  // Ensure channel.clan is attached so channel.send / channel.sendEphemeral does not fail on this.clan.id
  if (!channel.clan) {
    const clanId = options?.clanId || (channel as any).clan_id || process.env.MEZON_TARGET_CLAN_ID;
    if (clanId && client.clans.get(clanId)) {
      (channel as any).clan = client.clans.get(clanId);
    }
  }

  const mentions = options?.mentions || [];
  const isPublic = options?.isPublic !== undefined ? options.isPublic : true;
  const chunks = splitTextIntoChunks(text, 3500);

  try {
    if (!isPublic && mentions.length > 0) {
      const receiverId = mentions[0].user_id;
      try {
        console.log(
          `[Mezon Bot Messenger] Delivering ephemeral message (${chunks.length} chunk(s)) to user ${receiverId} in channel ${channelId}...`,
        );
        for (let i = 0; i < chunks.length; i++) {
          const isLast = i === chunks.length - 1;
          const content = buildMessageContent(
            chunks[i],
            isLast ? options?.components : undefined,
          );
          await sendEphemeralMessage(
            channel,
            receiverId,
            content,
            undefined, // Keep undefined to avoid SQLite cache miss errors
          );
          if (i < chunks.length - 1) {
            await new Promise((resolve) => setTimeout(resolve, 300));
          }
        }
        console.log(
          `[Mezon Bot Messenger] ✅ Ephemeral message delivered successfully to ${receiverId}`,
        );
        return true;
      } catch (ephemeralErr) {
        console.warn(
          `[Mezon Bot Messenger] sendEphemeral failed, falling back to regular channel send with mention:`,
          ephemeralErr,
        );
        // Fallback to sending in channel with mention
        for (let i = 0; i < chunks.length; i++) {
          const isLast = i === chunks.length - 1;
          const content = buildMessageContent(
            chunks[i],
            isLast ? options?.components : undefined,
          );
          await channel.send(
            content,
            mentions.map((m) => ({
              user_id: m.user_id,
              username: m.username || "",
            })),
          );
          if (i < chunks.length - 1) {
            await new Promise((resolve) => setTimeout(resolve, 300));
          }
        }
        return true;
      }
    }

    for (let i = 0; i < chunks.length; i++) {
      const isLast = i === chunks.length - 1;
      const content = buildMessageContent(
        chunks[i],
        isLast ? options?.components : undefined,
      );
      await channel.send(
        content,
        mentions.map((m) => ({
          user_id: m.user_id,
          username: m.username || "",
        })),
      );
      if (i < chunks.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 300));
      }
    }
    return true;
  } catch (err) {
    console.error(
      `[Mezon Bot Messenger] Error sending to channel ${channelId}:`,
      err,
    );
    return false;
  }
}

/**
 * Sends a Direct Message fallback to a specific user
 */
export async function sendDirectMessage(
  userId: string,
  text: string,
  options?: {
    components?: any[];
  },
): Promise<boolean> {
  const client = await getSharedBotClient();
  if (!client) return false;

  try {
    const user =
      client.users.get(userId) || (await client.users.fetch(userId));
    if (user) {
      const chunks = splitTextIntoChunks(text, 3500);
      for (let i = 0; i < chunks.length; i++) {
        const isLast = i === chunks.length - 1;
        const content = buildMessageContent(
          chunks[i],
          isLast ? options?.components : undefined,
        );
        await user.sendDM(content);
        if (i < chunks.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 300));
        }
      }
      return true;
    }
  } catch (err) {
    console.error(
      `[Mezon Bot Messenger] Error sending DM to user ${userId}:`,
      err,
    );
  }
  return false;
}

/**
 * High-level function: Notifies an IELTS Speaking result to the user in the "Thi thử" channel
 * as an ephemeral message tagging the user, with DM fallback.
 */
export async function notifyExamResult(
  targetMezonUserId: string,
  attemptId: string,
  targetChannelId?: string,
): Promise<{ success: boolean; message: string; channelId?: string }> {
  const user = await pgDb.getUserByMezonId(targetMezonUserId);
  if (!user) {
    return {
      success: false,
      message: "User account was not found in the exam database.",
    };
  }

  const attempt = await pgDb.getIELTSAttempt(attemptId);
  if (!attempt) {
    return {
      success: false,
      message: `IELTS Speaking test record ${attemptId} was not found.`,
    };
  }

  const formattedResult = formatIELTSResult(
    attempt,
    user.display_name || user.mezon_username,
  );

  const examChannelId =
    targetChannelId ||
    process.env.MEZON_EXAM_CHANNEL_ID ||
    process.env.MEZON_WELCOME_CHANNEL_ID ||
    "";

  const messageText = `👋 Hello @${user.mezon_username || user.display_name}, your IELTS Speaking test report is ready!\n\n${formattedResult}`;

  let sent = false;

  if (examChannelId) {
    sent = await sendChannelMessage(examChannelId, messageText, {
      isPublic: false, // Ephemeral / private to user
      mentions: [
        {
          user_id: targetMezonUserId,
          username: user.mezon_username || user.display_name,
        },
      ],
    });
  }

  // If channel sending was not configured or failed, fallback to DM
  if (!sent) {
    const dmSent = await sendDirectMessage(targetMezonUserId, messageText);
    if (dmSent) {
      return {
        success: true,
        message: "Your test report has been sent directly to you via Mezon DM!",
      };
    }
    return {
      success: false,
      message:
        "Failed to send message via clan channel or DM. Please verify the bot connection!",
    };
  }

  return {
    success: true,
    message:
      "Your test report has been sent to you in the exam channel on Mezon Clan!",
    channelId: examChannelId,
  };
}
