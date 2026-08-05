# RKE Invoice — Agent Guide

## Tech Stack

- **Framework**: Next.js 16 (App Router) + React 19
- **Database**: Prisma ORM v6 + PostgreSQL (Vercel Postgres)
- **Styling**: Tailwind CSS v4 + shadcn/ui components
- **State**: Zustand (client-side invoice store)
- **Validation**: Zod schemas for all server action payloads
- **PDF**: @react-pdf/renderer for print-ready invoice generation
- **AI OCR**: Gemini API for invoice scanning

## Key Conventions

- **Server Actions** live in `app/actions/` — all mutation logic goes here.
- **Database access** is exclusively via `prisma` imported from `lib/db.ts`.
- **Authentication** uses `requireSessionUser()` from `lib/auth.ts` — call it at the top of every server action and protected page.
- **GST calculations** must only use functions from `lib/calculations.ts` — never compute tax amounts inline.
- **Invoice numbers** are auto-sequenced via `getNextInvoiceNo()` in `lib/bootstrap.ts`.
- **Component structure**: domain components in `components/<domain>/`, shared UI primitives in `components/ui/`.

## What NOT To Do

- **Do NOT** use SQLite or any local file database — the app uses PostgreSQL on Vercel Postgres.
- **Do NOT** hardcode `DATABASE_URL` in Dockerfiles, code, or config — it is injected at runtime.
- **Do NOT** bypass Zod validation in server actions — all payloads must be validated.
- **Do NOT** write raw SQL queries — use Prisma's query builder exclusively.
- **Do NOT** import from `node_modules` internal paths or use unstable Next.js APIs.

## Environment Variables (Required)

| Variable         | Purpose                                       |
| ---------------- | --------------------------------------------- |
| `DATABASE_URL`   | PostgreSQL connection string (Vercel Postgres) |
| `SESSION_SECRET` | Secret key for session token signing           |
| `GEMINI_API_KEY` | Google Gemini API key for OCR invoice scanning |
