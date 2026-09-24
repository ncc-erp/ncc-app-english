import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { checkIsClanAdmin } from '@/lib/admin/clan-data-service';
import { pgDb } from '@/lib/db/postgres';
import { extractAudioStoragePath } from '@/lib/storage';

export async function GET(_req: NextRequest, segmentData: { params: Promise<{ studentId: string }> }) {
	try {
		const session = await getSession();
		const user = session.user;

		if (!user || !user.isLoggedIn) {
			return NextResponse.json({ success: false, error: 'Unauthorized. Login required.' }, { status: 401 });
		}

		const isAdmin = await checkIsClanAdmin(user.mezon_id);
		if (!isAdmin) {
			return NextResponse.json({ success: false, error: 'Forbidden. Admin role in clan required.' }, { status: 403 });
		}

		const { studentId } = await segmentData.params;
		if (!studentId) {
			return NextResponse.json({ success: false, error: 'Student ID is required.' }, { status: 400 });
		}

		// 1. Fetch user profile from DB if registered
		const dbUser = await pgDb.getUserByMezonId(studentId);

		// 2. Fetch all detailed Speaking attempts
		const attempts = await pgDb.getStudentSpeakingDetailedAttempts(studentId);

		// 2.1 Ensure fresh, non-expiring streaming audio URLs for admin playback
		for (const attempt of attempts) {
			const processResponse = (res: any, qId: string) => {
				if (!res) return;
				let path = res.audio_storage_path;
				if (!path && res.audio_url) {
					path = extractAudioStoragePath(res.audio_url);
					if (path) {
						res.audio_storage_path = path;
					}
				}
				if (!path && attempt.user_id && attempt.id) {
					path = `${attempt.user_id}/${attempt.id}/${qId}.webm`;
					res.audio_storage_path = path;
				}
				if (path) {
					res.audio_url = `/api/admin/audio?path=${encodeURIComponent(path)}`;
				}
			};

			if (attempt.responses && typeof attempt.responses === 'object') {
				for (const [qId, resp] of Object.entries(attempt.responses)) {
					processResponse(resp, qId);
				}
			}

			if (attempt.score_result?.responses && typeof attempt.score_result.responses === 'object') {
				for (const [qId, resp] of Object.entries(attempt.score_result.responses as Record<string, any>)) {
					processResponse(resp, qId);
				}
			}
		}

		// 3. Compute summary statistics
		const completedAttempts = attempts.filter((a) => a.band_score !== undefined || a.score_result !== undefined);

		const totalAttempts = attempts.length;
		const bandScores = completedAttempts
			.map((a) => a.band_score ?? a.score_result?.overall_band)
			.filter((b): b is number => typeof b === 'number' && !isNaN(b));

		const averageBand = bandScores.length > 0 ? Number((bandScores.reduce((sum, b) => sum + b, 0) / bandScores.length).toFixed(1)) : null;

		const highestBand = bandScores.length > 0 ? Math.max(...bandScores) : null;

		const latestAttempt = attempts[0];
		const latestAttemptAt = latestAttempt ? latestAttempt.submitted_at || latestAttempt.started_at : null;

		return NextResponse.json({
			success: true,
			student: {
				mezon_id: studentId,
				username: dbUser?.mezon_username || studentId,
				display_name: dbUser?.display_name || dbUser?.mezon_username || studentId,
				avatar_url: dbUser?.avatar_url || undefined
			},
			stats: {
				total_speaking_attempts: totalAttempts,
				average_speaking_band: averageBand,
				highest_speaking_band: highestBand,
				latest_attempt_at: latestAttemptAt
			},
			attempts
		});
	} catch (error) {
		console.error('[Admin Student Attempts GET Error]:', error);
		return NextResponse.json({ success: false, error: 'Failed to fetch student speaking attempts' }, { status: 500 });
	}
}
