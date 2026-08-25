import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { pgDb } from "@/lib/db/postgres";
import { createSignedAudioUrl } from "@/lib/supabase/storage";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ attemptId: string }> },
) {
  const session = await getSession();
  const { attemptId } = await params;

  if (!session.user) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 },
    );
  }

  try {
    const attempt = await pgDb.getIELTSAttempt(attemptId);
    if (!attempt) {
      return NextResponse.json(
        { success: false, error: "IELTS attempt not found" },
        { status: 404 },
      );
    }

    if (attempt.user_id !== session.user.user_id) {
      return NextResponse.json(
        { success: false, error: "IELTS attempt not found" },
        { status: 404 },
      );
    }

    for (const response of Object.values(attempt.responses)) {
      if (response.audio_storage_path) {
        try {
          response.audio_url = await createSignedAudioUrl(
            response.audio_storage_path,
          );
        } catch (error) {
          console.error(
            "[GET /api/ielts/[attemptId]] Signed audio URL error:",
            error,
          );
          response.audio_url = undefined;
        }
      }
    }

    const topic = await pgDb.getIELTSTopic(attempt.topic_id);
    if (!topic) {
      return NextResponse.json(
        { success: false, error: "IELTS topic not found" },
        { status: 404 },
      );
    }

    const isUnlocked =
      session.user?.clan_member === true || attempt.unlocked === true;

    if (attempt.status === "submitted") {
      const result = attempt.score_result
        ? {
            ...attempt.score_result,
            responses: attempt.responses,
            unlocked: isUnlocked,
          }
        : null;

      return NextResponse.json({
        success: true,
        attempt: { ...attempt, unlocked: isUnlocked },
        topic,
        isUnlocked,
        result,
      });
    }

    return NextResponse.json({
      success: true,
      attempt: { ...attempt, unlocked: isUnlocked },
      topic,
      isUnlocked,
    });
  } catch (error) {
    console.error("[GET /api/ielts/[attemptId]] Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch IELTS Speaking attempt" },
      { status: 500 },
    );
  }
}
