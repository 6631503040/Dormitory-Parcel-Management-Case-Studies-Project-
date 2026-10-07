// Package config reads the service configuration from environment variables.
package config

import (
	"errors"
	"fmt"
	"os"
	"strconv"
	"strings"
	"time"
)

type Config struct {
	Env            string // "development" or "production"
	Port           string
	DatabaseURL    string
	DBMaxConns     int32
	MigrationsDir  string
	SessionSecret  []byte
	SessionTTL     time.Duration
	CookieSecure   bool     // set true whenever the app is served over HTTPS
	TrustedProxies []string // reverse proxies allowed to set X-Forwarded-For

	// LINE Messaging API (Epic E3: Check-Parcel status button + OTP-verified linking). Both are
	// optional — an empty LineChannelSecret disables the webhook entirely (LINE_NOT_CONFIGURED)
	// rather than failing startup, since not every deployment (or every dev machine) wires this up.
	LineChannelSecret      string
	LineChannelAccessToken string
}

func Load() (Config, error) {
	c := Config{
		Env:           getenv("APP_ENV", "development"),
		Port:          getenv("PORT", "8080"),
		DatabaseURL:   os.Getenv("DATABASE_URL"),
		MigrationsDir: getenv("MIGRATIONS_DIR", "../db/migrations"),
		SessionSecret: []byte(os.Getenv("SESSION_SECRET")),
		SessionTTL:    8 * time.Hour,
		CookieSecure:  getenv("COOKIE_SECURE", "false") == "true",

		LineChannelSecret:      os.Getenv("LINE_CHANNEL_SECRET"),
		LineChannelAccessToken: os.Getenv("LINE_CHANNEL_ACCESS_TOKEN"),
	}

	if c.DatabaseURL == "" {
		return c, errors.New("DATABASE_URL is required")
	}
	if len(c.SessionSecret) < 32 {
		return c, errors.New("SESSION_SECRET is required and must be at least 32 bytes")
	}
	if c.Env == "production" && !c.CookieSecure {
		return c, errors.New("COOKIE_SECURE=true is required when APP_ENV=production")
	}

	maxConns, err := strconv.ParseInt(getenv("DB_MAX_CONNS", "20"), 10, 32)
	if err != nil || maxConns < 1 {
		return c, fmt.Errorf("DB_MAX_CONNS must be a positive integer")
	}
	c.DBMaxConns = int32(maxConns)

	if hours := os.Getenv("SESSION_TTL_HOURS"); hours != "" {
		h, err := strconv.Atoi(hours)
		if err != nil || h < 1 {
			return c, fmt.Errorf("SESSION_TTL_HOURS must be a positive integer")
		}
		c.SessionTTL = time.Duration(h) * time.Hour
	}

	for _, p := range strings.Split(os.Getenv("TRUSTED_PROXIES"), ",") {
		if p = strings.TrimSpace(p); p != "" {
			c.TrustedProxies = append(c.TrustedProxies, p)
		}
	}
	return c, nil
}

func getenv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
