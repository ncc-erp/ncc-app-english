import { NextRequest, NextResponse } from 'next/server';
import { getMezonOAuthAuthUrl, generateMezonState } from '@/lib/mezon/oauth';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const isMock = searchParams.get('mock') === 'true';
  const clientId = process.env.MEZON_CLIENT_ID || '';
  const isPlaceholderClient = !clientId || clientId === 'your_mezon_oauth_client_id';

  // Fallback to Mock Dev Login if Client ID is placeholder or ?mock=true is requested
  if (isMock || isPlaceholderClient) {
    console.log('[Auth Login] Using Dev Mock Login mode (Client ID is placeholder or mock=true).');
    const mockUrl = new URL('/api/auth/callback?code=mock_dev_code', req.url);
    const mockRedirect = searchParams.get('redirect') || '';
    const response = NextResponse.redirect(mockUrl);
    if (mockRedirect.startsWith('/') && !mockRedirect.startsWith('//')) {
      response.cookies.set('oauth_redirect', mockRedirect, { httpOnly: true, sameSite: 'lax', maxAge: 600 });
    }
    return response;
  }

  const state = generateMezonState();
  const authUrl = getMezonOAuthAuthUrl(state);

  const response = NextResponse.redirect(authUrl);
  const cookieOpts = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    maxAge: 600, // 10 minutes
  };
  response.cookies.set('oauth_state', state, cookieOpts);

  // Where to land after login; only same-origin paths to avoid open redirects
  const redirect = searchParams.get('redirect') || '';
  if (redirect.startsWith('/') && !redirect.startsWith('//')) {
    response.cookies.set('oauth_redirect', redirect, cookieOpts);
  }

  return response;
}

