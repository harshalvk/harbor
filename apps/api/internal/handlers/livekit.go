package handlers

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/harshalvk/harbor/api/internal/config"
	"github.com/jackc/pgx/v5/pgxpool"

	appliveKit "github.com/harshalvk/harbor/api/internal/livekit"
	appmw "github.com/harshalvk/harbor/api/internal/middleware"
)

type LiveKitHandler struct {
	db       *pgxpool.Pool
	lkClient *appliveKit.Client
	lkURL    string
}

func NewLiveKitHandler(db *pgxpool.Pool, cfg config.Config) *LiveKitHandler {
	return &LiveKitHandler{
		db: db,
		lkClient: appliveKit.NewClient(cfg.LiveKitAPIKey, cfg.LiveKitAPISecret),
		lkURL: cfg.LiveKitURL,
	}
}

type joinResponse struct {
	Token string `json:"token"`
	URL string `json:"url"`
}

// Join issues a liveKit token for {roomID}. this sits behind RequireWorkspace,
// so workspaceID is already verfified -but we additionally confirm the room
// itself belongs to that workspace, since roomID is a path param a client
// could otherwise swap out to probe a room in a different workspace
func (h *LiveKitHandler) Join(w http.ResponseWriter, r *http.Request) {
	workspaceID, _ := appmw.WorkspaceIDFromContext(r.Context())
	userID, _ := appmw.UserIDFromContext(r.Context())
	roomID := chi.URLParam(r, "roomID")

	// Confirm the room belongs to this workspace before issuing a token for it
	var roomExists bool
	err := h.db.QueryRow(r.Context(), `
		SELECT EXISTS(SELECT 1 FROM rooms WHERE id = $1 AND workspace_id = $2)	
	`, roomID, workspaceID).Scan(&roomExists)
	if err != nil || !roomExists {
		// same story as workspace membership checks: don't distinguish 
		// "room doesn't exist" from "room belongs to another workspace"
		http.Error(w, "room not found", http.StatusNotFound)
		return
	}

	var displayName string
	if err := h.db.QueryRow(r.Context(), 
		`SELECT name FROM users WHERE id = $1`, userID,
	).Scan(&displayName); err != nil {
		http.Error(w, "user not found", http.StatusInternalServerError)
		return
	}

	token, err := h.lkClient.CreateJoinToken(roomID, userID, displayName)
	if err != nil {
		http.Error(w, "failed to create join token", http.StatusInternalServerError)
		return
	}

	respondJSON(w, http.StatusOK, joinResponse{Token: token, URL: h.lkURL})
}