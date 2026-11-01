// Command createadmin creates an Admin account directly in the database. Run it once when the system
// is installed at a dormitory, to get the first Admin; from then on Admins register everyone else
// in the app. Unlike seed, it is safe in production: it creates only the one account you name.
//
//	createadmin -username manager -fullname "ผู้จัดการหอพัก"   (password read from stdin)
//
// The password can also come from CREATEADMIN_PASSWORD, for scripted installs.
package main

import (
	"bufio"
	"context"
	"flag"
	"fmt"
	"log"
	"os"
	"strings"

	"dpms/backend/internal/auth"
	"dpms/backend/internal/config"
	"dpms/backend/internal/db"
	"dpms/backend/internal/store"
)

func main() {
	username := flag.String("username", "", "login name: 3-32 characters, a-z 0-9 . _ -")
	fullName := flag.String("fullname", "", "name shown in the app")
	flag.Parse()

	password := os.Getenv("CREATEADMIN_PASSWORD")
	if password == "" {
		fmt.Fprint(os.Stderr, "Password (8+ characters): ")
		line, err := bufio.NewReader(os.Stdin).ReadString('\n')
		if err != nil && line == "" {
			log.Fatal("no password given")
		}
		password = strings.TrimRight(line, "\r\n")
	}

	u := strings.ToLower(strings.TrimSpace(*username))
	name := strings.TrimSpace(*fullName)
	if e := store.ValidateNewStaff(u, name, password, store.RoleAdmin); e != nil {
		log.Fatalf("invalid %v: %v", e.Params["field"], e.Params["reason"])
	}

	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("config: %v", err)
	}
	ctx := context.Background()
	pool, err := db.Connect(ctx, cfg.DatabaseURL, cfg.DBMaxConns)
	if err != nil {
		log.Fatalf("database: %v", err)
	}
	defer pool.Close()

	hash, err := auth.HashPassword(password)
	if err != nil {
		log.Fatal(err)
	}
	st, err := store.New(pool).CreateStaff(ctx, store.NewStaff{Username: u, PasswordHash: hash, FullName: name, Role: store.RoleAdmin})
	if err != nil {
		log.Fatalf("create admin: %v", err)
	}
	fmt.Printf("created Admin %q (id %d)\n", st.Username, st.ID)
}
