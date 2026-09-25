import { NextRequest, NextResponse } from 'next/server';

// Set MAINTENANCE_MODE=true to put the whole app behind /maintenance.
// Pages are rewritten (URL kept, status 503); API routes get a 503 JSON body.
export function middleware(req: NextRequest) {
	if (process.env.MAINTENANCE_MODE !== 'true') {
		return NextResponse.next();
	}

	const { pathname } = req.nextUrl;

	if (pathname.startsWith('/api/')) {
		return NextResponse.json({ success: false, error: 'Service under maintenance' }, { status: 503, headers: { 'Retry-After': '600' } });
	}

	return NextResponse.rewrite(new URL('/maintenance', req.url), { status: 503, headers: { 'Retry-After': '600' } });
}

export const config = {
	// Skip Next internals, static files, and the maintenance page itself.
	matcher: ['/((?!_next/|maintenance|favicon.ico|robots.txt|sitemap.xml|opengraph-image|.*\\.[\\w]+$).*)']
};
