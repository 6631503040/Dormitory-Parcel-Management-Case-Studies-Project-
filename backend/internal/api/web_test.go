package api_test

// Serving the built client from WEB_DIR (web.go). No database needed: these paths never reach a
// handler that touches the store.

import (
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"

	"dpms/backend/internal/api"
	"dpms/backend/internal/auth"
)

func webRouter(t *testing.T, webDir string) http.Handler {
	t.Helper()
	gin.SetMode(gin.TestMode)
	return api.NewRouter(api.Deps{Signer: auth.NewSigner([]byte(strings.Repeat("k", 32)), 0), WebDir: webDir})
}

func get(h http.Handler, method, target string) *httptest.ResponseRecorder {
	w := httptest.NewRecorder()
	h.ServeHTTP(w, httptest.NewRequest(method, target, nil))
	return w
}

func TestServesBuiltClient(t *testing.T) {
	dir := t.TempDir()
	files := map[string]string{
		"index.html":                    "staff page",
		"resident/index.html":           "resident page",
		"resident/sw.js":                "service worker",
		"resident/manifest.webmanifest": "{}",
		"assets/app-1a2b.js":            "bundle",
	}
	for name, body := range files {
		p := filepath.Join(dir, filepath.FromSlash(name))
		if err := os.MkdirAll(filepath.Dir(p), 0o755); err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(p, []byte(body), 0o644); err != nil {
			t.Fatal(err)
		}
	}
	// A file outside WEB_DIR that traversal must never reach.
	if err := os.WriteFile(filepath.Join(filepath.Dir(dir), "secret.txt"), []byte("secret"), 0o644); err != nil {
		t.Fatal(err)
	}
	h := webRouter(t, dir)

	for _, tc := range []struct {
		target, body, cache, ctype string
	}{
		{"/", "staff page", "no-cache", "text/html"},
		{"/resident/", "resident page", "no-cache", "text/html"},
		{"/resident/sw.js", "service worker", "no-cache", "javascript"},
		{"/resident/manifest.webmanifest", "{}", "no-cache", "application/manifest+json"},
		{"/assets/app-1a2b.js", "bundle", "immutable", "javascript"},
	} {
		w := get(h, http.MethodGet, tc.target)
		if w.Code != http.StatusOK || w.Body.String() != tc.body {
			t.Errorf("GET %s = %d %q, want 200 %q", tc.target, w.Code, w.Body.String(), tc.body)
		}
		if cc := w.Header().Get("Cache-Control"); !strings.Contains(cc, tc.cache) {
			t.Errorf("GET %s Cache-Control = %q, want %q", tc.target, cc, tc.cache)
		}
		if ct := w.Header().Get("Content-Type"); !strings.Contains(ct, tc.ctype) {
			t.Errorf("GET %s Content-Type = %q, want %q", tc.target, ct, tc.ctype)
		}
	}

	if w := get(h, http.MethodGet, "/resident?x=1"); w.Code != http.StatusMovedPermanently || w.Header().Get("Location") != "/resident/?x=1" {
		t.Errorf("GET /resident = %d Location %q, want 301 /resident/?x=1", w.Code, w.Header().Get("Location"))
	}

	// Missing files, directories without an index, traversal, unknown API routes and writes all get
	// the JSON NOT_FOUND error, never a file or a directory listing.
	for _, tc := range []struct{ method, target string }{
		{http.MethodGet, "/missing.js"},
		{http.MethodGet, "/assets/"},
		{http.MethodGet, "/../secret.txt"},
		{http.MethodGet, "/assets/../../secret.txt"},
		{http.MethodGet, "/api/v1/nope"},
		{http.MethodPost, "/index.html"},
	} {
		w := get(h, tc.method, tc.target)
		if w.Code != http.StatusNotFound || !strings.Contains(w.Body.String(), `"NOT_FOUND"`) {
			t.Errorf("%s %s = %d %s, want 404 NOT_FOUND", tc.method, tc.target, w.Code, w.Body.String())
		}
	}
}

func TestNoWebDirServesAPIOnly(t *testing.T) {
	w := get(webRouter(t, ""), http.MethodGet, "/")
	if w.Code != http.StatusNotFound || !strings.Contains(w.Body.String(), `"NOT_FOUND"`) {
		t.Errorf("GET / without WEB_DIR = %d %s, want 404 NOT_FOUND", w.Code, w.Body.String())
	}
}
