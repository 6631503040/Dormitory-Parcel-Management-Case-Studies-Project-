package push

import (
	"context"
	"crypto/ecdh"
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/sha256"
	"encoding/json"
	"io"
	"math/big"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func mustDecode(t *testing.T, s string) []byte {
	t.Helper()
	b, err := DecodeKey(s)
	if err != nil {
		t.Fatalf("decode %q: %v", s, err)
	}
	return b
}

// RFC 8291 Appendix A: the exact worked example from the spec.
func TestEncrypt_RFC8291Vector(t *testing.T) {
	asPriv, err := ecdh.P256().NewPrivateKey(mustDecode(t, "yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw"))
	if err != nil {
		t.Fatal(err)
	}
	uaPublic := mustDecode(t, "BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4")
	auth := mustDecode(t, "BTBZMqHH6r4Tts7J_aSIgg")
	salt := mustDecode(t, "DGv6ra1nlYgDCS1FRnbzlw")

	got, err := Encrypt([]byte("When I grow up, I want to be a watermelon"), uaPublic, auth, asPriv, salt)
	if err != nil {
		t.Fatal(err)
	}
	want := "DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPTpK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN"
	if b64.EncodeToString(got) != want {
		t.Fatalf("ciphertext mismatch\n got %s\nwant %s", b64.EncodeToString(got), want)
	}

	uaPriv, err := ecdh.P256().NewPrivateKey(mustDecode(t, "q1dXpw3UpT5VOmu_cf_v6ih07Aems3njxI-JWgLcM94"))
	if err != nil {
		t.Fatal(err)
	}
	plain, err := Decrypt(got, uaPriv, auth)
	if err != nil || string(plain) != "When I grow up, I want to be a watermelon" {
		t.Fatalf("decrypt: %q %v", plain, err)
	}
}

func TestParseKeys_RoundTripAndMismatch(t *testing.T) {
	pub, priv, err := GenerateKeys()
	if err != nil {
		t.Fatal(err)
	}
	k, err := ParseKeys(pub, priv)
	if err != nil || k.PublicB64 != pub {
		t.Fatalf("ParseKeys: %v (%s vs %s)", err, k.PublicB64, pub)
	}
	otherPub, _, _ := GenerateKeys()
	if _, err := ParseKeys(otherPub, priv); err == nil {
		t.Fatal("mismatched public key accepted")
	}
}

func TestDefaultEndpointAllowed(t *testing.T) {
	for endpoint, want := range map[string]bool{
		"https://fcm.googleapis.com/fcm/send/abc":                true,
		"https://updates.push.services.mozilla.com/wpush/v2/abc": true,
		"https://web.push.apple.com/QGxyz":                       true,
		"https://db5p.notify.windows.com/w/?token=abc":           true,
		"http://fcm.googleapis.com/fcm/send/abc":                 false, // not https
		"https://fcm.googleapis.com:8443/x":                      false,
		"https://evilfcm.googleapis.com.attacker.example/x":      false,
		"https://127.0.0.1/x":                                    false,
		"https://user@fcm.googleapis.com/x":                      false,
		"https://metadata.google.internal/computeMetadata/v1/":   false,
	} {
		if got := DefaultEndpointAllowed(endpoint); got != want {
			t.Errorf("%s: got %v want %v", endpoint, got, want)
		}
	}
}

func TestSend_HeadersVAPIDAndPayload(t *testing.T) {
	pub, priv, _ := GenerateKeys()
	keys, err := ParseKeys(pub, priv)
	if err != nil {
		t.Fatal(err)
	}
	uaKey, _ := ecdh.P256().GenerateKey(rand.Reader)
	auth := make([]byte, 16)
	_, _ = rand.Read(auth)

	var gotPlain []byte
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Content-Encoding") != "aes128gcm" || r.Header.Get("TTL") != "3600" || r.Header.Get("Topic") != "room-7" {
			t.Errorf("headers: %v", r.Header)
		}
		verifyVAPID(t, r.Header.Get("Authorization"), pub, "http://"+r.Host)
		body, _ := io.ReadAll(r.Body)
		var err error
		if gotPlain, err = Decrypt(body, uaKey, auth); err != nil {
			t.Errorf("decrypt: %v", err)
		}
		w.WriteHeader(http.StatusCreated)
	}))
	defer srv.Close()

	s := NewSender(keys, "mailto:desk@example.com")
	res, err := s.Send(context.Background(), Subscription{
		Endpoint: srv.URL + "/push/abc",
		P256dh:   b64.EncodeToString(uaKey.PublicKey().Bytes()),
		Auth:     b64.EncodeToString(auth),
	}, []byte(`{"type":"parcel_arrived"}`), Options{TTL: time.Hour, Topic: "room-7"})
	if err != nil || !res.OK() {
		t.Fatalf("send: %+v %v", res, err)
	}
	if string(gotPlain) != `{"type":"parcel_arrived"}` {
		t.Fatalf("payload: %q", gotPlain)
	}
}

// verifyVAPID checks the JWT the way a push service does: signature by k=, aud = origin.
func verifyVAPID(t *testing.T, header, wantPub, wantAud string) {
	t.Helper()
	parts := strings.Split(strings.TrimPrefix(header, "vapid "), ", ")
	if len(parts) != 2 || !strings.HasPrefix(parts[0], "t=") || parts[1] != "k="+wantPub {
		t.Fatalf("authorization header: %q", header)
	}
	jwt := strings.Split(strings.TrimPrefix(parts[0], "t="), ".")
	if len(jwt) != 3 {
		t.Fatalf("jwt: %q", parts[0])
	}
	var claims struct {
		Aud string `json:"aud"`
		Exp int64  `json:"exp"`
		Sub string `json:"sub"`
	}
	if err := json.Unmarshal(mustDecode(t, jwt[1]), &claims); err != nil {
		t.Fatal(err)
	}
	if claims.Aud != wantAud || claims.Sub != "mailto:desk@example.com" || claims.Exp <= time.Now().Unix() {
		t.Fatalf("claims: %+v", claims)
	}
	pubBytes := mustDecode(t, wantPub)
	x, y := elliptic.Unmarshal(elliptic.P256(), pubBytes) //nolint:staticcheck // test-only parsing
	sig := mustDecode(t, jwt[2])
	digest := sha256.Sum256([]byte(jwt[0] + "." + jwt[1]))
	if !ecdsa.Verify(&ecdsa.PublicKey{Curve: elliptic.P256(), X: x, Y: y}, digest[:],
		new(big.Int).SetBytes(sig[:32]), new(big.Int).SetBytes(sig[32:])) {
		t.Fatal("VAPID signature does not verify")
	}
}

func TestSubscriptionValidate(t *testing.T) {
	uaKey, _ := ecdh.P256().GenerateKey(rand.Reader)
	good := Subscription{Endpoint: "https://fcm.googleapis.com/x", P256dh: b64.EncodeToString(uaKey.PublicKey().Bytes()), Auth: b64.EncodeToString(make([]byte, 16))}
	if err := good.Validate(); err != nil {
		t.Fatal(err)
	}
	bad := good
	bad.Auth = b64.EncodeToString(make([]byte, 8))
	if bad.Validate() == nil {
		t.Fatal("short auth accepted")
	}
	bad = good
	bad.P256dh = b64.EncodeToString(make([]byte, 65))
	if bad.Validate() == nil {
		t.Fatal("invalid point accepted")
	}
}
