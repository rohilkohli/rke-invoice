# 🧾 RKE Invoice & Ledger Manager

A premium, modern, and highly interactive **GST Tax Invoice Generator & Client Ledger Account Statement** manager. Bootstrapped with Next.js 16 (App Router), Tailwind CSS, SQLite, Prisma, and integrated with Google Gemini VLM OCR for intelligent manual invoice scanning.

Custom-tailored for **RKE (Rental Service of Heavy Engineering Equipments)** to manage client accounts, bank payment credits, and professional GST invoice billing statements.

---

## 📸 Interactive UI Walkthroughs & Demo Recordings

Explore the core workflows and aesthetic upgrades of RKE Invoice in action:

### 1. Modern Login & User Authentication
A sleek, premium landing interface with smooth animations, custom floating cards, and responsive state transitions.
* **Seed Credentials**: `agranitinkohli@gmail.com` | `Agra@2009`

<p align="center">
  <img src="public/demo/login_aesthetics.webp" width="85%" alt="Login Aesthetics Demo" style="border-radius: 12px; box-shadow: 0 10px 30px rgba(0,0,0,0.15); border: 1px solid rgba(255,255,255,0.1);" />
</p>

---

### 2. Smart GST Invoice Generator & Print Preview
Easily generate standard tax invoices with dynamic CGST, SGST, IGST calculations, line-item table editor, local signature caching, and instant pixel-perfect print preview.

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

### 4. Intelligent AI Invoice Scanner (Gemini VLM OCR)
Powered by the Google Gemini API. Scan any manual invoice image to automatically parse line items, rates, taxes, and customer details directly into the digital editor in seconds.

<p align="center">
  <img src="public/demo/ocr_invoice_scan.webp" width="85%" alt="Gemini OCR Scan Demo" style="border-radius: 12px; box-shadow: 0 10px 30px rgba(0,0,0,0.15); border: 1px solid rgba(255,255,255,0.1);" />
</p>

---

## ⚡ Core Features

*   🌟 **Stunning Modern Aesthetics**: Curated color palette (emerald/teal gradients), smooth hover states, micro-animations, glassmorphism card templates, and responsive layouts.
*   📊 **Client Ledger Statement**: Chronological debit (invoice) and credit (bank payment receipt) ledger bookkeeping per client with dynamic running balances.
*   🤖 **Intelligent OCR Engine**: Google Gemini API scanning engine with high-accuracy parsing of hardware/rental invoices.
*   🖨️ **Print and Export Utilities**: Instant PDF compiler and export to clean Microsoft Excel spreadsheets (.xlsx).
*   💳 **UPI QR Code Integration**: Automatically generates an embedded payment QR code based on invoice totals and bank account details.
*   🔒 **Multi-User Isolation**: Scopes invoices, settings, and payments securely per authenticated user session.

---

## 🛠️ Technology Stack

*   **Frontend & Routing**: Next.js 16 (App Router, Turbopack, React Server Actions)
*   **Styling**: Tailwind CSS & Lucide Icons
*   **Database ORM**: Prisma Client & SQLite (`prisma/dev.db`)
*   **State Management**: Zustand
*   **UI Components**: Base UI & Custom Tailwind variables
*   **AI Integration**: Google GenAI SDK (Gemini VLM models)

---

## 🚀 Local Setup & Installation

### 1. Prerequisites
Make sure you have Node.js (v18+) and npm installed.

### 2. Environment Variables
Create a `.env` file in the root directory:
```env
# Database connection string
DATABASE_URL="file:./dev.db"

# Google Gemini API Key for OCR Scanning
GEMINI_API_KEY="your-gemini-api-key"
```

### 3. Install Dependencies
```bash
npm install
```

### 4. Database Setup
Run Prisma push to generate the SQLite database and schema models:
```bash
npx prisma db push
```

### 5. Seed the User Account
Seed the initial administrator user profile:
```bash
npx prisma db seed
```

### 6. Run the Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) with your browser.
