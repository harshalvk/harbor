package main

import (
	"context"
	"log/slog"
	"net/http"
	"os"

	"github.com/go-chi/chi/v5"
	chimw "github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"

	"github.com/harshalvk/harbor/api/internal/config"
	"github.com/harshalvk/harbor/api/internal/db"
	"github.com/harshalvk/harbor/api/internal/handlers"
	appmw "github.com/harshalvk/harbor/api/internal/middleware"
)

func main() {
	cfg := config.Load()
	ctx := context.Background()

	pool, err := db.NewPool(ctx, cfg.DatabaseURL)
	if err != nil {
		slog.Error("failed to connect to database", "error", err)
		os.Exit(1)
	}
	defer pool.Close()

	authMW, err := appmw.NewAuthMiddleware(cfg.ClerkJWKSURL)
	if err != nil {
		slog.Error("failed to init auth middleware", "error", err)
		os.Exit(1)
	}
	workspaceResolver := appmw.NewWorkspaceResolver(pool)

	workspaceHandler := handlers.NewWorkspaceHandler(pool)
	roomHandler := handlers.NewRoomHandler(pool)
	liveKitHandler := handlers.NewLiveKitHandler(pool, cfg)

	r := chi.NewRouter()
	r.Use(chimw.Logger)
	r.Use(chimw.Recoverer)
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   []string{cfg.WebOrigin},
		AllowedMethods:   []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Authorization", "Content-Type"},
		AllowCredentials: true,
	}))

	r.Get("/healthz", handlers.Health)

	r.Route("/api", func(r chi.Router) {
		r.Use(authMW.Authenticate)
		r.Use(workspaceResolver.ResolveUser)

		// Not workspace-scoped yet - listing/creating workspaces themselves.
		r.Get("/workspaces", workspaceHandler.ListMine)
		r.Post("/workspaces", workspaceHandler.Create)

		// Everything under here requires membership in {workspaceID}.
		r.Route("/workspaces/{workspaceID}", func(r chi.Router) {
			r.Use(workspaceResolver.RequireWorkspace)

			r.Get("/rooms", roomHandler.List)
			r.Post("/rooms", roomHandler.Create)
			r.Post("/rooms/{roomID}/join", liveKitHandler.Join)
		})
	})

	slog.Info("server starting", "port", cfg.Port, "env", cfg.Env)
	if err := http.ListenAndServe(":"+cfg.Port, r); err != nil {
		slog.Error("server failed", "error", err)
		os.Exit(1)
	}
}
