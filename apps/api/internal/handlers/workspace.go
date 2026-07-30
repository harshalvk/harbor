package handlers

import (
	"encoding/json"
	"net/http"

	appmw "github.com/harshalvk/harbor/api/internal/middleware"
	"github.com/harshalvk/harbor/api/internal/models"
	"github.com/jackc/pgx/v5/pgxpool"
)

type WorkspaceHandler struct {
	db *pgxpool.Pool
}

func NewWorkspaceHandler(db *pgxpool.Pool) *WorkspaceHandler {
	return &WorkspaceHandler{db: db}
}

// ListMine returns every workspace the current user belongs to.
// Notably this route sits behind ResolveUser but NOT RequireWorkspace,
// since there's no single workspace to scope to yet - the user is asking
// "which workspaces can I access at all".
func (h *WorkspaceHandler) ListMine(w http.ResponseWriter, r *http.Request) {
	userID, _ := appmw.UserIDFromContext(r.Context())

	rows, err := h.db.Query(r.Context(), `
		SELECT w.id, w.name, w.plan_tier, w.created_at
		FROM workspaces w
		JOIN workspace_members wm ON wm.workspace_id = w.id
		WHERE wm.user_id = $1
		ORDER BY w.created_at ASC
	`, userID)
	if err != nil {
		http.Error(w, "failed to list workspaces", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	workspaces := []models.Workspace{}
	for rows.Next() {
		var ws models.Workspace
		if err := rows.Scan(&ws.ID, &ws.Name, &ws.PlanTier, &ws.CreatedAt); err != nil {
			http.Error(w, "failed to scan workspace", http.StatusInternalServerError)
			return
		}
		workspaces = append(workspaces, ws)
	}

	respondJSON(w, http.StatusOK, workspaces)
}

type createWorkspaceRequest struct {
	Name string `json:"name"`
}

// Create makes a new workspace and adds the current user as its owner.
// Used both for the auto-created "personal workspace" on signup and for
// users creating additional workspaces later.
func (h *WorkspaceHandler) Create(w http.ResponseWriter, r *http.Request) {
	userID, _ := appmw.UserIDFromContext(r.Context())

	var req createWorkspaceRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Name == "" {
		http.Error(w, "name is required", http.StatusBadRequest)
		return
	}

	tx, err := h.db.Begin(r.Context())
	if err != nil {
		http.Error(w, "failed to start transaction", http.StatusInternalServerError)
		return
	}
	defer tx.Rollback(r.Context())

	var ws models.Workspace
	err = tx.QueryRow(r.Context(), `
		INSERT INTO workspaces (name, plan_tier) VALUES ($1, 'free')
		RETURNING id, name, plan_tier, created_at
	`, req.Name).Scan(&ws.ID, &ws.Name, &ws.PlanTier, &ws.CreatedAt)
	if err != nil {
		http.Error(w, "failed to create workspace", http.StatusInternalServerError)
		return
	}

	_, err = tx.Exec(r.Context(), `
		INSERT INTO workspace_members (workspace_id, user_id, role) VALUES ($1, $2, 'owner')
	`, ws.ID, userID)
	if err != nil {
		http.Error(w, "failed to add owner", http.StatusInternalServerError)
		return
	}

	if err := tx.Commit(r.Context()); err != nil {
		http.Error(w, "failed to commit", http.StatusInternalServerError)
		return
	}

	respondJSON(w, http.StatusCreated, ws)
}

func respondJSON(w http.ResponseWriter, status int, v interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(v)
}
