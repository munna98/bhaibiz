# BhaiBiz

Attendance and commission ledger for labour suppliers.

## Tech Stack

- **Framework**: TanStack Start (React 19)
- **Routing**: TanStack Router
- **State & Data Fetching**: TanStack React Query
- **Styling**: Tailwind CSS v4
- **Database & Auth**: Supabase
- **ORM / Migrations**: Drizzle ORM

## Getting Started

### 1. Prerequisites

- Node.js (v20+ or v22+)
- npm or bun

### 2. Environment Setup

Copy `.env.example` to `.env` and fill in your Supabase project credentials:

```sh
cp .env.example .env
```

Set the following variables:
- `VITE_SUPABASE_URL` and `SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY` and `SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `DATABASE_URL` (for Drizzle migrations)
- `AADHAAR_KEY` (secret key for server-side Aadhaar encryption)

### 3. Installation & Run

```sh
npm install
npm run dev
```

### 4. Build

```sh
npm run build
```
