import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { pgDb } from '@/lib/db/postgres';
import { checkIsClanAdmin } from '@/lib/admin/clan-data-service';
import { parseMeetingInput } from '@/lib/admin/meeting-validation';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
	try {
		if (!(await isAdmin())) return NextResponse.json({ success: false, error: 'Admin privileges required.' }, { status: 403 });
		const input = parseMeetingInput(await req.json().catch(() => null));
		if (!input)
			return NextResponse.json(
				{ success: false, error: 'Provide a title (1–200 characters) and a valid scheduled_at with timezone.' },
				{ status: 400 }
			);
		const meeting = await pgDb.updateMeeting((await params).id, input.title, input.scheduled_at);
		if (!meeting) return NextResponse.json({ success: false, error: 'Meeting not found' }, { status: 404 });
		return NextResponse.json({ success: true, meeting });
	} catch (error) {
		console.error('[Admin Meeting PATCH Error]:', error);
		return NextResponse.json({ success: false, error: 'Failed to update meeting' }, { status: 500 });
	}
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
	try {
		if (!(await isAdmin())) return NextResponse.json({ success: false, error: 'Admin privileges required.' }, { status: 403 });
		if (!(await pgDb.deleteMeeting((await params).id))) return NextResponse.json({ success: false, error: 'Meeting not found' }, { status: 404 });
		return NextResponse.json({ success: true });
	} catch (error) {
		console.error('[Admin Meeting DELETE Error]:', error);
		return NextResponse.json({ success: false, error: 'Failed to delete meeting' }, { status: 500 });
	}
}

async function isAdmin(): Promise<boolean> {
	const session = await getSession();
	const user = session.user;
	if (!user || !user.isLoggedIn) return false;
	return checkIsClanAdmin(user.mezon_id);
}

// GET /api/admin/meetings/[id] - Full meeting detail, including every participant (not just the preview)
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
	try {
		if (!(await isAdmin())) {
			return NextResponse.json({ success: false, error: 'Unauthorized. Admin privileges required.' }, { status: 403 });
		}

		const { id } = await params;
		const meeting = await pgDb.getMeeting(id);

		if (!meeting) {
			return NextResponse.json({ success: false, error: 'Meeting not found' }, { status: 404 });
		}

		return NextResponse.json({ success: true, meeting });
	} catch (error) {
		console.error('[Admin Meeting GET Error]:', error);
		return NextResponse.json({ success: false, error: 'Failed to fetch meeting' }, { status: 500 });
	}
}
