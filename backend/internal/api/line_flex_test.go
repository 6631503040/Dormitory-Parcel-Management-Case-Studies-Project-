package api

// Internal (white-box) test for the LINE "Check Parcel" Flex card: it needs direct access to the
// unexported pendingParcelsCard/flexInfoRow builders, unlike line_test.go's black-box webhook tests.

import (
	"encoding/json"
	"strings"
	"testing"
	"time"

	"dpms/backend/internal/store"
)

func TestPendingParcelsCard_NoButtonsAndNoCourierInfo(t *testing.T) {
	h := &handlers{Deps{Location: time.UTC}}
	checkedIn := time.Date(2026, 9, 5, 3, 0, 0, 0, time.UTC)
	msg := h.pendingParcelsCard("3", "101", []store.PendingParcelItem{
		{TrackingCode: "TH1610727515", CheckedInAt: checkedIn},
		{TrackingCode: "SPX5667898839", CheckedInAt: checkedIn},
	})

	if msg["type"] != "flex" {
		t.Fatalf("type = %v, want flex", msg["type"])
	}
	altText, _ := msg["altText"].(string)
	if !strings.Contains(altText, "3101") || !strings.Contains(altText, "TH1610727515") || !strings.Contains(altText, "SPX5667898839") {
		t.Fatalf("altText = %q, missing room or tracking codes", altText)
	}

	// Round-trip through JSON the same way the real Reply call would, then inspect the raw
	// structure — this is the actual wire shape LINE receives, not just the Go map we built.
	raw, err := json.Marshal(msg)
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}
	body := string(raw)

	if strings.Contains(body, `"footer"`) {
		t.Fatalf("card must not have a footer (buttons): %s", body)
	}
	if strings.Contains(strings.ToLower(body), "action") {
		t.Fatalf("card must not contain any tappable action: %s", body)
	}
	for _, courierWord := range []string{"บริษัทขนส่ง", "courier", "ABC"} {
		if strings.Contains(body, courierWord) {
			t.Fatalf("card must never include courier identity (%q found): %s", courierWord, body)
		}
	}
	if !strings.Contains(body, "TH1610727515") || !strings.Contains(body, "SPX5667898839") {
		t.Fatalf("card body must list every pending parcel's tracking code: %s", body)
	}
	if !strings.Contains(body, "2026-09-05") {
		t.Fatalf("card body must show each parcel's arrival date: %s", body)
	}
}

func TestPendingParcelsCard_ContentMatchesCount(t *testing.T) {
	h := &handlers{Deps{Location: time.UTC}}
	msg := h.pendingParcelsCard("1", "507", []store.PendingParcelItem{
		{TrackingCode: "ONLY-ONE", CheckedInAt: time.Now()},
	})
	altText, _ := msg["altText"].(string)
	if !strings.Contains(altText, "1 ชิ้น") {
		t.Fatalf("altText = %q, want it to report a count of 1", altText)
	}
}
