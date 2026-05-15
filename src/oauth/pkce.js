import crypto from "node:crypto";

export function verifyPkceS256(verifier, expectedChallenge) {
  const actual = crypto.createHash("sha256").update(verifier).digest("base64url");
  return crypto.timingSafeEqual(Buffer.from(actual), Buffer.from(expectedChallenge));
}
