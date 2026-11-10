package api

import (
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"

	"dpms/backend/internal/apperr"
	"dpms/backend/internal/auth"
)

const maxLoggedUsernameLen = 100

type loginRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

// login authenticates Staff and starts a session. Every attempt — success or failure — is written
// to access_logs before the response is sent (Computer Crime Act §26); if that write fails the
// login is refused rather than allowed unlogged.
func (h *handlers) login(c *gin.Context) {
	var req loginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		fail(c, apperr.Validation("body", "invalid_json"))
		return
	}
	username := strings.TrimSpace(req.Username)
	if username == "" {
		fail(c, apperr.Validation("username", "required"))
		return
	}
	if req.Password == "" {
		fail(c, apperr.Validation("password", "required"))
		return
	}

	ctx := c.Request.Context()
	ip := c.ClientIP()
	logged := truncate(username, maxLoggedUsernameLen)

	acct, err := h.Store.StaffByUsername(ctx, username)
	if err != nil {
		fail(c, err)
		return
	}

	// Too many recent failures for this username from this client: refuse before checking the
	// password, so guessing can't continue (QA-02). The refusal is logged like any failed attempt.
	key := loginKey(username, ip)
	if wait := h.logins.retryAfter(key, time.Now()); wait > 0 {
		var staffID *int64
		if acct != nil {
			staffID = &acct.ID
		}
		if err := h.Store.RecordAccess(ctx, staffID, logged, "failed", ip); err != nil {
			fail(c, err)
			return
		}
		secs := int(wait.Seconds()) + 1
		c.Header("Retry-After", strconv.Itoa(secs))
		fail(c, apperr.New(apperr.TooManyLoginAttempts, map[string]any{"retryAfterSeconds": secs}))
		return
	}

	// One error for every failure, and the same work for an unknown username, so the response
	// never reveals which field was wrong.
	if acct == nil {
		auth.BurnPasswordCheck(req.Password)
	}
	if acct == nil || !acct.IsActive || !auth.CheckPassword(acct.PasswordHash, req.Password) {
		var staffID *int64
		if acct != nil {
			staffID = &acct.ID
		}
		if err := h.Store.RecordAccess(ctx, staffID, logged, "failed", ip); err != nil {
			fail(c, err)
			return
		}
		h.logins.fail(key, time.Now())
		fail(c, apperr.New(apperr.InvalidCredentials, nil))
		return
	}
	h.logins.succeed(key)

	if err := h.Store.RecordAccess(ctx, &acct.ID, logged, "success", ip); err != nil {
		fail(c, err)
		return
	}
	if err := h.Store.TouchLastLogin(ctx, acct.ID); err != nil {
		fail(c, err)
		return
	}

	h.setSession(c, acct.ID)
	c.JSON(http.StatusOK, gin.H{"staff": acct.Staff})
}

// logout revokes the session server-side before clearing the cookie, so a copy of the cookie can't
// be used afterwards (QA-01). If the revocation can't be stored, logout fails rather than pretending
// the session is gone. Logging out without a valid session is a no-op.
func (h *handlers) logout(c *gin.Context) {
	if token, err := c.Cookie(sessionCookie); err == nil {
		if sess, ok := h.Signer.Verify(token, time.Now()); ok {
			if err := h.Store.RevokeSession(c.Request.Context(), sess.ID, sess.StaffID, sess.ExpiresAt); err != nil {
				fail(c, err)
				return
			}
		}
	}
	h.clearSession(c)
	c.Status(http.StatusNoContent)
}

func (h *handlers) me(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"staff": currentStaff(c).Staff})
}

func (h *handlers) setSession(c *gin.Context, staffID int64) {
	token := h.Signer.Issue(staffID, time.Now())
	h.writeCookie(c, token, int(h.Signer.TTL().Seconds()))
}

func (h *handlers) clearSession(c *gin.Context) { h.writeCookie(c, "", -1) }

func (h *handlers) writeCookie(c *gin.Context, value string, maxAge int) {
	http.SetCookie(c.Writer, &http.Cookie{
		Name:     sessionCookie,
		Value:    value,
		Path:     "/",
		MaxAge:   maxAge,
		HttpOnly: true, // not readable from JavaScript
		Secure:   h.CookieSecure,
		SameSite: http.SameSiteLaxMode,
	})
}

func truncate(s string, max int) string {
	r := []rune(s)
	if len(r) <= max {
		return s
	}
	return string(r[:max])
}
