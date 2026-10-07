package api_test

// Integration tests for the LINE Check-Parcel status button (US-08) and OTP-verified linking
// (US-11). Like api_test.go, these need TEST_DATABASE_URL and are skipped without it. LINE's own
// servers are stood in for by a local httptest server: the webhook's outbound reply calls are
// redirected to it via Deps.LineReplyEndpoint, so no real network call to api.line.me happens.

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"regexp"
	"strconv"
	"strings"
	"sync"
	"testing"
	"time"

	"dpms/backend/internal/api"
)

const lineTestSecret = "test-line-channel-secret"

var sixDigitCode = regexp.MustCompile(`\b\d{6}\b`)

// lineFakeLine stands in for LINE's servers: it records every reply the backend sends so tests
// can assert on the message text, without an outbound call ever leaving the test process.
type lineFakeLine struct {
	srv *httptest.Server
	mu  sync.Mutex
	msgs []string // flattened message text, in send order
}

func newLineFakeLine(t *testing.T) *lineFakeLine {
	f := &lineFakeLine{}
	f.srv = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var body struct {
			Messages []struct {
				Text    string `json:"text"`
				AltText string `json:"altText"`
			} `json:"messages"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			t.Errorf("fake LINE: decode reply body: %v", err)
			w.WriteHeader(http.StatusBadRequest)
			return
		}
		f.mu.Lock()
		for _, m := range body.Messages {
			// A Flex message has no "text" field — altText carries the equivalent summary (and is
			// what LINE itself shows in push notifications / non-Flex clients), so tests can still
			// assert on message content regardless of which message type was sent.
			if m.Text != "" {
				f.msgs = append(f.msgs, m.Text)
			} else {
				f.msgs = append(f.msgs, m.AltText)
			}
		}
		f.mu.Unlock()
		w.WriteHeader(http.StatusOK)
	}))
	t.Cleanup(f.srv.Close)
	return f
}

func (f *lineFakeLine) last() string {
	f.mu.Lock()
	defer f.mu.Unlock()
	if len(f.msgs) == 0 {
		return ""
	}
	return f.msgs[len(f.msgs)-1]
}

func (f *lineFakeLine) count() int {
	f.mu.Lock()
	defer f.mu.Unlock()
	return len(f.msgs)
}

// waitCount blocks until at least want messages have arrived. The webhook handler processes
// events in a background goroutine (deliberately decoupled from the request, see line_handlers.go)
// so a reply can land a few milliseconds after the HTTP response — tests poll for it instead of
// asserting on it immediately.
func (f *lineFakeLine) waitCount(t *testing.T, want int, timeout time.Duration) {
	t.Helper()
	deadline := time.Now().Add(timeout)
	for {
		if f.count() >= want {
			return
		}
		if time.Now().After(deadline) {
			t.Fatalf("timed out after %s waiting for %d reply message(s), got %d", timeout, want, f.count())
		}
		time.Sleep(10 * time.Millisecond)
	}
}

func newLineEnv(t *testing.T) (*env, *lineFakeLine) {
	fake := newLineFakeLine(t)
	e := newEnvWithDeps(t, func(d *api.Deps) {
		d.LineChannelSecret = lineTestSecret
		d.LineChannelAccessToken = "test-access-token"
		d.LineReplyEndpoint = fake.srv.URL
	})
	return e, fake
}

func lineSign(body []byte) string {
	mac := hmac.New(sha256.New, []byte(lineTestSecret))
	mac.Write(body)
	return base64.StdEncoding.EncodeToString(mac.Sum(nil))
}

// webhook posts a single LINE event to the webhook endpoint, signed the way LINE itself signs it,
// then waits for the reply that event triggers to land on fake (event handling runs in a
// background goroutine — see the comment in line_handlers.go — so it can finish a moment after the
// HTTP response comes back).
func (e *env) webhook(fake *lineFakeLine, payload string) response {
	e.t.Helper()
	before := fake.count()
	body := []byte(payload)
	c := e.anon()
	req, err := http.NewRequest(http.MethodPost, c.base+"/api/v1/line/webhook", strings.NewReader(payload))
	if err != nil {
		e.t.Fatal(err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Line-Signature", lineSign(body))
	resp, err := c.http.Do(req)
	if err != nil {
		e.t.Fatalf("webhook: %v", err)
	}
	defer resp.Body.Close()
	status := resp.StatusCode
	if status == http.StatusOK {
		fake.waitCount(e.t, before+1, 3*time.Second)
	}
	return response{Status: status}
}

func lineMessageEvent(userID, text string) string {
	return `{"events":[{"type":"message","replyToken":"rt-` + userID + `","source":{"userId":"` + userID + `"},"message":{"type":"text","text":"` + text + `"}}]}`
}

func linePostbackEvent(userID string) string {
	return `{"events":[{"type":"postback","replyToken":"rt-` + userID + `","source":{"userId":"` + userID + `"},"postback":{"data":"action=check_parcel"}}]}`
}

func TestLineWebhook_RejectsBadSignature(t *testing.T) {
	e, _ := newLineEnv(t)
	body := lineMessageEvent("U1", "1101")
	c := e.anon()
	req, _ := http.NewRequest(http.MethodPost, c.base+"/api/v1/line/webhook", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Line-Signature", "not-the-right-signature")
	resp, err := c.http.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusUnauthorized {
		t.Fatalf("status = %d, want 401", resp.StatusCode)
	}
}

func TestLineWebhook_AmbiguousRoomAsksForBuildingCode(t *testing.T) {
	e, fake := newLineEnv(t)
	// Fixture has room "101" in both buildings 1 and 2 — an unqualified "101" must not silently pick one.
	if r := e.webhook(fake, lineMessageEvent("Uamb", "101")); r.Status != http.StatusOK {
		t.Fatalf("webhook status = %d", r.Status)
	}
	if got := fake.last(); !strings.Contains(got, "รหัสตึก") {
		t.Fatalf("reply = %q, want a prompt for the building code", got)
	}
	if n := e.queryInt(`SELECT count(*) FROM line_otp_challenges WHERE line_user_id = 'Uamb'`); n != 0 {
		t.Fatalf("otp challenges created for an ambiguous room = %d, want 0", n)
	}
}

func TestLineWebhook_UnknownRoomIsRejected(t *testing.T) {
	e, fake := newLineEnv(t)
	if r := e.webhook(fake, lineMessageEvent("Uunknown", "9999")); r.Status != http.StatusOK {
		t.Fatalf("webhook status = %d", r.Status)
	}
	if got := fake.last(); !strings.Contains(got, "ไม่พบห้องนี้") {
		t.Fatalf("reply = %q, want a not-found message", got)
	}
}

func TestLineWebhook_FullLinkAndCheckParcelFlow(t *testing.T) {
	e, fake := newLineEnv(t)
	staff := e.login("op1")
	userID := "Ufull"

	// Step 1-2: resident claims a room; a code is generated but never sent over LINE.
	if r := e.webhook(fake, lineMessageEvent(userID, "1101")); r.Status != http.StatusOK {
		t.Fatalf("claim webhook status = %d", r.Status)
	}
	if got := fake.last(); !strings.Contains(got, "1101") || sixDigitCode.MatchString(got) {
		t.Fatalf("claim reply = %q, must name the room and must not leak a 6-digit code", got)
	}

	// Step 3: staff look up the pending code the same way the front desk would.
	otpResp := staff.get("/api/v1/rooms/" + itoa(e.roomB1101) + "/line-otp")
	if otpResp.Status != http.StatusOK {
		t.Fatalf("line-otp lookup: %d %s", otpResp.Status, otpResp.Body)
	}
	var otp struct {
		Code       string `json:"code"`
		RoomNumber string `json:"roomNumber"`
	}
	otpResp.decode(t, &otp)
	if len(otp.Code) != 6 {
		t.Fatalf("code = %q, want 6 digits", otp.Code)
	}

	// Step 4: resident types the code back; a match links the account and never reveals the code.
	wrongCode := "000000"
	if wrongCode == otp.Code {
		wrongCode = "111111"
	}
	if r := e.webhook(fake, lineMessageEvent(userID, wrongCode)); r.Status != http.StatusOK {
		t.Fatalf("wrong-code webhook status = %d", r.Status)
	}
	if got := fake.last(); !strings.Contains(got, "ไม่ถูกต้อง") {
		t.Fatalf("wrong-code reply = %q, want a mismatch message", got)
	}

	if r := e.webhook(fake, lineMessageEvent(userID, otp.Code)); r.Status != http.StatusOK {
		t.Fatalf("correct-code webhook status = %d", r.Status)
	}
	if got := fake.last(); !strings.Contains(got, "สำเร็จ") {
		t.Fatalf("link reply = %q, want a success message", got)
	}
	if n := e.queryInt(`SELECT count(*) FROM line_links WHERE line_user_id = $1 AND unlinked_at IS NULL`, userID); n != 1 {
		t.Fatalf("active line_links rows = %d, want 1", n)
	}

	// Re-using the same (now consumed) code must not link again.
	before := fake.count()
	if r := e.webhook(fake, lineMessageEvent(userID, otp.Code)); r.Status != http.StatusOK {
		t.Fatalf("replay webhook status = %d", r.Status)
	}
	if fake.count() != before+1 {
		t.Fatalf("expected exactly one more reply for the replay attempt")
	}
	if got := fake.last(); strings.Contains(got, "สำเร็จ") {
		t.Fatalf("replaying a consumed code must not link again, got reply %q", got)
	}

	// Check Parcel via the rich-menu "Text" action (Official Account Manager has no raw Postback
	// option), with nothing checked in yet.
	if r := e.webhook(fake, lineMessageEvent(userID, "เช็คพัสดุ")); r.Status != http.StatusOK {
		t.Fatalf("check-parcel webhook status = %d", r.Status)
	}
	if got := fake.last(); !strings.Contains(got, "ยังไม่มีพัสดุ") {
		t.Fatalf("empty check-parcel reply = %q", got)
	}

	// Check-in a parcel for the linked room, then Check Parcel again.
	parcel := staff.checkIn("LINE-DEMO-1", e.roomB1101)
	if r := e.webhook(fake, linePostbackEvent(userID)); r.Status != http.StatusOK {
		t.Fatalf("check-parcel webhook status = %d", r.Status)
	}
	got := fake.last()
	if !strings.Contains(got, parcel.TrackingCode) || !strings.Contains(got, "1") {
		t.Fatalf("check-parcel reply = %q, want it to mention %q and a count of 1", got, parcel.TrackingCode)
	}
}

func TestLineWebhook_LockoutAfterRepeatedWrongCodes(t *testing.T) {
	e, fake := newLineEnv(t)
	userID := "Ulock"
	staff := e.login("op1")

	e.webhook(fake, lineMessageEvent(userID, "1102"))
	otpResp := staff.get("/api/v1/rooms/" + itoa(e.roomB1102) + "/line-otp")
	var otp struct {
		Code string `json:"code"`
	}
	otpResp.decode(t, &otp)

	// 5 wrong attempts burns the challenge; the correct code afterwards must no longer work.
	for i := 0; i < 5; i++ {
		e.webhook(fake, lineMessageEvent(userID, "000000"))
	}
	if got := fake.last(); !strings.Contains(got, "ผิดหลายครั้ง") {
		t.Fatalf("5th wrong-attempt reply = %q, want a lockout message", got)
	}

	e.webhook(fake, lineMessageEvent(userID, otp.Code))
	if got := fake.last(); !strings.Contains(got, "หมดอายุ") {
		t.Fatalf("post-lockout correct-code reply = %q, want an expired/none message", got)
	}
	if n := e.queryInt(`SELECT count(*) FROM line_links WHERE line_user_id = $1 AND unlinked_at IS NULL`, userID); n != 0 {
		t.Fatalf("active line_links rows after lockout = %d, want 0", n)
	}
}

func TestLineOTPForRoom_NoPendingChallenge(t *testing.T) {
	e, _ := newLineEnv(t)
	staff := e.login("op1")
	r := staff.get("/api/v1/rooms/" + itoa(e.roomB2101) + "/line-otp")
	wantCode(t, r, http.StatusNotFound, "NO_PENDING_LINE_OTP")
}

func TestLineOTPForRoom_RequiresAuth(t *testing.T) {
	e, _ := newLineEnv(t)
	r := e.anon().get("/api/v1/rooms/" + itoa(e.roomB1101) + "/line-otp")
	wantCode(t, r, http.StatusUnauthorized, "UNAUTHENTICATED")
}

func itoa(n int64) string { return strconv.FormatInt(n, 10) }
