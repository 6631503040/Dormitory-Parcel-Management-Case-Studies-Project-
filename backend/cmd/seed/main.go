// Command seed fills the database with synthetic data: the dormitory can't share production data,
// so the resident directory, Staff accounts and Parcels are generated. Development/demo use only.
package main

import (
	"context"
	"encoding/json"
	"flag"
	"fmt"
	"log"
	"math/rand/v2"
	"os"
	"time"
	_ "time/tzdata"

	"github.com/jackc/pgx/v5"

	"dpms/backend/internal/auth"
	"dpms/backend/internal/config"
	"dpms/backend/internal/db"
)

var firstNames = []string{
	"สมชาย", "สมหญิง", "ณัฐพล", "พิมพ์ชนก", "กันตพงศ์", "อารียา", "ธีรภัทร", "ชญานิษฐ์", "วรวุฒิ", "ปวีณา",
	"กิตติพงษ์", "สุภาวดี", "อนุชา", "วิภาวี", "ภูมิพัฒน์", "ศิริพร", "นภัสสร", "ธนกร", "รุ่งนภา", "ปิยะพงษ์",
	"จิราพร", "อภิชาติ", "มนัสนันท์", "พีรพัฒน์", "ณัฐธิดา", "วัชรพล", "กมลชนก", "สิรวิชญ์", "ชนิดา", "ปัณณวัฒน์",
}

var lastNames = []string{
	"ใจดี", "สุขใจ", "แสงทอง", "วงศ์ไพร", "คงสวัสดิ์", "มั่นคง", "เพชรรัตน์", "ศรีสุข", "บุญมี", "จันทร์เพ็ญ",
	"ทองดี", "รักษา", "พึ่งบุญ", "สุวรรณ", "ประเสริฐ", "เจริญสุข", "มณีรัตน์", "ภักดี", "ชัยมงคล", "แก้วมณี",
	"พงษ์ไทย", "อินทร์แก้ว", "ศักดิ์สิทธิ์", "นามวงศ์", "เรืองศรี", "สายทอง", "ดวงดี", "วัฒนากุล", "ธรรมรักษ์", "ปัญญาดี",
}

var nicknames = []string{"แนน", "บอส", "ฟ้า", "ปูเป้", "มายด์", "โอ๊ต", "เจ", "ไอซ์", "กุ๊กไก่", "ต้น", "แพร", "เบส"}

var unmatchedReasons = []string{"no_match", "no_resident", "ambiguous", "other"}
var codePrefixes = []string{"TH", "SPX", "KEX", "FLS"}

const (
	buildingCount = 10
	floors        = 5
	roomsPerFloor = 10
)

type staffSeed struct{ username, fullName, role string }

func main() {
	parcelCount := flag.Int("parcels", 1000, "number of synthetic Parcels to create")
	reset := flag.Bool("reset", false, "wipe every table first (development only)")
	flag.Parse()

	if os.Getenv("APP_ENV") == "production" {
		log.Fatal("seed refuses to run with APP_ENV=production: it creates accounts with a known password")
	}
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("config: %v", err)
	}
	password := os.Getenv("SEED_PASSWORD")
	if password == "" {
		password = "parcel1234"
	}

	ctx := context.Background()
	pool, err := db.Connect(ctx, cfg.DatabaseURL, cfg.DBMaxConns)
	if err != nil {
		log.Fatalf("database: %v", err)
	}
	defer pool.Close()
	if err := db.Migrate(ctx, pool, cfg.MigrationsDir); err != nil {
		log.Fatalf("migrate: %v", err)
	}

	if *reset {
		if _, err := pool.Exec(ctx, `TRUNCATE parcel_events, parcels, access_logs, residents, rooms, buildings, staff RESTART IDENTITY CASCADE`); err != nil {
			log.Fatalf("reset: %v", err)
		}
	} else {
		var n int
		if err := pool.QueryRow(ctx, `SELECT count(*) FROM buildings`).Scan(&n); err != nil {
			log.Fatalf("check: %v", err)
		}
		if n > 0 {
			log.Println("database already has data; nothing to do (use -reset to start over)")
			return
		}
	}

	rng := rand.New(rand.NewPCG(20260921, 1))
	tx, err := pool.Begin(ctx)
	if err != nil {
		log.Fatal(err)
	}
	defer tx.Rollback(ctx) //nolint:errcheck

	staffIDs, err := seedStaff(ctx, tx, password)
	if err != nil {
		log.Fatalf("staff: %v", err)
	}
	roomIDs, err := seedDirectory(ctx, tx, rng)
	if err != nil {
		log.Fatalf("directory: %v", err)
	}
	if err := seedParcels(ctx, tx, rng, *parcelCount, roomIDs, staffIDs); err != nil {
		log.Fatalf("parcels: %v", err)
	}
	if err := tx.Commit(ctx); err != nil {
		log.Fatal(err)
	}

	fmt.Printf("seeded: %d buildings, %d rooms, %d parcels\n", buildingCount, len(roomIDs), *parcelCount)
	fmt.Printf("staff logins (development only): admin / somsri / prasert — password %q\n", password)
}

func seedStaff(ctx context.Context, tx pgx.Tx, password string) ([]int64, error) {
	hash, err := auth.HashPassword(password)
	if err != nil {
		return nil, err
	}
	accounts := []staffSeed{
		{"admin", "Admin", "admin"},
		{"somsri", "Somsri Rattanakul", "operator"},
		{"prasert", "Prasert Boonmee", "operator"},
	}
	var operatorIDs []int64
	for _, a := range accounts {
		var id int64
		if err := tx.QueryRow(ctx,
			`INSERT INTO staff (username, password_hash, full_name, role) VALUES ($1, $2, $3, $4::text::staff_role) RETURNING id`,
			a.username, hash, a.fullName, a.role).Scan(&id); err != nil {
			return nil, err
		}
		if a.role == "operator" {
			operatorIDs = append(operatorIDs, id)
		}
	}
	return operatorIDs, nil
}

// seedDirectory creates buildings 1..10, their rooms and residents. The same nicknames recur
// across many rooms, which is exactly the "label says a nickname that matches several rooms"
// problem. A room's full resident-facing number is building+floor+room concatenated with no
// separator (building 3, floor 1, room 01 -> "3101") — building codes are plain digits, no "B".
func seedDirectory(ctx context.Context, tx pgx.Tx, rng *rand.Rand) ([]int64, error) {
	var roomIDs []int64
	for b := 1; b <= buildingCount; b++ {
		var buildingID int64
		if err := tx.QueryRow(ctx, `INSERT INTO buildings (code, name) VALUES ($1, $2) RETURNING id`,
			fmt.Sprintf("%d", b), fmt.Sprintf("Building %d", b)).Scan(&buildingID); err != nil {
			return nil, err
		}
		for f := 1; f <= floors; f++ {
			for n := 1; n <= roomsPerFloor; n++ {
				var roomID int64
				if err := tx.QueryRow(ctx, `INSERT INTO rooms (building_id, room_number) VALUES ($1, $2) RETURNING id`,
					buildingID, fmt.Sprintf("%d%02d", f, n)).Scan(&roomID); err != nil {
					return nil, err
				}
				roomIDs = append(roomIDs, roomID)

				residents := 1
				if rng.Float64() < 0.3 {
					residents = 2
				}
				for i := 0; i < residents; i++ {
					name := firstNames[rng.IntN(len(firstNames))] + " " + lastNames[rng.IntN(len(lastNames))]
					var nick *string
					if rng.Float64() < 0.4 {
						s := nicknames[rng.IntN(len(nicknames))]
						nick = &s
					}
					if _, err := tx.Exec(ctx, `INSERT INTO residents (room_id, full_name, nickname) VALUES ($1, $2, $3)`,
						roomID, name, nick); err != nil {
						return nil, err
					}
				}
			}
		}
	}
	return roomIDs, nil
}

func seedParcels(ctx context.Context, tx pgx.Tx, rng *rand.Rand, count int, roomIDs, staffIDs []int64) error {
	loc, err := time.LoadLocation("Asia/Bangkok")
	if err != nil {
		return err
	}
	now := time.Now()
	local := now.In(loc)
	todayStart := time.Date(local.Year(), local.Month(), local.Day(), 0, 0, 0, 0, loc)
	const day = 24 * time.Hour

	unmatched := max(3, count/50)
	used := map[string]bool{}
	newCode := func() string {
		for {
			c := fmt.Sprintf("%s%010d", codePrefixes[rng.IntN(len(codePrefixes))], rng.Int64N(10_000_000_000))
			if !used[c] {
				used[c] = true
				return c
			}
		}
	}
	pickStaff := func() int64 { return staffIDs[rng.IntN(len(staffIDs))] }

	for i := 0; i < count; i++ {
		isUnmatched := i < unmatched
		roll := rng.Float64()
		dayOffset := 2 + rng.IntN(5)
		switch {
		case isUnmatched:
			dayOffset = i % 2
		case roll < 0.45:
			dayOffset = 0
		case roll < 0.65:
			dayOffset = 1
		}

		var receivedAt time.Time
		if dayOffset == 0 {
			receivedAt = todayStart.Add(time.Duration(rng.Float64() * float64(now.Sub(todayStart))))
		} else {
			receivedAt = todayStart.Add(-time.Duration(dayOffset)*day + 7*time.Hour + time.Duration(rng.Float64()*float64(10*time.Hour)))
		}
		checkedInBy := pickStaff()

		var roomID *int64
		var reason *string
		if isUnmatched {
			r := unmatchedReasons[i%len(unmatchedReasons)]
			reason = &r
		} else {
			id := roomIDs[rng.IntN(len(roomIDs))]
			roomID = &id
		}

		pickChance := 0.9
		if dayOffset == 0 {
			pickChance = 0.35
		} else if dayOffset == 1 {
			pickChance = 0.75
		}
		latest := receivedAt.Add(3 * day)
		if latest.After(now) {
			latest = now
		}
		var outAt *time.Time
		var outBy *int64
		if !isUnmatched && latest.Sub(receivedAt) > 2*time.Minute && rng.Float64() < pickChance {
			t := receivedAt.Add(time.Minute + time.Duration(rng.Float64()*float64(latest.Sub(receivedAt)-time.Minute)))
			s := pickStaff()
			outAt, outBy = &t, &s
		}
		status := "pending"
		if outAt != nil {
			status = "picked_up"
		}

		var parcelID int64
		if err := tx.QueryRow(ctx,
			`INSERT INTO parcels (tracking_code, room_id, unmatched_reason, status, checked_in_by, checked_in_at, checked_out_by, checked_out_at, created_at, updated_at)
			 VALUES ($1, $2, $3::text::unmatched_reason, $4::text::parcel_status, $5, $6::timestamptz, $7, $8::timestamptz, $6::timestamptz, COALESCE($8::timestamptz, $6::timestamptz)) RETURNING id`,
			newCode(), roomID, reason, status, checkedInBy, receivedAt, outBy, outAt).Scan(&parcelID); err != nil {
			return err
		}

		detail := map[string]any{}
		if roomID != nil {
			detail["roomId"] = *roomID
		}
		if reason != nil {
			detail["unmatchedReason"] = *reason
		}
		if err := seedEvent(ctx, tx, parcelID, "checked_in", checkedInBy, receivedAt, detail); err != nil {
			return err
		}
		if outAt != nil {
			eventType := "checked_out"
			if rng.Float64() < 0.3 {
				eventType = "checked_out_bulk"
			}
			if err := seedEvent(ctx, tx, parcelID, eventType, *outBy, *outAt, nil); err != nil {
				return err
			}
		}
	}
	return nil
}

func seedEvent(ctx context.Context, tx pgx.Tx, parcelID int64, eventType string, staffID int64, at time.Time, detail map[string]any) error {
	var raw []byte
	if len(detail) > 0 {
		var err error
		if raw, err = json.Marshal(detail); err != nil {
			return err
		}
	}
	_, err := tx.Exec(ctx,
		`INSERT INTO parcel_events (parcel_id, event_type, staff_id, occurred_at, detail) VALUES ($1, $2::text::parcel_event_type, $3, $4, $5::jsonb)`,
		parcelID, eventType, staffID, at, raw)
	return err
}
