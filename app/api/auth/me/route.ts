import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { checkIsClanAdmin } from '@/lib/admin/clan-data-service';

export async function GET() {
	const session = await getSession();

	if (!session.user) {
		return NextResponse.json({ isLoggedIn: false });
	}

	const isClanAdmin = await checkIsClanAdmin(session.user.mezon_id);
	// Respect BOTH DB/session role (for password-login admins) AND clan role
	const resolvedRole = isClanAdmin || session.user.role === 'admin' ? 'admin' : 'user';

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
