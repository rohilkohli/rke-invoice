"use server";

import crypto from "crypto";
import { redirect } from "next/navigation";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/crypto";
import { clearSession, setSessionForUser } from "@/lib/auth";

const authSchema = z.object({
  email: z.string().email("Invalid email address"),
  // The same minimum as changing a password and as the seed script.
  password: z.string().min(10, "Password must be at least 10 characters"),
  name: z.string().optional(),
});

const signUpSchema = authSchema.extend({
  inviteCode: z.string().optional(),
});

const signInSchema = z.object({ email: z.string().min(1), password: z.string().min(1) });

/** Compares two secrets without leaking where they first differ. */
function sameSecret(given: string, expected: string) {
  const a = crypto.createHash("sha256").update(given).digest();
  const b = crypto.createHash("sha256").update(expected).digest();
  return crypto.timingSafeEqual(a, b);
}

export async function signUp(formData: z.infer<typeof signUpSchema>) {
  // Sign-up is closed unless an invite code is configured. New logins start empty and can
  // use the app's paid AI-scan keys, so they are never open to the public.
  const inviteCode = process.env.SIGNUP_INVITE_CODE?.trim();
  if (!inviteCode) {
    return { error: "Sign-up is closed. Ask the account owner to create a login for you." };
  }

  const parsed = signUpSchema.safeParse(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || "Invalid input" };
  }

  const { email, password, name } = parsed.data;
  if (!sameSecret(parsed.data.inviteCode?.trim() ?? "", inviteCode)) {
    return { error: "That invite code is not valid." };
  }

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

export async function signIn(formData: z.infer<typeof signInSchema>) {
  const parsed = signInSchema.safeParse(formData);
  if (!parsed.success) {
    return { error: "Invalid email or password" };
  }
  const { email, password } = parsed.data;

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
