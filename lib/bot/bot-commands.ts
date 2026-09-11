import { pgDb } from "@/lib/db/postgres";
import { formatIELTSResult, formatIELTSTestHistory } from "./bot-formatter";
import { createLaunchToken, getAppBaseUrl } from "@/lib/auth/launch-token";

export interface CommandResult {
  text: string;
  isSuccess: boolean;
  components?: any[];
}

/**
 * Handles the `*result` command (alias: `*ketqua`).
 * If args has an attempt ID, fetches that specific attempt.
 * Otherwise, fetches the user's latest submitted attempt.
 */
export async function handleResultCommand(
  mezonUserId: string,
  args: string[] = [],
): Promise<CommandResult> {
  const user = await pgDb.getUserByMezonId(mezonUserId);
  if (!user) {
    return {
      text: `⚠️ Your Mezon account was not found in the exam system. Please log in to the web app first!`,
      isSuccess: false,
    };
  }

  const specificAttemptId = args[0]?.trim();

  if (specificAttemptId) {
    const attempt = await pgDb.getIELTSAttemptByIdAndUser(
      specificAttemptId,
      user.user_id,
    );

    if (!attempt) {
      // Also try direct lookup in case attempt belongs to mezon_id
      const directAttempt = await pgDb.getIELTSAttempt(specificAttemptId);
      if (
        directAttempt &&
        (directAttempt.user_id === user.user_id ||
          directAttempt.user_id === user.mezon_id)
      ) {
        return {
          text: formatIELTSResult(
            directAttempt,
            user.display_name || user.mezon_username,
          ),
          isSuccess: true,
        };
      }

      return {
        text: `⚠️ Could not find IELTS Speaking test with ID \`${specificAttemptId}\` or this test does not belong to your account.`,
        isSuccess: false,
      };
    }

    return {
      text: formatIELTSResult(
        attempt,
        user.display_name || user.mezon_username,
      ),
      isSuccess: true,
    };
  }

  // Get latest submitted attempt (try user.user_id first, fallback to mezon_id)
  let latestAttempt = await pgDb.getLatestSubmittedIELTSAttempt(user.user_id);
  if (!latestAttempt && user.mezon_id) {
    latestAttempt = await pgDb.getLatestSubmittedIELTSAttempt(user.mezon_id);
  }
  if (!latestAttempt && mezonUserId) {
    latestAttempt = await pgDb.getLatestSubmittedIELTSAttempt(mezonUserId);
  }

  if (!latestAttempt) {
    return {
      text: `ℹ️ You have not completed any IELTS Speaking tests yet. Head over to the web app to start your first test!`,
      isSuccess: false,
    };
  }

  return {
    text: formatIELTSResult(
      latestAttempt,
      user.display_name || user.mezon_username,
    ),
    isSuccess: true,
  };
}

/**
 * Handles the `*history` command (alias: `*lichsu`) to list recent IELTS Speaking tests.
 */
export async function handleHistoryCommand(
  mezonUserId: string,
): Promise<CommandResult> {
  const user = await pgDb.getUserByMezonId(mezonUserId);
  if (!user) {
    return {
      text: `⚠️ Your Mezon account was not found in the system. Please log in to the web app first!`,
      isSuccess: false,
    };
  }

  let attempts = await pgDb.getRecentIELTSAttempts(user.user_id, 10);
  if (attempts.length === 0 && user.mezon_id) {
    attempts = await pgDb.getRecentIELTSAttempts(user.mezon_id, 10);
  }
  if (attempts.length === 0 && mezonUserId) {
    attempts = await pgDb.getRecentIELTSAttempts(mezonUserId, 10);
  }

  return {
    text: formatIELTSTestHistory(
      attempts,
      user.display_name || user.mezon_username,
    ),
    isSuccess: true,
  };
}

/**
 * Handles `*testingnow` command (aliases: `*testnow`, `*thi`, `*starttest`).
 * Creates a new IELTS Speaking attempt for the user and generates a personalized test room link.
 */
export async function handleTestingNowCommand(
  mezonUserId: string,
  userInfo?: { username?: string; displayName?: string; avatarUrl?: string },
  args: string[] = [],
): Promise<CommandResult> {
  // 1. Ensure user is in PostgreSQL DB
  let user = await pgDb.getUserByMezonId(mezonUserId);
  if (!user) {
    user = await pgDb.findOrCreateUser({
      mezon_id: mezonUserId,
      username: userInfo?.username || `user_${mezonUserId}`,
      display_name: userInfo?.displayName || userInfo?.username,
      avatar_url: userInfo?.avatarUrl,
    });
  }

  // 2. Retrieve available IELTS Speaking topics
  const topics = await pgDb.getIELTSTopics();
  if (!topics || topics.length === 0) {
    return {
      text: `⚠️ No active IELTS Speaking test sets are currently available in the database. Please try again later!`,
      isSuccess: false,
    };
  }

  // 3. Match topic or select one
  let selectedTopic = topics[0];
  const query = args.join(" ").trim().toLowerCase();
  if (query) {
    const matched = topics.find(
      (t) =>
        t.id.toLowerCase() === query ||
        t.title.toLowerCase().includes(query) ||
        t.category?.toLowerCase().includes(query),
    );
    if (matched) {
      selectedTopic = matched;
    }
  } else {
    // Pick a random topic to ensure variety on each attempt
    selectedTopic = topics[Math.floor(Math.random() * topics.length)];
  }

  // 4. Create new attempt for candidate
  const attempt = await pgDb.createIELTSAttempt(user.user_id, selectedTopic.id);

  // 5. Generate authenticated launch URL
  const baseUrl = getAppBaseUrl();
  const token = createLaunchToken(
    {
      attemptId: attempt.id,
      userId: user.user_id,
      mezonId: user.mezon_id,
    },
    120,
  );

  const launchUrl = `${baseUrl}/api/ielts/launch?token=${token}`;
  const candidateName = user.display_name || user.mezon_username || "Candidate";

  let msg = `🎙️ **IELTS SPEAKING MOCK TEST GENERATED!**\n`;
  msg += `━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  msg += `👋 Hello **${candidateName}**, your test room is ready!\n\n`;
  msg += `📋 **Topic:** ${selectedTopic.title}\n`;
  if (selectedTopic.category) {
    msg += `🗂️ **Category:** ${selectedTopic.category}\n`;
  }
  msg += `⏱️ **Format:** Full 3-Part Assessment (Interview • Cue Card • Discussion)\n`;
  msg += `🆔 **Attempt ID:** \`${attempt.id}\`\n`;
  msg += `━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
  msg += `🚀 **Click the link below to enter your speaking room:**\n`;
  msg += `${launchUrl}\n\n`;
  msg += `💡 **Quick Tips before you begin:**\n`;
  msg += `• Make sure your microphone is connected and working.\n`;
  msg += `• Speak clearly and maintain natural pacing.\n`;
  msg += `• Once submitted, return here and type \`*result\` to view your in-depth AI score report!\n`;
  msg += `━━━━━━━━━━━━━━━━━━━━━━━━━━`;

  const components = [
    {
      components: [
        {
          id: "btn_start_speaking_test",
          type: 1, // BUTTON
          component: {
            label: "🚀 Start IELTS Speaking Test",
            style: 5, // LINK
            url: launchUrl,
          },
        },
      ],
    },
  ];

  return {
    text: msg,
    isSuccess: true,
    components,
  };
}

/**
 * Handles `*help` command.
 */
export function getHelpMessage(): string {
  return (
    `🤖 **IELTS SPEAKING BOT COMMANDS**\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `Available Commands:\n` +
    `• \`*testingnow\` (or \`*testnow\`, \`*thi\`): Start a new IELTS Speaking test and receive your test room link\n` +
    `• \`*result\` (or \`*ketqua\`): View your latest IELTS Speaking mock test report\n` +
    `• \`*result <attempt_id>\`: View the report for a specific test attempt\n` +
    `• \`*history\` (or \`*lichsu\`): View your recent 10 IELTS Speaking attempts\n` +
    `• \`*help\`: Display this help guide\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━`
  );
}
