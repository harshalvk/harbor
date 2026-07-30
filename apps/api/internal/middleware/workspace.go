package middleware

import (
	"context"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// WorkspaceResolver looks up the internal user record for an authenticated
// request and verifies the requested workspace membership. This is the single
// chokepoint for tenant isolation: every route that reads/writes tenant data
// should sit behind RequireWorkspace, and handlers should ONLY trust the
// workspace id that ends up in the context here — never one read directly
// off the request body or query string.
type WorkspaceResolver struct {
	db *pgxpool.Pool
}

func NewWorkspaceResolver(db *pgxpool.Pool) *WorkspaceResolver {
	return &WorkspaceResolver{db: db}
}

// ResolveUser maps the verified external_auth_id (from the JWT) to our
// internal users.id, and attaches it to context. Split from RequireWorkspace
// because some routes (e.g. "list my workspaces") need the user but not a
// specific workspace yet.
func (wr *WorkspaceResolver) ResolveUser(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		externalAuthID, ok := ExternalAuthIDFromContext(r.Context())
		if !ok {
			http.Error(w, "unauthenticated", http.StatusUnauthorized)
			return
		}

		var userID string
		err := wr.db.QueryRow(r.Context(),
			`SELECT id FROM users WHERE external_auth_id = $1`, externalAuthID,
		).Scan(&userID)
		if err != nil {
			http.Error(w, "user not found", http.StatusUnauthorized)
			return
		}

		ctx := context.WithValue(r.Context(), ctxKeyUserID, userID)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

// RequireWorkspace expects a {workspaceID} URL param, checks that the current
// user is a member of it, and attaches workspace id + role to context.
// Any route needing tenant data should be nested under this middleware.
func (wr *WorkspaceResolver) RequireWorkspace(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		userID, ok := UserIDFromContext(r.Context())
		if !ok {
			http.Error(w, "unauthenticated", http.StatusUnauthorized)
			return
		}

		workspaceID := chi.URLParam(r, "workspaceID")
		if workspaceID == "" {
			http.Error(w, "workspace id required", http.StatusBadRequest)
			return
		}

		var role string
		err := wr.db.QueryRow(r.Context(),
			`SELECT role FROM workspace_members WHERE workspace_id = $1 AND user_id = $2`,
			workspaceID, userID,
		).Scan(&role)
		if err != nil {
			// Deliberately the same error whether the workspace doesn't exist
			// or the user just isn't a member of it - don't leak existence
			// of other tenants' workspaces.
			http.Error(w, "workspace not found", http.StatusNotFound)
			return
		}

		ctx := context.WithValue(r.Context(), ctxKeyWorkspaceID, workspaceID)
		ctx = context.WithValue(ctx, ctxKeyWorkspaceRole, role)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}
