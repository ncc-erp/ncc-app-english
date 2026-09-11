/**
 * Self-check for bot launch tokens: `npx tsx scripts/check-launch-token.ts`
 * Covers signature, expiry and the jti that makes a link single-use.
 */
import assert from "assert";
import crypto from "crypto";

process.env.SESSION_SECRET =
  process.env.SESSION_SECRET || "0123456789abcdef0123456789abcdef";

import {
  createLaunchToken,
  verifyLaunchToken,
} from "../lib/auth/launch-token";

const base = { attemptId: "ielts-att-1", userId: "u-1", mezonId: "m-1" };

// 1. Round trip
const token = createLaunchToken(base, 5);
const payload = verifyLaunchToken(token);
assert(payload, "valid token must verify");
assert.equal(payload!.attemptId, base.attemptId);
assert(payload!.jti, "payload must carry a jti");

// 2. Every token is distinct, so one leaked link cannot unlock another attempt
assert.notEqual(
  verifyLaunchToken(createLaunchToken(base, 5))!.jti,
  payload!.jti,
);

// 3. Tampered payload is rejected
const [data, sig] = token.split(".");
const forged = Buffer.from(
  JSON.stringify({ ...payload, mezonId: "someone-else" }),
).toString("base64url");
assert.equal(verifyLaunchToken(`${forged}.${sig}`), null, "forged payload");
assert.equal(verifyLaunchToken(`${data}.${sig}x`), null, "bad signature");

// 4. Expired token is rejected
assert.equal(verifyLaunchToken(createLaunchToken(base, -1)), null, "expired");

// 5. Legacy token without a jti is rejected (it could be replayed forever)
const legacy = Buffer.from(
  JSON.stringify({ ...base, exp: Date.now() + 60_000 }),
).toString("base64url");
const legacySig = crypto
  .createHmac("sha256", process.env.SESSION_SECRET!)
  .update(legacy)
  .digest("base64url");
assert.equal(verifyLaunchToken(`${legacy}.${legacySig}`), null, "no jti");

console.log("✅ launch-token checks passed");
