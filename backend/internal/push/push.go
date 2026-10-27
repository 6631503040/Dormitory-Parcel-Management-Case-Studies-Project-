// Package push sends Web Push messages (RFC 8030) using only the Go standard library:
// payload encryption per RFC 8291 (aes128gcm, RFC 8188) and VAPID application-server
// authentication per RFC 8292. No third-party push library — the stack stays Go + Gin + pgx.
package push

import (
	"bytes"
	"context"
	"crypto/aes"
	"crypto/cipher"
	"crypto/ecdh"
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/hkdf"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/binary"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"
)

const (
	recordSize  = 4096
	saltLen     = 16
	authLen     = 16
	pubKeyLen   = 65 // uncompressed P-256 point: 0x04 || X || Y
	vapidJWTTTL = 12 * time.Hour
)

var b64 = base64.RawURLEncoding

// DecodeKey accepts base64url with or without padding (browsers hand keys out unpadded, some
// tools pad them) and also plain base64, since PushSubscription.toJSON() output varies by browser.
func DecodeKey(s string) ([]byte, error) {
	s = strings.TrimRight(strings.TrimSpace(s), "=")
	s = strings.NewReplacer("+", "-", "/", "_").Replace(s)
	return b64.DecodeString(s)
}

// Subscription is what a browser's PushManager.subscribe() returns: where to send, and the two
// keys the payload must be encrypted to.
type Subscription struct {
	Endpoint string
	P256dh   string // base64url, the user agent's ECDH public key
	Auth     string // base64url, 16-byte shared auth secret
}

// Validate checks the keys are well-formed so a bad subscription is rejected at registration
// time instead of failing silently on every later send.
func (s Subscription) Validate() error {
	u, err := url.Parse(s.Endpoint)
	if err != nil || u.Scheme == "" || u.Host == "" {
		return errors.New("endpoint")
	}
	pub, err := DecodeKey(s.P256dh)
	if err != nil || len(pub) != pubKeyLen {
		return errors.New("p256dh")
	}
	if _, err := ecdh.P256().NewPublicKey(pub); err != nil {
		return errors.New("p256dh")
	}
	auth, err := DecodeKey(s.Auth)
	if err != nil || len(auth) != authLen {
		return errors.New("auth")
	}
	return nil
}

// pushServiceSuffixes are the push services the major browsers use. The server POSTs to whatever
// endpoint a resident's browser hands over, so accepting an arbitrary URL would turn the
// registration endpoint into an SSRF primitive (make the backend call any internal address).
var pushServiceSuffixes = []string{
	"fcm.googleapis.com",        // Chrome, Edge (Chromium), Samsung Internet, Android
	"push.services.mozilla.com", // Firefox
	"notify.windows.com",        // legacy Edge / Windows
	"push.apple.com",            // Safari on macOS and iOS/iPadOS (16.4+, installed PWA)
}

// DefaultEndpointAllowed reports whether endpoint is an https URL on a known browser push service.
func DefaultEndpointAllowed(endpoint string) bool {
	u, err := url.Parse(endpoint)
	if err != nil || u.Scheme != "https" || u.User != nil {
		return false
	}
	if p := u.Port(); p != "" && p != "443" {
		return false
	}
	host := strings.ToLower(u.Hostname())
	for _, s := range pushServiceSuffixes {
		if host == s || strings.HasSuffix(host, "."+s) {
			return true
		}
	}
	return false
}

// --- VAPID keys --------------------------------------------------------------------------------

// Keys is the application server's VAPID key pair. The public key is what the browser's
// PushManager.subscribe({applicationServerKey}) needs; the private key signs every request.
type Keys struct {
	ecdsa     *ecdsa.PrivateKey
	PublicB64 string // base64url uncompressed point — hand this to the frontend
}

// GenerateKeys makes a new VAPID key pair; returns (publicB64, privateB64).
func GenerateKeys() (string, string, error) {
	k, err := ecdh.P256().GenerateKey(rand.Reader)
	if err != nil {
		return "", "", err
	}
	return b64.EncodeToString(k.PublicKey().Bytes()), b64.EncodeToString(k.Bytes()), nil
}

// ParseKeys loads a VAPID key pair from its base64url form (the format web-push tooling uses:
// 32-byte private scalar, 65-byte uncompressed public point). The public key must match.
func ParseKeys(publicB64, privateB64 string) (*Keys, error) {
	priv, err := DecodeKey(privateB64)
	if err != nil {
		return nil, fmt.Errorf("VAPID private key: %w", err)
	}
	sk, err := ecdsa.ParseRawPrivateKey(elliptic.P256(), priv)
	if err != nil {
		return nil, fmt.Errorf("VAPID private key: %w", err)
	}
	pub, err := sk.PublicKey.Bytes()
	if err != nil {
		return nil, err
	}
	derived := b64.EncodeToString(pub)
	if publicB64 != "" {
		given, err := DecodeKey(publicB64)
		if err != nil || !bytes.Equal(given, pub) {
			return nil, errors.New("VAPID public key does not match the private key")
		}
	}
	return &Keys{ecdsa: sk, PublicB64: derived}, nil
}

// vapidAuthorization builds the RFC 8292 header: a short-lived ES256 JWT scoped to the push
// service's origin, plus our public key.
func (k *Keys) vapidAuthorization(endpoint, subject string, now time.Time) (string, error) {
	u, err := url.Parse(endpoint)
	if err != nil {
		return "", err
	}
	header := b64.EncodeToString([]byte(`{"typ":"JWT","alg":"ES256"}`))
	claims, err := json.Marshal(map[string]any{
		"aud": u.Scheme + "://" + u.Host,
		"exp": now.Add(vapidJWTTTL).Unix(),
		"sub": subject,
	})
	if err != nil {
		return "", err
	}
	signingInput := header + "." + b64.EncodeToString(claims)
	digest := sha256.Sum256([]byte(signingInput))
	r, s, err := ecdsa.Sign(rand.Reader, k.ecdsa, digest[:])
	if err != nil {
		return "", err
	}
	sig := make([]byte, 64) // JWS ES256: fixed-width R || S, not ASN.1
	r.FillBytes(sig[:32])
	s.FillBytes(sig[32:])
	return "vapid t=" + signingInput + "." + b64.EncodeToString(sig) + ", k=" + k.PublicB64, nil
}

// --- payload encryption (RFC 8291) -------------------------------------------------------------

// Encrypt encrypts plaintext to a subscription's keys as a single aes128gcm record. asKey is the
// sender's ephemeral ECDH key and salt a fresh 16-byte value — both random per message in normal
// use; they're parameters only so the RFC 8291 test vector can be reproduced exactly.
func Encrypt(plaintext, uaPublic, authSecret []byte, asKey *ecdh.PrivateKey, salt []byte) ([]byte, error) {
	if len(salt) != saltLen || len(authSecret) != authLen {
		return nil, errors.New("push: bad salt or auth secret length")
	}
	if len(plaintext)+1+aes.BlockSize > recordSize-86 { // 86 = header (21 + 65)
		return nil, errors.New("push: payload too large")
	}
	uaKey, err := ecdh.P256().NewPublicKey(uaPublic)
	if err != nil {
		return nil, fmt.Errorf("push: user agent key: %w", err)
	}
	shared, err := asKey.ECDH(uaKey)
	if err != nil {
		return nil, err
	}
	asPublic := asKey.PublicKey().Bytes()

	cek, nonce, err := deriveKeys(shared, authSecret, salt, uaPublic, asPublic)
	if err != nil {
		return nil, err
	}
	block, err := aes.NewCipher(cek)
	if err != nil {
		return nil, err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}
	record := append(append([]byte{}, plaintext...), 0x02) // 0x02 = last-record delimiter, no padding

	out := make([]byte, 0, 21+len(asPublic)+len(record)+gcm.Overhead())
	out = append(out, salt...)
	out = binary.BigEndian.AppendUint32(out, recordSize)
	out = append(out, byte(len(asPublic)))
	out = append(out, asPublic...)
	return gcm.Seal(out, nonce, record, nil), nil
}

// Decrypt reverses Encrypt given the user agent's private key — what a browser does on receipt.
// The server never needs it; it exists so tests can check exactly what a resident would see.
func Decrypt(body []byte, uaKey *ecdh.PrivateKey, authSecret []byte) ([]byte, error) {
	if len(body) < 21 {
		return nil, errors.New("push: short body")
	}
	salt := body[:saltLen]
	idLen := int(body[20])
	if len(body) < 21+idLen {
		return nil, errors.New("push: short header")
	}
	asPublic := body[21 : 21+idLen]
	asKey, err := ecdh.P256().NewPublicKey(asPublic)
	if err != nil {
		return nil, err
	}
	shared, err := uaKey.ECDH(asKey)
	if err != nil {
		return nil, err
	}
	cek, nonce, err := deriveKeys(shared, authSecret, salt, uaKey.PublicKey().Bytes(), asPublic)
	if err != nil {
		return nil, err
	}
	block, err := aes.NewCipher(cek)
	if err != nil {
		return nil, err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}
	plain, err := gcm.Open(nil, nonce, body[21+idLen:], nil)
	if err != nil {
		return nil, err
	}
	i := bytes.LastIndexByte(plain, 0x02)
	if i < 0 {
		return nil, errors.New("push: missing delimiter")
	}
	return plain[:i], nil
}

func deriveKeys(shared, authSecret, salt, uaPublic, asPublic []byte) (cek, nonce []byte, err error) {
	keyInfo := append(append([]byte("WebPush: info\x00"), uaPublic...), asPublic...)
	ikm, err := hkdf.Key(sha256.New, shared, authSecret, string(keyInfo), 32)
	if err != nil {
		return nil, nil, err
	}
	if cek, err = hkdf.Key(sha256.New, ikm, salt, "Content-Encoding: aes128gcm\x00", 16); err != nil {
		return nil, nil, err
	}
	if nonce, err = hkdf.Key(sha256.New, ikm, salt, "Content-Encoding: nonce\x00", 12); err != nil {
		return nil, nil, err
	}
	return cek, nonce, nil
}

// --- sending -----------------------------------------------------------------------------------

// Sender delivers encrypted messages to push services.
type Sender struct {
	Keys    *Keys
	Subject string // VAPID "sub": a mailto: or https: contact for the push service operator
	HTTP    *http.Client
}

func NewSender(keys *Keys, subject string) *Sender {
	return &Sender{Keys: keys, Subject: subject, HTTP: &http.Client{Timeout: 10 * time.Second}}
}

// Options are per-message delivery hints for the push service.
type Options struct {
	TTL   time.Duration // how long the push service may hold the message for an offline device
	Topic string        // a newer message with the same topic replaces an undelivered older one
}

// Result is the push service's answer. Gone means the subscription no longer exists (the browser
// unsubscribed, the app was uninstalled, permission was revoked) and must not be retried.
type Result struct {
	Status int
}

func (r Result) OK() bool        { return r.Status >= 200 && r.Status < 300 }
func (r Result) Gone() bool      { return r.Status == http.StatusNotFound || r.Status == http.StatusGone }
func (r Result) Retryable() bool { return r.Status == http.StatusTooManyRequests || r.Status >= 500 }

// Send encrypts payload for sub and POSTs it. A network error comes back as err; any HTTP answer
// (including 4xx/5xx) comes back as a Result for the caller to classify.
func (s *Sender) Send(ctx context.Context, sub Subscription, payload []byte, opt Options) (Result, error) {
	uaPublic, err := DecodeKey(sub.P256dh)
	if err != nil {
		return Result{}, fmt.Errorf("push: p256dh: %w", err)
	}
	auth, err := DecodeKey(sub.Auth)
	if err != nil {
		return Result{}, fmt.Errorf("push: auth: %w", err)
	}
	asKey, err := ecdh.P256().GenerateKey(rand.Reader)
	if err != nil {
		return Result{}, err
	}
	salt := make([]byte, saltLen)
	if _, err := rand.Read(salt); err != nil {
		return Result{}, err
	}
	body, err := Encrypt(payload, uaPublic, auth, asKey, salt)
	if err != nil {
		return Result{}, err
	}
	authz, err := s.Keys.vapidAuthorization(sub.Endpoint, s.Subject, time.Now())
	if err != nil {
		return Result{}, err
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, sub.Endpoint, bytes.NewReader(body))
	if err != nil {
		return Result{}, err
	}
	ttl := opt.TTL
	if ttl <= 0 {
		ttl = 24 * time.Hour
	}
	req.Header.Set("Content-Type", "application/octet-stream")
	req.Header.Set("Content-Encoding", "aes128gcm")
	req.Header.Set("TTL", strconv.Itoa(int(ttl.Seconds())))
	req.Header.Set("Urgency", "normal")
	req.Header.Set("Authorization", authz)
	if opt.Topic != "" {
		req.Header.Set("Topic", opt.Topic)
	}

	client := s.HTTP
	if client == nil {
		client = http.DefaultClient
	}
	resp, err := client.Do(req)
	if err != nil {
		return Result{}, err
	}
	defer resp.Body.Close()
	_, _ = io.Copy(io.Discard, io.LimitReader(resp.Body, 4096))
	return Result{Status: resp.StatusCode}, nil
}
