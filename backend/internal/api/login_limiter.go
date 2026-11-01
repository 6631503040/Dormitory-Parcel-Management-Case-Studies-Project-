package api

import (
	"strings"
	"sync"
	"time"
)

// Login throttling (QA-02, review 2026-11-01). After loginMaxFailures wrong passwords for one
// username from one client IP within loginWindow, further attempts for that pair get 429 until the
// oldest failure ages out of the window. A successful login clears the pair.
//
// The key is the (username, IP) pair, not the username alone, so someone guessing from elsewhere
// can't lock the owner out of their own desk; and not the IP alone, because desks share one NAT
// address (and, until TRUSTED_PROXIES is set, every client on Render appears as the proxy's IP).
//
// State is in memory: right for the single API instance this project runs. Several instances would
// each keep their own count, so a shared store (or the proxy's limiter) would be needed then.
const (
	loginMaxFailures = 5
	loginWindow      = 15 * time.Minute
	loginMaxKeys     = 10_000 // bound on memory under a flood of distinct usernames
)

type loginLimiter struct {
	mu       sync.Mutex
	failures map[string][]time.Time // oldest first, at most loginMaxFailures entries
}

func newLoginLimiter() *loginLimiter {
	return &loginLimiter{failures: map[string][]time.Time{}}
}

func loginKey(username, ip string) string { return strings.ToLower(username) + "\x00" + ip }

// retryAfter reports how long the pair must wait, or 0 if it may try now.
func (l *loginLimiter) retryAfter(key string, now time.Time) time.Duration {
	l.mu.Lock()
	defer l.mu.Unlock()
	f := recent(l.failures[key], now)
	if len(f) < loginMaxFailures {
		return 0
	}
	return f[0].Add(loginWindow).Sub(now)
}

func (l *loginLimiter) fail(key string, now time.Time) {
	l.mu.Lock()
	defer l.mu.Unlock()
	if _, ok := l.failures[key]; !ok && len(l.failures) >= loginMaxKeys {
		for k, f := range l.failures {
			if len(recent(f, now)) == 0 {
				delete(l.failures, k)
			}
		}
		if len(l.failures) >= loginMaxKeys {
			return // still full of live entries: don't grow further
		}
	}
	f := append(recent(l.failures[key], now), now)
	if len(f) > loginMaxFailures {
		f = f[len(f)-loginMaxFailures:]
	}
	l.failures[key] = f
}

func (l *loginLimiter) succeed(key string) {
	l.mu.Lock()
	defer l.mu.Unlock()
	delete(l.failures, key)
}

// recent drops failures older than the window.
func recent(f []time.Time, now time.Time) []time.Time {
	i := 0
	for i < len(f) && now.Sub(f[i]) >= loginWindow {
		i++
	}
	return f[i:]
}
