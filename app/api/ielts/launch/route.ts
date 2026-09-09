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
    // 1. Fetch or ensure user exists in PostgreSQL
    let user = await pgDb.getUserByMezonId(payload.mezonId);
    if (!user) {
      user = await pgDb.findOrCreateUser({
        mezon_id: payload.mezonId,
        username: `user_${payload.mezonId}`,
      });
    }

    // 2. Refresh clan membership if needed
    if (!user.clan_member) {
      user.clan_member = true;
    }

    // 3. Establish iron-session for browser
    const session = await getSession();
    session.user = user;
    await session.save();

    console.log(
      `[GET /api/ielts/launch] Seamless auth for user: ${user.display_name || user.mezon_username} (ID: ${user.user_id}) -> launching attempt ${payload.attemptId}`,
    );

    // 4. Redirect directly to the IELTS Speaking test room
    return NextResponse.redirect(
      new URL(`/ielts-speaking/test/${payload.attemptId}`, baseUrl),
    );
  } catch (error) {
    console.error("[GET /api/ielts/launch] Error launching test:", error);
    return NextResponse.redirect(
      new URL(`/ielts-speaking/test/${payload.attemptId}`, baseUrl),
    );
  }
}
