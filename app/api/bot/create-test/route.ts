import { NextRequest, NextResponse } from "next/server";
import { pgDb } from "@/lib/db/postgres";
import { createLaunchToken, getAppBaseUrl } from "@/lib/auth/launch-token";
import { verifyBotSecret } from "../auth";

export async function POST(req: NextRequest) {
  if (!verifyBotSecret(req)) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 },
    );
  }

  try {
    const body = await req.json();
    const { mezon_id, username } = body;

    if (!mezon_id) {
      return NextResponse.json(
        { success: false, error: "Missing mezon_id in request body" },
        { status: 400 },
      );
    }

    const user = await pgDb.findOrCreateUser({
      mezon_id,
      username,
    });

    const topics = await pgDb.getIELTSTopics();
    if (topics.length === 0) {
      return NextResponse.json(
        { success: false, error: "No IELTS topics available" },
        { status: 404 },
      );
    }

    const randomTopic = topics[Math.floor(Math.random() * topics.length)];

    const attempt = await pgDb.createIELTSAttempt(user.user_id, randomTopic.id);

    const token = await createLaunchToken(
      {
        attemptId: attempt.id,
        userId: user.user_id,
        mezonId: user.mezon_id,
      },
      120, // 120 minutes TTL
    );

    const launchUrl = `${getAppBaseUrl()}/api/ielts/launch?token=${token}`;

    return NextResponse.json({
      success: true,
      attemptId: attempt.id,
      topic: {
        id: randomTopic.id,
        title: randomTopic.title,
        category: randomTopic.category,
      },
      launchUrl,
    });
  } catch (error) {
    console.error("[POST /api/bot/create-test] Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to create IELTS test attempt" },
      { status: 500 },
    );
  }
}
