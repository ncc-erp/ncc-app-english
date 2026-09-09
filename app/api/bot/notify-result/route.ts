import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { notifyExamResult } from "@/lib/bot/bot-messenger";

export async function POST(req: NextRequest) {
  const session = await getSession();

  if (!session.user) {
    return NextResponse.json(
      { success: false, error: "Unauthorized. Please login first." },
      { status: 401 },
    );
  }

  try {
    const { attemptId } = await req.json();

    if (!attemptId) {
      return NextResponse.json(
        { success: false, error: "Missing attemptId in request body." },
        { status: 400 },
      );
    }

    const result = await notifyExamResult(session.user.mezon_id, attemptId);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.message },
        { status: 400 },
      );
    }

    return NextResponse.json({
      success: true,
      message: result.message,
      channelId: result.channelId,
    });
  } catch (error) {
    console.error("[POST /api/bot/notify-result] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to send exam result notification to Mezon Clan.",
      },
      { status: 500 },
    );
  }
}
