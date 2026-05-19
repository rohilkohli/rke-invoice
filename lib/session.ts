import crypto from "crypto";

const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days
export const SESSION_COOKIE_NAME = "session";

type SessionPayload = {
  uid: number;
  exp: number;
};

function getSessionSecret() {
  const secret = process.env.SESSION_SECRET;
  if (secret && secret.trim()) return secret;
  if (process.env.NODE_ENV === "production") {
    throw new Error("SESSION_SECRET is required in production");
  }
  return "dev-insecure-session-secret-change-me";
}

function toBase64Url(value: string | Buffer) {
  return Buffer.from(value).toString("base64url");
}

function sign(payloadBase64Url: string) {
  return crypto
    .createHmac("sha256", getSessionSecret())
    .update(payloadBase64Url)
    .digest("base64url");
}

export function createSessionToken(
  userId: number,
  options?: { expiresInSeconds?: number },
) {
  const expiresInSeconds = options?.expiresInSeconds ?? SESSION_TTL_SECONDS;
  const now = Math.floor(Date.now() / 1000);
  const payload: SessionPayload = {
    uid: userId,
    exp: now + expiresInSeconds,
  };
  const payloadBase64Url = toBase64Url(JSON.stringify(payload));
  const signature = sign(payloadBase64Url);
  return `${payloadBase64Url}.${signature}`;
}

export function verifySessionToken(token: string): SessionPayload | null {
  const [payloadBase64Url, signature] = token.split(".");
  if (!payloadBase64Url || !signature) return null;

  const expectedSignature = sign(payloadBase64Url);
  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);

  if (
    signatureBuffer.length !== expectedBuffer.length ||
    !crypto.timingSafeEqual(signatureBuffer, expectedBuffer)
  ) {
    return null;
  }

  try {
    const payloadRaw = Buffer.from(payloadBase64Url, "base64url").toString("utf8");
    const payload = JSON.parse(payloadRaw) as SessionPayload;
    if (!Number.isInteger(payload.uid) || !Number.isInteger(payload.exp)) {
      return null;
    }
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp <= now) return null;
    return payload;
  } catch {
    return null;
  }
}
