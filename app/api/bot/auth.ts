// app/api/bot/auth.ts
import { NextRequest } from "next/server";

/**
 * Verifies that the request is from the bot server using x-bot-secret header.
 * Returns true if the secret matches BOT_VERIFY_SECRET env var.
 */
export function verifyBotSecret(req: NextRequest): boolean {
  const secret = req.headers.get("x-bot-secret");
  const expected = process.env.BOT_VERIFY_SECRET;
  if (!expected || !secret) return false;
  return secret === expected;
}
