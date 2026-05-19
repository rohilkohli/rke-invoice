import assert from "node:assert/strict";
import test from "node:test";

import { createSessionToken, verifySessionToken } from "../lib/session";

process.env.SESSION_SECRET = "test-session-secret";

test("accepts a valid signed session token", () => {
  const token = createSessionToken(42);
  const payload = verifySessionToken(token);

  assert.ok(payload);
  assert.equal(payload.uid, 42);
});

test("rejects tampered session token", () => {
  const token = createSessionToken(42);
  const [payload, signature] = token.split(".");
  const tamperedPayload = payload.slice(0, -1) + (payload.endsWith("a") ? "b" : "a");
  const tampered = `${tamperedPayload}.${signature}`;

  const parsed = verifySessionToken(tampered);
  assert.equal(parsed, null);
});

test("rejects expired session token", () => {
  const expired = createSessionToken(42, { expiresInSeconds: -10 });
  const parsed = verifySessionToken(expired);
  assert.equal(parsed, null);
});

