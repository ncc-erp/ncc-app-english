import { NextRequest, NextResponse } from "next/server";
import { pgDb } from "@/lib/db/postgres";
import { getAppBaseUrl } from "@/lib/auth/launch-token";
import { verifyBotSecret } from "../auth";

export async function GET(req: NextRequest) {
  if (!verifyBotSecret(req)) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 },
    );
  }

  try {
    const { searchParams } = new URL(req.url);
    const mezon_id = searchParams.get("mezon_id");

    if (!mezon_id) {
      return NextResponse.json(
        { success: false, error: "Missing mezon_id query parameter" },
        { status: 400 },
      );
    }

    let user = await pgDb.getUserByMezonId(mezon_id);
    if (!user) {
      user = await pgDb.findOrCreateUser({
        mezon_id,
        username: `user_${mezon_id}`,
      });
    }

    let attempt = await pgDb.getLatestSubmittedIELTSAttempt(user.user_id);
    if (!attempt && user.user_id !== user.mezon_id) {
      attempt = await pgDb.getLatestSubmittedIELTSAttempt(user.mezon_id);
    }

    if (!attempt) {
      return NextResponse.json(
        { success: false, error: "No submitted attempts found" },
        { status: 404 },
      );
    }

    const detailsUrl = `${getAppBaseUrl()}/ielts-speaking/result/${attempt.id}/details`;

    return NextResponse.json({
      success: true,
      attempt: {
        id: attempt.id,
        topic_id: attempt.topic_id,
        topic_title: attempt.topic_title,
        submitted_at: attempt.submitted_at,
        score_result: attempt.score_result,
      },
      detailsUrl,
    });
  } catch (error) {
    console.error("[GET /api/bot/latest-result] Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch latest result" },
      { status: 500 },
    );
  }
}
