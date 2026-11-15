# 🧾 RKE Invoice & Ledger Manager

<p align="center">
  <img src="public/RKE logo.png" alt="RKE Logo" width="120" style="border-radius: 16px; margin-bottom: 10px;" />
</p>

<p align="center">
  <strong>A Premium GST Tax Invoice Generator & Client Ledger Account Statement Manager</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Next.js-16.2.6-black?style=for-the-badge&logo=next.js" alt="Next.js" />
  <img src="https://img.shields.io/badge/React-19.2.4-61DAFB?style=for-the-badge&logo=react&logoColor=black" alt="React" />
  <img src="https://img.shields.io/badge/Prisma-6.19.3-2D3748?style=for-the-badge&logo=prisma" alt="Prisma" />
  <img src="https://img.shields.io/badge/PostgreSQL-16-4169E1?style=for-the-badge&logo=postgresql&logoColor=white" alt="PostgreSQL" />
  <img src="https://img.shields.io/badge/Tailwind_CSS-v4-06B6D4?style=for-the-badge&logo=tailwind-css" alt="Tailwind CSS" />
  <img src="https://img.shields.io/badge/Google_Gemini-API-blue?style=for-the-badge&logo=google-gemini" alt="Gemini" />
</p>

---

## 📖 Overview

**RKE Invoice & Ledger Manager** is a premium, modern, and highly interactive business management suite custom-tailored for **RKE (Rental Service of Heavy Engineering Equipments)**. It streamlines client invoicing, ledger tracking, and credit/payment books.

The application features a gorgeous **glassmorphic dark UI** with smooth micro-animations, an interactive live-updating A4 PDF canvas, and integrated **AI vision scanning** to convert scanned/photographed paper invoices into editable digital invoices.

---

## 📸 Interactive UI Walkthroughs & Demo Recordings

Explore the core workflows and aesthetic upgrades of RKE Invoice in action:

### 1. Modern Login & User Authentication
A sleek, premium landing interface with smooth animations, custom floating cards, and responsive state transitions.

<p align="center">
  <img src="public/demo/login_aesthetics.webp" width="85%" alt="Login Aesthetics Demo" style="border-radius: 12px; box-shadow: 0 10px 30px rgba(0,0,0,0.15); border: 1px solid rgba(255,255,255,0.1);" />
</p>

---

### 2. Smart GST Invoice Generator & Print Preview
Easily generate standard tax invoices with dynamic CGST, SGST, IGST calculations, a line-item table editor, local signature caching, and an instant print preview.

<p align="center">
  <img src="public/demo/invoice_creation.webp" width="85%" alt="Invoice Creation Demo" style="border-radius: 12px; box-shadow: 0 10px 30px rgba(0,0,0,0.15); border: 1px solid rgba(255,255,255,0.1);" />
</p>

---

### 3. Client Wise Ledger & Bank Payments
Record payments received in bank accounts (UTR, UPI, Cash) to update client ledger books. Instantly track Total Billed, Total Received, and Running Outstanding Dues.

<p align="center">
  <img src="public/demo/ledger_walkthrough.webp" width="85%" alt="Client Ledger Demo" style="border-radius: 12px; box-shadow: 0 10px 30px rgba(0,0,0,0.15); border: 1px solid rgba(255,255,255,0.1);" />
</p>

---

### 4. Intelligent AI Invoice Scanner
Scan any manual invoice image to automatically read line items, rates, taxes, and customer details into the digital editor in seconds. Gemini is the primary reader; OpenAI and Mistral can be added as fallbacks.

<p align="center">
  <img src="public/demo/ocr_invoice_scan.webp" width="85%" alt="AI Scan Demo" style="border-radius: 12px; box-shadow: 0 10px 30px rgba(0,0,0,0.15); border: 1px solid rgba(255,255,255,0.1);" />
</p>

---

## ⚡ Core Features

*   ✨ **Premium Aesthetics**: Glassmorphic theme overlays, modern typography, interactive hover triggers, and dynamic color accents (emerald and teal).
*   📊 **Client Ledger Bookkeeping**: Chronological tracking of debits (issued invoices) and credits (bank payment receipts) with automatically calculated outstanding balances. Quotations are never counted as billed.
*   🤖 **AI Scan Mode**: Take a photo of an invoice on mobile or upload a scan on desktop; the vision model extracts line items, quantities, rates, and totals for you to check.
*   📄 **Live PDF Canvas Toggle**: Toggle the A4 print preview pane on or off instantly to optimize screen space while editing.
*   🔳 **Details QR Code**: Every invoice PDF carries a "Scan for Details" QR with the company, GSTIN, invoice number, date, billed-to name and total.
*   ☁️ **Google Drive Sync**: Each saved invoice is filed to your Google Drive as a PDF, with a ledger sheet row and a database backup (see [Google Drive sync](#-google-drive-sync)).
*   💾 **Signatures**: Drawn, uploaded, or typed signatures are kept with the invoice and printed on the PDF.
*   🔒 **Multi-Tenant Security**: All clients, invoices, settings, and ledger statements are scoped to the signed-in account.

### How invoices behave

*   **Invoice numbers are typed by you.** The field starts blank, the number shows in the live PDF as you type it, and each account can use a number only once (another account may reuse it).
*   **Unit, Qty and Rate are free text** (for example `26 Days` or `5,000 per day`), saved and printed exactly as typed. Nothing is calculated from them.
*   **You type each line's Amount.** It is the only line figure that feeds the totals; GST is worked out in whole paise from the sum.
*   **Clients are remembered, invoices are not tied to them.** Each invoice keeps its own copy of the bill-to and ship-to details, so picking or changing a client never alters an invoice you have already issued. The "Saved client" box lists clients you have billed before and only fills the form in.
*   **One PDF everywhere.** The editor preview, the dashboard downloads, the ZIP, and the copy sent to Google Drive are all drawn by the same code from what is saved.

---

## 🛠️ Technology Stack

| Component | Technology | Description |
| :--- | :--- | :--- |
| **Framework** | **Next.js 16 (App Router)** | Fast SSR, React Server Actions, Turbopack bundling |
| **UI & Styling** | **Tailwind CSS v4 & Lucide** | Responsive styles, emerald accents, dark theme layout |
| **Database** | **PostgreSQL & Prisma ORM** | Schema safety and relational storage (Vercel Postgres in production) |
| **State** | **Zustand** | Client-side invoice editor state |
| **Validation** | **Zod** | Every server action payload is validated |
| **PDF Engine** | **@react-pdf/renderer** | The same PDF template in the browser and on the server |
| **AI Integration** | **Gemini (OpenAI / Mistral fallbacks)** | Reads scanned invoices into the editor |

---

## 🚀 Local Setup & Installation

### 1. Prerequisites
Node.js 20+ and npm, and a PostgreSQL database (a local one, or a free hosted one such as Neon or Vercel Postgres).

### 2. Configure Environment Variables
Copy `.env.example` to `.env` and fill it in. The minimum for local work:

```env
DATABASE_URL="postgresql://user:password@localhost:5432/rke"
SESSION_SECRET="a-long-random-string-of-at-least-32-characters"
```

All variables are described in [Environment variables](#-environment-variables).

### 3. Install Dependencies
```bash
npm install
```

### 4. Create the Database Tables
```bash
npx prisma db push
```

### 5. Create Your Login
Nothing about a login is stored in the repository. Choose your own email and a password of at least 10 characters:

```bash
SEED_ADMIN_EMAIL="you@example.com" SEED_ADMIN_PASSWORD="a long password" npx prisma db seed
```

Running it again leaves an existing user untouched. To replace that user's password on purpose, also set `SEED_RESET_PASSWORD=true`. You can change your password any time in **Settings → Change password**.

### 6. Run the Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) and sign in.

### 7. Run the Checks
```bash
npm test        # unit tests
npm run lint
npm run build
```

---

## 🔑 Environment Variables

| Variable | Required | Purpose |
| :--- | :---: | :--- |
| `DATABASE_URL` | yes | PostgreSQL connection string. Injected at runtime; never commit it. |
| `SESSION_SECRET` | yes | Secret that signs login cookies (use 32+ random characters). Changing it signs everyone out. |
| `GEMINI_API_KEY` | for AI scan | Google Gemini key. It is the only reader that accepts PDFs. |
| `OPENAI_API_KEY`, `MISTRAL_API_KEY` | optional | Fallback readers for pictures when Gemini is unavailable. |
| `GEMINI_MODEL`, `OPENAI_MODEL`, `MISTRAL_MODEL` | optional | Override the model each reader uses (the defaults are in `lib/ocr.ts`). |
| `SIGNUP_INVITE_CODE` | optional | Sign-up is **closed** unless this is set; people then need the code to create a login. Leave it unset to keep sign-up closed. |
| `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`, `SEED_ADMIN_NAME`, `SEED_RESET_PASSWORD` | seed only | Used by `npx prisma db seed` to create the first login. |

---

## ☁️ Production Deployment (Vercel)

The app is deployed on **Vercel** with **Vercel Postgres**.

1. **Environment variables** — set `DATABASE_URL`, `SESSION_SECRET` and `GEMINI_API_KEY` for the Production environment (plus `SIGNUP_INVITE_CODE` only if you want invited people to be able to sign up). Preview deployments should point at a different database, or at none, so a preview never changes production data.
2. **Build command** — `npm run build` (this runs `prisma generate` and `next build`). The build does **not** change the database.
3. **First login** — run the seed command above once against the production database.

### Changing the database tables (read before deploying a schema change)

The build never touches the database, so a release that changes `prisma/schema.prisma` needs one manual step, done **before** the new code goes live:

1. **Back up** the database (a Vercel Postgres/Neon backup, or the backup file the app keeps in Google Drive).
2. Use the **direct (unpooled)** connection string for schema commands, not the pooled one the app runs on:
   ```bash
   DATABASE_URL="<direct connection string>" npx prisma db push
   ```
3. If Prisma stops with a data-loss warning about a **new unique constraint** on `Invoice (userId, invoiceNo)`, that is expected the first time you apply the per-account invoice numbers: invoice numbers were already unique across all accounts, so the new rule cannot reject any row. Run the command once without any flag to read the warning, then again with `--accept-data-loss`. Any other warning (anything about dropping a column or table) is **not** expected: stop and check.
4. Deploy straight away. Once `LineItem.qty` and `rate` have become text, the *previous* release can still read invoices but can no longer save them, so roll **forward** (fix and redeploy) rather than back if something is wrong.

### Other things to know

* `Dockerfile` and `cloudbuild.yaml` belong to an earlier Cloud Run setup. Vercel does not use them. If a Google Cloud Build trigger still watches this repository, disable it so a push does not deploy a second copy.
* The PDF font files in `public/fonts` (`Arimo-Regular.ttf`, `Arimo-Italic.ttf`) are read by the server when it makes a PDF; `next.config.ts` makes sure they are included in the deployed function.

---

## ☁️ Google Drive Sync

Saved invoices can be filed to your Google Drive through a small Google Apps Script that you deploy yourself.

1. In **Settings → Google Drive Auto-Sync**, press **Get Google Script** and **Copy Script**. The script already contains a private key made for your account; it refuses any request that does not carry it.
2. At [script.google.com](https://script.google.com) create a project, paste the script into `Code.gs`, and **Deploy → New deployment → Web app** (Execute as: *Me*, Who has access: *Anyone*).
3. Paste the web app address (it starts with `https://script.google.com/macros/`) into the box in Settings, then **Save** and **Test**.

From then on each save uploads the invoice PDF and its ledger row after the page has replied. If a step fails, the reason is shown on the invoice ("Last Drive sync failed: …"). A renamed or deleted invoice has its old file and row removed. **Sync All to Drive Now** brings everything up to date and uploads a database backup (which never includes your Drive address, private key or any stored PDF).

Already set up before? Copy the script again and paste it over the old one, then **Deploy → Manage deployments → pencil → New version**. Older scripts keep working but the app will tell you to update.
