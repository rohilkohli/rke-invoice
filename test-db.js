const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    console.log("Testing Neon DB connection...");
    await prisma.$connect();
    const count = await prisma.user.count();
    console.log("SUCCESS! User count:", count);
  } catch (err) {
    console.error("Connection error details:", err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
