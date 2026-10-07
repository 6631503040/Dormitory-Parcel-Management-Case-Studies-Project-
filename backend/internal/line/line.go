// Package line implements the minimal LINE Messaging API surface DPMS needs: verifying inbound
// webhook signatures, parsing events, and sending reply messages. It knows nothing about parcels,
// rooms or OTPs — that logic lives in the api package's LINE handlers.
package line

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"time"
)

const defaultReplyEndpoint = "https://api.line.me/v2/bot/message/reply"

// VerifySignature checks the X-Line-Signature header against the raw request body, per LINE's
// webhook-signature spec: HMAC-SHA256 of the exact request body, keyed by the channel secret,
// base64-encoded. Comparison happens on the decoded bytes with hmac.Equal (constant-time).
func VerifySignature(channelSecret string, body []byte, signatureHeader string) bool {
	if channelSecret == "" || signatureHeader == "" {
		return false
	}
	mac := hmac.New(sha256.New, []byte(channelSecret))
	mac.Write(body)
	expected := mac.Sum(nil)
	got, err := base64.StdEncoding.DecodeString(signatureHeader)
	if err != nil {
		return false
	}
	return hmac.Equal(expected, got)
}

// --- inbound webhook payload (only the fields DPMS reads) ---------------------------------------

type WebhookBody struct {
	Events []Event `json:"events"`
}

type Event struct {
	Type       string    `json:"type"` // "message" or "postback"
	ReplyToken string    `json:"replyToken"`
	Source     Source    `json:"source"`
	Message    *Message  `json:"message,omitempty"`
	Postback   *Postback `json:"postback,omitempty"`
}

type Source struct {
	UserID string `json:"userId"`
}

type Message struct {
	Type string `json:"type"` // "text", "sticker", "image", ...
	Text string `json:"text"`
}

type Postback struct {
	Data string `json:"data"`
}

func ParseWebhookBody(raw []byte) (WebhookBody, error) {
	var b WebhookBody
	err := json.Unmarshal(raw, &b)
	return b, err
}

// --- outbound reply -------------------------------------------------------------------------------

// OutgoingMessage is one entry of the Messaging API's `messages` array — any JSON object with at
// least a "type" field. Build one with TextMessage or FlexMessage rather than constructing the map
// by hand.
type OutgoingMessage = map[string]any

// TextMessage is a plain chat message.
func TextMessage(text string) OutgoingMessage {
	return OutgoingMessage{"type": "text", "text": text}
}

// FlexMessage wraps a Flex "bubble" (or carousel) container for a richer reply (e.g. a parcel-status
// card). altText is required by the Messaging API — it's what push notifications and clients that
// can't render Flex show instead.
func FlexMessage(altText string, contents map[string]any) OutgoingMessage {
	return OutgoingMessage{"type": "flex", "altText": altText, "contents": contents}
}

// Client sends replies via the LINE Messaging API. Endpoint defaults to the real LINE reply URL;
// tests override it to point at a local httptest server instead of calling the network.
type Client struct {
	AccessToken string
	Endpoint    string
	HTTPClient  *http.Client
}

func NewClient(accessToken string) *Client {
	return &Client{
		AccessToken: accessToken,
		Endpoint:    defaultReplyEndpoint,
		HTTPClient:  &http.Client{Timeout: 5 * time.Second},
	}
}

// Reply sends up to 5 messages back on a single reply token. Reply tokens are single-use and
// expire quickly, matching how one webhook delivery is handled synchronously.
func (c *Client) Reply(ctx context.Context, replyToken string, messages ...OutgoingMessage) error {
	if c == nil || c.AccessToken == "" {
		return errors.New("line: access token not configured")
	}
	if len(messages) == 0 {
		return nil
	}
	payload, err := json.Marshal(map[string]any{"replyToken": replyToken, "messages": messages})
	if err != nil {
		return err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.Endpoint, bytes.NewReader(payload))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+c.AccessToken)
	resp, err := c.HTTPClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 300 {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("line: reply failed %d: %s", resp.StatusCode, body)
	}
	return nil
}
