# harbor

Turborepo monorepo, all TypeScript. Stack: Next.js 16, Prisma, better-auth,
a self-built mediasoup SFU, shadcn/ui, Tailwind, Zod.

Local dev infra (Postgres + MinIO object storage) runs via `docker-compose`
at the repo root — see `docker-compose.yml`. Production storage can point
at MinIO, R2, or any other S3-compatible provider with no code changes,
since `apps/web/src/lib/storage.ts` is written against the plain S3 API.

## Layout

```
apps/
  web/      Next.js 16 — UI, Route Handlers, better-auth, local recording upload
  media/    Node + mediasoup — our own SFU + signaling WebSocket server
  worker/   Node service — background jobs (ffmpeg merge/transcode, transcription)
packages/
  db/       Prisma schema + generated client, shared by web and worker
  shared/   Shared Zod schemas/types (e.g. background job payload shapes)
```

`apps/worker` is separate from `apps/web` on purpose: ffmpeg needs a real,
long-running process, which doesn't fit inside Vercel's serverless functions.
Keeping it as its own deployable means `apps/web` can stay on Vercel while
`apps/worker` runs somewhere like Railway/Fly.io with no execution time limit.

## Setup

```
docker-compose up -d        # local Postgres + MinIO
pnpm install
pnpm db:generate             # generates the Prisma client from packages/db/schema.prisma
cd packages/db && pnpm db:migrate:dev   # applies the schema to local Postgres
```

## Common commands (run from repo root)

```
pnpm dev          # runs `dev` in every app in parallel (turbo)
pnpm build        # builds every app (Prisma client generated first, see turbo.json)
pnpm lint         # lints every app
pnpm typecheck    # typechecks every app
```

To run a command for just one app: `pnpm --filter web dev` or `turbo run dev --filter=web`.

## Why Turborepo here specifically

- Single repo, single PR history across frontend/backend/worker — useful for
  a buildinpublic project where you want one clean commit log to point people to
- `packages/db` and `packages/shared` give web and worker a single shared
  source of truth for DB schema and job payload types — no duplicated type
  definitions to keep in sync by hand
- Caching matters less right now (small project) but will matter once CI
  builds all three packages on every push
