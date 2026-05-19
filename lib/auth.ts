import { cookies } from "next/headers";
import { prisma } from "@/lib/db";

export async function getSessionUser() {
  try {
    const cookieStore = await cookies();
    const userIdStr = cookieStore.get("userId")?.value;
    if (!userIdStr) return null;
    const userId = Number(userIdStr);
    if (Number.isNaN(userId)) return null;

    return await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true },
    });
  } catch (e) {
    console.error("getSessionUser error:", e);
    return null;
  }
}
