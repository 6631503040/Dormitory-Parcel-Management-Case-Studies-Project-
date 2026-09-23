// Package apperr defines the stable machine codes the API returns. The backend never sends
// user-facing text; the frontend maps each code to a message (design-spec §5).
package apperr

import (
	"errors"
	"net/http"
)

const (
	Internal              = "INTERNAL_ERROR"
	NotFound              = "NOT_FOUND"
	ValidationError       = "VALIDATION_ERROR"
	Unauthenticated       = "UNAUTHENTICATED"
	InvalidCredentials    = "INVALID_CREDENTIALS"
	Forbidden             = "FORBIDDEN"
	UnsupportedMediaType  = "UNSUPPORTED_MEDIA_TYPE"
	RoomNotInDirectory    = "ROOM_NOT_IN_DIRECTORY"
	ResidentNotInRoom     = "RESIDENT_NOT_IN_ROOM"
	DuplicateTrackingCode = "DUPLICATE_TRACKING_CODE"
	ParcelNotFound        = "PARCEL_NOT_FOUND"
	ParcelNotPending      = "PARCEL_NOT_PENDING"
	ParcelHasRoom         = "PARCEL_HAS_ROOM"
	NoPendingParcels      = "NO_PENDING_PARCELS"
	PendingCountChanged   = "PENDING_COUNT_CHANGED"
	AmbiguousRoom         = "AMBIGUOUS_ROOM"
	NoPendingLineOTP      = "NO_PENDING_LINE_OTP"
	LineNotConfigured     = "LINE_NOT_CONFIGURED"
)

var statusByCode = map[string]int{
	Internal:              http.StatusInternalServerError,
	NotFound:              http.StatusNotFound,
	ValidationError:       http.StatusBadRequest,
	Unauthenticated:       http.StatusUnauthorized,
	InvalidCredentials:    http.StatusUnauthorized,
	Forbidden:             http.StatusForbidden,
	UnsupportedMediaType:  http.StatusUnsupportedMediaType,
	RoomNotInDirectory:    http.StatusUnprocessableEntity,
	ResidentNotInRoom:     http.StatusUnprocessableEntity,
	DuplicateTrackingCode: http.StatusConflict,
	ParcelNotFound:        http.StatusNotFound,
	ParcelNotPending:      http.StatusConflict,
	ParcelHasRoom:         http.StatusConflict,
	NoPendingParcels:      http.StatusNotFound,
	PendingCountChanged:   http.StatusConflict,
	AmbiguousRoom:         http.StatusUnprocessableEntity,
	NoPendingLineOTP:      http.StatusNotFound,
	LineNotConfigured:     http.StatusServiceUnavailable,
}

// Error is returned by the store and handlers; the API layer renders it as {code, params}.
type Error struct {
	Code   string         `json:"code"`
	Params map[string]any `json:"params,omitempty"`
}

func (e *Error) Error() string { return e.Code }

func New(code string, params map[string]any) *Error { return &Error{Code: code, Params: params} }

func Validation(field, reason string) *Error {
	return New(ValidationError, map[string]any{"field": field, "reason": reason})
}

// HTTPStatus maps a code to its HTTP status (500 for anything unknown).
func HTTPStatus(code string) int {
	if s, ok := statusByCode[code]; ok {
		return s
	}
	return http.StatusInternalServerError
}

// As extracts an *Error from err, if there is one.
func As(err error) (*Error, bool) {
	var e *Error
	if errors.As(err, &e) {
		return e, true
	}
	return nil, false
}
