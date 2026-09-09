import crypto from "crypto";

export interface LaunchTokenPayload {
  attemptId: string;
  userId: string;
  mezonId: string;
  exp: number; // timestamp in ms
}

const getSecret = (): string => {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error("Missing SESSION_SECRET environment variable");
  }
  return secret;
};

/**
 * Returns the base URL of the web application.
 */
export function getAppBaseUrl(): string {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");
  if (process.env.NEXT_PUBLIC_APP_URL)
    return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  if (process.env.MEZON_REDIRECT_URI) {
    try {
      const { origin } = new URL(process.env.MEZON_REDIRECT_URI);
      return origin;
    } catch {
      // ignore
    }
  }
  return "http://localhost:3000";
}

/**
 * Creates a cryptographically signed one-time or time-limited launch token.
 */
export function createLaunchToken(
  payload: Omit<LaunchTokenPayload, "exp">,
  expiresInMinutes = 120,
): string {
  const fullPayload: LaunchTokenPayload = {
    ...payload,
    exp: Date.now() + expiresInMinutes * 60 * 1000,
  };
  const data = Buffer.from(JSON.stringify(fullPayload)).toString("base64url");
  const sig = crypto
    .createHmac("sha256", getSecret())
    .update(data)
    .digest("base64url");
  return `${data}.${sig}`;
}

/**
 * Verifies a launch token and returns the payload if valid and not expired.
 */
export function verifyLaunchToken(token: string): LaunchTokenPayload | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 2) return null;
    const [data, sig] = parts;
    if (!data || !sig) return null;

    const expectedSig = crypto
      .createHmac("sha256", getSecret())
      .update(data)
      .digest("base64url");

    if (
      sig.length === expectedSig.length &&
      crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig))
    ) {
      const payload: LaunchTokenPayload = JSON.parse(
        Buffer.from(data, "base64url").toString("utf8"),
      );
      if (Date.now() > payload.exp) {
        console.warn("[verifyLaunchToken] Launch token has expired");
        return null;
      }
      return payload;
    }
  } catch (err) {
    console.error("[verifyLaunchToken] Verification failed:", err);
  }
  return null;
}
