import { NextRequest, NextResponse } from "next/server";
import { verifyLaunchToken, getAppBaseUrl } from "@/lib/auth/launch-token";
import { getSession } from "@/lib/auth/session";
import { pgDb } from "@/lib/db/postgres";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token");
  const baseUrl = getAppBaseUrl();

  if (!token) {
    return NextResponse.redirect(new URL("/login?error=no_token", baseUrl));
  }

  const payload = verifyLaunchToken(token);
  if (!payload) {
    console.warn("[GET /api/ielts/launch] Invalid or expired launch token");
    return NextResponse.redirect(new URL("/login?error=auth_failed", baseUrl));
  }

  try {
    // 0. Burn the token: a launch link works exactly once, even if it leaks
    //    into a channel or is forwarded to someone else.
    const isFirstUse = await pgDb.consumeLaunchToken(payload.jti);
    if (!isFirstUse) {
      console.warn(
        `[GET /api/ielts/launch] Launch token already used (jti: ${payload.jti})`,
      );
      return NextResponse.redirect(new URL("/login?error=token_used", baseUrl));
    }

    // 1. Fetch or ensure user exists in PostgreSQL
    let user = await pgDb.getUserByMezonId(payload.mezonId);
    if (!user) {
      user = await pgDb.findOrCreateUser({
        mezon_id: payload.mezonId,
        username: `user_${payload.mezonId}`,
      });
    }

    // 2. Establish iron-session for browser. Clan membership stays whatever the
    //    DB says: a launch link starts a test, it does not grant clan access.
    const session = await getSession();
    session.user = user;
    await session.save();

    console.log(
      `[GET /api/ielts/launch] Seamless auth for user: ${user.display_name || user.mezon_username} (ID: ${user.user_id}) -> launching attempt ${payload.attemptId}`,
    );

    // 3. Redirect directly to the IELTS Speaking test room
    return NextResponse.redirect(
      new URL(`/ielts-speaking/test/${payload.attemptId}`, baseUrl),
    );
  } catch (error) {
    console.error("[GET /api/ielts/launch] Error launching test:", error);
    // No session was established, so send the candidate through normal login
    // rather than to a test room they cannot load.
    return NextResponse.redirect(new URL("/login?error=auth_failed", baseUrl));
  }
}
