# VOGPK — Vision of Gamers

Initial storefront foundation. Frontend: Next.js 16 (App Router), React, JavaScript/JSX, Tailwind CSS 4, Inter via next/font, and Lucide icons. Backend: NestJS 12 with its standard TypeScript module setup.

VOGPK is a Pakistan-focused PC hardware and gaming e-commerce project. This monorepo keeps the storefront and REST API as separate applications, each with its own package manifest and lockfile. The backend runs on Node.js. PostgreSQL and Prisma are planned; neither is installed or configured yet.

## Repository structure

```text
vog-pk/
├── frontend/     # Next.js storefront: public/, src/, package.json
├── backend/      # NestJS REST API: src/, test/, package.json
├── .gitignore
└── README.md
```

Git is managed at the repository root. Install dependencies within each application; no workspace orchestration is required.

## Requirements

Node.js 24.15+ (verified with 24.20.0) and npm.

Git is required to clone and contribute to the repository.

## Run locally

Open two terminals from this directory:

```powershell
cd frontend
npm ci
npm run dev
```

Frontend: http://localhost:3000

```powershell
cd backend
npm ci
npm run start:dev
```

Backend: http://localhost:4000/api/health → {"status":"ok"}. CORS allows http://localhost:3000.

## Environment setup

Neither application currently requires environment variables. The backend port and local frontend CORS origin are configured in `backend/src/main.ts`. No `.env.example` files are needed at this stage. When environment configuration is introduced, add placeholder-only `.env.example` files and keep real `.env` files local; Git excludes environment files while allowing `.env.example`.

## Planned deployment architecture

Deploy the applications independently from the same GitHub repository:

| Application | Hosting | Root directory | Future domain |
| --- | --- | --- | --- |
| Frontend | Vercel (planned) | `frontend` | `vogpk.com` |
| Backend | To be selected | `backend` | `api.vogpk.com` |

The frontend uses Next.js; the backend runs as a separate NestJS service. These domains and production deployments are not configured. Production API connectivity and CORS configuration will be addressed when deployment is implemented.

## Checks and production

Frontend: `npm run lint`, `npm run build`, then `npm start`.
Backend: `npm run lint`, `npm test`, `npm run test:e2e`, `npm run build`, then `npm run start:prod`.

## Structure and customization

- `frontend/src/app/globals.css`: central palette, typography, spacing, container, border, radius, and shadow tokens; Tailwind is available alongside semantic CSS classes.
- `frontend/src/app/layout.jsx`: shared navbar, main landmark, skip link, and footer.
- `frontend/src/components/layout/`: reusable branding and responsive navigation/footer.
- `frontend/src/config/navigation.js`: navigation, categories, future URLs, and footer links.
- `frontend/src/config/site.js`: site identity and contact/social placeholders. Replace null values with real details when available. Social brand marks are inline SVGs; UI icons use Lucide.
- `frontend/public/images/`, `frontend/src/components/ui/`, `frontend/src/lib/`: reserved for future assets and shared code.
- `backend/src/`: root module, health controller, and bootstrap with `/api` prefix and port 4000.

The homepage deliberately contains only a welcome placeholder. Search is a visual input, and account, wishlist, and cart buttons are marked as coming soon. The cart badge uses a dash until real data exists. Future product, support, policy, and account pages are not implemented; their links use the intended URL structure and currently reach Next.js's 404 page. No database, commerce API, authentication, checkout, or newsletter is included.

Desktop dropdowns use native details controls (Enter/Space, Tab, Escape). The mobile navigation uses a modal dialog with native focus containment, Escape/close handling, focus return, expandable categories, and background scroll locking. It closes when resizing to desktop.

## Verification

Completed on 24 October 2026:

- Frontend and backend dependency installation, lint, and production builds passed.
- Backend unit and HTTP integration tests passed.
- Running production backend returned HTTP 200 with `{"status":"ok"}` at `/api/health`; the local frontend CORS origin was confirmed.
- Running frontend checked in headless Microsoft Edge at 320, 375, 768, 1024, and 1440px: homepage renders, footer stacks, no horizontal overflow, mobile categories expand, Escape closes menus, focus returns, and scroll locking releases.
- Desktop dropdowns verified with Enter, Tab, and Escape; no browser runtime errors.
- Both npm dependency audits reported zero vulnerabilities.

Future-route links intentionally resolve to 404 until the corresponding development phase.
- Additional interaction checks passed: repeated Tab focus containment inside the drawer, close on desktop resize, Home link dismissal, and mobile search focus. Explicit Tab wrapping supplements the native dialog behavior.
