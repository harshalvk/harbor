# harbor

Turborepo monorepo. Polyglot on purpose — `apps/api` is Go, `apps/web` will be
Next.js. Turbo doesn't care what language a workspace is written in; it just
needs a `package.json` with matching script names (`dev`, `build`, `lint`,
`typecheck`) per app so it can orchestrate them together and cache results.

## Layout

```
apps/
  api/      Go backend (multi-tenant API, see apps/api/README.md)
  web/      Next.js frontend (not yet scaffolded)
packages/   Shared code between apps (e.g. shared TS types) - empty for now
```

## Setup

```
pnpm install
```

Note: `apps/api` has its own Go dependency management (`go.mod`) — `pnpm install`
only handles the JS/TS side. Run `make tidy` inside `apps/api` separately for Go deps.

## Common commands (run from repo root)

```
pnpm dev         # runs `dev` in every app in parallel (turbo)
pnpm build       # builds every app
pnpm lint        # lints every app
```

Turbo will run these per-app in parallel and cache results where possible.
To run a command for just one app: `pnpm --filter api dev` or `turbo run dev --filter=api`.

## Why Turborepo here specifically

- Single repo, single PR history across frontend/backend — useful for a
  buildinpublic project where you want one clean commit log to point people to
- Shared `packages/` folder gives you a place for TypeScript types shared
  between the Next.js app and any future TS tooling, without duplicating them
- Caching matters less right now (small project) but will matter once CI
  builds both apps on every push
