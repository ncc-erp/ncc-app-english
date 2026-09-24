import '@/lib/mezon/sdk-patch';
import { MezonClient, ChannelMessageContent, IInteractiveMessageProps } from 'mezon-sdk';
import type { TextChannel } from 'mezon-sdk/dist/cjs/mezon-client/structures/TextChannel';
import { pgDb } from '@/lib/db/postgres';
import { formatIELTSResult } from './bot-formatter';
import { getAppBaseUrl } from '@/lib/auth/launch-token';

declare global {
	// eslint-disable-next-line no-var
	var __mezonBotClient: MezonClient | undefined;
	// eslint-disable-next-line no-var
	var __mezonBotPromise: Promise<MezonClient | null> | undefined;
}

export function setSharedBotClient(client: MezonClient) {
	globalThis.__mezonBotClient = client;
}

export async function getSharedBotClient(): Promise<MezonClient | null> {
	// 1. Return already active client if available
	if (globalThis.__mezonBotClient) {
		return globalThis.__mezonBotClient;
	}

	// 2. Return in-progress connection promise if another call is currently connecting
	if (globalThis.__mezonBotPromise) {
		return globalThis.__mezonBotPromise;
	}

	// 3. Delegate to initBotService to establish the single connection
	const { initBotService } = await import('./bot-service');
	return initBotService();
}

/**
 * Helper to resolve a channel by ID from clan cache or client cache
 */
export async function resolveChannel(client: MezonClient, channelId: string, clanId?: string): Promise<TextChannel | null> {
	const targetClanId = clanId || process.env.MEZON_TARGET_CLAN_ID || '';
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
		const channel = client.channels.get(channelId) || (await client.channels.fetch(channelId));
		if (channel) return channel;
	} catch {
		// ignore
	}

	return null;
}

/**
 * Sends an ephemeral message (only visible to the receiver) to a channel.
 */
export async function sendEphemeralMessage(channel: TextChannel, receiverId: string, content: ChannelMessageContent, replyToMessageId?: string) {
	try {
		const response = await channel.sendEphemeral(receiverId, content, replyToMessageId);
		console.warn(`[Mezon Bot Messenger] Ephemeral message sent to ${receiverId}`);
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
			let splitIdx = remaining.lastIndexOf('\n━━━━━━━━━━━━━━━━━━━━━━━━━━\n', maxChunkLength);
			if (splitIdx === -1 || splitIdx < maxChunkLength / 2) {
				splitIdx = remaining.lastIndexOf('\n\n', maxChunkLength);
			}
			if (splitIdx === -1 || splitIdx < maxChunkLength / 2) {
				splitIdx = remaining.lastIndexOf('\n', maxChunkLength);
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
			e: match.index + match[0].length
		});
	}
	return lk;
}

/**
 * Builds a ChannelMessageContent object with text, link ranges (lk), and components.
 */
function buildMessageContent(text: string, components?: IInteractiveMessageProps[]): ChannelMessageContent {
	const content: ChannelMessageContent = { t: text };
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
		components?: IInteractiveMessageProps[];
	}
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
		const clanId = options?.clanId || process.env.MEZON_TARGET_CLAN_ID;

		const clan = clanId ? client.clans.get(clanId) : undefined;

		if (clan) {
			channel.clan = clan;
		}
	}

	const mentions = options?.mentions || [];
	const isPublic = options?.isPublic !== undefined ? options.isPublic : true;
	const chunks = splitTextIntoChunks(text, 3500);

	try {
		if (!isPublic && mentions.length > 0) {
			const receiverId = mentions[0].user_id;
			try {
				console.warn(
					`[Mezon Bot Messenger] Delivering ephemeral message (${chunks.length} chunk(s)) to user ${receiverId} in channel ${channelId}...`
				);
				for (let i = 0; i < chunks.length; i++) {
					const isLast = i === chunks.length - 1;
					const content = buildMessageContent(chunks[i], isLast ? options?.components : undefined);
					await sendEphemeralMessage(
						channel,
						receiverId,
						content,
						undefined // Keep undefined to avoid SQLite cache miss errors
					);
					if (i < chunks.length - 1) {
						await new Promise((resolve) => setTimeout(resolve, 300));
					}
				}
				console.warn(`[Mezon Bot Messenger] ✅ Ephemeral message delivered successfully to ${receiverId}`);
				return true;
			} catch (ephemeralErr) {
				// Never fall back to a public channel post here: these messages carry
				// band scores and single-use launch links. Returning false lets the
				// caller retry over DM instead.
				console.warn(`[Mezon Bot Messenger] sendEphemeral failed; caller should fall back to DM:`, ephemeralErr);
				return false;
			}
		}

		for (let i = 0; i < chunks.length; i++) {
			const isLast = i === chunks.length - 1;
			const content = buildMessageContent(chunks[i], isLast ? options?.components : undefined);
			await channel.send(
				content,
				mentions.map((m) => ({
					user_id: m.user_id,
					username: m.username || ''
				}))
			);
			if (i < chunks.length - 1) {
				await new Promise((resolve) => setTimeout(resolve, 300));
			}
		}
		return true;
	} catch (err) {
		console.error(`[Mezon Bot Messenger] Error sending to channel ${channelId}:`, err);
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
		components?: IInteractiveMessageProps[];
	}
): Promise<boolean> {
	const client = await getSharedBotClient();
	if (!client) return false;

	try {
		const user = client.users.get(userId) || (await client.users.fetch(userId));
		if (user) {
			const chunks = splitTextIntoChunks(text, 3500);
			for (let i = 0; i < chunks.length; i++) {
				const isLast = i === chunks.length - 1;
				const content = buildMessageContent(chunks[i], isLast ? options?.components : undefined);
				await user.sendDM(content);
				if (i < chunks.length - 1) {
					await new Promise((resolve) => setTimeout(resolve, 300));
				}
			}
			return true;
		}
	} catch (err) {
		console.error(`[Mezon Bot Messenger] Error sending DM to user ${userId}:`, err);
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
	targetChannelId?: string
): Promise<{ success: boolean; message: string; channelId?: string }> {
	const user = await pgDb.getUserByMezonId(targetMezonUserId);
	if (!user) {
		return {
			success: false,
			message: 'Không tìm thấy tài khoản người dùng trong hệ thống thi.'
		};
	}

	const attempt = await pgDb.getIELTSAttempt(attemptId);
	if (!attempt || (attempt.user_id !== user.user_id && attempt.user_id !== user.mezon_id)) {
		return {
			success: false,
			message: `Không tìm thấy bài thi IELTS Speaking với mã ${attemptId}.`
		};
	}

	const baseUrl = getAppBaseUrl();
	const detailsUrl = `${baseUrl}/ielts-speaking/result/${attempt.id}/details`;

	const formattedResult = formatIELTSResult(attempt, user.display_name || user.mezon_username, detailsUrl);

	const examChannelId = targetChannelId || process.env.MEZON_EXAM_CHANNEL_ID || process.env.MEZON_WELCOME_CHANNEL_ID || '';

	const messageText = `👋 Chào @${user.mezon_username || user.display_name}, báo cáo bài thi IELTS Speaking của bạn đã sẵn sàng!\n\n${formattedResult}`;

	const components = [
		{
			components: [
				{
					id: 'btn_view_result_details',
					type: 1, // BUTTON
					component: {
						label: '📊 Xem báo cáo chi tiết',
						style: 5, // LINK
						url: detailsUrl
					}
				}
			]
		}
	];

	let sent = false;

	if (examChannelId) {
		sent = await sendChannelMessage(examChannelId, messageText, {
			isPublic: false, // Ephemeral / private to user
			mentions: [
				{
					user_id: targetMezonUserId,
					username: user.mezon_username || user.display_name
				}
			],
			components: components as IInteractiveMessageProps[]
		});
	}

	// If channel sending was not configured or failed, fallback to DM
	if (!sent) {
		const dmSent = await sendDirectMessage(targetMezonUserId, messageText, {
			components: components as IInteractiveMessageProps[]
		});
		if (dmSent) {
			return {
				success: true,
				message: 'Báo cáo bài thi đã được gửi trực tiếp cho bạn qua tin nhắn Mezon!'
			};
		}
		return {
			success: false,
			message: 'Không thể gửi tin nhắn qua kênh clan hoặc DM. Vui lòng kiểm tra lại kết nối bot!'
		};
	}

	return {
		success: true,
		message: 'Báo cáo bài thi đã được gửi cho bạn trong kênh thi trên Mezon Clan!',
		channelId: examChannelId
	};
}

export async function sendDailyMessage(options?: {
	channelId: string;
	clanId?: string;
	isPublic?: boolean;
	mentions?: Array<{ user_id: string; username?: string }>;
	replyToMessageId?: string;
}): Promise<boolean> {
	const client = await getSharedBotClient();
	if (!client || !options?.channelId) return false;

	const channel = await resolveChannel(client, options?.channelId, options?.clanId);
	if (!channel) {
		console.warn(`[Mezon Bot Messenger] Channel ${options?.channelId} not found.`);
		return false;
	}

	// Ensure channel.clan is attached so channel.send / channel.sendEphemeral does not fail on this.clan.id
	if (!channel.clan) {
		const clanId = options?.clanId || process.env.MEZON_TARGET_CLAN_ID;

		const clan = clanId ? client.clans.get(clanId) : undefined;

		if (clan) {
			channel.clan = clan;
		}
	}

	const users = await pgDb.getDailySubmitted();

	const mentions = options?.mentions || [];
	const isPublic = options?.isPublic !== undefined ? options.isPublic : true;
	const { tripple, quadra, penta, rampage } = users.reduce(
		(acc, user) => {
			const name = user.metadata.display_name;

			if (user.count === 3) {
				acc.tripple.push(name);
			} else if (user.count === 4) {
				acc.quadra.push(name);
			} else if (user.count === 5) {
				acc.penta.push(name);
			} else if (user.count > 5) {
				acc.rampage.push(name);
			}

			return acc;
		},
		{
			tripple: [] as string[],
			quadra: [] as string[],
			penta: [] as string[],
			rampage: [] as string[]
		}
	);
	const textDecor = `
	#### ✨ Tripple
	${tripple.join(', ') || '-'}
	
	#### 💫 Quadra
	${quadra.join(', ') || '-'}
	
	#### ⭐ Penta
	${penta.join(', ') || '-'}
	
	#### 🌟 Rampage
	${rampage.join(', ') || '-'}
	`;
	const contentCheck = { t: textDecor };
	const chunks = splitTextIntoChunks(textDecor, 3500);

	try {
		if (!isPublic && mentions.length > 0) {
			const receiverId = mentions[0].user_id;
			try {
				console.warn(
					`[Mezon Bot Messenger] Delivering ephemeral message (${chunks.length} chunk(s)) to user ${receiverId} in channel ${options?.channelId}...`
				);
				for (let i = 0; i < chunks.length; i++) {
					const isLast = i === chunks.length - 1;
					await sendEphemeralMessage(
						channel,
						receiverId,
						contentCheck,
						undefined // Keep undefined to avoid SQLite cache miss errors
					);
					if (i < chunks.length - 1) {
						await new Promise((resolve) => setTimeout(resolve, 300));
					}
				}
				console.warn(`[Mezon Bot Messenger] ✅ Ephemeral message delivered successfully to ${receiverId}`);
				return true;
			} catch (ephemeralErr) {
				// Never fall back to a public channel post here: these messages carry
				// band scores and single-use launch links. Returning false lets the
				// caller retry over DM instead.
				console.warn(`[Mezon Bot Messenger] sendEphemeral failed; caller should fall back to DM:`, ephemeralErr);
				return false;
			}
		}
		for (let i = 0; i < chunks.length; i++) {
			const isLast = i === chunks.length - 1;
			await channel.send(
				contentCheck,
				mentions.map((m) => ({
					user_id: m.user_id,
					username: m.username || ''
				}))
			);
			if (i < chunks.length - 1) {
				await new Promise((resolve) => setTimeout(resolve, 300));
			}
		}
		return true;
	} catch (err) {
		console.error(`[Mezon Bot Messenger] Error sending to channel ${options?.channelId}:`, err);
		return false;
	}
}
