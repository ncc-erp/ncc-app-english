import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";

export const maxDuration = 120;

export async function POST(request: NextRequest) {
  const session = await getSession();

  if (!session.user) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 },
    );
  }

  const apiKey = process.env.DEEPGRAM_API_KEY?.trim();

  if (!apiKey) {
    return NextResponse.json(
      { success: false, error: "DEEPGRAM_API_KEY is not configured." },
      { status: 503 },
    );
  }

  try {
    const formData = await request.formData();
    const audio = formData.get("audio");

    if (!(audio instanceof File)) {
      return NextResponse.json(
        { success: false, error: "Audio file is required." },
        { status: 400 },
      );
    }

    const audioBuffer = await audio.arrayBuffer();
    const contentType = audio.type || "audio/webm";
    const params = new URLSearchParams({
      model: "nova-3",
      smart_format: "true",
      punctuate: "true",
      language: "en-US",
    });

    const response = await fetch(
      `https://api.deepgram.com/v1/listen?${params.toString()}`,
      {
        method: "POST",
        headers: {
          Authorization: `Token ${apiKey}`,
          "Content-Type": contentType,
        },
        body: audioBuffer,
        cache: "no-store",
      },
    );

    const data = (await response.json()) as {
      results?: { channels?: Array<{ alternatives?: Array<{ transcript?: string }> }> };
      err_code?: string;
      err_msg?: string;
    };

    if (!response.ok) {
      console.error("[Deepgram REST] Upstream request rejected:", data);
      return NextResponse.json(
        { success: false, error: data.err_msg || "Audio transcription failed." },
        { status: 502 },
      );
    }

    const transcript =
      data.results?.channels?.[0]?.alternatives?.[0]?.transcript?.trim() || "";

    return NextResponse.json({ success: true, transcript });
  } catch (error) {
    console.error("[POST /api/ielts/transcribe] Error:", error);
    return NextResponse.json(
      { success: false, error: "Audio transcription failed." },
      { status: 500 },
    );
  }
}
