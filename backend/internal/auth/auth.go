// Package auth hashes passwords (bcrypt, salted) and issues/verifies signed session tokens.
package auth

import (
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"strconv"
	"strings"
	"sync"
	"time"

	"golang.org/x/crypto/bcrypt"
)

// BcryptCost is the work factor for production hashes.
const BcryptCost = 12

// maxPasswordBytes is bcrypt's input limit; longer passwords can never match a stored hash.
const maxPasswordBytes = 72

func HashPassword(password string) (string, error) { return HashPasswordCost(password, BcryptCost) }

func HashPasswordCost(password string, cost int) (string, error) {
	b, err := bcrypt.GenerateFromPassword([]byte(password), cost)
	return string(b), err
}

func CheckPassword(hash, password string) bool {
	if len(password) > maxPasswordBytes {
		return false
	}
	return bcrypt.CompareHashAndPassword([]byte(hash), []byte(password)) == nil
}

var (
	dummyOnce sync.Once
	dummyHash string
)

// BurnPasswordCheck spends the same time as a real comparison, so an unknown username can't be told
// apart from a wrong password by response time.
func BurnPasswordCheck(password string) {
	dummyOnce.Do(func() { dummyHash, _ = HashPassword("not-a-real-password") })
	CheckPassword(dummyHash, password)
}

// Signer issues signed session tokens: "v2.<staffID>.<expiryUnix>.<sessionID>.<hex hmac-sha256>".
// The token carries identity only; role and active status are always re-read from the database.
// The random session ID is what logout revokes server-side (revoked_sessions), so a copy of the
// cookie stops working at logout instead of at expiry.
type Signer struct {
	secret []byte
	ttl    time.Duration
}

// Session is what a valid token proves.
type Session struct {
	StaffID   int64
	ID        string // random, unique per login
	ExpiresAt time.Time
}

func NewSigner(secret []byte, ttl time.Duration) Signer { return Signer{secret: secret, ttl: ttl} }

func (s Signer) TTL() time.Duration { return s.ttl }

func (s Signer) Issue(staffID int64, now time.Time) string {
	id := make([]byte, 16)
	if _, err := rand.Read(id); err != nil {
		panic(fmt.Sprintf("session id: %v", err)) // crypto/rand never fails on supported platforms
	}
	payload := fmt.Sprintf("v2.%d.%d.%s", staffID, now.Add(s.ttl).Unix(), hex.EncodeToString(id))
	return payload + "." + s.mac(payload)
}

func (s Signer) Verify(token string, now time.Time) (Session, bool) {
	i := strings.LastIndexByte(token, '.')
	if i < 0 {
		return Session{}, false
	}
	payload, sig := token[:i], token[i+1:]
	if !hmac.Equal([]byte(sig), []byte(s.mac(payload))) {
		return Session{}, false
	}
	parts := strings.Split(payload, ".")
	if len(parts) != 4 || parts[0] != "v2" || len(parts[3]) != 32 {
		return Session{}, false
	}
	id, err1 := strconv.ParseInt(parts[1], 10, 64)
	exp, err2 := strconv.ParseInt(parts[2], 10, 64)
	if err1 != nil || err2 != nil || now.Unix() >= exp {
		return Session{}, false
	}
	return Session{StaffID: id, ID: parts[3], ExpiresAt: time.Unix(exp, 0)}, true
}

func (s Signer) mac(payload string) string {
	m := hmac.New(sha256.New, s.secret)
	m.Write([]byte(payload))
	return hex.EncodeToString(m.Sum(nil))
}
