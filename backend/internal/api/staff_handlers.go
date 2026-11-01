package api

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"

	"dpms/backend/internal/apperr"
	"dpms/backend/internal/auth"
	"dpms/backend/internal/store"
)

type createStaffRequest struct {
	Username string `json:"username"`
	FullName string `json:"fullName"`
	Password string `json:"password"`
	Role     string `json:"role"`
}

// createStaff registers a Staff account. Admin only (enforced by the router group); the new row
// records which Admin created it.
func (h *handlers) createStaff(c *gin.Context) {
	var req createStaffRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		fail(c, apperr.Validation("body", "invalid_json"))
		return
	}
	username := strings.ToLower(strings.TrimSpace(req.Username))
	fullName := strings.TrimSpace(req.FullName)
	if e := store.ValidateNewStaff(username, fullName, req.Password, req.Role); e != nil {
		fail(c, e)
		return
	}
	hash, err := auth.HashPassword(req.Password)
	if err != nil {
		fail(c, err)
		return
	}
	admin := currentStaff(c)
	st, err := h.Store.CreateStaff(c.Request.Context(), store.NewStaff{
		Username: username, PasswordHash: hash, FullName: fullName, Role: req.Role, CreatedBy: &admin.ID,
	})
	if err != nil {
		fail(c, err)
		return
	}
	c.JSON(http.StatusCreated, gin.H{"staff": st})
}

func (h *handlers) listStaff(c *gin.Context) {
	page, size, e := parsePaging(c)
	if e != nil {
		fail(c, e)
		return
	}
	result, err := h.Store.ListStaff(c.Request.Context(), page, size)
	if err != nil {
		fail(c, err)
		return
	}
	c.JSON(http.StatusOK, result)
}
