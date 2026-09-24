import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { pgDb } from '@/lib/db/postgres';
import { checkIsClanAdmin } from '@/lib/admin/clan-data-service';
import { parseMeetingInput } from '@/lib/admin/meeting-validation';

async function isAdmin(): Promise<boolean> {
	const session = await getSession();
	const user = session.user;
	if (!user || !user.isLoggedIn) return false;
	return checkIsClanAdmin(user.mezon_id);
}

// GET /api/admin/meetings - List meetings (each with a 10-item participant preview)
export async function GET() {
	try {
		if (!(await isAdmin())) {
			return NextResponse.json({ success: false, error: 'Unauthorized. Admin privileges required.' }, { status: 403 });
		}

		const meetings = await pgDb.getMeetings();
		return NextResponse.json({ success: true, meetings });
	} catch (error) {
		console.error('[Admin Meetings GET Error]:', error);
		return NextResponse.json({ success: false, error: 'Failed to fetch meetings' }, { status: 500 });
	}
}

// POST /api/admin/meetings - Create a new meeting (name + scheduled time; room/people assigned separately)
export async function POST(req: NextRequest) {
	try {
		const session = await getSession();
		const user = session.user;
		if (!user || !user.isLoggedIn || !(await checkIsClanAdmin(user.mezon_id))) {
			return NextResponse.json({ success: false, error: 'Unauthorized. Admin privileges required.' }, { status: 403 });
		}

		const input = parseMeetingInput(await req.json().catch(() => null));

		if (!input) {
			return NextResponse.json(
				{ success: false, error: 'Provide a title (1–200 characters) and a valid scheduled_at with timezone.' },
				{ status: 400 }
			);
		}

		const meeting = await pgDb.createMeeting(input.title, input.scheduled_at, user.mezon_id);
		return NextResponse.json({ success: true, meeting });
	} catch (error) {
		console.error('[Admin Meetings POST Error]:', error);
		return NextResponse.json({ success: false, error: 'Failed to create meeting' }, { status: 500 });
	}
}
