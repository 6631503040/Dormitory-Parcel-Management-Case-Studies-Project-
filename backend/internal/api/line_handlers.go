package api

import (
	"context"
	"fmt"
	"io"
	"log"
	"net/http"
	"regexp"
	"strings"
	"time"

	"github.com/gin-gonic/gin"

	"dpms/backend/internal/apperr"
	"dpms/backend/internal/line"
	"dpms/backend/internal/store"
)

// lineEventProcessingTimeout bounds the background work triggered by one webhook delivery (DB
// queries plus the outbound LINE reply call).
const lineEventProcessingTimeout = 10 * time.Second

// The "Check Parcel" rich-menu button (US-08) triggers on either of these, because LINE Official
// Account Manager's rich-menu editor (the simplified, no-code one — Messaging API console is
// separate) only offers action types Link / Coupon / Text / Point card, no raw Postback. Set the
// button's action to "ข้อความ" (Text) with the exact text lineCheckParcelKeyword — that sends it as
// a normal message, indistinguishable from the resident typing it. linePostbackCheckParcel stays
// supported too, for a rich menu built via the Messaging API (POST /v2/bot/richmenu) instead.
const (
	lineCheckParcelKeyword  = "เช็คพัสดุ"
	linePostbackCheckParcel = "action=check_parcel"
)

var lineOTPPattern = regexp.MustCompile(`^\d{6}$`)

// Card colors — reused from the frontend's own design tokens (shared.jsx: C.primary, C.success,
// C.warning) so a resident's LINE chat and staff's web UI read as the same product.
const (
	lineColorInfo    = "#4285F4" // primary — action needed, nothing wrong
	lineColorSuccess = "#188038" // success — linked / confirmed
	lineColorWarning = "#D93025" // warning — rejected, wrong, locked, expired
	lineColorNeutral = "#757575" // neutral — plain status, nothing to do
)

func (h *handlers) lineClient() *line.Client {
	c := line.NewClient(h.LineChannelAccessToken)
	if h.LineReplyEndpoint != "" {
		c.Endpoint = h.LineReplyEndpoint
	}
	return c
}

// lineWebhook receives every event for the dorm's official LINE account: the "Check Parcel"
// rich-menu button (US-08) and the room-claim/OTP conversation that links a LINE account to a
// room (US-11). LINE expects a fast 200 response — failures here are logged, not surfaced to the
// sender, so a broken reply call never makes LINE retry-storm the webhook.
func (h *handlers) lineWebhook(c *gin.Context) {
	if h.LineChannelSecret == "" {
		fail(c, apperr.New(apperr.LineNotConfigured, nil))
		return
	}
	raw, err := io.ReadAll(c.Request.Body)
	if err != nil {
		fail(c, apperr.Validation("body", "unreadable"))
		return
	}
	if !line.VerifySignature(h.LineChannelSecret, raw, c.GetHeader("X-Line-Signature")) {
		fail(c, apperr.New(apperr.Unauthenticated, nil))
		return
	}
	body, err := line.ParseWebhookBody(raw)
	if err != nil {
		fail(c, apperr.Validation("body", "invalid_json"))
		return
	}

	// Acknowledge LINE immediately and flush the response now — event handling below can involve a
	// DB round trip plus an outbound call to LINE's reply API, and c.Request.Context() is torn down
	// as soon as the client (LINE, via whatever tunnel/proxy sits in front of us in dev) considers
	// the request done. Tying that work to c.Request.Context() let a slow reply get silently
	// cancelled mid-flight even after we'd already committed to a 200. Processing runs in the
	// background on a context detached from the request, so a closed client connection can't cancel
	// it — the client already got its 200 and moved on.
	c.Status(http.StatusOK)
	c.Writer.Flush()

	client := h.lineClient()
	events := body.Events
	go func() {
		ctx, cancel := context.WithTimeout(context.Background(), lineEventProcessingTimeout)
		defer cancel()
		for _, ev := range events {
			h.handleLineEvent(ctx, client, ev)
		}
	}()
}

func (h *handlers) handleLineEvent(ctx context.Context, client *line.Client, ev line.Event) {
	userID := ev.Source.UserID
	if userID == "" || ev.ReplyToken == "" {
		return
	}
	switch {
	case ev.Type == "postback" && ev.Postback != nil && ev.Postback.Data == linePostbackCheckParcel:
		h.replyParcelStatus(ctx, client, ev.ReplyToken, userID)

	case ev.Type == "message" && ev.Message != nil && ev.Message.Type == "text":
		text := strings.TrimSpace(ev.Message.Text)
		switch {
		case text == lineCheckParcelKeyword:
			h.replyParcelStatus(ctx, client, ev.ReplyToken, userID)
		case lineOTPPattern.MatchString(text):
			h.handleLineOTPAttempt(ctx, client, ev.ReplyToken, userID, text)
		default:
			h.handleLineRoomClaim(ctx, client, ev.ReplyToken, userID, text)
		}
	}
}

// replyParcelStatus answers the "Check Parcel" button (US-08) with minimal-data content (US-10):
// building, room, count, and each pending parcel's tracking code — nothing else.
func (h *handlers) replyParcelStatus(ctx context.Context, client *line.Client, replyToken, userID string) {
	link, err := h.Store.ActiveLineLink(ctx, userID)
	if err != nil {
		log.Printf("line: active link: %v", err)
		return
	}
	if link == nil {
		h.lineReply(ctx, client, replyToken, lineStatusCard(lineColorInfo, "🔑", "ยังไม่ได้ผูกบัญชี", "", []string{
			"บัญชี LINE นี้ยังไม่ได้เชื่อมกับห้องใด",
			"พิมพ์เลขห้องของคุณเพื่อเริ่มยืนยันตัวตน เช่น 3101",
		}))
		return
	}
	pending, err := h.Store.PendingParcelSummary(ctx, link.RoomID)
	if err != nil {
		log.Printf("line: pending summary: %v", err)
		return
	}
	if pending.Count == 0 {
		h.lineReply(ctx, client, replyToken, lineStatusCard(lineColorNeutral, "📭", "ยังไม่มีพัสดุ",
			"ห้อง "+link.BuildingCode+link.RoomNumber, []string{"ยังไม่มีพัสดุรอรับในขณะนี้"}))
		return
	}
	h.lineReply(ctx, client, replyToken, h.pendingParcelsCard(link.BuildingCode, link.RoomNumber, pending.Items))
}

// pendingParcelsCard renders the "Check Parcel" answer as a Flex card (info only, no buttons) —
// building, room, count, and each pending parcel's tracking code + arrival date. Never a courier
// name or any other resident's info (US-10 minimal data).
func (h *handlers) pendingParcelsCard(buildingCode, roomNumber string, items []store.PendingParcelItem) line.OutgoingMessage {
	rows := []map[string]any{
		flexInfoRow("ห้อง", buildingCode+roomNumber),
		flexInfoRow("จำนวน", fmt.Sprintf("%d ชิ้น", len(items))),
		{"type": "separator", "margin": "md"},
	}
	loc := h.Location
	if loc == nil {
		loc = time.UTC
	}
	codes := make([]string, len(items))
	for i, it := range items {
		codes[i] = it.TrackingCode
		rows = append(rows, map[string]any{
			"type":   "box",
			"layout": "vertical",
			"margin": "md",
			"contents": []map[string]any{
				{"type": "text", "text": it.TrackingCode, "size": "sm", "weight": "bold", "wrap": true},
				{"type": "text", "text": "มาถึงเมื่อ " + it.CheckedInAt.In(loc).Format("2006-01-02"), "size": "xs", "color": "#999999"},
			},
		})
	}
	bubble := map[string]any{
		"type":   "bubble",
		"header": flexCardHeader("#FF9F43", "📦", "พัสดุรอรับ"),
		"body":   map[string]any{"type": "box", "layout": "vertical", "spacing": "md", "contents": rows},
	}
	altText := fmt.Sprintf("ห้อง %s%s มีพัสดุรอรับ %d ชิ้น: %s", buildingCode, roomNumber, len(items), strings.Join(codes, ", "))
	return line.FlexMessage(altText, bubble)
}

func flexInfoRow(label, value string) map[string]any {
	return map[string]any{
		"type":   "box",
		"layout": "baseline",
		"contents": []map[string]any{
			{"type": "text", "text": label, "color": "#999999", "size": "sm", "flex": 2},
			{"type": "text", "text": value, "size": "sm", "flex": 5, "weight": "bold", "wrap": true},
		},
	}
}

// flexCardHeader is the colored header every LINE reply card shares: a white icon badge next to a
// bold title, on a colored background. Keeps every reply visually consistent regardless of which
// step of the conversation it answers.
func flexCardHeader(bgColor, icon, title string) map[string]any {
	return map[string]any{
		"type":            "box",
		"layout":          "horizontal",
		"backgroundColor": bgColor,
		"paddingAll":      "16px",
		"spacing":         "md",
		"alignItems":      "center",
		"contents": []map[string]any{
			{
				"type": "box", "layout": "vertical",
				"width": "36px", "height": "36px", "cornerRadius": "18px",
				"backgroundColor": "#FFFFFF", "justifyContent": "center", "alignItems": "center",
				"contents": []map[string]any{
					{"type": "text", "text": icon, "size": "md", "align": "center", "gravity": "center"},
				},
			},
			{"type": "text", "text": title, "color": "#FFFFFF", "weight": "bold", "size": "lg", "gravity": "center", "wrap": true},
		},
	}
}

// lineStatusCard is the shared template for every other LINE reply (link status, OTP prompts,
// errors): a colored header (flexCardHeader) plus a bold subtitle (e.g. the room number, omitted
// when blank) and a short list of plain-language lines — numbered steps read far better as
// separate lines than as one run-on sentence. altText carries the same content for push
// notifications and non-Flex clients.
func lineStatusCard(color, icon, title, subtitle string, lines []string) line.OutgoingMessage {
	body := make([]map[string]any, 0, len(lines)+2)
	if subtitle != "" {
		body = append(body, map[string]any{"type": "text", "text": subtitle, "size": "md", "weight": "bold", "wrap": true})
		body = append(body, map[string]any{"type": "separator", "margin": "md"})
	}
	for i, ln := range lines {
		text := map[string]any{"type": "text", "text": ln, "size": "sm", "wrap": true, "color": "#333333"}
		if i > 0 || subtitle != "" {
			text["margin"] = "md"
		}
		body = append(body, text)
	}
	bubble := map[string]any{
		"type":   "bubble",
		"header": flexCardHeader(color, icon, title),
		"body":   map[string]any{"type": "box", "layout": "vertical", "paddingAll": "16px", "contents": body},
	}
	alt := title
	if subtitle != "" {
		alt += " — " + subtitle
	}
	if len(lines) > 0 {
		alt += ": " + strings.Join(lines, " ")
	}
	return line.FlexMessage(alt, bubble)
}

// handleLineRoomClaim is US-11 step 1–2: a resident claims a room, the system mints a one-time
// code. The code is never sent over LINE — only a staff member reading it out at the desk counts
// as identity verification (step 3).
func (h *handlers) handleLineRoomClaim(ctx context.Context, client *line.Client, replyToken, userID, text string) {
	if text == "" {
		return
	}
	room, err := h.Store.ResolveRoomExact(ctx, text)
	if err != nil {
		if ae, ok := apperr.As(err); ok && (ae.Code == apperr.RoomNotInDirectory || ae.Code == apperr.AmbiguousRoom) {
			h.lineReply(ctx, client, replyToken, lineStatusCard(lineColorWarning, "⚠️", "ไม่พบห้องนี้", "", []string{
				"กรุณาพิมพ์รหัสตึกและเลขห้องให้ถูกต้อง เช่น 3101",
			}))
			return
		}
		log.Printf("line: resolve room: %v", err)
		return
	}

	if _, _, err := h.Store.GenerateLineOTP(ctx, userID, room.ID); err != nil {
		log.Printf("line: generate otp: %v", err)
		return
	}
	h.lineReply(ctx, client, replyToken, lineStatusCard(lineColorInfo, "🔑", "สร้างรหัสยืนยันแล้ว",
		"ห้อง "+room.BuildingCode+room.RoomNumber, []string{
			"1. ไปที่เคาน์เตอร์พัสดุ",
			"2. แจ้งเจ้าหน้าที่ว่าต้องการยืนยันตัวตนผ่าน LINE",
			"3. รับรหัส 6 หลักจากเจ้าหน้าที่",
			"4. พิมพ์รหัสนั้นกลับมาที่แชทนี้ภายใน 5 นาที",
		}))
}

// handleLineOTPAttempt is US-11 step 4: the resident types the code back after staff read it to
// them in person.
func (h *handlers) handleLineOTPAttempt(ctx context.Context, client *line.Client, replyToken, userID, code string) {
	result, err := h.Store.VerifyLineOTP(ctx, userID, code)
	if err != nil {
		log.Printf("line: verify otp: %v", err)
		return
	}
	switch result.Outcome {
	case store.LineOTPMatched:
		h.lineReply(ctx, client, replyToken, lineStatusCard(lineColorSuccess, "✅", "เชื่อมบัญชีสำเร็จ",
			"ห้อง "+result.BuildingCode+result.RoomNumber, []string{
				"กดปุ่ม \"เช็คพัสดุ\" เพื่อดูสถานะได้ทุกเมื่อ",
			}))
	case store.LineOTPMismatch:
		h.lineReply(ctx, client, replyToken, lineStatusCard(lineColorWarning, "❌", "รหัสไม่ถูกต้อง", "", []string{
			"กรุณาตรวจสอบรหัส 6 หลักแล้วลองใหม่อีกครั้ง",
		}))
	case store.LineOTPLocked:
		h.lineReply(ctx, client, replyToken, lineStatusCard(lineColorWarning, "🔒", "ใส่รหัสผิดหลายครั้ง", "", []string{
			"เพื่อความปลอดภัย กรุณาพิมพ์เลขห้องของคุณอีกครั้งเพื่อขอรหัสใหม่",
		}))
	default: // store.LineOTPExpiredOrNone
		h.lineReply(ctx, client, replyToken, lineStatusCard(lineColorWarning, "⏰", "รหัสหมดอายุ", "", []string{
			"ไม่พบรหัสที่รอการยืนยัน หรือรหัสหมดอายุแล้ว",
			"กรุณาพิมพ์เลขห้องของคุณเพื่อขอรหัสใหม่",
		}))
	}
}

func (h *handlers) lineReply(ctx context.Context, client *line.Client, replyToken string, messages ...line.OutgoingMessage) {
	if err := client.Reply(ctx, replyToken, messages...); err != nil {
		log.Printf("line: reply FAILED (token=%s): %v", replyToken, err)
		return
	}
	log.Printf("line: reply OK (token=%s, messages=%d)", replyToken, len(messages))
}

// lineOTPForRoom is the staff-facing counterpart of handleLineRoomClaim: the desk looks up the
// pending code for a room and reads it to the resident. Any authenticated staff member may view
// it — this is the current desk process (whoever is on shift), not an admin-only action.
func (h *handlers) lineOTPForRoom(c *gin.Context) {
	roomID, e := parseID(c.Param("roomId"), "roomId")
	if e != nil {
		fail(c, e)
		return
	}
	view, err := h.Store.PendingLineOTP(c.Request.Context(), currentStaff(c).ID, roomID)
	if err != nil {
		fail(c, err)
		return
	}
	if view == nil {
		fail(c, apperr.New(apperr.NoPendingLineOTP, nil))
		return
	}
	c.JSON(http.StatusOK, view)
}
