import { NextRequest, NextResponse } from 'next/server';
import { pgDb } from '@/lib/db/postgres';
import { createSignedAudioUrl } from '@/lib/storage';
import { verifyLaunchToken } from '@/lib/auth/launch-token';
import { AdminVerificationUnavailableError } from '@/lib/admin/clan-data-service';
import { checkIsClanAdmin } from '@/lib/admin/clan-data-service';

import { getSession } from '@/lib/auth/session';

export async function GET(req: NextRequest, { params }: { params: Promise<{ attemptId: string }> }) {
	try {
		const session = await getSession();
		const { attemptId } = await params;
		const token = req.nextUrl.searchParams.get('token');

		// 1. Attempt lookup
		const attempt = await pgDb.getIELTSAttempt(attemptId);
		if (!attempt) {
			return NextResponse.json({ success: false, error: 'IELTS Speaking test attempt not found.' }, { status: 404 });
		}

		// 2. Authorization check:
		// (a) User session (owner or admin)
		let isAuthorized = false;

		if (session.user) {
			if (
				attempt.user_id === session.user.user_id ||
				attempt.user_id === session.user.mezon_id ||
				session.user.role === 'admin' ||
				(await checkIsClanAdmin(session.user.mezon_id))
			) {
				isAuthorized = true;
			}
		}

		// (b) Optional token support for direct external launch
		if (!isAuthorized && token) {
			const payload = verifyLaunchToken(token);
			if (payload && payload.attemptId === attemptId && (attempt.user_id === payload.userId || attempt.user_id === payload.mezonId)) {
				isAuthorized = true;
				if (!session.user) {
					let dbUser = await pgDb.getUserByMezonId(payload.mezonId);
					if (!dbUser && payload.userId) {
						dbUser = await pgDb.getUserById(payload.userId);
					}
					if (dbUser) {
						session.user = dbUser;
						await session.save();
					}
				}
			}
		}

		if (!isAuthorized) {
			if (!session.user) {
				return NextResponse.json(
					{
						success: false,
						error: 'Please log in to view this test report.',
						requiresLogin: true
					},
					{ status: 401 }
				);
			}
			return NextResponse.json(
				{
					success: false,
					error: 'You do not have permission to view this test attempt.'
				},
				{ status: 403 }
			);
		}

		const topic = await pgDb.getIELTSTopic(attempt.topic_id);
		if (!topic) {
			return NextResponse.json({ success: false, error: 'Test topic not found.' }, { status: 404 });
		}

		if (!attempt.score_result) {
			return NextResponse.json(
				{
					success: false,
					error: 'Detailed AI evaluation is not yet available for this test attempt.'
				},
				{ status: 400 }
			);
		}

		// Generate signed audio URLs for candidate recordings
		for (const response of Object.values(attempt.responses || {})) {
			if (response.audio_storage_path) {
				try {
					response.audio_url = await createSignedAudioUrl(response.audio_storage_path);
				} catch (error) {
					console.error('[GET /api/ielts/[attemptId]/details] Signed audio URL error:', error);
					response.audio_url = undefined;
				}
			}
		}

		return NextResponse.json({
			success: true,
			attempt: { ...attempt, unlocked: true },
			topic,
			result: {
				...attempt.score_result,
				responses: attempt.responses,
				unlocked: true
			}
		});
	} catch (error) {
		if (error instanceof AdminVerificationUnavailableError) {
			return NextResponse.json(
				{ success: false, error: 'Admin verification is temporarily unavailable. Please try again.' },
				{ status: 503, headers: { 'Cache-Control': 'no-store', 'Retry-After': '5' } }
			);
		}
		console.error('[GET /api/ielts/[attemptId]/details] Error:', error);
		return NextResponse.json(
			{
				success: false,
				error: 'Internal server error loading IELTS Speaking test details.'
			},
			{ status: 500 }
		);
	}
}
