"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/crypto";
import { clearSession, setSessionForUser } from "@/lib/auth";

const authSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  name: z.string().optional(),
});

export async function signUp(formData: z.infer<typeof authSchema>) {
  const parsed = authSchema.safeParse(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || "Invalid input" };
  }

  const { email, password, name } = parsed.data;

  try {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return { error: "User already exists with this email" };
    }

    const hashedPassword = hashPassword(password);
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name: name || null,
      },
    });

    await setSessionForUser(user.id);
  } catch (e) {
    console.error("SignUp error:", e);
    return { error: "Failed to create account" };
  }

  redirect("/dashboard");
}

export async function signIn(formData: Omit<z.infer<typeof authSchema>, "name">) {
  const { email, password } = formData;

  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return { error: "Invalid email or password" };
    }

    const valid = verifyPassword(password, user.password);
    if (!valid) {
      return { error: "Invalid email or password" };
    }

    await setSessionForUser(user.id);
  } catch (e) {
    console.error("SignIn error:", e);
    return { error: "Failed to sign in" };
  }

  redirect("/dashboard");
}

export async function signOut() {
  await clearSession();
  redirect("/login");
}
