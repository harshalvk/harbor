package config

import (
	"os"
)

// Config holds all environment-derived settings for the service.
// Keeping this as a single struct (rather than scattering os.Getenv calls
// throughout handlers) makes it obvious what the service depends on,
// and makes testing with fake config trivial later.
type Config struct {
	Port             string
	Env              string
	DatabaseURL      string
	ClerkJWKSURL     string
	WebOrigin        string
	LiveKitURL       string
	LiveKitAPIKey    string
	LiveKitAPISecret string
}

func Load() Config {
	return Config{
		Port:             getEnv("PORT", "8080"),
		Env:              getEnv("ENV", "development"),
		DatabaseURL:      getEnv("DATABASE_URL", ""),
		ClerkJWKSURL:     getEnv("CLERK_JWKS_URL", ""),
		WebOrigin:        getEnv("WEB_ORIGIN", "http://localhost:3000"),
		LiveKitURL:       getEnv("LIVEKIT_URL", ""),
		LiveKitAPIKey:    getEnv("LIVEKIT_API_KEY", ""),
		LiveKitAPISecret: getEnv("LIVEKIT_API_SECRET", ""),
	}
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
