package api

import (
	"net/http"
	"regexp"
	"strings"

	"github.com/gin-gonic/gin"

	"dpms/backend/internal/apperr"
	"dpms/backend/internal/push"
	"dpms/backend/internal/store"
)

// Web Push for Residents (Epic E3, 2026-10-21 revision): US-23 notification on Check-In, US-24
// desk-OTP device registration, US-25 PWA status view. Resident routes are public (a Resident has
// no Staff account) and authenticate with a per-device bearer token instead of the session cookie.

// PushConsentVersion names the exact consent text the PWA shows before a code is issued
// (src/resident/consent.js in the frontend). Bump both together whenever the wording changes.
const PushConsentVersion = "push-v1"

const residentDeviceKey = "residentDevice"

// otpPattern is the shape of the 6-digit code Staff read out at the desk.
var otpPattern = regexp.MustCompile(`^\d{6}$`)

type pushSubscriptionBody struct {
	Endpoint string `json:"endpoint"`
	Keys     struct {
		P256dh string `json:"p256dh"`
		Auth   string `json:"auth"`
	} `json:"keys"`
	// PushSubscription.toJSON() also emits this; accepted and ignored.
	ExpirationTime *float64 `json:"expirationTime"`
}

func (h *handlers) pushEnabled(c *gin.Context) bool {
	if h.PushPublicKey == "" {
		fail(c, apperr.New(apperr.PushNotConfigured, nil))
		return false
	}
	return true
}

func (h *handlers) validSubscription(b *pushSubscriptionBody) (store.PushSubscriptionInput, *apperr.Error) {
	sub := push.Subscription{Endpoint: strings.TrimSpace(b.Endpoint), P256dh: b.Keys.P256dh, Auth: b.Keys.Auth}
	if len(sub.Endpoint) > 2048 || len(sub.P256dh) > 200 || len(sub.Auth) > 100 {
		return store.PushSubscriptionInput{}, apperr.Validation("subscription", "too_long")
	}
	if err := sub.Validate(); err != nil {
		return store.PushSubscriptionInput{}, apperr.Validation("subscription."+err.Error(), "invalid")
	}
	allowed := h.PushEndpointAllowed
	if allowed == nil {
		allowed = push.DefaultEndpointAllowed
	}
	if !allowed(sub.Endpoint) {
		return store.PushSubscriptionInput{}, apperr.Validation("subscription.endpoint", "not_allowed")
	}
	return store.PushSubscriptionInput{Endpoint: sub.Endpoint, P256dh: sub.P256dh, Auth: sub.Auth}, nil
}

// GET /resident/push/config — what the PWA needs before it can subscribe.
func (h *handlers) residentPushConfig(c *gin.Context) {
	if !h.pushEnabled(c) {
		return
	}
	c.JSON(http.StatusOK, gin.H{"vapidPublicKey": h.PushPublicKey, "consentVersion": PushConsentVersion})
}

// POST /resident/otp — step 1: the Resident claims a room. The response deliberately has no code.
func (h *handlers) residentClaimRoom(c *gin.Context) {
	if !h.pushEnabled(c) {
		return
	}
	var body struct {
		RoomNumber      string `json:"roomNumber"`
		ConsentVersion  string `json:"consentVersion"`
		ConsentAccepted bool   `json:"consentAccepted"`
	}
	if err := bindBody(c, &body); err != nil {
		fail(c, err)
		return
	}
	if !body.ConsentAccepted || body.ConsentVersion != PushConsentVersion {
		fail(c, apperr.Validation("consentAccepted", "required"))
		return
	}
	raw := strings.TrimSpace(body.RoomNumber)
	if raw == "" || len(raw) > 16 {
		fail(c, apperr.Validation("roomNumber", "required"))
		return
	}
	room, err := h.Store.ResolveRoomExact(c.Request.Context(), raw)
	if err != nil {
		fail(c, err)
		return
	}
	claim, err := h.Store.CreateResidentOTP(c.Request.Context(), room, body.ConsentVersion)
	if err != nil {
		fail(c, err)
		return
	}
	c.JSON(http.StatusCreated, claim)
}

// POST /resident/otp/verify — step 4: the code Staff read out + this browser's PushSubscription.
func (h *handlers) residentVerifyOTP(c *gin.Context) {
	if !h.pushEnabled(c) {
		return
	}
	var body struct {
		ClaimToken   string               `json:"claimToken"`
		Code         string               `json:"code"`
		Subscription pushSubscriptionBody `json:"subscription"`
	}
	if err := bindBody(c, &body); err != nil {
		fail(c, err)
		return
	}
	if body.ClaimToken == "" || len(body.ClaimToken) > 100 {
		fail(c, apperr.Validation("claimToken", "required"))
		return
	}
	code := strings.TrimSpace(body.Code)
	if !otpPattern.MatchString(code) {
		fail(c, apperr.Validation("code", "format"))
		return
	}
	sub, verr := h.validSubscription(&body.Subscription)
	if verr != nil {
		fail(c, verr)
		return
	}
	reg, err := h.Store.VerifyResidentOTP(c.Request.Context(), body.ClaimToken, code, sub)
	if err != nil {
		fail(c, err)
		return
	}
	c.JSON(http.StatusCreated, reg)
}

// requireResidentDevice authenticates the PWA by its bearer token. Bearer tokens in a header
// (never a cookie) can't be sent by a cross-site form, so these routes need no CSRF handling.
func (h *handlers) requireResidentDevice() gin.HandlerFunc {
	return func(c *gin.Context) {
		token, ok := strings.CutPrefix(c.GetHeader("Authorization"), "Bearer ")
		token = strings.TrimSpace(token)
		if !ok || token == "" || len(token) > 100 {
			fail(c, apperr.New(apperr.Unauthenticated, nil))
			return
		}
		d, err := h.Store.ResidentDeviceByToken(c.Request.Context(), token)
		if err != nil {
			fail(c, err)
			return
		}
		if d == nil {
			fail(c, apperr.New(apperr.Unauthenticated, nil))
			return
		}
		c.Set(residentDeviceKey, d)
		c.Next()
	}
}

func currentDevice(c *gin.Context) *store.ResidentDevice {
	v, _ := c.Get(residentDeviceKey)
	d, _ := v.(*store.ResidentDevice)
	return d
}

// GET /resident/me — US-25: the room's Pending Parcels, same minimal data as US-10.
func (h *handlers) residentStatus(c *gin.Context) {
	st, err := h.Store.ResidentParcelStatus(c.Request.Context(), currentDevice(c))
	if err != nil {
		fail(c, err)
		return
	}
	c.JSON(http.StatusOK, st)
}

// PUT /resident/push/subscription — the browser rotated its subscription; keep delivering.
func (h *handlers) residentUpdateSubscription(c *gin.Context) {
	var body pushSubscriptionBody
	if err := bindBody(c, &body); err != nil {
		fail(c, err)
		return
	}
	sub, verr := h.validSubscription(&body)
	if verr != nil {
		fail(c, verr)
		return
	}
	if err := h.Store.UpdatePushEndpoint(c.Request.Context(), currentDevice(c).SubscriptionID, sub); err != nil {
		fail(c, err)
		return
	}
	c.Status(http.StatusNoContent)
}

// DELETE /resident/push/subscription — the Resident turns notifications off (withdraws consent).
func (h *handlers) residentUnsubscribe(c *gin.Context) {
	if err := h.Store.Unsubscribe(c.Request.Context(), currentDevice(c).SubscriptionID, "resident"); err != nil {
		fail(c, err)
		return
	}
	c.Status(http.StatusNoContent)
}

// --- Staff side --------------------------------------------------------------------------------

// GET /rooms/:roomId/resident-otp — step 3: the code to read out loud at the desk.
func (h *handlers) residentOTPForRoom(c *gin.Context) {
	roomID, perr := parseID(c.Param("roomId"), "roomId")
	if perr != nil {
		fail(c, perr)
		return
	}
	v, err := h.Store.PendingResidentOTP(c.Request.Context(), currentStaff(c).ID, roomID)
	if err != nil {
		fail(c, err)
		return
	}
	if v == nil {
		fail(c, apperr.New(apperr.NoPendingResidentOTP, map[string]any{"roomId": roomID}))
		return
	}
	c.JSON(http.StatusOK, v)
}

// GET /rooms/:roomId/push-subscriptions — how many devices get this room's notifications.
func (h *handlers) roomPushSubscriptions(c *gin.Context) {
	roomID, perr := parseID(c.Param("roomId"), "roomId")
	if perr != nil {
		fail(c, perr)
		return
	}
	n, err := h.Store.RoomPushSubscriptionCount(c.Request.Context(), roomID)
	if err != nil {
		fail(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"activeCount": n})
}

// DELETE /rooms/:roomId/push-subscriptions — Staff stop every device of a room (move-out, request).
func (h *handlers) revokeRoomPushSubscriptions(c *gin.Context) {
	roomID, perr := parseID(c.Param("roomId"), "roomId")
	if perr != nil {
		fail(c, perr)
		return
	}
	n, err := h.Store.RevokeRoomPushSubscriptions(c.Request.Context(), currentStaff(c).ID, roomID)
	if err != nil {
		fail(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"revokedCount": n})
}
