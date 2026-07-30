package handlers

import (
	"encoding/json"
	"net/http"

	appmw "github.com/harshalvk/harbor/api/internal/middleware"
	"github.com/harshalvk/harbor/api/internal/models"
	"github.com/jackc/pgx/v5/pgxpool"
)

type RoomHandler struct {
	db *pgxpool.Pool
}

func NewRoomHandler(db *pgxpool.Pool) *RoomHandler {
	return &RoomHandler{db: db}
}

// List returns rooms for the workspace already resolved by RequireWorkspace.
// Note: workspaceID comes ONLY from context (verified membership), never
// from a client-supplied field - this is what makes cross-tenant leaks
// structurally hard rather than just "don't forget to filter".
func (h *RoomHandler) List(w http.ResponseWriter, r *http.Request) {
	workspaceID, _ := appmw.WorkspaceIDFromContext(r.Context())

	rows, err := h.db.Query(r.Context(), `
		SELECT id, workspace_id, name, created_by, created_at
		FROM rooms WHERE workspace_id = $1
		ORDER BY created_at DESC
	`, workspaceID)
	if err != nil {
		http.Error(w, "failed to list rooms", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	rooms := []models.Room{}
	for rows.Next() {
		var rm models.Room
		if err := rows.Scan(&rm.ID, &rm.WorkspaceID, &rm.Name, &rm.CreatedBy, &rm.CreatedAt); err != nil {
			http.Error(w, "failed to scan room", http.StatusInternalServerError)
			return
		}
		rooms = append(rooms, rm)
	}

	respondJSON(w, http.StatusOK, rooms)
}

type createRoomRequest struct {
	Name string `json:"name"`
}

func (h *RoomHandler) Create(w http.ResponseWriter, r *http.Request) {
	workspaceID, _ := appmw.WorkspaceIDFromContext(r.Context())
	userID, _ := appmw.UserIDFromContext(r.Context())

	var req createRoomRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Name == "" {
		http.Error(w, "name is required", http.StatusBadRequest)
		return
	}

	var rm models.Room
	err := h.db.QueryRow(r.Context(), `
		INSERT INTO rooms (workspace_id, name, created_by)
		VALUES ($1, $2, $3)
		RETURNING id, workspace_id, name, created_by, created_at
	`, workspaceID, req.Name, userID).Scan(&rm.ID, &rm.WorkspaceID, &rm.Name, &rm.CreatedBy, &rm.CreatedAt)
	if err != nil {
		http.Error(w, "failed to create room", http.StatusInternalServerError)
		return
	}

	respondJSON(w, http.StatusCreated, rm)
}
