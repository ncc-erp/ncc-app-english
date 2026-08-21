import crypto from 'crypto';

export interface MezonTokenResponse {
  access_token: string;
  token_type: string;
  expires_in?: number;
  refresh_token?: string;
  scope?: string;
}

export interface MezonUserInfo {
  id?: string;
  sub?: string;
  user_id?: string;
  username?: string;
  display_name?: string;
  name?: string;
  preferred_username?: string;
  email?: string;
  avatar?: string;
  avatar_url?: string;
  picture?: string;
}

/**
 * Mezon requires an 11-character alphanumeric string for the `state` parameter.
 */
export function generateMezonState(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  const randomBytes = crypto.randomBytes(11);
  for (let i = 0; i < 11; i++) {
    result += chars[randomBytes[i] % chars.length];
  }
  return result;
}

export function getMezonOAuthAuthUrl(state: string): string {
  const clientId = process.env.MEZON_CLIENT_ID || '';
  const redirectUri = process.env.MEZON_REDIRECT_URI || 'http://localhost:3000/api/auth/callback';

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid offline',
    state,
  });

  return `https://oauth2.mezon.ai/oauth2/auth?${params.toString()}`;
}

export async function exchangeOAuthCodeForToken(code: string, state?: string): Promise<MezonTokenResponse> {
  const clientId = process.env.MEZON_CLIENT_ID || '';
  const clientSecret = process.env.MEZON_CLIENT_SECRET || '';
  const redirectUri = process.env.MEZON_REDIRECT_URI || 'http://localhost:3000/api/auth/callback';

  // Per Mezon docs (and RFC 6749), parameters are sent via application/x-www-form-urlencoded
  const postParams = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
  });

  if (state) {
    postParams.set('state', state);
  }

  let res = await fetch('https://oauth2.mezon.ai/oauth2/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: postParams.toString(),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.warn('[exchangeOAuthCodeForToken] Form body auth attempt returned:', res.status, errText);

    // Fallback: Basic Auth Header attempt (RFC 6749 Section 2.3.1)
    const encodedClientId = encodeURIComponent(clientId);
    const encodedClientSecret = encodeURIComponent(clientSecret);
    const basicAuth = Buffer.from(`${encodedClientId}:${encodedClientSecret}`).toString('base64');

    const basicBodyParams = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
    });
    if (state) {
      basicBodyParams.set('state', state);
    }

    const fallbackRes = await fetch('https://oauth2.mezon.ai/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${basicAuth}`,
      },
      body: basicBodyParams.toString(),
    });

    if (fallbackRes.ok) {
      return fallbackRes.json();
    }

    const fallbackErr = await fallbackRes.text();
    console.error('[exchangeOAuthCodeForToken] Basic auth fallback failed:', fallbackRes.status, fallbackErr);
    throw new Error(`Mezon token exchange failed: ${res.status} - ${errText || fallbackErr}`);
  }

  return res.json();
}

export async function fetchMezonUserInfo(accessToken: string): Promise<MezonUserInfo> {
  const res = await fetch('https://oauth2.mezon.ai/userinfo', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Mezon userinfo failed: ${res.status} ${errorText}`);
  }

  return res.json();
}

