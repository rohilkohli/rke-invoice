import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { createSessionToken, SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/session";

export type SessionUser = {
  id: number;
  email: string;
  name: string | null;
};

function getSessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    maxAge: 60 * 60 * 24 * 7, // 1 week
    path: "/",
  };
}

export async function setSessionForUser(userId: number) {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, createSessionToken(userId), getSessionCookieOptions());
}

export async function clearSession() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
  cookieStore.delete("userId");
}

export async function getSessionUser() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    if (!token) return null;
    const payload = verifySessionToken(token);
    if (!payload) return null;

    return await prisma.user.findUnique({
      where: { id: payload.uid },
      select: { id: true, email: true, name: true },
    });
  } catch (e) {
    console.error("getSessionUser error:", e);
    return null;
  }
}

export async function requireSessionUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) {
    throw new Error("Unauthorized");
  }
  return user;
}
