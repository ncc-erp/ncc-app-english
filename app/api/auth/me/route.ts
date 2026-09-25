import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { checkIsClanAdmin } from '@/lib/admin/clan-data-service';

export async function GET() {
	const session = await getSession();

	if (!session.user) {
		return NextResponse.json({ isLoggedIn: false });
	}

	let isAdmin: boolean;
	try {
		isAdmin = await checkIsClanAdmin(session.user.mezon_id);
	} catch (error) {
		console.error('[Auth Me] Admin verification unavailable:', error);
		return NextResponse.json(
			{ isLoggedIn: true, error: 'Admin verification is temporarily unavailable. Please try again.' },
			{ status: 503, headers: { 'Cache-Control': 'no-store', 'Retry-After': '5' } }
		);
	}
	const resolvedRole = isAdmin ? 'admin' : 'user';

	// Sync cookie session when role changes so other routes
	// that check session.user.role stay consistent
	if (session.user.role !== resolvedRole) {
		session.user.role = resolvedRole;
		await session.save();
	}

	return NextResponse.json({
		isLoggedIn: true,
		user: {
			...session.user,
			role: resolvedRole
		}
	});
}
