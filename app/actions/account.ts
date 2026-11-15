"use server";

import { z } from "zod";

import { prisma } from "@/lib/db";
import { requireSessionUser } from "@/lib/auth";
import { hashPassword, verifyPassword } from "@/lib/crypto";

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Enter your current password."),
  newPassword: z
    .string()
    .min(10, "The new password must be at least 10 characters.")
    .max(200, "The new password is too long."),
});

export async function changePassword(input: z.infer<typeof changePasswordSchema>) {
  const user = await requireSessionUser();

  const parsed = changePasswordSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const { currentPassword, newPassword } = parsed.data;

  const row = await prisma.user.findUnique({
    where: { id: user.id },
    select: { password: true },
  });
  if (!row || !verifyPassword(currentPassword, row.password)) {
    return { ok: false as const, error: "The current password is wrong." };
  }
  if (currentPassword === newPassword) {
    return { ok: false as const, error: "Choose a password that is different from the current one." };
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { password: hashPassword(newPassword) },
  });
  return { ok: true as const };
}
