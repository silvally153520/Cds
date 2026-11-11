# Sieuechxanh

Sieuechxanh is a full-stack accommodation booking platform built with React + TypeScript + Tailwind on the frontend and Express + Prisma + PostgreSQL on the backend. It supports three roles: User, Host, and Admin, and includes real booking, management, authorization, and admin approval flows.

## Features

- Responsive landing page and room listing with real API data
- Authentication and session handling for registration/login
- Role-based access control for User, Host, and Admin
- Host registration and approval flow
- Property and room management by host
- Booking creation, history, and cancellation
- Instant Booking with transactional inventory checks and immediate confirmation
- Host check-in/check-out, room inventory, and new-booking notifications
- Host property wizard, multiple room types, image URLs, availability calendar, and date-specific prices
- Admin property approval and rejection with host notifications
- Admin booking filters and revenue monitoring
- Booking and payment states are tracked independently; free customer cancellation is available until 48 hours before check-in
- Accommodation categories: HOTEL, RESORT, VILLA, HOMESTAY, APARTMENT, and MOTEL
- Admin dashboard for account and host application management
- Prisma schema ready for PostgreSQL/Supabase deployment

## Tech stack

- Frontend: React 19, Vite, TypeScript, Tailwind CSS, React Router, React Query
- Backend: Express 5, TypeScript, Prisma ORM, PostgreSQL, JWT, bcrypt
- Database: PostgreSQL compatible with Supabase

## Local development

1. Install root dependencies:

```bash
npm install
```

2. Configure environment variables:

```bash
cd apps/server
cp .env.example .env
```

Create the frontend env file as well:

```bash
cd apps/client
cp .env.example .env
```

Update the values with your local Supabase credentials. Keep this file local; it is ignored by Git. Example:

```bash
# apps/server/.env
PORT=5001
JWT_SECRET=replace-with-a-long-random-secret
JWT_REFRESH_SECRET=replace-with-a-different-long-random-secret
JWT_EXPIRES_IN=7d
JWT_REFRESH_EXPIRES_IN=30d
DATABASE_URL="postgresql://postgres.your-project-ref:your_password@aws-0-region.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1"
DIRECT_URL="postgresql://postgres.your-project-ref:your_password@aws-0-region.pooler.supabase.com:5432/postgres"
FRONTEND_URL="http://localhost:5173"
CORS_ORIGINS="http://localhost:5173,https://your-frontend-domain.example.com"
```

```bash
# apps/client/.env
VITE_API_URL=http://localhost:5001/api
# Optional image uploads (Cloudinary unsigned upload preset)
VITE_CLOUDINARY_CLOUD_NAME=
VITE_CLOUDINARY_UPLOAD_PRESET=
```

For image uploads, configure a restricted unsigned Cloudinary upload preset and use its cloud name and preset name above. If these values are omitted, hosts can still add images by URL. Never put Cloudinary API secrets in frontend environment variables.

3. Generate Prisma Client and apply the checked-in migrations:

```bash
cd apps/server
npx prisma generate
npx prisma migrate deploy
```

The host property-management migration only adds nullable columns, defaulted room fields, and new availability/pricing tables. Review the migration and confirm the target database before applying it. It does not reset or delete existing data. Do not run `migrate reset`.

`npm run seed` is for demo content only. Do not run it against a production database.

4. Start backend and frontend in separate terminals:

```bash
cd apps/server
npm run dev
```

```bash
cd apps/client
npm run dev -- --host 0.0.0.0
```

Then open:
- Frontend: http://localhost:5173
- API health: http://localhost:5001/api/health

The browser frontend uses `VITE_API_URL` from `apps/client/.env`; in development it defaults to `http://localhost:5001/api`. The API runs locally on port 5001 and reads `apps/server/.env` via `dotenv/config`. Confirm that `/api/health` returns `{"ok":true,"database":"connected",...}` before registering an account.

### AI booking assistant (local development)

The floating booking assistant is a separate Cloudflare Worker in `apps/ai-worker`. It uses the Workers AI binding and the `@cf/meta/llama-3.3-70b-instruct-fp8-fast` model with read-only, allow-listed tools. Room searches use the existing public `/api/rooms`, `/api/properties`, and booking-availability APIs; personal bookings are fetched through `/api/bookings/my` with the signed-in user's existing JWT. The Worker does not connect to PostgreSQL directly and never creates, updates, or cancels bookings. Chat history stays in the current browser session and is not stored in the database.

Install the workspace dependencies, then sign in to a Cloudflare account that has Workers AI enabled:

```bash
npm install
npx wrangler login
```

Run the API, AI Worker, and client in separate terminals:

```bash
npm run dev:server
npm run dev:ai
npm run dev:client
```

The Vite development server proxies `/api/ai/*` to the Worker on port `8787`; the Worker calls the backend at `http://localhost:5001/api`. Its `/api/ai/health` endpoint checks the backend health. Workers AI inference requires a Cloudflare account/session and may incur Workers AI usage charges. If the account is not authorized, chat returns a visible error instead of falling back to fabricated or mock answers.

For a different local Worker URL, set `AI_WORKER_DEV_URL` for the Vite proxy. To point the browser directly to a Worker URL, set `VITE_AI_API_URL` in `apps/client/.env` (for example `https://sieuechxanh-ai.<account-subdomain>.workers.dev/api/ai`) and add the frontend origin to the Worker `ALLOWED_ORIGINS`.

### Prepare the AI Worker for Cloudflare

No Worker is deployed by the development or build commands. Before a future production deployment:

1. In `apps/ai-worker/wrangler.jsonc`, replace the production `API_BASE_URL` and `ALLOWED_ORIGINS` example values with the public backend API and frontend origins. The API URL is a non-secret setting; do not put JWT or database credentials in Worker vars.
2. Change the rate-limit `namespace_id` to a positive integer unique within your Cloudflare account.
3. Configure `VITE_AI_API_URL` for the frontend build to use the Worker URL ending in `/api/ai`, or configure a Cloudflare route for `/api/ai/*` on the frontend hostname and keep the frontend value as `/api/ai`.
4. Configure the Worker route/origin and Workers AI binding in Cloudflare, then run `npm --workspace ai-worker run build` to inspect the bundle. Deployment, custom routes, and database migrations are intentionally not run by this project setup.

The Worker uses the native `env.AI` binding, `wrangler.jsonc`, and a Cloudflare rate-limit binding, so it can be deployed independently of the Express/Prisma API. Only the backend needs database connectivity. No chatbot tables or Prisma migration are required.

### Local Supabase troubleshooting

- Copy the connection strings from Supabase **Connect**. Use the transaction pooler (usually port `6543` with `pgbouncer=true`) for `DATABASE_URL`; use a direct/session connection for `DIRECT_URL` and migrations.
- If a database password contains reserved URL characters (such as `@`, `:`, `/`, `?`, or `#`), URL-encode the password component before putting it into the connection string.
- Run `npx prisma generate` after changing the schema or installing dependencies. Use the normal command, not `--no-engine`; then restart the local backend so it loads the generated query engine.
- `npx prisma migrate status` checks migration state. Use `npx prisma migrate deploy` for an empty database with the checked-in migrations. Never run `migrate reset` for a database containing data.
- The registration endpoint is `POST /api/auth/register`; it validates input, checks for an existing email, hashes the password, and inserts a `USER` record. A valid registration creates persistent user data.

## Production deployment

### Backend on Render

1. Create a new Web Service on Render.
2. Set the root of the project to the repository root.
3. Use the build command:

```bash
npm install && npm run build:server
```

4. Use the start command:

```bash
npm run start --workspace server
```

The server build emits `apps/server/dist/index.js`, which is the entry point used by the workspace start script.

5. Add environment variables in Render:

```bash
NODE_ENV=production
PORT=10000
JWT_SECRET=replace-with-a-long-random-secret
JWT_REFRESH_SECRET=replace-with-a-different-long-random-secret
JWT_EXPIRES_IN=7d
JWT_REFRESH_EXPIRES_IN=30d
DATABASE_URL=postgresql://postgres:your_password@db.your-project-ref.supabase.co:5432/postgres?pgbouncer=true&connection_limit=1
DIRECT_URL=postgresql://postgres:your_password@db.your-project-ref.supabase.co:5432/postgres
FRONTEND_URL=https://your-frontend-domain.example.com
CORS_ORIGINS=https://your-frontend-domain.example.com
```

6. In Render, ensure the service has a PostgreSQL connection available via Supabase and the Prisma migrations are executed before production traffic is enabled.

### Frontend on Cloudflare Pages

1. Connect the repository to Cloudflare Pages.
2. Set the build command to:

```bash
npm install && npm run build:client
```

3. Set the output directory to `apps/client/dist`.
4. Add environment variable:

```bash
VITE_API_URL=https://sieuech-api.onrender.com/api
```

5. Set the same value in Cloudflare Pages **Settings → Environment variables** for Production, then redeploy. The frontend API client uses this base URL for authentication, rooms, properties, bookings, host and admin endpoints.

Run the backend database migration as a one-off command before routing production traffic:

```bash
npm --workspace server run prisma:migrate:deploy
```

Set `DATABASE_URL` and `DIRECT_URL` in the Render environment for this command. Do not run the demo seed script against a production database.

For an existing Supabase database with the previous Sieuechxanh tables but no Prisma migration history, do not reset it. First take a database backup and verify that its schema matches `20261108120000_initial_schema`. Then baseline that already-present schema and apply the booking migration:

```bash
cd apps/server
npx prisma migrate resolve --applied 20261108120000_initial_schema
npx prisma migrate deploy
```

Only mark the initial migration as applied if those tables and columns already exist. For a new empty database, run `npx prisma migrate deploy` directly; it creates the schema and upgrades it without a baseline step.

## Build, lint, and test

Run the project checks from the repo root:

```bash
npm run build
npm run lint
npm run test
```

Notes:
- `npm run test` is available as a workspace passthrough and will execute tests only when a package defines them.
- There are no custom Jest/Vitest test files in the current project yet, so the command exits cleanly when no tests are present.

## Supabase / PostgreSQL deployment

Use the same Prisma datasource configuration with your Supabase connection string:

```bash
DATABASE_URL="postgresql://postgres:[YOUR_PASSWORD]@db.[PROJECT_REF].supabase.co:5432/postgres?pgbouncer=true&connection_limit=1"
DIRECT_URL="postgresql://postgres:[YOUR_PASSWORD]@db.[PROJECT_REF].supabase.co:5432/postgres"
```

For a new empty database, run:

```bash
cd apps/server
npx prisma generate
npx prisma migrate deploy
```

For a database that already contains the previous app schema, follow the safe baseline procedure in [Production deployment](#production-deployment) instead. Never use `migrate reset` against production.

The `20261108140000_property_categories` migration only adds `APARTMENT` and `MOTEL` to the PostgreSQL `PropertyType` enum. It preserves all existing properties and categories.

The `20261108210600_add_user_avatar_url` migration adds a nullable avatar URL to `User` without changing existing accounts. Run `prisma migrate deploy` before using profile avatar updates.

If you are using a hosted Supabase database, ensure the Prisma datasource is compatible with the PostgreSQL version and keep the `DIRECT_URL` value set for direct Prisma operations such as migrations.

## Project structure

- `apps/client` - Vite + React + Tailwind frontend
- `apps/server` - Express + Prisma backend
- `apps/server/prisma/schema.prisma` - PostgreSQL/Supabase database schema
- `apps/server/prisma/seed.ts` - seed data for demo accounts and sample listings

## Default account roles

The seed script creates basic demo users. Update the seed file if you need custom credentials for staging or production.
