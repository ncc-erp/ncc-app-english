import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";

export async function GET() {
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
      {
        success: false,
        error: "DEEPGRAM_API_KEY is not configured.",
      },
      { status: 503 },
    );
  }

  try {
    const tokenUrl = "https://api.deepgram.com/v1/auth/grant";

    const response = await fetch(tokenUrl, {
      method: "POST",
      headers: {
        Authorization: `Token ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ ttl_seconds: 300 }),
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    });

    const responseText = await response.text();
    let data: {
      access_token?: string;
      token?: string;
      err_msg?: string;
      message?: string;
    } = {};

    try {
      data = JSON.parse(responseText) as typeof data;
    } catch {
      console.error("[Deepgram Token] Non-JSON upstream response:", {
        status: response.status,
        body: responseText,
      });
    }

    const token = data.access_token || data.token;

    if (!response.ok || !token) {
      console.error("[Deepgram Token] Upstream request rejected:", {
        status: response.status,
        error: data.err_msg || data.message || responseText,
      });
      return NextResponse.json(
        {
          success: false,
          error:
            data.err_msg ||
            data.message ||
            "Deepgram could not create a streaming session.",
        },
        { status: 502 },
      );
    }

    return NextResponse.json({ success: true, token });
  } catch (error) {
    console.error("[GET /api/ielts/deepgram-token] Error:", {
      error: error instanceof Error ? error.message : error,
      hasApiKey: Boolean(process.env.DEEPGRAM_API_KEY?.trim()),
    });
    return NextResponse.json(
      { success: false, error: "Could not create Deepgram session." },
      { status: 500 },
    );
  }
}
