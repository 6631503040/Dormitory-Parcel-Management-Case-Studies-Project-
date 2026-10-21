package line

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"testing"
)

func sign(secret string, body []byte) string {
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write(body)
	return base64.StdEncoding.EncodeToString(mac.Sum(nil))
}

func TestVerifySignature(t *testing.T) {
	secret := "test-channel-secret"
	body := []byte(`{"events":[]}`)
	valid := sign(secret, body)

	if !VerifySignature(secret, body, valid) {
		t.Fatal("expected a correctly signed body to verify")
	}
	if VerifySignature(secret, body, sign("wrong-secret", body)) {
		t.Fatal("signature computed with the wrong secret must not verify")
	}
	if VerifySignature(secret, []byte(`{"events":[],"tampered":true}`), valid) {
		t.Fatal("a signature for one body must not verify a different body")
	}
	if VerifySignature(secret, body, "") {
		t.Fatal("an empty signature header must never verify")
	}
	if VerifySignature("", body, valid) {
		t.Fatal("an empty channel secret must never verify")
	}
	if VerifySignature(secret, body, "not-base64!!") {
		t.Fatal("a non-base64 signature header must not verify")
	}
}

func TestParseWebhookBody(t *testing.T) {
	raw := []byte(`{"events":[
		{"type":"message","replyToken":"rt1","source":{"userId":"U1"},"message":{"type":"text","text":"1101"}},
		{"type":"postback","replyToken":"rt2","source":{"userId":"U2"},"postback":{"data":"action=check_parcel"}}
	]}`)
	body, err := ParseWebhookBody(raw)
	if err != nil {
		t.Fatalf("parse: %v", err)
	}
	if len(body.Events) != 2 {
		t.Fatalf("events = %d, want 2", len(body.Events))
	}
	if body.Events[0].Message == nil || body.Events[0].Message.Text != "1101" {
		t.Fatalf("event[0] message = %+v", body.Events[0].Message)
	}
	if body.Events[1].Postback == nil || body.Events[1].Postback.Data != "action=check_parcel" {
		t.Fatalf("event[1] postback = %+v", body.Events[1].Postback)
	}
}
