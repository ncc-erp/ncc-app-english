import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { checkIsClanAdmin, getClanStudents } from '@/lib/admin/clan-data-service';

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
		const classId = searchParams.get('classId') || undefined;
		const forceRefresh = searchParams.get('refresh') === 'true';
		const searchQuery = searchParams.get('search')?.toLowerCase().trim();

		let students = await getClanStudents(classId, forceRefresh);

		if (searchQuery) {
			students = students.filter(
				(s) =>
					s.display_name.toLowerCase().includes(searchQuery) ||
					s.username.toLowerCase().includes(searchQuery) ||
					s.mezon_id.toLowerCase().includes(searchQuery)
			);
		}

		return NextResponse.json(
			{
				success: true,
				students
			},
			{
				headers: {
					'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate'
				}
			}
		);
	} catch (error) {
		console.error('[Admin Students GET Error]:', error);
		return NextResponse.json({ success: false, error: 'Failed to fetch students' }, { status: 500 });
	}
}
