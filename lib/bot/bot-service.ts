import { MezonClient } from "mezon-sdk";
import {
  handleResultCommand,
  handleHistoryCommand,
  handleTestingNowCommand,
  getHelpMessage,
} from "./bot-commands";
import {
  setSharedBotClient,
  sendChannelMessage,
  sendDirectMessage,
} from "./bot-messenger";

declare global {
  // eslint-disable-next-line no-var
  var __mezonBotStarted: boolean | undefined;
  // eslint-disable-next-line no-var
  var __mezonBotClient: MezonClient | undefined;
}

/**
 * Safely extracts message text across all formats (string, JSON string, object)
 */
function extractMessageText(content: any): string {
  if (!content) return "";
  if (typeof content === "string") {
    const trimmed = content.trim();
    if (
      (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
      (trimmed.startsWith('"') && trimmed.endsWith('"'))
    ) {
      try {
        const parsed = JSON.parse(trimmed);
        if (typeof parsed === "string") return parsed.trim();
        if (parsed && typeof parsed === "object") {
          return (parsed.t || parsed.text || parsed.content || trimmed).trim();
        }
      } catch {
        return trimmed;
      }
    }
    return trimmed;
  }
  if (typeof content === "object") {
    return (content.t || content.text || content.content || "").trim();
  }
  return String(content).trim();
}

/**
 * Initializes and starts the Mezon Bot client if not already running.
 * Uses a global singleton guard to prevent duplicate logins during Next.js HMR.
 */
export async function initBotService(): Promise<MezonClient | null> {
  // Prevent duplicate execution during Next.js Hot Module Replacement (HMR) or multi-runtime calls
  if (globalThis.__mezonBotStarted && globalThis.__mezonBotClient) {
    return globalThis.__mezonBotClient;
  }

  const botToken = process.env.MEZON_BOT_TOKEN;
  const botId = process.env.MEZON_BOT_ID;
  const targetClanId = process.env.MEZON_TARGET_CLAN_ID || "";
  const examChannelId = process.env.MEZON_EXAM_CHANNEL_ID || "";
  const welcomeChannelId =
    process.env.MEZON_WELCOME_CHANNEL_ID || examChannelId;

  if (!botToken || !botId) {
    console.warn(
      "⚠️ [Mezon Bot Service] MEZON_BOT_TOKEN or MEZON_BOT_ID is not configured. Bot service skipped.",
    );
    return null;
  }

  globalThis.__mezonBotStarted = true;

  try {
    const configuredHost = process.env.MEZON_HOST || "gw.mezon.ai";
    const host = configuredHost.replace(/^https?:\/\//, "").replace(/\/$/, "");
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

    // Event 1: Triggered when a new user joins the clan
    client.onAddClanUser(async (event: any) => {
      try {
        const userId = event?.user?.user_id;
        const username =
          event?.user?.display_name || event?.user?.username || "friend";
        const clanId = event?.clan_id || targetClanId;

        const welcomeMsg =
          `🎉 **Welcome @${username} to our Mezon Clan!**\n\n` +
          `• Type \`*testingnow\` (or \`*thi\`) to immediately generate your speaking test room link and start practicing!\n` +
          `• Type \`*result\` to view your latest IELTS Speaking mock test score report.\n` +
          `• Type \`*help\` to view all available commands.`;

        if (welcomeChannelId) {
          await sendChannelMessage(welcomeChannelId, welcomeMsg, {
            isPublic: true,
            mentions: [{ user_id: userId, username }],
          });
        } else if (userId) {
          await sendDirectMessage(userId, welcomeMsg);
        }
      } catch (err) {
        console.error("[Mezon Bot Service] Error handling onAddClanUser:", err);
      }
    });

    // Event 2: Triggered when a message is sent in any channel
    client.onChannelMessage(async (message: any) => {
      try {
        // Ignore bot's own messages
        if (
          message.sender_id === botId ||
          message.sender_id === client.clientId
        ) {
          return;
        }

        const contentText = extractMessageText(message.content);
        if (!contentText.startsWith("*")) return;

        const [cmd, ...args] = contentText.slice(1).trim().split(/\s+/);
        const commandName = cmd.toLowerCase();

        if (
          commandName === "result" ||
          commandName === "ketqua" ||
          commandName === "score" ||
          commandName === "kq"
        ) {
          const res = await handleResultCommand(message.sender_id, args);
          const sent = await sendChannelMessage(message.channel_id, res.text, {
            clanId: message.clan_id,
            isPublic: false,
            mentions: [
              {
                user_id: message.sender_id,
                username: message.username || message.display_name,
              },
            ],
          });

          if (!sent) {
            console.warn(
              `[Mezon Bot Service] Channel send failed, falling back to DM...`,
            );
            await sendDirectMessage(message.sender_id, res.text);
          }
        } else if (
          commandName === "history" ||
          commandName === "lichsu" ||
          commandName === "recent"
        ) {
          const res = await handleHistoryCommand(message.sender_id);
          const sent = await sendChannelMessage(message.channel_id, res.text, {
            clanId: message.clan_id,
            isPublic: false,
            mentions: [
              {
                user_id: message.sender_id,
                username: message.username || message.display_name,
              },
            ],
          });

          if (!sent) {
            console.warn(
              `[Mezon Bot Service] Channel send failed, falling back to DM...`,
            );
            await sendDirectMessage(message.sender_id, res.text);
          }
        } else if (
          commandName === "testingnow" ||
          commandName === "testnow" ||
          commandName === "thi" ||
          commandName === "starttest" ||
          commandName === "test"
        ) {
          console.log(
            `[Mezon Bot Service] Processing *${commandName} for user: ${message.sender_id}...`,
          );
          const res = await handleTestingNowCommand(
            message.sender_id,
            {
              username: message.username || message.display_name,
              displayName: message.display_name || message.username,
              avatarUrl: message.avatar,
            },
            args,
          );

          const sent = await sendChannelMessage(message.channel_id, res.text, {
            clanId: message.clan_id,
            isPublic: false,
            mentions: [
              {
                user_id: message.sender_id,
                username: message.username || message.display_name,
              },
            ],
            components: res.components,
          });

          if (!sent) {
            console.warn(
              `[Mezon Bot Service] Channel send failed, falling back to DM...`,
            );
            await sendDirectMessage(message.sender_id, res.text, {
              components: res.components,
            });
          }
          console.log(
            `[Mezon Bot Service] ✅ Sent *${commandName} link to user ${message.sender_id}`,
          );
        } else if (commandName === "help" || commandName === "trogiup") {
          const helpMsg = getHelpMessage();
          await sendChannelMessage(message.channel_id, helpMsg, {
            clanId: message.clan_id,
            isPublic: false,
            mentions: [{ user_id: message.sender_id }],
          });
        }
      } catch (err) {
        console.error(
          "[Mezon Bot Service] Error handling onChannelMessage:",
          err,
        );
      }
    });

    // Connect & authenticate
    await client.login();
    setSharedBotClient(client);
    globalThis.__mezonBotClient = client;

    console.log(
      "✅ [Mezon Bot Service] Connected and logged into Mezon successfully!",
    );

    // Enumerate clans & channels, and explicitly join channels so the bot receives events
    try {
      const clans = Array.from(client.clans.values());
      for (const clan of clans) {
        try {
          await clan.loadChannels();
          const channels = Array.from(clan.channels.values());
          for (const ch of channels) {
            try {
              const socket = (client as any).socketManager?.socket;
              if (socket) {
                await socket.joinChat(
                  clan.id,
                  ch.id,
                  ch.channel_type || 1,
                  !ch.is_private,
                );
              }
            } catch {
              // ignore socket join failures
            }
          }
        } catch (err) {
          console.warn(
            `[Mezon Bot Service] Could not load channels for clan ${clan.id}:`,
            err,
          );
        }
      }
    } catch (clanErr) {
      console.warn("[Mezon Bot Service] Could not enumerate clans:", clanErr);
    }

    // Also explicitly join Exam Channel if defined
    if (examChannelId) {
      try {
        const examCh = await client.channels.fetch(examChannelId);
        if (examCh) {
          const socket = (client as any).socketManager?.socket;
          if (socket) {
            await socket.joinChat(
              (examCh as any).clan_id || targetClanId || "0",
              examChannelId,
              examCh.channel_type || 1,
              !examCh.is_private,
            );
          }
        }
      } catch {
        // ignore
      }
    }

    console.log(
      "📡 [Mezon Bot Service] Listening for clan events and bot commands (*testingnow, *result, *history, *help)...",
    );
    return client;
  } catch (err) {
    console.error("❌ [Mezon Bot Service] Failed to connect to Mezon:", err);
    globalThis.__mezonBotStarted = false;
    return null;
  }
}

export const startBot = initBotService;
