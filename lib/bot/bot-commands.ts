import { pgDb } from "@/lib/db/postgres";
import { formatIELTSResult, formatIELTSTestHistory } from "./bot-formatter";
import { createLaunchToken, getAppBaseUrl } from "@/lib/auth/launch-token";
import { IELTSSpeakingAttempt } from "@/types/ielts";

export interface CommandResult {
  text: string;
  isSuccess: boolean;
  components?: any[];
}

function buildResultCommandOutput(
  attempt: IELTSSpeakingAttempt,
  user: any,
  mezonUserId: string,
): CommandResult {
  const baseUrl = getAppBaseUrl();
  const detailsUrl = `${baseUrl}/ielts-speaking/result/${attempt.id}/details`;
  const formattedText = formatIELTSResult(
    attempt,
    user.display_name || user.mezon_username,
    detailsUrl,
  );

  const components = [
    {
      components: [
        {
          id: "btn_view_result_details",
          type: 1, // BUTTON
          component: {
            label: "📊 Xem báo cáo chi tiết",
            style: 5, // LINK
            url: detailsUrl,
          },
        },
      ],
    },
  ];

  return {
    text: formattedText,
    isSuccess: true,
    components,
  };
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
      text: `⚠️ Không tìm thấy tài khoản Mezon của bạn trong hệ thống thi. Vui lòng đăng nhập web app trước!`,
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
        return buildResultCommandOutput(directAttempt, user, mezonUserId);
      }

      return {
        text: `⚠️ Không tìm thấy bài thi IELTS Speaking với mã \`${specificAttemptId}\` hoặc bài thi này không thuộc tài khoản của bạn.`,
        isSuccess: false,
      };
    }

    return buildResultCommandOutput(attempt, user, mezonUserId);
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
      text: `ℹ️ Bạn chưa hoàn thành bài thi IELTS Speaking nào. Vào web app để bắt đầu bài thi đầu tiên nhé!`,
      isSuccess: false,
    };
  }

  return buildResultCommandOutput(latestAttempt, user, mezonUserId);
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
      text: `⚠️ Không tìm thấy tài khoản Mezon của bạn trong hệ thống. Vui lòng đăng nhập web app trước!`,
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
      text: `⚠️ Hiện chưa có bộ đề thi IELTS Speaking nào khả dụng trong hệ thống. Vui lòng thử lại sau!`,
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

  let msg = `🎙️ **ĐÃ TẠO BÀI THI THỬ IELTS SPEAKING!**\n`;
  msg += `━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  msg += `👋 Chào **${candidateName}**, phòng thi của bạn đã sẵn sàng!\n\n`;
  msg += `📋 **Chủ đề:** ${selectedTopic.title}\n`;
  if (selectedTopic.category) {
    msg += `🗂️ **Danh mục:** ${selectedTopic.category}\n`;
  }
  msg += `⏱️ **Hình thức:** Đủ 3 Phần (Phỏng vấn • Cue Card • Thảo luận)\n`;
  msg += `🆔 **Mã lượt thi:** \`${attempt.id}\`\n`;
  msg += `━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
  msg += `🚀 **Bấm vào link bên dưới để vào phòng thi nói:**\n`;
  msg += `${launchUrl}\n\n`;
  msg += `💡 **Mẹo nhanh trước khi bắt đầu:**\n`;
  msg += `• Đảm bảo microphone đã kết nối và hoạt động tốt.\n`;
  msg += `• Nói rõ ràng và giữ tốc độ tự nhiên.\n`;
  msg += `• Sau khi nộp bài, quay lại đây và gõ \`*result\` để xem báo cáo điểm chi tiết từ AI!\n`;
  msg += `━━━━━━━━━━━━━━━━━━━━━━━━━━`;

  const components = [
    {
      components: [
        {
          id: "btn_start_speaking_test",
          type: 1, // BUTTON
          component: {
            label: "🚀 Bắt đầu thi IELTS Speaking",
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
    `🤖 **CÁC LỆNH CỦA BOT IELTS SPEAKING**\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `Danh sách lệnh:\n` +
    `• \`*testingnow\` (hoặc \`*testnow\`, \`*thi\`): Bắt đầu bài thi IELTS Speaking mới và nhận link phòng thi\n` +
    `• \`*result\` (hoặc \`*ketqua\`): Xem báo cáo kết quả thi thử IELTS Speaking gần nhất\n` +
    `• \`*result <attempt_id>\`: Xem báo cáo của một lượt thi cụ thể\n` +
    `• \`*history\` (hoặc \`*lichsu\`): Xem 10 lượt thi IELTS Speaking gần nhất của bạn\n` +
    `• \`*help\`: Hiển thị hướng dẫn này\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━`
  );
}
