package middleware

import "context"

type contextKey string

const (
	ctxKeyExternalAuthID contextKey = "external_auth_id"
	ctxKeyUserID         contextKey = "user_id"
	ctxKeyWorkspaceID    contextKey = "workspace_id"
	ctxKeyWorkspaceRole  contextKey = "workspace_role"
)

func ExternalAuthIDFromContext(ctx context.Context) (string, bool) {
	v, ok := ctx.Value(ctxKeyExternalAuthID).(string)
	return v, ok
}

func UserIDFromContext(ctx context.Context) (string, bool) {
	v, ok := ctx.Value(ctxKeyUserID).(string)
	return v, ok
}

// WorkspaceIDFromContext returns the workspace the current request has been
// scoped to. Every handler that touches tenant data MUST read the workspace
// id from here — never from a client-supplied field on the request body —
// because RequireWorkspace has already verified membership before this is set.
func WorkspaceIDFromContext(ctx context.Context) (string, bool) {
	v, ok := ctx.Value(ctxKeyWorkspaceID).(string)
	return v, ok
}

func WorkspaceRoleFromContext(ctx context.Context) (string, bool) {
	v, ok := ctx.Value(ctxKeyWorkspaceRole).(string)
	return v, ok
}
