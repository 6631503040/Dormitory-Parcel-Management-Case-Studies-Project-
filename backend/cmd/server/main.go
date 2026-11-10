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
	"dpms/backend/internal/notify"
	"dpms/backend/internal/push"
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

	st := store.New(pool)
	st.PushBatchWindow = cfg.PushBatchWindow

	// Web Push is optional: without VAPID keys the resident routes report PUSH_NOT_CONFIGURED and
	// Check-In simply never finds a subscription to notify.
	var pushPublicKey string
	if cfg.VAPIDPrivateKey != "" {
		keys, err := push.ParseKeys(cfg.VAPIDPublicKey, cfg.VAPIDPrivateKey)
		if err != nil {
			log.Fatalf("web push: %v", err)
		}
		pushPublicKey = keys.PublicB64
		worker := &notify.Worker{Store: st, Sender: push.NewSender(keys, cfg.VAPIDSubject), Interval: cfg.PushPollInterval}
		go worker.Run(ctx)
		log.Printf("web push enabled (batch window %s)", cfg.PushBatchWindow)
	}

	srv := &http.Server{
		Addr: ":" + cfg.Port,
		Handler: api.NewRouter(api.Deps{
			Store:          st,
			Signer:         auth.NewSigner(cfg.SessionSecret, cfg.SessionTTL),
			CookieSecure:   cfg.CookieSecure,
			TrustedProxies: cfg.TrustedProxies,
			Location:       loc,
			Ping:           pool.Ping,

			PushPublicKey: pushPublicKey,
			WebDir:        cfg.WebDir,
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
