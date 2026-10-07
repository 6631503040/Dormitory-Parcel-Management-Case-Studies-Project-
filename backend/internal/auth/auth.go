// Package auth hashes passwords (bcrypt, salted) and issues/verifies signed session tokens.
package auth

import (
	"crypto/hmac"
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

// Signer issues stateless session tokens: "v1.<staffID>.<expiryUnix>.<hex hmac-sha256>".
// The token carries identity only; role and active status are always re-read from the database.
type Signer struct {
	secret []byte
	ttl    time.Duration
}

func NewSigner(secret []byte, ttl time.Duration) Signer { return Signer{secret: secret, ttl: ttl} }

func (s Signer) TTL() time.Duration { return s.ttl }

func (s Signer) Issue(staffID int64, now time.Time) string {
	payload := fmt.Sprintf("v1.%d.%d", staffID, now.Add(s.ttl).Unix())
	return payload + "." + s.mac(payload)
}

func (s Signer) Verify(token string, now time.Time) (int64, bool) {
	i := strings.LastIndexByte(token, '.')
	if i < 0 {
		return 0, false
	}
	payload, sig := token[:i], token[i+1:]
	if !hmac.Equal([]byte(sig), []byte(s.mac(payload))) {
		return 0, false
	}
	parts := strings.Split(payload, ".")
	if len(parts) != 3 || parts[0] != "v1" {
		return 0, false
	}
	id, err1 := strconv.ParseInt(parts[1], 10, 64)
	exp, err2 := strconv.ParseInt(parts[2], 10, 64)
	if err1 != nil || err2 != nil || now.Unix() >= exp {
		return 0, false
	}
	return id, true
}

func (s Signer) mac(payload string) string {
	m := hmac.New(sha256.New, s.secret)
	m.Write([]byte(payload))
	return hex.EncodeToString(m.Sum(nil))
}
