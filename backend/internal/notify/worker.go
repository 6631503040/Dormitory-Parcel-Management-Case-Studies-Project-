// Package notify delivers queued Web Push notifications (the push_notifications outbox) in the
// background. Check-In only writes the outbox row; everything network-related happens here, so a
// slow or unreachable push service never touches the desk workflow (ET-04).
package notify

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"strconv"
	"time"

	"dpms/backend/internal/push"
	"dpms/backend/internal/store"
)

const (
	defaultInterval = 10 * time.Second
	claimBatch      = 50
	claimLease      = 2 * time.Minute // a job a crashed worker leased comes back after this
	maxAttempts     = 5
	baseBackoff     = 30 * time.Second
	messageTTL      = 24 * time.Hour // a phone that's off overnight still gets it in the morning
)

// Payload is the JSON the service worker receives. It carries machine values only — the PWA's
// service worker turns them into Thai text (backend never sends user-facing strings), and it holds
// no Tracking Codes or names: the push service relays it, even though it can't read it (US-10/LR-03).
type Payload struct {
	Type         string `json:"type"` // "parcel_arrived"
	Room         string `json:"room"` // full Room Number, building+room, e.g. "3101"
	NewCount     int64  `json:"newCount"`
	PendingCount int64  `json:"pendingCount"`
	URL          string `json:"url"`
}

type Worker struct {
	Store    *store.Store
	Sender   *push.Sender
	Interval time.Duration
	Now      func() time.Time
}

// Run polls until ctx is cancelled.
func (w *Worker) Run(ctx context.Context) {
	interval := w.Interval
	if interval <= 0 {
		interval = defaultInterval
	}
	t := time.NewTicker(interval)
	defer t.Stop()
	for {
		if _, err := w.RunOnce(ctx); err != nil && ctx.Err() == nil {
			log.Printf("push worker: %v", err)
		}
		select {
		case <-ctx.Done():
			return
		case <-t.C:
		}
	}
}

// RunOnce delivers every notification that is due right now; returns how many it handled.
func (w *Worker) RunOnce(ctx context.Context) (int, error) {
	handled := 0
	for {
		jobs, err := w.Store.ClaimDuePushes(ctx, claimBatch, claimLease)
		if err != nil {
			return handled, err
		}
		for _, j := range jobs {
			if err := w.deliver(ctx, j); err != nil {
				return handled, err
			}
			handled++
		}
		if len(jobs) < claimBatch {
			return handled, nil
		}
	}
}

func (w *Worker) now() time.Time {
	if w.Now != nil {
		return w.Now()
	}
	return time.Now()
}

func (w *Worker) deliver(ctx context.Context, j store.PushJob) error {
	// Everything in the batch was already picked up before we got to it: nothing to say.
	if j.NewPending == 0 {
		return w.Store.FinishPush(ctx, j.ID, store.PushCancelled, 0, "")
	}
	body, err := json.Marshal(Payload{
		Type:         "parcel_arrived",
		Room:         j.BuildingCode + j.RoomNumber,
		NewCount:     j.NewPending,
		PendingCount: j.TotalPending,
		URL:          "/resident/",
	})
	if err != nil {
		return err
	}

	sendCtx, cancel := context.WithTimeout(ctx, 15*time.Second)
	res, sendErr := w.Sender.Send(sendCtx, push.Subscription{Endpoint: j.Endpoint, P256dh: j.P256dh, Auth: j.Auth}, body,
		push.Options{TTL: messageTTL, Topic: "room-" + strconv.FormatInt(j.RoomID, 10)})
	cancel()

	switch {
	case sendErr == nil && res.OK():
		return w.Store.FinishPush(ctx, j.ID, store.PushSent, res.Status, "")
	case sendErr == nil && res.Gone():
		// The browser dropped the subscription (unsubscribed, uninstalled, permission revoked).
		if err := w.Store.Unsubscribe(ctx, j.SubscriptionID, "gone"); err != nil {
			return err
		}
		return w.Store.FinishPush(ctx, j.ID, store.PushFailed, res.Status, "subscription gone")
	case sendErr == nil && !res.Retryable():
		// 400/401/403/413: our request is wrong for this subscription; retrying won't fix it.
		return w.Store.FinishPush(ctx, j.ID, store.PushFailed, res.Status, "rejected by push service")
	}

	msg := ""
	if sendErr != nil {
		msg = truncate(sendErr.Error(), 300) // network error text only; never contains payload or keys
	} else {
		msg = fmt.Sprintf("push service returned %d", res.Status)
	}
	if j.Attempts >= maxAttempts {
		return w.Store.FinishPush(ctx, j.ID, store.PushFailed, res.Status, msg)
	}
	backoff := baseBackoff << (j.Attempts - 1) // 30s, 1m, 2m, 4m
	return w.Store.RetryPush(ctx, j.ID, w.now().Add(backoff), res.Status, msg)
}

func truncate(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n]
}
