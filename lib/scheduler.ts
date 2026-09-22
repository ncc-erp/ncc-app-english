let timer: ReturnType<typeof setTimeout> | null = null;

const CLAN_SUBMIT = '2091711303834931200';
const CHANNEL_SUBMIT = '2102306495197614080';

export async function startScheduler() {
	const { sendDailyMessage } = await import('./bot/bot-messenger');

	if (timer !== null) {
		return;
	}

	const scheduleNext = async () => {
		const now: Date = new Date();

		const next: Date = new Date(now);
		next.setHours(8, 0, 0, 0);
		// Nếu đã qua 08:00 → chạy ngày mai
		if (next <= now) {
			next.setDate(next.getDate() + 1);
		}

		const delay: number = next.getTime() - now.getTime();
		timer = setTimeout(async (): Promise<void> => {
			timer = null;

			try {
				await sendDailyMessage({
					clanId: CLAN_SUBMIT,
					isPublic: true,
					channelId: CHANNEL_SUBMIT
				});
			} catch (error: unknown) {
				console.error('[Scheduler] Failed to send message:', error);
			} finally {
				scheduleNext();
			}
		}, delay);
	};

	scheduleNext();
}
