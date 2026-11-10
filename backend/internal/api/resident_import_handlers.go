package api

import (
	"fmt"
	"log"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"

	"dpms/backend/internal/apperr"
	"dpms/backend/internal/store"
)

// The CSV travels inside JSON ({"csv": "..."}): every state-changing route only accepts
// application/json (CSRF guard, see requireJSONBody), and the 1 MB body limit still applies.
type residentImportRequest struct {
	CSV string `json:"csv"`
}

func bindImport(c *gin.Context) (string, bool) {
	var req residentImportRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		fail(c, apperr.Validation("body", "invalid_json"))
		return "", false
	}
	return req.CSV, true
}

// previewResidentImport returns what an upload would change; nothing is written.
func (h *handlers) previewResidentImport(c *gin.Context) {
	data, ok := bindImport(c)
	if !ok {
		return
	}
	sum, err := h.Store.PreviewResidentImport(c.Request.Context(), data)
	if err != nil {
		fail(c, err)
		return
	}
	c.JSON(http.StatusOK, sum)
}

// applyResidentImport replaces the directory with the uploaded list, in one transaction.
func (h *handlers) applyResidentImport(c *gin.Context) {
	data, ok := bindImport(c)
	if !ok {
		return
	}
	sum, err := h.Store.ApplyResidentImport(c.Request.Context(), currentStaff(c).ID, data)
	if err != nil {
		fail(c, err)
		return
	}
	c.JSON(http.StatusOK, sum)
}

// exportResidents downloads the active directory as CSV in the import format. It contains phone
// numbers, so it is Admin only like the import itself.
func (h *handlers) exportResidents(c *gin.Context) {
	name := fmt.Sprintf("residents-%s.csv", time.Now().In(h.Location).Format("20060102"))
	c.Header("Content-Type", "text/csv; charset=utf-8")
	c.Header("Content-Disposition", `attachment; filename="`+name+`"`)
	c.Status(http.StatusOK)
	if _, err := c.Writer.WriteString(store.UTF8BOM); err != nil {
		return
	}
	if err := h.Store.ExportResidents(c.Request.Context(), c.Writer); err != nil {
		// Headers are already sent; all we can do is log and cut the response short.
		log.Printf("export residents: %v", err)
	}
}
