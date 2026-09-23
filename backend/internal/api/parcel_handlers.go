package api

import (
	"net/http"
	"regexp"
	"strconv"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/gin-gonic/gin"

	"dpms/backend/internal/apperr"
	"dpms/backend/internal/store"
)

const (
	defaultPageSize = 20
	maxPageSize     = 100
	maxQueryLen     = 100
	maxNoteLen      = 500
	maxCheckOut     = 100
	recentCheckIns  = 10
	maxRoomHits     = 20
)

// Barcode values are printable ASCII without spaces. They are stored upper-cased, which is what
// makes prefix search on the tracking_code index case-insensitive.
var trackingCodePattern = regexp.MustCompile(`^[\x21-\x7E]{1,64}$`)

func normalizeTrackingCode(raw string) (string, *apperr.Error) {
	code := strings.ToUpper(strings.TrimSpace(raw))
	if code == "" {
		return "", apperr.Validation("trackingCode", "required")
	}
	if !trackingCodePattern.MatchString(code) {
		return "", apperr.Validation("trackingCode", "invalid_format")
	}
	return code, nil
}

var unmatchedReasons = map[string]bool{"no_match": true, "no_resident": true, "ambiguous": true, "other": true}
var parcelStatuses = map[string]bool{"pending": true, "picked_up": true, "archived": true}

// --- query-string parsing ----------------------------------------------------------------------

func parsePaging(c *gin.Context) (page, size int, err *apperr.Error) {
	page, size = 1, defaultPageSize
	if v := c.Query("page"); v != "" {
		n, e := strconv.Atoi(v)
		if e != nil || n < 1 {
			return 0, 0, apperr.Validation("page", "must_be_positive_integer")
		}
		page = n
	}
	if v := c.Query("pageSize"); v != "" {
		n, e := strconv.Atoi(v)
		if e != nil || n < 1 || n > maxPageSize {
			return 0, 0, apperr.Validation("pageSize", "must_be_between_1_and_100")
		}
		size = n
	}
	return page, size, nil
}

func parseSearchText(c *gin.Context, key string) (string, *apperr.Error) {
	q := strings.TrimSpace(c.Query(key))
	if utf8.RuneCountInString(q) > maxQueryLen {
		return "", apperr.Validation(key, "too_long")
	}
	return q, nil
}

func parseID(raw, field string) (int64, *apperr.Error) {
	n, err := strconv.ParseInt(raw, 10, 64)
	if err != nil || n < 1 {
		return 0, apperr.Validation(field, "must_be_positive_integer")
	}
	return n, nil
}

func bindBody(c *gin.Context, dst any) *apperr.Error {
	if err := c.ShouldBindJSON(dst); err != nil {
		return apperr.Validation("body", "invalid_json")
	}
	return nil
}

// --- Check-In ----------------------------------------------------------------------------------

type checkInRequest struct {
	TrackingCode    string  `json:"trackingCode"`
	RoomID          *int64  `json:"roomId"`
	ResidentID      *int64  `json:"residentId"`
	UnmatchedReason *string `json:"unmatchedReason"`
	Note            *string `json:"note"`
}

// checkIn records one incoming Parcel. The room must be a directory room (roomId), or the Parcel is
// parked with an unmatchedReason — never a guessed or free-text room.
func (h *handlers) checkIn(c *gin.Context) {
	var req checkInRequest
	if e := bindBody(c, &req); e != nil {
		fail(c, e)
		return
	}
	code, e := normalizeTrackingCode(req.TrackingCode)
	if e != nil {
		fail(c, e)
		return
	}

	switch {
	case req.RoomID != nil && req.UnmatchedReason != nil:
		fail(c, apperr.Validation("unmatchedReason", "not_allowed_with_roomId"))
		return
	case req.RoomID == nil && req.UnmatchedReason == nil:
		fail(c, apperr.Validation("roomId", "required"))
		return
	case req.RoomID != nil && *req.RoomID < 1:
		fail(c, apperr.Validation("roomId", "must_be_positive_integer"))
		return
	case req.UnmatchedReason != nil && !unmatchedReasons[*req.UnmatchedReason]:
		fail(c, apperr.Validation("unmatchedReason", "invalid_value"))
		return
	case req.ResidentID != nil && req.RoomID == nil:
		fail(c, apperr.Validation("residentId", "requires_roomId"))
		return
	}

	var note *string
	if req.Note != nil {
		if n := strings.TrimSpace(*req.Note); n != "" {
			if utf8.RuneCountInString(n) > maxNoteLen {
				fail(c, apperr.Validation("note", "too_long"))
				return
			}
			note = &n
		}
	}

	parcel, err := h.Store.CheckIn(c.Request.Context(), currentStaff(c).ID, store.CheckInInput{
		TrackingCode:    code,
		RoomID:          req.RoomID,
		ResidentID:      req.ResidentID,
		UnmatchedReason: req.UnmatchedReason,
		Note:            note,
	})
	if err != nil {
		fail(c, err)
		return
	}
	c.JSON(http.StatusCreated, parcel)
}

// --- Check-Out ---------------------------------------------------------------------------------

type checkOutRequest struct {
	TrackingCodes []string `json:"trackingCodes"`
}

type checkOutAllRequest struct {
	ExpectedCount *int `json:"expectedCount"`
}

type checkOutResponse struct {
	CheckedOutCount int            `json:"checkedOutCount"`
	Parcels         []store.Parcel `json:"parcels"`
}

// checkOut is "Check Out Selected": the listed Parcels, all-or-nothing.
func (h *handlers) checkOut(c *gin.Context) {
	var req checkOutRequest
	if e := bindBody(c, &req); e != nil {
		fail(c, e)
		return
	}
	if len(req.TrackingCodes) == 0 || len(req.TrackingCodes) > maxCheckOut {
		fail(c, apperr.Validation("trackingCodes", "must_have_1_to_100_items"))
		return
	}

	seen := make(map[string]bool, len(req.TrackingCodes))
	codes := make([]string, 0, len(req.TrackingCodes))
	for _, raw := range req.TrackingCodes {
		code, e := normalizeTrackingCode(raw)
		if e != nil {
			fail(c, apperr.Validation("trackingCodes", "invalid_format"))
			return
		}
		if !seen[code] {
			seen[code] = true
			codes = append(codes, code)
		}
	}

	parcels, err := h.Store.CheckOut(c.Request.Context(), currentStaff(c).ID, codes)
	if err != nil {
		fail(c, err)
		return
	}
	c.JSON(http.StatusOK, checkOutResponse{CheckedOutCount: len(parcels), Parcels: parcels})
}

// checkOutAll is "Check Out All": every Pending Parcel of one room in a single action.
func (h *handlers) checkOutAll(c *gin.Context) {
	roomID, e := parseID(c.Param("roomId"), "roomId")
	if e != nil {
		fail(c, e)
		return
	}
	var req checkOutAllRequest
	if c.Request.ContentLength != 0 {
		if e := bindBody(c, &req); e != nil {
			fail(c, e)
			return
		}
	}
	if req.ExpectedCount != nil && *req.ExpectedCount < 1 {
		fail(c, apperr.Validation("expectedCount", "must_be_positive_integer"))
		return
	}

	parcels, err := h.Store.CheckOutAll(c.Request.Context(), currentStaff(c).ID, roomID, req.ExpectedCount)
	if err != nil {
		fail(c, err)
		return
	}
	c.JSON(http.StatusOK, checkOutResponse{CheckedOutCount: len(parcels), Parcels: parcels})
}

type assignRoomRequest struct {
	RoomID *int64 `json:"roomId"`
}

// assignRoom resolves an unmatched Parcel by giving it a directory room.
func (h *handlers) assignRoom(c *gin.Context) {
	code, e := normalizeTrackingCode(c.Param("trackingCode"))
	if e != nil {
		fail(c, e)
		return
	}
	var req assignRoomRequest
	if e := bindBody(c, &req); e != nil {
		fail(c, e)
		return
	}
	if req.RoomID == nil || *req.RoomID < 1 {
		fail(c, apperr.Validation("roomId", "required"))
		return
	}

	parcel, err := h.Store.AssignRoom(c.Request.Context(), currentStaff(c).ID, code, *req.RoomID)
	if err != nil {
		fail(c, err)
		return
	}
	c.JSON(http.StatusOK, parcel)
}

// --- Search & Lookup ---------------------------------------------------------------------------

func (h *handlers) getParcel(c *gin.Context) {
	code, e := normalizeTrackingCode(c.Param("trackingCode"))
	if e != nil {
		fail(c, e)
		return
	}
	detail, err := h.Store.GetParcel(c.Request.Context(), code)
	if err != nil {
		fail(c, err)
		return
	}
	c.JSON(http.StatusOK, detail)
}

// listParcels serves Search & Lookup and the Check-Out room view: q matches Tracking Code (prefix),
// Room Number (prefix) or Resident name/nickname; always paginated.
func (h *handlers) listParcels(c *gin.Context) {
	page, size, e := parsePaging(c)
	if e != nil {
		fail(c, e)
		return
	}
	q, e := parseSearchText(c, "q")
	if e != nil {
		fail(c, e)
		return
	}

	f := store.ParcelFilter{Query: q, Page: page, PageSize: size}

	if v := c.Query("status"); v != "" {
		if !parcelStatuses[v] {
			fail(c, apperr.Validation("status", "invalid_value"))
			return
		}
		f.Status = v
	}
	if v := c.Query("roomId"); v != "" {
		id, e := parseID(v, "roomId")
		if e != nil {
			fail(c, e)
			return
		}
		f.RoomID = &id
	}
	if v := c.Query("unmatched"); v != "" {
		b, err := strconv.ParseBool(v)
		if err != nil {
			fail(c, apperr.Validation("unmatched", "must_be_boolean"))
			return
		}
		f.Unmatched = &b
	}
	if v := c.Query("unmatchedReason"); v != "" {
		if !unmatchedReasons[v] {
			fail(c, apperr.Validation("unmatchedReason", "invalid_value"))
			return
		}
		f.UnmatchedReason = v
	}
	for key, dst := range map[string]**time.Time{"from": &f.From, "to": &f.To} {
		if v := c.Query(key); v != "" {
			t, err := time.Parse(time.RFC3339, v)
			if err != nil {
				fail(c, apperr.Validation(key, "must_be_rfc3339"))
				return
			}
			*dst = &t
		}
	}

	result, err := h.Store.ListParcels(c.Request.Context(), f)
	if err != nil {
		fail(c, err)
		return
	}
	c.JSON(http.StatusOK, result)
}

// searchRooms backs the Room Number autocomplete on Check-In.
func (h *handlers) searchRooms(c *gin.Context) {
	q, e := parseSearchText(c, "q")
	if e != nil {
		fail(c, e)
		return
	}
	limit := 10
	if v := c.Query("limit"); v != "" {
		n, err := strconv.Atoi(v)
		if err != nil || n < 1 || n > maxRoomHits {
			fail(c, apperr.Validation("limit", "must_be_between_1_and_20"))
			return
		}
		limit = n
	}
	hits, err := h.Store.SearchRooms(c.Request.Context(), q, limit)
	if err != nil {
		fail(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"items": hits})
}

func (h *handlers) listDirectory(c *gin.Context) {
	page, size, e := parsePaging(c)
	if e != nil {
		fail(c, e)
		return
	}
	q, e := parseSearchText(c, "q")
	if e != nil {
		fail(c, e)
		return
	}
	result, err := h.Store.ListDirectory(c.Request.Context(), q, page, size)
	if err != nil {
		fail(c, err)
		return
	}
	c.JSON(http.StatusOK, result)
}

// --- Dashboard & audit -------------------------------------------------------------------------

// dashboard returns the day's counts. The day is a calendar day in dormitory local time.
func (h *handlers) dashboard(c *gin.Context) {
	loc := h.Location
	date := time.Now().In(loc).Format("2006-01-02")
	if v := c.Query("date"); v != "" {
		date = v
	}
	start, err := time.ParseInLocation("2006-01-02", date, loc)
	if err != nil {
		fail(c, apperr.Validation("date", "must_be_yyyy_mm_dd"))
		return
	}
	end := start.AddDate(0, 0, 1)

	d, err := h.Store.Dashboard(c.Request.Context(), date, start, end, recentCheckIns)
	if err != nil {
		fail(c, err)
		return
	}
	c.JSON(http.StatusOK, d)
}

func (h *handlers) listAccessLogs(c *gin.Context) {
	page, size, e := parsePaging(c)
	if e != nil {
		fail(c, e)
		return
	}
	result, err := h.Store.ListAccessLogs(c.Request.Context(), page, size)
	if err != nil {
		fail(c, err)
		return
	}
	c.JSON(http.StatusOK, result)
}
