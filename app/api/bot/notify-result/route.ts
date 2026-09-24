import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';

/**
 * POST /api/bot/notify-result
 *
 * Called by the web app frontend after a user completes an IELTS Speaking test.
 * Forwards the notification request to the standalone mezon-english-bot
 * via MEZON_VERIFY_URL (the bot's HTTP API).
 *
 * The bot will then send the result to the user as an ephemeral message in Mezon.
 */
export async function POST(req: NextRequest) {
	const session = await getSession();

	if (!session.user) {
		return NextResponse.json({ success: false, error: 'Unauthorized. Please login first.' }, { status: 401 });
	}

	try {
		const { attemptId } = await req.json();

		if (!attemptId) {
			return NextResponse.json({ success: false, error: 'Missing attemptId in request body.' }, { status: 400 });
		}

		// Forward to the standalone bot server
		const botUrl = process.env.MEZON_VERIFY_URL;
		const botSecret = process.env.BOT_VERIFY_SECRET;

		if (!botUrl) {
			return NextResponse.json({ success: false, error: 'Bot server URL (MEZON_VERIFY_URL) is not configured.' }, { status: 503 });
		}

		const botRes = await fetch(`${botUrl.replace(/\/$/, '')}/notify-result`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'x-bot-secret': botSecret || ''
			},
			body: JSON.stringify({
				userId: session.user.mezon_id,
				attemptId,
				channelId: process.env.MEZON_EXAM_CHANNEL_ID
			})
		});

		const data = await botRes.json();

		if (!botRes.ok || !data.success) {
			return NextResponse.json({ success: false, error: data.message || 'Bot server returned an error.' }, { status: botRes.status });
		}

		return NextResponse.json({
			success: true,
			message: data.message || 'Notification sent via Mezon bot.'
		});
	} catch (error) {
		console.error('[POST /api/bot/notify-result] Error:', error);
		return NextResponse.json(
			{
				success: false,
				error: 'Failed to send exam result notification to Mezon Clan.'
			},
			{ status: 500 }
		);
	}
}
