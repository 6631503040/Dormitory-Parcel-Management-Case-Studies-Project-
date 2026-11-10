package api

import (
	"mime"
	"net/http"
	"os"
	"path"
	"path/filepath"
	"strings"

	"github.com/gin-gonic/gin"

	"dpms/backend/internal/apperr"
)

// The built React client (Staff desk at /, Resident PWA at /resident/) is served from the same
// origin as the API, so the session cookie and the Resident service worker need no CORS. This is
// only active when WEB_DIR is set (the production image); in development Vite serves the client
// and proxies /api to this server.

func init() {
	// Not in Go's built-in table, and the runtime image has no /etc/mime.types.
	_ = mime.AddExtensionType(".webmanifest", "application/manifest+json")
}

// noRoute answers every request no API route matched: a file of the built client when WEB_DIR is
// set, otherwise (and always for /api/ and non-GET requests) the JSON NOT_FOUND error.
func (h *handlers) noRoute(c *gin.Context) {
	method := c.Request.Method
	if h.WebDir == "" || strings.HasPrefix(c.Request.URL.Path, "/api/") || (method != http.MethodGet && method != http.MethodHead) {
		fail(c, apperr.New(apperr.NotFound, nil))
		return
	}

	// Clean against "/" first so ".." can never leave WEB_DIR.
	p := path.Clean("/" + c.Request.URL.Path)
	name := filepath.Join(h.WebDir, filepath.FromSlash(p))
	if fi, err := os.Stat(name); err == nil && fi.IsDir() {
		if !strings.HasSuffix(c.Request.URL.Path, "/") {
			// /resident → /resident/ so the page's relative URLs and service-worker scope resolve.
			target := p + "/"
			if q := c.Request.URL.RawQuery; q != "" {
				target += "?" + q
			}
			c.Redirect(http.StatusMovedPermanently, target)
			return
		}
		name = filepath.Join(name, "index.html")
	}
	if fi, err := os.Stat(name); err != nil || fi.IsDir() {
		fail(c, apperr.New(apperr.NotFound, nil))
		return
	}

	// Vite fingerprints everything under /assets/, so those never change; pages, the service worker
	// and the manifest must be revalidated on every load or a deploy would not reach open devices.
	if strings.HasPrefix(p, "/assets/") {
		c.Header("Cache-Control", "public, max-age=31536000, immutable")
	} else {
		c.Header("Cache-Control", "no-cache")
	}
	http.ServeFile(c.Writer, c.Request, name)
}
