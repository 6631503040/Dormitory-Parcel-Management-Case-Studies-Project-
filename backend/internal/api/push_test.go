package api_test

// Integration tests for Web Push (US-23 notification on Check-In, US-24 desk-OTP registration,
// US-25 PWA status view). Need TEST_DATABASE_URL like the rest. The browser push service is a local
// httptest server that decrypts every message with the fake browser's private key, so the tests
// see exactly what a Resident's service worker would.

import (
	"bytes"
	"context"
	"crypto/ecdh"
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strconv"
	"sync"
	"testing"

	"dpms/backend/internal/api"
	"dpms/backend/internal/apperr"
	"dpms/backend/internal/notify"
	"dpms/backend/internal/push"
	"dpms/backend/internal/store"
)

// fakePushService stands in for FCM/Mozilla/Apple push.
type fakePushService struct {
	srv    *httptest.Server
	uaKey  *ecdh.PrivateKey
	auth   []byte
	mu     sync.Mutex
	got    []notify.Payload
	status int // what to answer; 201 by default
}

func newFakePushService(t *testing.T) *fakePushService {
	f := &fakePushService{status: http.StatusCreated, auth: make([]byte, 16)}
	f.uaKey, _ = ecdh.P256().GenerateKey(rand.Reader)
	_, _ = rand.Read(f.auth)
	f.srv = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		body, _ := io.ReadAll(r.Body)
		f.mu.Lock()
		defer f.mu.Unlock()
		if f.status == http.StatusCreated {
			plain, err := push.Decrypt(body, f.uaKey, f.auth)
			if err != nil {
				t.Errorf("fake push: decrypt: %v", err)
			}
			var p notify.Payload
			if err := json.Unmarshal(plain, &p); err != nil {
				t.Errorf("fake push: payload %q: %v", plain, err)
			}
			f.got = append(f.got, p)
		}
		w.WriteHeader(f.status)
	}))
	t.Cleanup(f.srv.Close)
	return f
}

func (f *fakePushService) setStatus(s int) { f.mu.Lock(); f.status = s; f.mu.Unlock() }

func (f *fakePushService) messages() []notify.Payload {
	f.mu.Lock()
	defer f.mu.Unlock()
	return append([]notify.Payload(nil), f.got...)
}

func (f *fakePushService) subscription(path string) map[string]any {
	enc := base64.RawURLEncoding
	return map[string]any{
		"endpoint":       f.srv.URL + path,
		"expirationTime": nil,
		"keys": map[string]string{
			"p256dh": enc.EncodeToString(f.uaKey.PublicKey().Bytes()),
			"auth":   enc.EncodeToString(f.auth),
		},
	}
}

type pushEnv struct {
	*env
	fake   *fakePushService
	worker *notify.Worker
}

func newPushEnv(t *testing.T) *pushEnv {
	pub, priv, err := push.GenerateKeys()
	if err != nil {
		t.Fatal(err)
	}
	keys, _ := push.ParseKeys(pub, priv)
	e := newEnvWithDeps(t, func(d *api.Deps) {
		d.PushPublicKey = pub
		d.PushEndpointAllowed = func(string) bool { return true } // the fake lives on 127.0.0.1
		d.Store.PushBatchWindow = 0                               // deliverable immediately
	})
	st := store.New(e.pool)
	return &pushEnv{env: e, fake: newFakePushService(t), worker: &notify.Worker{Store: st, Sender: push.NewSender(keys, "mailto:desk@example.com")}}
}

func (e *pushEnv) runWorker() int {
	e.t.Helper()
	n, err := e.worker.RunOnce(context.Background())
	if err != nil {
		e.t.Fatalf("worker: %v", err)
	}
	return n
}

// bearer sends a request authenticated as a registered PWA device.
func (e *env) bearer(method, path, token string, body any) response {
	e.t.Helper()
	var rd io.Reader
	if body != nil {
		b, _ := json.Marshal(body)
		rd = bytes.NewReader(b)
	}
	req, _ := http.NewRequest(method, e.srv.URL+path, rd)
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		e.t.Fatal(err)
	}
	defer resp.Body.Close()
	b, _ := io.ReadAll(resp.Body)
	return response{Status: resp.StatusCode, Body: b}
}

func claimBody(room string) map[string]any {
	return map[string]any{"roomNumber": room, "consentVersion": api.PushConsentVersion, "consentAccepted": true}
}

// register runs the whole US-24 flow for room ("1101") and returns the device token.
func (e *pushEnv) register(room string, roomID int64, endpointPath string) string {
	e.t.Helper()
	resident := e.anon()
	r := resident.post("/api/v1/resident/otp", claimBody(room))
	if r.Status != http.StatusCreated {
		e.t.Fatalf("claim: %d %s", r.Status, r.Body)
	}
	var claim map[string]any
	r.decode(e.t, &claim)
	if _, leaked := claim["code"]; leaked {
		e.t.Fatalf("claim response must not contain the code: %s", r.Body)
	}

	r = e.login("op1").get("/api/v1/rooms/" + strconv.FormatInt(roomID, 10) + "/resident-otp")
	if r.Status != 200 {
		e.t.Fatalf("staff otp: %d %s", r.Status, r.Body)
	}
	var otp store.ResidentOTPView
	r.decode(e.t, &otp)

	r = resident.post("/api/v1/resident/otp/verify", map[string]any{
		"claimToken": claim["claimToken"], "code": otp.Code, "subscription": e.fake.subscription(endpointPath),
	})
	if r.Status != http.StatusCreated {
		e.t.Fatalf("verify: %d %s", r.Status, r.Body)
	}
	var reg store.ResidentRegistration
	r.decode(e.t, &reg)
	if reg.DeviceToken == "" || reg.Device.BuildingCode+reg.Device.RoomNumber != room {
		e.t.Fatalf("registration: %s", r.Body)
	}
	return reg.DeviceToken
}

func TestPush_RegisterNotifyAndStatus(t *testing.T) {
	e := newPushEnv(t)
	token := e.register("1101", e.roomB1101, "/sub/a")

	// LR-05: who issued the code, and which consent text, is on the registration.
	if n := e.queryInt(`SELECT count(*) FROM push_subscriptions ps JOIN staff s ON s.id = ps.issued_by_staff_id
		WHERE s.username = 'op1' AND ps.consent_version = $1 AND ps.room_id = $2`, api.PushConsentVersion, e.roomB1101); n != 1 {
		t.Fatalf("subscription audit fields missing")
	}

	op := e.login("op2")
	op.checkIn("TH-PUSH-1", e.roomB1101)
	op.checkIn("TH-PUSH-2", e.roomB1101)
	op.checkIn("TH-OTHER", e.roomB1102) // other room, nobody subscribed: no outbox row
	if n := e.queryInt(`SELECT count(*) FROM push_notifications`); n != 1 {
		t.Fatalf("outbox rows = %d, want 1 merged batch", n)
	}

	if n := e.runWorker(); n != 1 {
		t.Fatalf("worker handled %d", n)
	}
	msgs := e.fake.messages()
	if len(msgs) != 1 || msgs[0] != (notify.Payload{Type: "parcel_arrived", Room: "1101", NewCount: 2, PendingCount: 2, URL: "/resident/"}) {
		t.Fatalf("payloads = %+v", msgs)
	}
	if e.runWorker() != 0 {
		t.Fatal("sent twice")
	}

	r := e.bearer(http.MethodGet, "/api/v1/resident/me", token, nil)
	if r.Status != 200 {
		t.Fatalf("me: %d %s", r.Status, r.Body)
	}
	var st store.ResidentParcelStatus
	r.decode(t, &st)
	if st.PendingCount != 2 || len(st.Pending) != 2 || st.Device.RoomNumber != "101" {
		t.Fatalf("status = %s", r.Body)
	}

	// Next Parcel after delivery opens a new batch, reporting the new total.
	op.checkIn("TH-PUSH-3", e.roomB1101)
	e.runWorker()
	if msgs = e.fake.messages(); len(msgs) != 2 || msgs[1].NewCount != 1 || msgs[1].PendingCount != 3 {
		t.Fatalf("second payload = %+v", msgs)
	}
}

func TestPush_PickedUpBeforeDeliveryIsCancelled(t *testing.T) {
	e := newPushEnv(t)
	e.register("1101", e.roomB1101, "/sub/a")
	op := e.login("op1")
	op.checkIn("TH-FAST", e.roomB1101)
	if r := op.post("/api/v1/rooms/"+strconv.FormatInt(e.roomB1101, 10)+"/check-out-all", nil); r.Status != 200 {
		t.Fatalf("check-out-all: %d %s", r.Status, r.Body)
	}
	e.runWorker()
	if len(e.fake.messages()) != 0 {
		t.Fatal("notified about a Parcel that was already Picked Up")
	}
	if n := e.queryInt(`SELECT count(*) FROM push_notifications WHERE status = 'cancelled'`); n != 1 {
		t.Fatalf("cancelled = %d", n)
	}
}

// A Parcel moved to another room by an edit (US-26) notifies the new room; the old room's queued
// notification no longer counts it, so it is cancelled instead of announcing someone else's Parcel.
func TestPush_EditedRoomNotifiesNewRoomOnly(t *testing.T) {
	e := newPushEnv(t)
	e.register("1101", e.roomB1101, "/sub/old")
	e.register("1102", e.roomB1102, "/sub/new")
	op := e.login("op1")
	op.checkIn("TH-MOVE", e.roomB1101)
	if r := op.patch("/api/v1/parcels/TH-MOVE", map[string]any{"roomId": e.roomB1102}); r.Status != 200 {
		t.Fatalf("edit: %d %s", r.Status, r.Body)
	}
	e.runWorker()
	msgs := e.fake.messages()
	if len(msgs) != 1 || msgs[0].Room != "1102" || msgs[0].NewCount != 1 {
		t.Fatalf("payloads = %+v", msgs)
	}
	if n := e.queryInt(`SELECT count(*) FROM push_notifications WHERE status = 'cancelled' AND room_id = $1`, e.roomB1101); n != 1 {
		t.Fatalf("old room's notification not cancelled")
	}
}

func TestPush_OTPMustBeReadByStaffAndLocksOut(t *testing.T) {
	e := newPushEnv(t)
	resident := e.anon()
	r := resident.post("/api/v1/resident/otp", claimBody("1101"))
	var claim map[string]any
	r.decode(t, &claim)

	// The right code, but no Staff member has looked it up: that can only be a guess.
	var real string
	if err := e.pool.QueryRow(context.Background(), `SELECT code FROM resident_otp_challenges`).Scan(&real); err != nil {
		t.Fatal(err)
	}
	verify := func(c string) response {
		return resident.post("/api/v1/resident/otp/verify", map[string]any{"claimToken": claim["claimToken"], "code": c, "subscription": e.fake.subscription("/s")})
	}
	if got := wantCode(t, verify(real), 422, apperr.OTPInvalid); got.Params["attemptsLeft"] != float64(4) {
		t.Fatalf("params = %v", got.Params)
	}
	wrong := "000000"
	if real == wrong {
		wrong = "111111"
	}
	for i := 0; i < 3; i++ {
		wantCode(t, verify(wrong), 422, apperr.OTPInvalid)
	}
	wantCode(t, verify(wrong), 410, apperr.OTPExpired) // 5th wrong attempt burns it
	wantCode(t, verify(real), 410, apperr.OTPExpired)
	if n := e.queryInt(`SELECT count(*) FROM push_subscriptions`); n != 0 {
		t.Fatal("registered on a burnt challenge")
	}
}

func TestPush_ClaimValidationAndRateLimit(t *testing.T) {
	e := newPushEnv(t)
	c := e.anon()
	wantCode(t, c.post("/api/v1/resident/otp", map[string]any{"roomNumber": "1101", "consentVersion": api.PushConsentVersion, "consentAccepted": false}), 400, apperr.ValidationError)
	wantCode(t, c.post("/api/v1/resident/otp", claimBody("9999")), 422, apperr.RoomNotInDirectory)
	wantCode(t, c.post("/api/v1/resident/otp", claimBody("101")), 422, apperr.AmbiguousRoom) // 101 exists in two buildings
	// LIKE wildcards are plain text, not patterns: they can't be used to probe which rooms exist.
	wantCode(t, c.post("/api/v1/resident/otp", claimBody("210_")), 422, apperr.RoomNotInDirectory)
	wantCode(t, c.post("/api/v1/resident/otp", claimBody("%")), 422, apperr.RoomNotInDirectory)
	for i := 0; i < 3; i++ {
		if r := c.post("/api/v1/resident/otp", claimBody("1101")); r.Status != 201 {
			t.Fatalf("claim %d: %d", i, r.Status)
		}
	}
	wantCode(t, c.post("/api/v1/resident/otp", claimBody("1101")), 429, apperr.TooManyOTPRequests)
	wantCode(t, e.login("op1").get("/api/v1/rooms/"+strconv.FormatInt(e.roomB1102, 10)+"/resident-otp"), 404, apperr.NoPendingResidentOTP)
	wantCode(t, c.get("/api/v1/rooms/"+strconv.FormatInt(e.roomB1101, 10)+"/resident-otp"), 401, apperr.Unauthenticated)
}

func TestPush_GoneSubscriptionIsDropped(t *testing.T) {
	e := newPushEnv(t)
	token := e.register("1101", e.roomB1101, "/sub/a")
	e.fake.setStatus(http.StatusGone)
	e.login("op1").checkIn("TH-GONE", e.roomB1101)
	e.runWorker()
	if n := e.queryInt(`SELECT count(*) FROM push_subscriptions WHERE unsubscribed_reason = 'gone'`); n != 1 {
		t.Fatal("gone subscription still active")
	}
	wantCode(t, e.bearer(http.MethodGet, "/api/v1/resident/me", token, nil), 401, apperr.Unauthenticated)
}

func TestPush_ServerErrorIsRetriedLater(t *testing.T) {
	e := newPushEnv(t)
	e.register("1101", e.roomB1101, "/sub/a")
	e.fake.setStatus(http.StatusServiceUnavailable)
	e.login("op1").checkIn("TH-RETRY", e.roomB1101)
	e.runWorker()
	if n := e.queryInt(`SELECT count(*) FROM push_notifications WHERE status = 'queued' AND attempts = 1 AND next_attempt_at > now() AND last_http_status = 503`); n != 1 {
		t.Fatal("not rescheduled for retry")
	}
	if e.runWorker() != 0 {
		t.Fatal("retried before its backoff")
	}
	e.exec(`UPDATE push_notifications SET next_attempt_at = now() - interval '1 second'`)
	e.fake.setStatus(http.StatusCreated)
	e.runWorker()
	if len(e.fake.messages()) != 1 {
		t.Fatal("retry not delivered")
	}
}

func TestPush_UnsubscribeAndStaffRevoke(t *testing.T) {
	e := newPushEnv(t)
	tokenA := e.register("1101", e.roomB1101, "/sub/a")
	tokenB := e.register("1101", e.roomB1101, "/sub/b")

	if r := e.bearer(http.MethodDelete, "/api/v1/resident/push/subscription", tokenA, nil); r.Status != 204 {
		t.Fatalf("unsubscribe: %d %s", r.Status, r.Body)
	}
	wantCode(t, e.bearer(http.MethodGet, "/api/v1/resident/me", tokenA, nil), 401, apperr.Unauthenticated)

	staff := e.login("op1")
	path := "/api/v1/rooms/" + strconv.FormatInt(e.roomB1101, 10) + "/push-subscriptions"
	var count struct{ ActiveCount int64 }
	staff.get(path).decode(t, &count)
	if count.ActiveCount != 1 {
		t.Fatalf("active = %d", count.ActiveCount)
	}
	if r := staff.send(http.MethodDelete, path, nil); r.Status != 200 {
		t.Fatalf("revoke: %d %s", r.Status, r.Body)
	}
	wantCode(t, e.bearer(http.MethodGet, "/api/v1/resident/me", tokenB, nil), 401, apperr.Unauthenticated)
	e.login("op2").checkIn("TH-AFTER", e.roomB1101)
	if n := e.queryInt(`SELECT count(*) FROM push_notifications`); n != 0 {
		t.Fatal("queued for revoked devices")
	}
}

func TestPush_ReRegisteringSameBrowserReplacesOldRow(t *testing.T) {
	e := newPushEnv(t)
	old := e.register("1101", e.roomB1101, "/sub/same")
	e.register("1101", e.roomB1101, "/sub/same")
	wantCode(t, e.bearer(http.MethodGet, "/api/v1/resident/me", old, nil), 401, apperr.Unauthenticated)
	if n := e.queryInt(`SELECT count(*) FROM push_subscriptions WHERE unsubscribed_at IS NULL`); n != 1 {
		t.Fatalf("active = %d", n)
	}
}

func TestPush_UpdateSubscription(t *testing.T) {
	e := newPushEnv(t)
	token := e.register("1101", e.roomB1101, "/sub/old")
	if r := e.bearer(http.MethodPut, "/api/v1/resident/push/subscription", token, e.fake.subscription("/sub/new")); r.Status != 204 {
		t.Fatalf("update: %d %s", r.Status, r.Body)
	}
	if n := e.queryInt(`SELECT count(*) FROM push_subscriptions WHERE endpoint LIKE '%/sub/new'`); n != 1 {
		t.Fatal("endpoint not updated")
	}
}

func TestPush_DefaultAllowlistAndNotConfigured(t *testing.T) {
	// Real allowlist: a 127.0.0.1 endpoint (SSRF attempt) is refused before anything is stored.
	pub, _, _ := push.GenerateKeys()
	e := newEnvWithDeps(t, func(d *api.Deps) { d.PushPublicKey = pub })
	fake := newFakePushService(t)
	c := e.anon()
	var claim map[string]any
	c.post("/api/v1/resident/otp", claimBody("1101")).decode(t, &claim)
	got := wantCode(t, c.post("/api/v1/resident/otp/verify", map[string]any{"claimToken": claim["claimToken"], "code": "123456", "subscription": fake.subscription("/x")}), 400, apperr.ValidationError)
	if got.Params["field"] != "subscription.endpoint" {
		t.Fatalf("params = %v", got.Params)
	}

	off := newEnv(t)
	wantCode(t, off.anon().get("/api/v1/resident/push/config"), 503, apperr.PushNotConfigured)
	wantCode(t, off.anon().post("/api/v1/resident/otp", claimBody("1101")), 503, apperr.PushNotConfigured)
}
