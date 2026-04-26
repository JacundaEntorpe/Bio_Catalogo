# BioCatalog

BioCatalog is a Next.js and Prisma application for cataloging living organisms. The MVP focuses on private user-owned entries, a hierarchical classification tree, editable entry records, and a reading-oriented entry detail view.

## Stack

- Next.js App Router
- PostgreSQL
- Prisma ORM
- NextAuth credentials authentication
- Local image storage under `public/uploads`

## Quick start

1. Copy `.env.example` to `.env` and adjust `DATABASE_URL`, `NEXTAUTH_URL`, and `NEXTAUTH_SECRET`.
2. Install dependencies with `npm install`.
3. Create the database schema with `npx prisma migrate dev --name init`.
4. Seed the demo data with `npm run prisma:seed`.
5. Start the app with `npm run dev`.

## Demo login

- Email: `naturalist@biocatalog.local`
- Password: `biocatalog-demo`

## Project structure

- `app/`: UI pages and API routes
- `components/`: reusable UI components and forms
- `lib/`: Prisma, auth, validation, tree, and storage helpers
- `prisma/`: schema and seed script
- `public/uploads/`: local image storage

## Notes

- Category ownership is nullable so future shared taxonomy nodes can coexist with user-defined branches.
- Image storage is isolated behind a single helper to simplify a later cloud migration.
- Observation records are included in the schema and API responses, but the MVP UI only appends simple notes during entry editing.