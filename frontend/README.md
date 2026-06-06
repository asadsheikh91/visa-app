# ParchiVisa — Frontend

Next.js 14 + TypeScript + Tailwind CSS + Clerk auth.

## Setup

```bash
cd frontend
rm -rf node_modules package-lock.json
npm install
```

## Development

```bash
npm run dev        # start dev server on http://localhost:3000
npm run build      # production build
npm run typecheck  # TypeScript check (tsc --noEmit)
npm run lint       # ESLint via Next.js
```

## Testing

```bash
npm test           # run full test suite (jest, no coverage)
npm run test:watch # jest in watch mode
```

All tests live in `__tests__/`. The jest configuration is in `jest.config.js`.
Babel transform config for tests is in `babel.config.test.js`.

## Environment variables

Copy `.env.local.example` to `.env.local` and fill in the required values:

```bash
cp .env.local.example .env.local
```

Required:
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` — Clerk publishable key
- `CLERK_SECRET_KEY` — Clerk secret key
- `NEXT_PUBLIC_API_URL` — backend API base URL
