# Test Summary Report — Parcel Desk (DPMS-TP-002)

| | |
|---|---|
| วันที่ทดสอบ | 16 พฤศจิกายน 2026 (regression รอบที่ 2) |
| Build ที่ทดสอบ | `9344cff` (main, PR #44) — branch `Fix-UI` (`67b599b`) มี source ของ backend, db และ client ตรงกันทุกไฟล์ |
| สภาพแวดล้อม | แยกจากระบบใช้งานทั้งหมด: PostgreSQL 16 บน tmpfs ที่ `127.0.0.1:15432` (`docker/docker-compose.test.yml`), API + client ที่ `:18080`, ข้อมูลจำลองจาก `cmd/seed` |
| ผลรายเคสและ UAT | `docs/03-test/Test-Result-Report.docx` (DPMS-TR-001) หัวข้อ 3 และ 5 |
| ผู้ทดสอบ | Software Tester ของทีม (รันด้วย Claude Code) |
| เอกสารอ้างอิง | Test Plan `docs/Test-Plan.docx` (v1.8, เฉพาะแผนและเคส), **ผลรายเคสทั้ง 64 เคส: `docs/03-test/Test-Result-Report.docx` (DPMS-TR-001)**, defect log `docs/03-test/defects.md` |

## 1. สรุปสำหรับผู้บริหาร

- **ยังไม่ผ่าน exit criteria** เพราะมี defect ระดับ **Critical ที่ยังเปิดอยู่ 2 รายการ** (DEF-002 นำพัสดุต่างห้องออกในคำขอเดียวได้, QA-08 OTP เก่าใช้ลงทะเบียนหลังย้ายออกได้) และยังมีเคส Blocked 9 เคสที่ต้องใช้เครื่องสแกนหรือโทรศัพท์จริง
- เคสที่ Fail ในรอบที่ 1 ทั้ง 3 เคส **ยัง Fail อยู่** บน build ปัจจุบัน (TC25, TC35, TC43) ไม่มีเคสไหนถูกแก้ระหว่างรอบ
- พบ defect ใหม่ 2 รายการ: ช่องโหว่ Go standard library ที่โค้ดเรียกถึง (DEF-004) และ `TRUNCATE` ข้าม trigger append-only ได้ (DEF-005)
- ส่วนที่แข็งแรง: ชุดทดสอบอัตโนมัติผ่านทั้งหมด, RBAC ถูกต้องทุก endpoint, ไม่มีข้อมูลสูญหาย/ซ้ำภายใต้โหลด, backup/restore ใช้งานได้, accessibility scan ไม่พบปัญหาระดับ serious/critical
- UAT: ความพึงพอใจผ่านเป้า (SUS ≥ 68, TAM ≥ 4) ทั้งสองกลุ่ม ค่า SUS ของ Staff ที่รายงานไว้เดิม (81.25) นับคนซ้ำ ค่าหลักคือ **คำตอบแรกหลัง session = 77.5** ตรงกับผล UAT ของทีม (`results/20261102-uat/`) (หัวข้อ 5)

## 2. ผลรวมตามประเภทการทดสอบ

| ประเภท | เครื่องมือ | ผล | หลักฐาน |
|---|---|---|---|
| Unit + integration (backend) | `go test -race` + PostgreSQL จริง | **ผ่าน 54/54** top-level tests (52 เดิม + 2 RBAC ใหม่), ไม่มี skip; `go vet` ผ่าน | `logs/go-test.jsonl`, `logs/go-vet.log` |
| Unit (frontend) | Vitest + Testing Library + MSW | **ผ่าน 159/159** tests, 16 files | `logs/vitest.log` |
| Coverage | Go `-coverpkg`, Vitest v8 | Go **70.8%** ทั้งหมด / **79.2%** เฉพาะ `internal/` (api 81.9, store 81.9, auth 93.9, push 77.5); Frontend statements **72.0%**, branches 68.9%, functions 65.4%, lines 74.5% | `logs/go-cover.txt`, `logs/vitest-coverage/` |
| Security — RBAC matrix (ใหม่) | Go integration | **ผ่าน 23 routes** × (ไม่ login, operator, admin, Staff cookie บน route ของ Resident, token ปลอม) และ operator สร้างบัญชี admin ไม่ได้ | `backend/internal/api/rbac_matrix_test.go` |
| Security — dependency | govulncheck 1.9.0, npm audit | Go: **1 finding ที่โค้ดเรียกถึง** (GO-2026-6859 → DEF-004) + 1 module-only (GO-2026-5932, เดิม); npm: **0** ทั้ง full และ production | `logs/govulncheck-findings.json`, `logs/npm-audit*.json` |
| End-to-end (ใหม่) | Playwright, Chromium / Firefox / Pixel 7 | **ผ่าน 11**, ยืนยัน defect เปิด **3** (TC25, TC35, TC43) | `logs/playwright.json`, `logs/playwright.log` |
| Accessibility (ใหม่) | axe-core (WCAG 2.1 A/AA) + keyboard | 4 หน้า (login, dashboard, Check-In dialog, Resident) **ไม่พบ violation เลย**; Check-In ใช้คีย์บอร์ดได้ครบ (TC47 ขั้น 1–2) | `e2e/a11y.spec.js` |
| Compatibility | Playwright | Chromium desktop, Firefox desktop, Chromium มือถือ (Pixel 7) ผ่าน smoke; **WebKit/Safari ไม่ได้ทดสอบ** (เครื่องขาด system library ต้องใช้ `sudo`); iOS จริงไม่ได้ทดสอบ | `logs/playwright.json` |
| Load — spike (ใหม่) | `tools/load_profile.py` | ผ่าน: 0 error, ข้อมูลครบ (หัวข้อ 4) | `logs/load-spike.json` |
| Load — soak (ใหม่) | `tools/load_profile.py` | ผ่าน: 515,928 requests ใน 30 นาที **0 error**, ข้อมูลครบ; ค้นหาช้าลงตามปริมาณข้อมูล (หัวข้อ 4) | `logs/load-soak.json` |
| Backup / restore (ใหม่) | `pg_dump -Fc` / `pg_restore` | ผ่าน (หัวข้อ 4) | หัวข้อ 4 |
| Compliance (ใหม่) | SQL probe ใน transaction ที่ rollback | append-only ทำงานกับ UPDATE/DELETE; **TRUNCATE ข้ามได้** (DEF-005) | หัวข้อ 4 |

## 3. Regression รอบที่ 2 — เคสที่ Fail/Blocked ในรอบที่ 1

ขอบเขต: รันซ้ำ 12 เคสที่ไม่ผ่านในรอบที่ 1 ส่วน **52 เคสที่ผ่านในรอบที่ 1 ไม่ได้รันซ้ำทีละเคสด้วยมือ** หลักฐาน regression ของกลุ่มนี้คือชุดอัตโนมัติในหัวข้อ 2 ที่รันบน build เดียวกัน

| TC | รอบ 1 (`4782b57`) | รอบ 2 (`9344cff`) | หมายเหตุ |
|---|---|---|---|
| TC25 | Fail | **Fail** | คิวพัสดุไม่มีห้องเรียงใหม่สุดก่อน (DEF-001) |
| TC35 | Fail | **Fail** | นำออกรหัสจากห้อง 1101 + 1102 ในคำขอเดียวได้ 200 (DEF-002, Critical) |
| TC43 | Fail | **Fail** | ระบบล่มแสดงเป็นหน้า login ไม่มีข้อความ error (DEF-003) |
| TC07, TC08, TC09 | Blocked | Blocked | ไม่มีเครื่องสแกนจริง (เส้นทางพิมพ์ + Enter ผ่านใน E2E) |
| TC46, TC52, TC55 | Blocked | Blocked | ต้องใช้โทรศัพท์ที่ลงทะเบียนจริง |
| TC47 | Blocked | Blocked | ขั้น 1–2 ผ่านแบบอัตโนมัติแล้ว เหลือขั้น 3 (Thai IME จริง) |
| TC56 | Blocked | Blocked | retry / gone / cancel ผ่านด้วย fake push; ยังไม่ได้จำลองการส่งซ้ำ/สลับลำดับ |
| TC60 | Blocked | Blocked | ยังไม่มีหน้า Directory (US-27) |

**สถานะรวม TC01–TC64 หลังรอบที่ 2: 52 Pass / 3 Fail / 9 Blocked** (เท่ารอบที่ 1)

## 4. Non-functional

**Spike** (closed-loop ไม่มี think time = กรณีหนักกว่าการใช้งานจริง, ฐานข้อมูลมีประมาณ 18,000–25,000 Parcels ระหว่างรัน, 180 วินาที):

| ช่วง | sessions | requests | p50 ms | p95 ms | p99 ms | error |
|---|---:|---:|---:|---:|---:|---:|
| baseline | 5 | 18,640 | 3.4 | 77.3 | 84.2 | 0 |
| spike | 50 | 21,368 | 108.4 | 341.1 | 392.3 | 0 |
| recovery | 5 | 15,128 | 3.5 | 95.3 | 101.3 | 0 |

- ช่วง spike ทุก endpoint p95 < 1 s (ช้าที่สุดคือค้นหาด้วยรหัส 392 ms) และ Check-In p95 146 ms < 2 s
- กลับสู่ระดับปกติทันทีหลัง spike; ค้นหาช้าลงเล็กน้อยระหว่างรอบ (82 → 100 ms) ตามจำนวนข้อมูลที่เพิ่มขึ้น ตรงกับข้อสังเกตเรื่อง unified code search ในรายงาน performance 4 พ.ย.
- ความถูกต้อง: สร้าง 6,892 Parcels ไม่ซ้ำ; สุ่มตรวจ 200 รายการ ทุกรายการ Picked Up และมี audit event checked_in 1 + checked_out 1

**Soak** (รันซ้ำ 17 พ.ย. หลังรอบแรกถูกหยุด; 10 sessions, 30 นาที, closed-loop ไม่มี think time, ฐานข้อมูลเริ่ม 5,000 → จบ 69,491 Parcels):

| ช่วง | requests | p50 ms | p95 ms | p99 ms | error |
|---|---:|---:|---:|---:|---:|
| 0–5 นาที | 179,475 | 4.6 | 82.3 | 124.5 | 0 |
| 10–15 นาที | 74,693 | 4.6 | 218.6 | 277.9 | 0 |
| 25–30 นาที | 49,976 | 4.8 | 335.4 | 423.5 | 0 |

- ไม่มี error ตลอด 515,928 requests; สร้าง 64,491 Parcels ไม่ซ้ำ; สุ่มตรวจ 200 รายการครบทั้งสถานะและ audit event
- ตลอดการรัน p95 ของ Check-In 4.7 ms, Check-Out 4.2 ms, รายละเอียด 3.4 ms, dashboard 39.7 ms คงที่ ส่วน **ค้นหาด้วยรหัส (p95 336 ms) และชื่อ (293 ms) ช้าลงเรื่อย ๆ ตามจำนวนข้อมูล** ทำให้ p95 รวมและ throughput เปลี่ยนตามเวลา
- หน่วยความจำ API หลังจบ 33 MB ไม่พบสัญญาณ memory leak
- **ข้อสังเกต (OBS-02):** เวลาค้นหาโตตามจำนวน Parcels ที่ 69k ยังต่ำกว่า 1 s แต่ปริมาณจริงประมาณ 150k Parcels/ปี ควรติดตามและพิจารณา index สำหรับ unified search ก่อนข้อมูลถึงระดับนั้น (สอดคล้องกับรายงาน performance 4 พ.ย.)

**Backup / restore** (ทำระหว่างที่มีโหลดเขียนอยู่): dump 1.3 MB ใช้ 0.64 s, restore 0.93 s; จำนวนแถวหลัง restore อยู่ระหว่างค่าก่อนและหลัง dump (snapshot สอดคล้องกัน); ไม่มี Picked Up ที่ขาด event นำออก และไม่มี event กำพร้า; trigger append-only มาครบ; เปิดแอปบนฐานที่ restore แล้ว login และเรียก dashboard ได้

**Compliance** (ตาม `rule.md`):

| ข้อกำหนด | ผล |
|---|---|
| Audit trail append-only (chain of custody) | UPDATE/DELETE บน `parcel_events` และ `access_logs` ถูกปฏิเสธ; **TRUNCATE ผ่านได้** → DEF-005 |
| ทุก event ผูกกับ Staff | `parcel_events` 52,491 แถว staff_id ว่าง 0 แถว |
| Computer Crime Act §26: เก็บ log ≥ 90 วัน | ไม่มีโค้ดหรือ job ใดลบ `access_logs` (ตรวจ source); ทุก login มี username, ผลลัพธ์, IP — **บน Render ยังเห็นแต่ IP ของ proxy** (OPS-01) |
| ห้ามลบ Parcel | DELETE ถูก FK ของ audit trail กันไว้ |
| PDPA consent | `push_subscriptions.consent_version` และ `resident_otp_challenges.consent_version` เป็น NOT NULL |
| PDPA สิทธิ์ของเจ้าของข้อมูล (เข้าถึง/แก้ไข/ลบ) | Resident ดูสถานะและยกเลิกการแจ้งเตือนเองได้; การแก้/ลบข้อมูลในทะเบียนทำผ่าน Admin CSV import — **ยังไม่มีขั้นตอนรับคำขอจากเจ้าของข้อมูลที่เขียนไว้** ต้องเพิ่มเป็นขั้นตอนปฏิบัติ ไม่ได้ทดสอบ |

## 5. UAT — ผลหลังทำความสะอาดข้อมูล

ไฟล์ต้นฉบับไม่ถูกแก้ ไฟล์ที่ทำความสะอาดแล้วเก็บไว้ **นอก repo** (มีข้อมูลผู้เข้าร่วม): `Parcel Desk – UAT results (DPMS-TP-002) – cleaned 2026-11-16.xlsx` มี sheet `Cleaning log` อธิบายทุกการเปลี่ยนแปลง

**ปัญหาที่พบและวิธีแก้**

1. Staff responses มี 8 แถวจาก 5 คน (U01, U02 ตอบ 2 พ.ย. และ 4 พ.ย.; U04 ตอบ 2 ครั้งห่าง 3 นาที) → เก็บคนละ 1 แถว
2. เวลา `0.0` ของวิธีเดิมใน UAT07/UAT10 (10 แถว) → `N/A` เพราะวิธีเดิมไม่มีขั้นตอนนี้; `0.0` ของระบบใหม่ (R05 UAT07, UAT10) → ข้อมูลหาย
3. Build ว่างหรือ `-` ในแถววิธีเดิม 50 แถว → `N/A (existing method)`; แถวระบบใหม่มี build ครบ
4. Staff ทดสอบบน **2 build**: U01, U02 บน `7dc4587` ส่วน U03–U05 บน `9344cff` (frontend ต่างกันที่ Check-Out room search และสถานะชำรุด) → เวลา UAT01/UAT04/UAT06 เทียบข้ามคนได้ไม่เต็มที่
5. R05 UAT09 วิธีเดิม = Fail แต่ไม่มีบันทึกหรือ defect ID; บันทึกการสังเกตหลายแถวยังมีหมายเหตุ `[ต้องยืนยัน: …]` ค้างอยู่ (แก้ไข 17 พ.ย.: UAT-D02 และ UAT-D06 มีอยู่ใน task record จริง ข้อความเดิมที่ว่า D02 ไม่ปรากฏนั้นผิด)

**SUS และ TAM** (n = 5 ต่อกลุ่ม — ผลเชิงบ่งชี้ ไม่ใช่ผลทางสถิติ)

| กลุ่ม | กติกา | SUS mean (SD, min–max) | PU | PEOU | BI |
|---|---|---|---|---|---|
| Staff | เดิม: ทุกแถว (n = 8, นับคนซ้ำ) | 81.25 (9.82, 67.5–92.5) | 4.72 | 4.47 | 4.33 |
| Staff | **หลัก: คำตอบแรกหลัง session** (ตรงกับ `results/20261102-uat/`) | **77.5 (10.61, 67.5–92.5)** | 4.60 | 4.45 | 4.33 |
| Staff | ทดสอบความไว: คำตอบล่าสุดของแต่ละคน | 87.5 (4.68, 82.5–92.5) | 4.95 | 4.65 | 4.33 |
| Resident | ไม่มีคำตอบซ้ำ | **76.5 (10.69, 57.5–82.5)** | 4.80 | 4.50 | 4.33 |

กติกาที่เลือกเปลี่ยนค่า SUS ของ Staff ได้ 10 คะแนน ค่าหลักใช้ **คำตอบแรกหลัง session** ตามผล UAT ของทีม และแสดงคำตอบล่าสุดไว้คู่กันเพื่อความโปร่งใส ทั้งสองกติกาผ่านเป้า SUS ≥ 68 และ TAM ≥ 4

**เวลาทำงาน (วินาที, mean ของระบบใหม่ เทียบวิธีเดิม)**

| Task | ระบบใหม่ | วิธีเดิม | ส่วนต่าง paired (SD) | สำเร็จ | หมายเหตุ |
|---|---|---|---|---|---|
| UAT01 Scanner Check-In | 47.4 | 23.6 | +23.8 (25.4) | 5/5 | **ช้ากว่าเดิม**; U01 ใช้ 87 s บน build เก่า (UAT-D01); บน `9344cff` ยังช้ากว่า ~8 s |
| UAT02 Manual fallback | 24.8 | 22.4 | +2.4 (4.6) | 5/5 | |
| UAT03 Pending lookup | 9.2 | 5.6 | +3.6 (3.9) | 5/5 | ช้ากว่าเล็กน้อย |
| UAT04 Selective collection | 31.8 | 24.8 | +7.0 (16.6) | 5/5 | U01/U02 หาช่องเลขห้องไม่เจอ (UAT-D03 แก้แล้ว) |
| UAT05 Full-room collection | 38.8 | 47.6 | −8.8 (22.1) | 5/5 | |
| UAT06 Collection evidence | 3.6 | 35.8 | **−32.2** (4.0) | 4/5 | Fail 1: สถานะชำรุดแสดงผิด (UAT-D05) |
| UAT07 Resident registration | 17.5 (n=4) | N/A | — | 5/5 | |
| UAT08 Parcel arrival | 9.4 | 11.2 | −1.8 (2.8) | 5/5 | |
| UAT09 Pickup update | 9.4 | 29.0 | **−19.6** (5.8) | 5/5 | |
| UAT10 Turn off notifications | 7.0 (n=4) | N/A | — | 5/5 | |

ทุก task ผู้เข้าร่วมทำสำเร็จโดยไม่ต้องช่วย ≥ 4/5 ตามเป้า ระบบใหม่เร็วกว่าชัดเจนในงานหาหลักฐานและติดตามสถานะ แต่ **Check-In ช้ากว่าวิธีเดิม** ควรรายงานตรง ๆ พร้อมสาเหตุ

**Feedback → backlog**: R01 "อยากให้รีเฟรชหน้าจออัตโนมัติ" — หน้า Resident รีเฟรชเองอยู่แล้วขณะเปิด จึงต้องถาม R01 ว่าเห็นอะไร (หน้าไม่ได้เปิดอยู่ หรือรอบรีเฟรชช้าเกิน) ก่อนเปิดเป็น backlog item

## 6. Exit criteria (Test Plan หัวข้อ 6)

| เกณฑ์ | ผล | เหตุผล |
|---|---|---|
| Cases TC01–TC64 ผ่าน | ❌ | 3 Fail, 9 Blocked (Blocked ไม่นับเป็นผ่าน) |
| ข้อมูลและสิทธิ์: ไม่มีส่งผิดห้อง/ข้อมูลหาย/เปิดเผยข้ามห้อง, ไม่มี Critical/High ค้าง | ❌ | DEF-002 และ QA-08 (Critical) ยังเปิด |
| Notifications ถึงเครื่องใน 90 s | ⚠️ ยังไม่ได้ตรวจ | ต้องใช้โทรศัพท์จริง (TC52, TC55) |
| Scanner 10 รหัสตรงทั้งหมด | ⚠️ ยังไม่ได้ตรวจ | ไม่มีเครื่องสแกน (TC07–TC09) |
| UAT 5 + 5 sessions, ≥ 4/5 unassisted ต่อ task, retest หลังแก้ | ⚠️ บางส่วน | sessions และ unassisted ผ่าน; retest: UAT-D03 และ UAT-D05 ผ่าน, UAT-D01 ยังเปิด |
| Performance TC64 (Check-In p95 < 2 s, search < 1 s) | ✅ | รอบ 1 ผ่าน และ spike 50 sessions ยังผ่าน |
| SUS ≥ 68, TAM ≥ 4 | ✅ | Staff 77.5 (คำตอบล่าสุด 87.5), Resident 76.5; TAM ทุก construct ≥ 4.33 |

## 7. สิ่งที่ไม่ได้ทดสอบ และเหตุผล

| สิ่งที่ไม่ได้ทดสอบ | เหตุผล | ต้องทำอะไร |
|---|---|---|
| เครื่องสแกนบาร์โค้ดจริง (TC07–TC09) | ไม่มีอุปกรณ์ | ยืมเครื่องสแกนของโครงการ + label N01–N10 |
| Web Push ถึงโทรศัพท์จริง, offline, iOS PWA (TC46, TC52, TC55) | ไม่มีโทรศัพท์ลงทะเบียนผ่าน HTTPS | ใช้ Android + iPhone (ติดตั้ง PWA ลงหน้าจอโฮม) ผ่าน tunnel HTTPS |
| Safari / WebKit | `npx playwright install-deps` ต้องใช้ `sudo` บนเครื่องนี้ | รัน `sudo npx playwright install-deps webkit` แล้วเพิ่ม project `webkit` |
| Thai IME จริง (TC47 ขั้น 3) | headless browser ไม่มี IME | ทดสอบมือบนเครื่องที่มีแป้นพิมพ์ไทย |
| หน้า Directory (TC60) | ยังไม่ได้สร้าง (US-27) | รอ feature |
| การตั้งค่า Render (`TRUSTED_PROXIES`, TLS, secrets) | ไม่มีสิทธิ์เข้า dashboard | เจ้าของ Render ตรวจ OPS-01 |
| CI job ใหม่ (`e2e`, `vulns`, coverage, audit) บน GitHub Actions | ยังไม่ได้ push; รันเทียบเท่าในเครื่องแล้วผ่าน | push branch แล้วดูผล CI |
| QA-08 รันซ้ำ | ใช้ผลยืนยันวันที่ 2 พ.ย. บน `9344cff` (backend ไม่เปลี่ยนตั้งแต่นั้น) | รันซ้ำหลังแก้ |
| 52 เคสที่ผ่านในรอบ 1 แบบทีละเคส | ใช้ชุดอัตโนมัติเป็นหลักฐาน regression แทน | ถ้าต้องการหลักฐานรายเคส ให้รันมือบน build สุดท้ายก่อนส่ง |

## 8. ข้อเสนอลำดับงานถัดไป

1. แก้ **DEF-002** และ **QA-08** (Critical) แล้วรัน TC35 + QA-08 ซ้ำ
2. อัปเกรด Go เป็น 1.26.11 (DEF-004) แล้วเอา `continue-on-error` ออกจาก job `vulns`
3. แก้ DEF-003 และ UAT-D01
5. นัดทดสอบอุปกรณ์จริง (เครื่องสแกน, Android, iPhone) เพื่อปิด 8 เคส Blocked
6. รันรอบสุดท้ายบน build ที่จะส่ง แล้วลงนาม exit criteria
