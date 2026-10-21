// Package api is the HTTP layer: routing, sessions, RBAC and JSON (camelCase) request/response shapes.
package api

import (
	"context"
	"fmt"
	"log"
	"mime"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/gin-gonic/gin/binding"

	"dpms/backend/internal/apperr"
	"dpms/backend/internal/auth"
	"dpms/backend/internal/store"
)

const (
	sessionCookie  = "dpms_session"
	staffKey       = "staff"
	requestTimeout = 10 * time.Second
	maxBodyBytes   = 1 << 20

	roleOperator = "operator"
	roleAdmin    = "admin"
)

type Deps struct {
	Store          *store.Store
	Signer         auth.Signer
	CookieSecure   bool
	TrustedProxies []string
	Location       *time.Location // dormitory local time (Asia/Bangkok): Dashboard day boundaries
	Ping           func(context.Context) error

	// LINE Messaging API (Epic E3). Empty LineChannelSecret disables the webhook. LineReplyEndpoint
	// is a test-only seam — leave empty in production to use the real LINE API.
	LineChannelSecret      string
	LineChannelAccessToken string
	LineReplyEndpoint      string
}

type handlers struct{ Deps }

func NewRouter(d Deps) *gin.Engine {
	binding.EnableDecoderDisallowUnknownFields = true

	r := gin.New()
	// Behind a reverse proxy the real client IP (for access_logs) comes from X-Forwarded-For; trust
	// only the proxies listed in TRUSTED_PROXIES, and none by default.
	if err := r.SetTrustedProxies(d.TrustedProxies); err != nil {
		log.Printf("invalid TRUSTED_PROXIES: %v", err)
	}
	r.Use(gin.Recovery(), requestLogger(), securityHeaders(), requestLimits(), requireJSONBody())
	r.NoRoute(func(c *gin.Context) { fail(c, apperr.New(apperr.NotFound, nil)) })

	h := &handlers{d}

	r.GET("/healthz", h.health)

	v1 := r.Group("/api/v1")
	v1.POST("/auth/login", h.login)
	v1.POST("/auth/logout", h.logout)

	// Called by LINE's servers, not a browser session — verified via X-Line-Signature, not a cookie.
	v1.POST("/line/webhook", h.lineWebhook)

	authed := v1.Group("", h.requireAuth())
	authed.GET("/auth/me", h.me)

	authed.GET("/rooms/search", h.searchRooms)
	authed.GET("/directory", h.listDirectory)

	authed.POST("/parcels", h.checkIn)
	authed.GET("/parcels", h.listParcels)
	authed.POST("/parcels/check-out", h.checkOut)
	authed.GET("/parcels/:trackingCode", h.getParcel)
	authed.PATCH("/parcels/:trackingCode/room", h.assignRoom)
	authed.POST("/rooms/:roomId/check-out-all", h.checkOutAll)
	authed.GET("/rooms/:roomId/line-otp", h.lineOTPForRoom)

	authed.GET("/dashboard", h.dashboard)

	// RBAC is enforced here, at the API layer — hiding a button in the UI is not access control.
	admin := authed.Group("/admin", requireRole(roleAdmin))
	admin.GET("/access-logs", h.listAccessLogs)

	return r
}

// --- middleware --------------------------------------------------------------------------------

// requestLogger logs method, path, status and latency. It deliberately omits the query string:
// searches carry resident names (personal data) and must not end up in server logs.
func requestLogger() gin.HandlerFunc {
	return gin.LoggerWithConfig(gin.LoggerConfig{
		Formatter: func(p gin.LogFormatterParams) string {
			return fmt.Sprintf("%s %-6s %s %d %s\n", p.TimeStamp.Format(time.RFC3339), p.Method, p.Path, p.StatusCode, p.Latency)
		},
	})
}

func securityHeaders() gin.HandlerFunc {
	return func(c *gin.Context) {
		h := c.Writer.Header()
		h.Set("X-Content-Type-Options", "nosniff")
		h.Set("Cache-Control", "no-store")
		c.Next()
	}
}

func requestLimits() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, maxBodyBytes)
		ctx, cancel := context.WithTimeout(c.Request.Context(), requestTimeout)
		defer cancel()
		c.Request = c.Request.WithContext(ctx)
		c.Next()
	}
}

// requireJSONBody rejects state-changing requests whose body isn't application/json. Together with
// the SameSite=Lax session cookie this closes off cross-site form posts (CSRF).
func requireJSONBody() gin.HandlerFunc {
	return func(c *gin.Context) {
		switch c.Request.Method {
		case http.MethodPost, http.MethodPut, http.MethodPatch, http.MethodDelete:
			if c.Request.ContentLength != 0 {
				mt, _, err := mime.ParseMediaType(c.GetHeader("Content-Type"))
				if err != nil || mt != "application/json" {
					fail(c, apperr.New(apperr.UnsupportedMediaType, nil))
					return
				}
			}
		}
		c.Next()
	}
}

func (h *handlers) requireAuth() gin.HandlerFunc {
	return func(c *gin.Context) {
		token, err := c.Cookie(sessionCookie)
		if err != nil {
			fail(c, apperr.New(apperr.Unauthenticated, nil))
			return
		}
		id, ok := h.Signer.Verify(token, time.Now())
		if !ok {
			h.clearSession(c)
			fail(c, apperr.New(apperr.Unauthenticated, nil))
			return
		}
		// Role and active status are re-read on every request, so disabling an account or changing
		// its role takes effect immediately, not when the token expires.
		acct, err := h.Store.StaffByID(c.Request.Context(), id)
		if err != nil {
			fail(c, err)
			return
		}
		if acct == nil || !acct.IsActive {
			h.clearSession(c)
			fail(c, apperr.New(apperr.Unauthenticated, nil))
			return
		}
		c.Set(staffKey, acct)
		c.Next()
	}
}

func requireRole(roles ...string) gin.HandlerFunc {
	return func(c *gin.Context) {
		acct := currentStaff(c)
		for _, r := range roles {
			if acct.Role == r {
				c.Next()
				return
			}
		}
		fail(c, apperr.New(apperr.Forbidden, nil))
	}
}

func currentStaff(c *gin.Context) *store.StaffAccount {
	v, _ := c.Get(staffKey)
	acct, _ := v.(*store.StaffAccount)
	return acct
}

// --- helpers -----------------------------------------------------------------------------------

// fail renders an error as {code, params}. Unexpected errors are logged server-side and reach the
// client only as INTERNAL_ERROR — never SQL text, stack traces or internal details.
func fail(c *gin.Context, err error) {
	if ae, ok := apperr.As(err); ok {
		c.AbortWithStatusJSON(apperr.HTTPStatus(ae.Code), ae)
		return
	}
	log.Printf("internal error: %s %s: %v", c.Request.Method, c.FullPath(), err)
	c.AbortWithStatusJSON(http.StatusInternalServerError, apperr.New(apperr.Internal, nil))
}

func (h *handlers) health(c *gin.Context) {
	if h.Ping != nil {
		if err := h.Ping(c.Request.Context()); err != nil {
			c.JSON(http.StatusServiceUnavailable, gin.H{"status": "unavailable"})
			return
		}
	}
	c.JSON(http.StatusOK, gin.H{"status": "ok"})
}
