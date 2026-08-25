import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { pgDb } from "@/lib/db/postgres";
import { createSignedAudioUrl, uploadAudio } from "@/lib/supabase/storage";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session.user)
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 },
    );

  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const attemptId = String(formData.get("attemptId") || "");
    const questionId = String(formData.get("questionId") || "");

    if (!(file instanceof File) || !attemptId || !questionId) {
      return NextResponse.json(
        { success: false, error: "Missing audio, attemptId, or questionId" },
        { status: 400 },
      );
    }

    if (file.size === 0 || file.size > 10 * 1024 * 1024) {
      return NextResponse.json(
        {
          success: false,
          error: "Audio file must be between 1 byte and 10 MB",
        },
        { status: 400 },
      );
    }

    const attempt = await pgDb.getIELTSAttempt(attemptId);
    if (!attempt || attempt.user_id !== session.user.user_id) {
      return NextResponse.json(
        { success: false, error: "IELTS attempt not found" },
        { status: 404 },
      );
    }

    const extension = file.type.includes("ogg") ? "ogg" : "webm";
    const path = `${session.user.user_id}/${attemptId}/${questionId}.${extension}`;
    await uploadAudio(
      path,
      await file.arrayBuffer(),
      file.type || "audio/webm",
    );

    return NextResponse.json({
      success: true,
      path,
      audioUrl: await createSignedAudioUrl(path),
    });
  } catch (error) {
    console.error("[POST /api/ielts/upload-audio] Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to upload audio recording" },
      { status: 500 },
    );
  }
}
