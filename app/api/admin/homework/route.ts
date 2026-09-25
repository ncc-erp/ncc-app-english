import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { pgDb } from '@/lib/db/postgres';
import { AdminVerificationUnavailableError, checkIsClanAdmin } from '@/lib/admin/clan-data-service';

async function isAdmin(): Promise<boolean> {
	const session = await getSession();
	const user = session.user;

	if (!user || !user.isLoggedIn) return false;

	return checkIsClanAdmin(user.mezon_id);
}

// GET /api/admin/homework - List all homework
export async function GET() {
	try {
		if (!(await isAdmin())) {
			return NextResponse.json(
				{
					success: false,
					error: 'Unauthorized. Admin privileges required.'
				},
				{ status: 403 }
			);
		}

		const homeworks = await pgDb.getListHomework();

		return NextResponse.json({
			success: true,
			homeworks
		});
	} catch (error) {
		if (error instanceof AdminVerificationUnavailableError) {
			return NextResponse.json(
				{
					success: false,
					error: 'Admin verification is temporarily unavailable. Please try again.'
				},
				{ status: 503 }
			);
		}

		console.error('[Admin Homework GET Error]:', error);

		return NextResponse.json(
			{
				success: false,
				error: 'Failed to fetch homework'
			},
			{ status: 500 }
		);
	}
}

// POST /api/admin/homework - Create homework
export async function POST(req: NextRequest) {
	try {
		if (!(await isAdmin())) {
			return NextResponse.json(
				{
					success: false,
					error: 'Unauthorized. Admin privileges required.'
				},
				{ status: 403 }
			);
		}

		const body = await req.json();

		const { name, startDate, dueDate, description } = body || {};

		if (!name || !startDate || !dueDate) {
			return NextResponse.json(
				{
					success: false,
					error: 'Name, start date and due date are required.'
				},
				{ status: 400 }
			);
		}

		if (startDate > dueDate) {
			return NextResponse.json(
				{
					success: false,
					error: 'Start date cannot be greater than due date.'
				},
				{ status: 400 }
			);
		}

		const homework = await pgDb.createHomework(name, startDate, dueDate, description || '');

		return NextResponse.json({
			success: true,
			homework
		});
	} catch (error) {
		if (error instanceof AdminVerificationUnavailableError) {
			return NextResponse.json(
				{
					success: false,
					error: 'Admin verification is temporarily unavailable. Please try again.'
				},
				{ status: 503 }
			);
		}

		console.error('[Admin Homework POST Error]:', error);

		return NextResponse.json(
			{
				success: false,
				error: 'Failed to create homework'
			},
			{ status: 500 }
		);
	}
}
