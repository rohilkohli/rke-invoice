# RKE Invoice — Agent Guide

## Tech Stack

- **Framework**: Next.js 16 (App Router) + React 19
- **Database**: Prisma ORM v6 + PostgreSQL (Vercel Postgres)
- **Styling**: Tailwind CSS v4 + shadcn/ui components
- **State**: Zustand (client-side invoice store)
- **Validation**: Zod schemas for all server action payloads
- **PDF**: @react-pdf/renderer for print-ready invoice generation (browser and server)
- **AI OCR**: Gemini API for invoice scanning (OpenAI / Mistral as optional fallbacks)
- **Backup / filing**: Google Drive through a user-deployed Apps Script webhook
- **Deployment**: Vercel (the `Dockerfile` and `cloudbuild.yaml` are an old Cloud Run setup, not used)

## Key Conventions

- **Server Actions** live in `app/actions/` — all mutation logic goes here.
- **Database access** is exclusively via `prisma` imported from `lib/db.ts`. That client leaves the legacy `Invoice.pdfData` column out of every query; PDFs are made on demand and never stored.
- **Authentication** uses `requireSessionUser()` from `lib/auth.ts` — call it at the top of every server action and protected page. Route handlers use `getSessionUser()` and answer `401` without a login. Always look records up by owner as well as id.
- **GST calculations** must only use functions from `lib/calculations.ts` — never compute tax amounts inline. Money is whole paise (BigInt for tax, half-up on the decimal text), never floating-point rounding. `resolveTaxMode(company, client)` is the only place that decides intra-state (CGST+SGST) or inter-state (IGST); state codes are normalised first, so `9` and `09` are the same state.
- **Line items**: Unit, Qty and Rate are free text, stored and printed exactly as typed, and must never be linked by a formula or derived from anything (not each other, not meter readings). Amount is typed by the user and is the only line figure that feeds totals — use `parseAmount()` / `lineAmount()` from `lib/calculations.ts`; never compute it as Qty × Rate.
- **Invoice numbers** are typed in by the user. Never pre-fill or auto-generate one — the field starts blank, and `createInvoice` / `updateInvoice` reject blank and duplicate numbers. They are unique per account (`@@unique([userId, invoiceNo])`), so another account may reuse a number.
- **Drafts**: a `DRAFT` may be saved unfinished: it needs only the invoice number, date and the client's name (the client record needs a name). Every other status needs the full details. The server rules are in `lib/invoiceInput.ts` (`invoiceSchema`, `findMissingDetail`) and the form's in `components/invoice/validation.ts`; keep the two in step. A saved draft lives in the database like any invoice, so it is there from any device after signing in.
- **Clients**: each invoice stores its own copy of the bill-to and ship-to details (`Invoice.client*` / `shipTo*`), written on every save. `Client` rows only identify who has been billed (found by name + GSTIN in `lib/clients.ts`); saving an invoice never edits a `Client` row or any other invoice. The "Saved client" picker only fills the form. Invoices from before the copy existed fall back to the linked client (`billToOf` in `lib/serialize.ts`).
- **One PDF**: the editor preview, dashboard downloads, ZIP and the Google Drive copy all render `components/pdf/InvoicePDF.tsx`, fed by `toInvoiceFormData` in `lib/serialize.ts` (server side: `lib/generatePdfServer.ts`). Do not build a second template or a second mapper. The QR text comes from `buildInvoiceQrText` in `lib/qr.ts`.
- **PDF fonts** are registered in `components/pdf/fonts.ts` (browser) and `lib/pdfFonts.ts` (server, from `public/fonts`). Register each font file once. Never register the same file again for bold: react-pdf then keeps two copies under one name and a later PDF loses the first character of some bold text (`tests/pdf-fonts.test.ts` covers this). If real bold is wanted, add a separate static bold file.
- **Google Drive**: every request goes through `post()` in `lib/gdrive.ts`, carries the account's private key (`CompanySettings.gdriveWebhookSecret`) and is sent only to an address that passes `isAllowedWebhookUrl` (`lib/gdriveCore.ts`). The address and key are never sent to the browser except as the script the owner copies in Settings. Syncing runs after the reply with `after()` and records its outcome on the invoice (`driveSynced*`, `driveSyncError`) so failures are visible.
- **Component structure**: domain components in `components/<domain>/`, shared UI primitives in `components/ui/`.
- **Tests**: `npm test` runs `tests/*.test.ts` with `tsx`. Modules that import `server-only` cannot be imported from a test, so keep logic in plain modules (`lib/calculations.ts`, `lib/gdriveCore.ts`, `lib/clientIdentity.ts`, `lib/export.ts`, …) and keep only database and framework glue in the `server-only` ones.

## What NOT To Do

- **Do NOT** use SQLite or any local file database — the app uses PostgreSQL on Vercel Postgres.
- **Do NOT** hardcode `DATABASE_URL` in Dockerfiles, code, or config — it is injected at runtime.
- **Do NOT** bypass Zod validation in server actions — all payloads must be validated.
- **Do NOT** write raw SQL queries — use Prisma's query builder exclusively.
- **Do NOT** import from `node_modules` internal paths or use unstable Next.js APIs.
- **Do NOT** put credentials, default passwords or sample logins anywhere in the repository (code, README, seed). The first login comes from `npx prisma db seed` with `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`.
- **Do NOT** open sign-up: it stays closed unless `SIGNUP_INVITE_CODE` is set.
- **Do NOT** send the Google Drive address or private key to a client component, or call any address that has not passed `isAllowedWebhookUrl`.
- **Do NOT** compute an invoice figure anywhere except `lib/calculations.ts`, or show a figure on a PDF/sheet that was not read from the saved invoice.

## Environment Variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | yes | PostgreSQL connection string (Vercel Postgres). Use the direct/unpooled string for `prisma db push`. |
| `SESSION_SECRET` | yes | Secret key for session token signing. |
| `GEMINI_API_KEY` | for AI scan | Google Gemini API key for OCR invoice scanning (the only reader that accepts PDFs). |
| `OPENAI_API_KEY`, `MISTRAL_API_KEY` | optional | Fallback readers for pictures. |
| `GEMINI_MODEL`, `OPENAI_MODEL`, `MISTRAL_MODEL` | optional | Override each reader's model (defaults in `lib/ocr.ts`). |
| `SIGNUP_INVITE_CODE` | optional | Sign-up is closed unless this is set. |
| `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`, `SEED_ADMIN_NAME`, `SEED_RESET_PASSWORD` | seed only | Used by `npx prisma db seed`. |

## Changing the Schema

The build (`prisma generate && next build`) never changes the database. After editing `prisma/schema.prisma`, apply it with `npx prisma db push` (direct connection string) **before** the new code is live, back up first, and roll forward rather than back. The full steps, including the one expected data-loss warning for the per-account invoice-number index, are in the README under "Changing the database tables".
