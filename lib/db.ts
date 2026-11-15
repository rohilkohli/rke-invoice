import { PrismaClient } from "@prisma/client";

function createClient() {
  return new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
    // The stored PDF copy on invoices is legacy: PDFs are made on demand now. Leaving it out
    // of every query keeps list pages, exports and backups light, and nothing can load
    // ~75 KB of base64 per invoice by accident.
    omit: { invoice: { pdfData: true } },
  });
}

const globalForPrisma = globalThis as unknown as {
  prisma: ReturnType<typeof createClient> | undefined;
};

export const prisma = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
