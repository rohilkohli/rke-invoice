import { PrismaClient } from "@prisma/client";

import { hashPassword } from "../lib/crypto";

const prisma = new PrismaClient();

/**
 * Creates the first login. Nothing about it is stored in the repository:
 *
 *   SEED_ADMIN_EMAIL="you@example.com" SEED_ADMIN_PASSWORD="a long password" npx prisma db seed
 *
 * An existing user is left exactly as it is. To replace its password on purpose, also set
 * SEED_RESET_PASSWORD=true.
 */
async function main() {
  const email = process.env.SEED_ADMIN_EMAIL?.trim();
  const password = process.env.SEED_ADMIN_PASSWORD;
  const name = process.env.SEED_ADMIN_NAME?.trim() || null;
  const reset = process.env.SEED_RESET_PASSWORD === "true";

  if (!email || !password) {
    throw new Error(
      "Set SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD, for example:\n" +
        '  SEED_ADMIN_EMAIL="you@example.com" SEED_ADMIN_PASSWORD="a long password" npx prisma db seed',
    );
  }
  if (password.length < 10) {
    throw new Error("SEED_ADMIN_PASSWORD must be at least 10 characters.");
  }

  const existing = await prisma.user.findUnique({ where: { email } });

  if (existing) {
    if (!reset) {
      console.log(
        `User ${email} already exists and was left unchanged. ` +
          "Set SEED_RESET_PASSWORD=true to replace its password.",
      );
      return;
    }
    await prisma.user.update({
      where: { email },
      data: { password: hashPassword(password), ...(name ? { name } : {}) },
    });
    console.log(`Replaced the password for ${email}.`);
    return;
  }

  await prisma.user.create({
    data: { email, name, password: hashPassword(password) },
  });
  console.log(`Created user ${email}.`);
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
