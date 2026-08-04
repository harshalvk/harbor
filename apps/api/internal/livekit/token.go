package livekit

import (
	"time"

	auth "github.com/livekit/protocol/auth"
)

type Client struct {
	apiKey    string
	apiSecret string
}

func NewClient(apiKey, apiSecret string) *Client {
	return &Client{apiKey: apiKey, apiSecret: apiSecret}
}

// CreateJoinToken issues a short-lived jwt a browser uses to connect to a
// specific livekit room; identity should be our internal user id (not the
// external auth id) so it's stable and meaningful when we look at livekit's
// webhooks/logs later; roomName should be our internal room id - keeping
// livekit's room concept 1:1 with `rooms` table row
func (c *Client) CreateJoinToken(roomName, identity, displayName string) (string, error) {
	at := auth.NewAccessToken(c.apiKey, c.apiSecret)

	grant := &auth.VideoGrant{
		RoomJoin: true,
		Room:     roomName,
	}

	at.SetVideoGrant(grant).SetIdentity(identity).SetName(displayName).SetValidFor(time.Hour)

	return at.ToJWT()
}
