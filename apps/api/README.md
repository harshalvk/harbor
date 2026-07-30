# API (Go)

Multi-tenant backend for the Riverside clone. Every tenant-scoped table carries
a `workspace_id`, and access to it is only ever granted through the
`RequireWorkspace` middleware, which verifies the authenticated user is a
member of the workspace before any handler runs.

## Setup

1. Copy `.env.example` to `.env` and fill in `DATABASE_URL` and `CLERK_JWKS_URL`
   (found in your Clerk instance settings — looks like
   `https://<your-instance>.clerk.accounts.dev/.well-known/jwks.json`).

2. Install the golang-migrate CLI (used for schema migrations):
   https://github.com/golang-migrate/migrate/tree/master/cmd/migrate

3. Fetch dependencies:
   ```
   make tidy
   ```

4. Run migrations against your Postgres instance:
   ```
   export DATABASE_URL=postgres://...
   make migrate-up
   ```

5. Run the server:
   ```
   make run
   ```

6. Confirm it's alive:
   ```
   curl http://localhost:8080/healthz
   ```

## Request flow (how a request gets scoped to a tenant)

```
Request → Authenticate (verifies JWT via Clerk JWKS, sets external_auth_id)
        → ResolveUser (maps external_auth_id → internal users.id)
        → RequireWorkspace (checks workspace_members, sets workspace_id + role)
        → handler (reads workspace_id ONLY from context, never from client input)
```

This is deliberate: the workspace id a handler trusts is always the one
verified by `RequireWorkspace`, never one read off a request body or query
param directly. That's what makes cross-tenant data leaks structurally hard
to introduce by accident as more endpoints get added.

## Endpoints so far

| Method | Path | Scoped to workspace? | Description |
|---|---|---|---|
| GET | `/healthz` | no | Liveness check |
| GET | `/api/workspaces` | no (lists all of the user's) | List workspaces the current user belongs to |
| POST | `/api/workspaces` | no | Create a new workspace, current user becomes owner |
| GET | `/api/workspaces/{workspaceID}/rooms` | yes | List rooms in a workspace |
| POST | `/api/workspaces/{workspaceID}/rooms` | yes | Create a room in a workspace |

## Next up (Phase 1)

LiveKit integration for the live call layer — room join tokens will be issued
from a new handler here once that's underway.
