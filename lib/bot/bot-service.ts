// bot-service.ts
import '@/lib/mezon/sdk-patch';
import { MezonClient } from 'mezon-sdk';
import { setSharedBotClient } from './bot-messenger';

declare global {
	// eslint-disable-next-line no-var
	var __mezonBotStarted: boolean | undefined;
	// eslint-disable-next-line no-var
	var __mezonBotClient: MezonClient | undefined;
	// eslint-disable-next-line no-var
	var __mezonBotPromise: Promise<MezonClient | null> | undefined;
}

/**
 * Initializes and starts the Mezon Bot client if not already running.
 * Uses a global singleton guard to prevent duplicate logins during Next.js HMR.
 *
 * NOTE: Commands and welcome messages have been moved to the standalone
 * mezon-english-bot project. This service now only handles:
 * - Bot login and channel joining (so web app can use bot for membership verification)
 * - Providing the shared MezonClient for clan-data-service.ts, bot-client.ts, etc.
 */
export async function initBotService(): Promise<MezonClient | null> {
	// Prevent duplicate execution: return already active client
	if (globalThis.__mezonBotClient) {
		return globalThis.__mezonBotClient;
	}

	// Prevent duplicate concurrent connection attempts (race condition guard)
	if (globalThis.__mezonBotPromise) {
		return globalThis.__mezonBotPromise;
	}

	const botToken = process.env.MEZON_BOT_TOKEN;
	const botId = process.env.MEZON_BOT_ID;
	const examChannelId = process.env.MEZON_EXAM_CHANNEL_ID || '';
	const targetClanId = process.env.MEZON_TARGET_CLAN_ID || '';

	if (!botToken || !botId) {
		console.warn('⚠️ [Mezon Bot Service] MEZON_BOT_TOKEN or MEZON_BOT_ID is not configured. Bot service skipped.');
		return null;
	}

	globalThis.__mezonBotStarted = true;

	globalThis.__mezonBotPromise = (async () => {
		try {
			const configuredHost = process.env.MEZON_HOST || 'gw.mezon.ai';
			const host = configuredHost.replace(/^https?:\/\//, '').replace(/\/$/, '');
			const port = process.env.MEZON_PORT || (configuredHost.startsWith('http://') ? '80' : '443');
			const useSSL = process.env.MEZON_USE_SSL ? process.env.MEZON_USE_SSL !== 'false' : !configuredHost.startsWith('http://') && port === '443';

			const client = new MezonClient({
				botId,
				token: botToken,
				host,
				port,
				useSSL
			});

			// Connect & authenticate
			await client.login();
			setSharedBotClient(client);
			globalThis.__mezonBotClient = client;

			console.log('✅ [Mezon Bot Service] Connected and logged into Mezon successfully!');

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
									await socket.joinChat(clan.id, ch.id, ch.channel_type || 1, !ch.is_private);
								}
							} catch {
								// ignore socket join failures
							}
						}
					} catch (err) {
						console.warn(`[Mezon Bot Service] Could not load channels for clan ${clan.id}:`, err);
					}
				}
			} catch (clanErr) {
				console.warn('[Mezon Bot Service] Could not enumerate clans:', clanErr);
			}

			// Also explicitly join Exam Channel if defined
			if (examChannelId) {
				try {
					const examCh = await client.channels.fetch(examChannelId);
					if (examCh) {
						const socket = (client as any).socketManager?.socket;
						if (socket) {
							await socket.joinChat((examCh as any).clan_id || targetClanId || '0', examChannelId, examCh.channel_type || 1, !examCh.is_private);
						}
					}
				} catch {
					// ignore
				}
			}

			console.log('📡 [Mezon Bot Service] Bot connected. Commands & welcome handled by mezon-english-bot.');
			return client;
		} catch (err) {
			console.error('❌ [Mezon Bot Service] Failed to connect to Mezon:', err);
			globalThis.__mezonBotStarted = false;
			globalThis.__mezonBotClient = undefined;
			return null;
		} finally {
			globalThis.__mezonBotPromise = undefined;
		}
	})();

	return globalThis.__mezonBotPromise;
}

export const startBot = initBotService;
