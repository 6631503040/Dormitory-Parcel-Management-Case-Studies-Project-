// Command server runs the Dormitory Parcel Management System API.
package main

import (
	"context"
	"errors"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"
	_ "time/tzdata" // Asia/Bangkok must resolve even in a minimal container image

	"github.com/gin-gonic/gin"

	"dpms/backend/internal/api"
	"dpms/backend/internal/auth"
	"dpms/backend/internal/config"
	"dpms/backend/internal/db"
	"dpms/backend/internal/store"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("config: %v", err)
	}
	if cfg.Env == "production" {
		gin.SetMode(gin.ReleaseMode)
	}

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	pool, err := db.Connect(ctx, cfg.DatabaseURL, cfg.DBMaxConns)
	if err != nil {
		log.Fatalf("database: %v", err)
	}
	defer pool.Close()

	if err := db.Migrate(ctx, pool, cfg.MigrationsDir); err != nil {
		log.Fatalf("migrate: %v", err)
	}

	loc, err := time.LoadLocation("Asia/Bangkok")
	if err != nil {
		log.Fatalf("timezone: %v", err)
	}

	srv := &http.Server{
		Addr: ":" + cfg.Port,
		Handler: api.NewRouter(api.Deps{
			Store:          store.New(pool),
			Signer:         auth.NewSigner(cfg.SessionSecret, cfg.SessionTTL),
			CookieSecure:   cfg.CookieSecure,
			TrustedProxies: cfg.TrustedProxies,
			Location:       loc,
			Ping:           pool.Ping,

			LineChannelSecret:      cfg.LineChannelSecret,
			LineChannelAccessToken: cfg.LineChannelAccessToken,
		}),
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       15 * time.Second,
		WriteTimeout:      30 * time.Second,
		IdleTimeout:       60 * time.Second,
	}

	go func() {
		<-ctx.Done()
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		_ = srv.Shutdown(shutdownCtx)
	}()

	log.Printf("listening on :%s (env=%s)", cfg.Port, cfg.Env)
	if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
		log.Fatalf("server: %v", err)
	}
}
