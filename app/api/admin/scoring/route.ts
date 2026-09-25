import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { checkIsClanAdmin } from '@/lib/admin/clan-data-service';
import { getJobState, startBatchJob } from '@/lib/admin/batch-scoring';
import { pgDb } from '@/lib/db/postgres';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// OR-gate: unlike the existing /api/admin/* routes (clan check only), this accepts both the
// Mezon clan admin and the DB/session role admin (the password-login account admin_sys_001,
// which has no clan membership). Mirrors how /api/auth/me resolves the effective role.
async function isAdmin(): Promise<boolean> {
	const session = await getSession();
	const user = session.user;
	if (!user || !user.isLoggedIn) return false;
	if (user.role === 'admin') return true;
	return checkIsClanAdmin(user.mezon_id);
}

// GET /api/admin/scoring - poll batch job progress + current unscored count
export async function GET() {
	try {
		if (!(await isAdmin())) {
			return NextResponse.json({ success: false, error: 'Unauthorized. Admin privileges required.' }, { status: 403 });
		}

		const job = getJobState();
		let pendingCount: number | null = null;
		try {
			pendingCount = await pgDb.countUnscoredIELTSAttempts();
		} catch (e) {
			console.error('[Admin Scoring GET] count failed:', e);
		}

		return NextResponse.json(
			{ success: true, job, pendingCount },
			{ headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate' } }
		);
	} catch (error) {
		console.error('[Admin Scoring GET Error]:', error);
		return NextResponse.json({ success: false, error: 'Failed to read batch scoring status' }, { status: 500 });
	}
}

// POST /api/admin/scoring - start the batch job (idempotent; returns current state if already running)
export async function POST() {
	try {
		if (!(await isAdmin())) {
			return NextResponse.json({ success: false, error: 'Unauthorized. Admin privileges required.' }, { status: 403 });
		}

		const { started, state } = startBatchJob();
		return NextResponse.json({ success: true, started, job: state });
	} catch (error) {
		console.error('[Admin Scoring POST Error]:', error);
		return NextResponse.json({ success: false, error: 'Failed to start batch scoring' }, { status: 500 });
	}
}
