# LandShield Frontend

Bilingual (Bangla & English) web application for independent cryptographic verification of land deeds and proactive fraud detection in Bangladesh.

## Tech Stack
- **Framework:** Next.js (App Router, React 19, TypeScript)
- **Styling:** Tailwind CSS v4
- **Typography:** `Noto_Sans_Bengali` & `Inter` via `next/font/google`
- **Internationalization:** Custom lightweight zero-dependency i18n (`src/lib/i18n.tsx`) supporting Bangla (`bn`) and English (`en`)
- **API Client:** Typed Fetch wrapper (`src/lib/api.ts`) connecting to FastAPI backend

## Getting Started

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure environment:**
   Copy `.env.example` to `.env.local`:
   ```bash
   cp .env.example .env.local
   ```
   Ensure `NEXT_PUBLIC_API_URL` points to your backend (default: `http://localhost:8000/api/v1`).

3. **Run local dev server:**
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) in your browser.

4. **Build production bundle:**
   ```bash
   npm run build
   ```

## Key Modules
- `src/lib/api.ts`: Typed backend API client with bearer token management and domain error handling.
- `src/lib/types.ts`: TypeScript contracts matching backend models and schemas.
- `src/lib/i18n.tsx`: Context provider and translation helper persisted in `localStorage`.
- `src/locales/`: Dictionary catalogs (`bn.json` and `en.json`).
- `src/components/`: Reusable components (`StatusBadge`, `Card`, `Spinner`, `ErrorBox`, `Header`, `Footer`).
