import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { checkIsClanAdmin, getClanClassrooms } from '@/lib/admin/clan-data-service';
import { pgDb } from '@/lib/db/postgres';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: NextRequest) {
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

		const { searchParams } = new URL(req.url);
		const forceRefresh = searchParams.get('refresh') === 'true';

		const [classes, overallStats] = await Promise.all([getClanClassrooms(forceRefresh), pgDb.getOverallSpeakingStats()]);

		return NextResponse.json(
			{
				success: true,
				classes,
				overallStats
			},
			{
				headers: {
					'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate'
				}
			}
		);
	} catch (error) {
		console.error('[Admin Classes GET Error]:', error);
		return NextResponse.json({ success: false, error: 'Failed to fetch classrooms' }, { status: 500 });
	}
}
