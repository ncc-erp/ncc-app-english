import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { checkIsClanAdmin } from "@/lib/admin/clan-data-service";
import { downloadAudioBuffer } from "@/lib/supabase/storage";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    const user = session.user;

    if (!user || !user.isLoggedIn) {
      return new NextResponse("Unauthorized. Login required.", { status: 401 });
    }

    const isAdmin = await checkIsClanAdmin(user.mezon_id);
    if (!isAdmin) {
      return new NextResponse("Forbidden. Admin role in clan required.", {
        status: 403,
      });
    }

    const { searchParams } = new URL(req.url);
    let path = searchParams.get("path") || "";
    const url = searchParams.get("url") || "";

    if (!path && url) {
      const match = url.match(
        /(?:ielts-recordings|ielts-speaking-recordings)\/([^?#]+)/,
      );
      if (match?.[1]) {
        path = decodeURIComponent(match[1]);
      }
    }

    if (!path) {
      return new NextResponse("Audio path is required.", { status: 400 });
    }

    // Attempt to download the audio buffer from Supabase Storage
    let audioData = await downloadAudioBuffer(path);

    // Fallback: if path omitted extension, try .webm then .ogg
    if (!audioData) {
      if (!path.endsWith(".webm") && !path.endsWith(".ogg")) {
        audioData =
          (await downloadAudioBuffer(`${path}.webm`)) ||
          (await downloadAudioBuffer(`${path}.ogg`));
      }
    }

    if (!audioData || audioData.buffer.length === 0) {
      return new NextResponse("Audio recording file not found in storage.", {
        status: 404,
      });
    }

    const buffer = audioData.buffer;
    const totalLength = buffer.length;
    const contentType = audioData.contentType || "audio/webm";

    // Handle HTTP Range requests for seamless audio seeking / scrubbing in browsers
    const range = req.headers.get("range");
    if (range && range.startsWith("bytes=")) {
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : totalLength - 1;

      if (start >= totalLength || end >= totalLength || start > end) {
        return new NextResponse(null, {
          status: 416,
          headers: {
            "Content-Range": `bytes */${totalLength}`,
          },
        });
      }

      const chunk = buffer.subarray(start, end + 1);
      return new NextResponse(new Uint8Array(chunk), {
        status: 206,
        headers: {
          "Content-Range": `bytes ${start}-${end}/${totalLength}`,
          "Accept-Ranges": "bytes",
          "Content-Length": String(chunk.length),
          "Content-Type": contentType,
          "Cache-Control": "private, max-age=3600",
        },
      });
    }

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Accept-Ranges": "bytes",
        "Content-Length": String(totalLength),
        "Content-Type": contentType,
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (error) {
    console.error("[GET /api/admin/audio Error]:", error);
    return new NextResponse("Internal server error streaming audio", {
      status: 500,
    });
  }
}
