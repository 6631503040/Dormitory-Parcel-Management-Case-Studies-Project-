// Command vapidkeys prints a fresh VAPID key pair for Web Push, in the env-var form docker/.env
// expects. Run once per deployment; keep the private key secret. Rotating it invalidates every
// existing browser subscription (Residents would have to register again).
package main

import (
	"fmt"
	"log"

	"dpms/backend/internal/push"
)

func main() {
	pub, priv, err := push.GenerateKeys()
	if err != nil {
		log.Fatal(err)
	}
	fmt.Printf("VAPID_PUBLIC_KEY=%s\nVAPID_PRIVATE_KEY=%s\n", pub, priv)
}
