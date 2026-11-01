package auth

import (
	"strings"
	"testing"
	"time"
)

func TestPasswordHashing(t *testing.T) {
	h, err := HashPasswordCost("s3cret-pass", 4)
	if err != nil {
		t.Fatal(err)
	}
	if strings.Contains(h, "s3cret-pass") {
		t.Fatal("hash contains the plaintext password")
	}
	h2, _ := HashPasswordCost("s3cret-pass", 4)
	if h == h2 {
		t.Error("two hashes of the same password are identical: no salt")
	}
	if !CheckPassword(h, "s3cret-pass") || CheckPassword(h, "S3cret-pass") || CheckPassword(h, "") {
		t.Error("CheckPassword accepted a wrong password or rejected the right one")
	}
	if CheckPassword(h, strings.Repeat("a", 73)) {
		t.Error("passwords over bcrypt's 72-byte limit must never match")
	}
}

func TestSessionTokens(t *testing.T) {
	now := time.Unix(1_800_000_000, 0)
	s := NewSigner([]byte(strings.Repeat("k", 32)), time.Hour)
	tok := s.Issue(42, now)

	sess, ok := s.Verify(tok, now.Add(59*time.Minute))
	if !ok || sess.StaffID != 42 || len(sess.ID) != 32 || !sess.ExpiresAt.Equal(now.Add(time.Hour)) {
		t.Errorf("valid token rejected: %+v ok=%v", sess, ok)
	}
	// Two logins in the same second still get different session IDs, so revoking one never
	// revokes the other.
	if again, _ := s.Verify(s.Issue(42, now), now); again.ID == sess.ID {
		t.Error("two sessions share an ID")
	}
	if _, ok := s.Verify(tok, now.Add(time.Hour)); ok {
		t.Error("expired token accepted")
	}

	// Tampering with the identity or the signature must fail.
	if _, ok := s.Verify(strings.Replace(tok, "v2.42.", "v2.1.", 1), now); ok {
		t.Error("token for a different staff id accepted")
	}
	if _, ok := s.Verify(tok[:len(tok)-1]+"0", now); ok && !strings.HasSuffix(tok, "0") {
		t.Error("token with altered signature accepted")
	}
	other := NewSigner([]byte(strings.Repeat("z", 32)), time.Hour)
	if _, ok := other.Verify(tok, now); ok {
		t.Error("token signed with another secret accepted")
	}
	for _, junk := range []string{"", "v1", "v1.1.2", "a.b.c.d", "v2.42.9999999999.abc", "v1.42.9999999999.abc"} {
		if _, ok := s.Verify(junk, now); ok {
			t.Errorf("junk token %q accepted", junk)
		}
	}
}
