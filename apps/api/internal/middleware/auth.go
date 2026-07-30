package middleware

import (
	"context"
	"log/slog"
	"net/http"
	"strings"

	"github.com/MicahParks/keyfunc/v3"
	"github.com/golang-jwt/jwt/v5"
)

// AuthMiddleware verifies the bearer JWT issued by the auth provider (Clerk)
// against its published JWKS, and attaches the verified external auth id to
// the request context. It does NOT resolve a workspace — that's a separate
// step (RequireWorkspace) because a user can belong to multiple workspaces
// and which one applies depends on the request (e.g. a path param).
type AuthMiddleware struct {
	jwks keyfunc.Keyfunc
}

func NewAuthMiddleware(jwksURL string) (*AuthMiddleware, error) {
	k, err := keyfunc.NewDefaultCtx(context.Background(), []string{jwksURL})
	if err != nil {
		return nil, err
	}
	return &AuthMiddleware{jwks: k}, nil
}

func (a *AuthMiddleware) Authenticate(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		authHeader := r.Header.Get("Authorization")
		tokenStr := strings.TrimPrefix(authHeader, "Bearer ")
		if tokenStr == "" || tokenStr == authHeader {
			http.Error(w, "missing or malformed Authorization header", http.StatusUnauthorized)
			return
		}

		token, err := jwt.Parse(tokenStr, a.jwks.Keyfunc)
		if err != nil || !token.Valid {
			slog.Warn("jwt verification failed", "error", err)
			http.Error(w, "invalid token", http.StatusUnauthorized)
			return
		}

		claims, ok := token.Claims.(jwt.MapClaims)
		if !ok {
			http.Error(w, "invalid token claims", http.StatusUnauthorized)
			return
		}

		// "sub" is the standard JWT subject claim - Clerk sets this to the user id.
		externalAuthID, ok := claims["sub"].(string)
		if !ok || externalAuthID == "" {
			http.Error(w, "token missing subject", http.StatusUnauthorized)
			return
		}

		ctx := context.WithValue(r.Context(), ctxKeyExternalAuthID, externalAuthID)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}
