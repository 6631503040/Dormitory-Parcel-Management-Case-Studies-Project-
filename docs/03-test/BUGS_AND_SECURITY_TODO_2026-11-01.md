# รายการสิ่งที่ต้องแก้ไข บั๊กและความปลอดภัย (Action Items) — 1 พฤศจิกายน 2026

เอกสารนี้รวบรวมข้อบกพร่องด้านการทำงาน การตรวจสอบข้อมูล และความเสี่ยงด้านความปลอดภัยของ **ParcelHub — Dormitory Parcel Management System** เพื่อส่งให้ทีมพัฒนาพิจารณาแก้ไข ครอบคลุม Frontend, Backend และ dependency ที่ใช้ในโครงการ


**วันที่ตรวจ:** 1 พฤศจิกายน 2026 เอกสารนี้จัดรูปแบบใหม่จากผลตรวจรอบเดิม ไม่ใช่ผลทดสอบรอบใหม่

---

## ผลการแก้ไข (Fix Results) — 1 พฤศจิกายน 2026

แก้บน branch `fix/qa-review-2026-11-01` ทุกข้อมี regression test ที่ **ไม่ผ่านก่อนแก้ และผ่านหลังแก้** (`backend/internal/api/qa_review_test.go`, `Modals.CheckOut.test.jsx`, `errorMessages.test.js`) และทดสอบซ้ำแบบ end-to-end บน Docker image production (`docker/app.Dockerfile`, `APP_ENV=production`)

| ID | ผลก่อนแก้ (ทำซ้ำได้) | ผลหลังแก้ | สิ่งที่แก้ |
|---|---|---|---|
| QA-01 | cookie ที่คัดลอกไว้ใช้ได้หลัง logout (`200`) | ได้ `401`; session อื่นของคนเดิมและของคนอื่นยังใช้ได้ | token รูปแบบ `v2` มี session ID สุ่ม; logout บันทึก ID ลงตารางใหม่ `revoked_sessions` (migration 0008) และทุก request ตรวจตารางนี้ |
| QA-02 | รหัสผิด 25 ครั้งได้ `401` ทุกครั้ง | ครั้งที่ 6 ได้ `429 TOO_MANY_LOGIN_ATTEMPTS` พร้อม `Retry-After`; ทุกครั้งยังบันทึกใน `access_logs`; บัญชีอื่นไม่ถูกกระทบ | limiter ในตัวแอป: 5 ครั้งต่อ (username, IP) ใน 15 นาที; login สำเร็จล้างตัวนับ; หน้าเว็บบอกเวลาที่ต้องรอ |
| QA-03 | `REVIEW/SLASH` รับเข้าได้ `201` แต่เปิดดูได้ `404` | ตอนรับเข้าได้ `400 invalid_format` | ห้าม `/ \ ? # %` และรหัสที่เป็นจุดล้วน (`.` `..`); หน้าเว็บบอกว่าอักขระไหนใช้ไม่ได้; ฐานข้อมูลบน Render ไม่มีรหัสเดิมที่มีอักขระเหล่านี้ (0 รายการ) |
| QA-04 | `page=9223372036854775807` ได้ `500` ทั้ง 3 endpoint | ได้ `400 page too_large`; รับหน้าสูงสุด 100,000 | ตรวจขอบเขต `page` ใน `parsePaging` ซึ่งทั้ง 3 endpoint ใช้ร่วมกัน |
| QA-05 | พิมพ์ช้า 450 ms/ตัว ระบบค้นหาทีละอักษรแล้วล้างช่อง | ข้อความคงอยู่จนกด Enter และขึ้นคำแนะนำ "พิมพ์ครบแล้วกด Enter เพื่อค้นหา"; สแกนเนอร์และการวางรหัสยังส่งอัตโนมัติ | ส่งอัตโนมัติเฉพาะเมื่อทุกตัวอักษรห่างกันไม่เกิน 50 ms (แบบเครื่องสแกน) หรือเป็นการวาง |
| QA-06 | `npm audit` พบ 10 แพ็กเกจ (critical 3) | `npm audit` = **0** (รวม dev) | Vite 5.4 → 6.4.5, Vitest และ @vitest/ui 2.1.9 → 4.1.12, @vitejs/plugin-react 4.7.0; สร้าง lockfile ใหม่ (npm 10.8.2 มีบั๊ก `edgesOut` ตอนอัปเกรด จึงสร้างด้วย npm 11 และยืนยันว่า `npm ci` ของ npm 10 ใช้ได้) |
| QA-07 | govulncheck พบ 18 advisory ที่มี call trace | **0** advisory ที่ถูกเรียกใช้; เหลือ 1 รายการระดับ module (GO-2026-5932 `x/crypto/openpgp` ซึ่งโปรเจกต์ไม่ได้ import และยังไม่มีรุ่นแก้) | Go 1.26.5 → 1.26.10 (`go.mod`; CI ใช้ `go-version-file`, Docker ใช้ `golang:1.26-alpine` ซึ่งเป็น patch ล่าสุด), `x/net` 0.62.0, `quic-go` 0.59.1, `x/crypto` 0.58.0 |

**ผลทดสอบหลังแก้:** Go 44 tests ผ่าน (integration กับ PostgreSQL จริง ไม่มี skip, `go vet` ผ่าน), Vitest 124 tests ผ่าน, production build และ Docker image build ผ่าน

**ยังไม่ได้ทำ / ต้องทำต่อ:**
- ตั้ง `TRUSTED_PROXIES=10.0.0.0/8` บน Render ตอนนี้ทุก request บน Render ถูกบันทึกเป็น IP ของ proxy (`10.x`) ทำให้ limiter ของ QA-02 นับรวมทุกเครื่องต่อ username และ `access_logs.ip_address` ไม่ใช่ IP จริง
- ไม่ได้รัน `-race` ในเครื่องนี้ (ไม่มี cgo) CI รันให้
- QA-05 ทดสอบด้วย Vitest + user-event (หน่วง 450 ms) ยังไม่ได้รัน Playwright บน Chromium จริงซ้ำ และยังไม่ได้ทดสอบกับเครื่องสแกนจริง (TC07–TC09)
- session ที่ออกก่อน deploy (รูปแบบ `v1`) จะใช้ไม่ได้หลัง deploy Staff ต้อง login ใหม่หนึ่งครั้ง

---

## สรุปภาพรวม (Executive Summary)

| ระดับความสำคัญ | จำนวน | ยืนยันพฤติกรรมด้วยการทดสอบ | คำเตือนจากเครื่องมือ | สถานะ |
|---|:---:|:---:|:---:|---|
| 🔴 **High / P1** | 3 | 2 | 1 | แก้แล้ว |
| 🟡 **Medium / P2** | 4 | 3 | 1 | แก้แล้ว |
| 🟢 **Low / Improvement** | 0 | 0 | 0 | ไม่ได้เพิ่มรายการที่ยังไม่มีหลักฐาน |
| **รวมทั้งหมด** | **7** | **5** | **2** | **แก้แล้วทั้ง 7 รายการ (ดูผลการแก้ไขด้านบน)** |

- **P1/P2 เป็นลำดับงานที่เสนอให้ทีมพัฒนา** ไม่ใช่คะแนน CVSS หรือการรับรองว่าโจมตี production ได้
- คำเตือน dependency **2 กลุ่ม** ไม่ใช่ช่องโหว่ 2 รหัส: ฝั่ง npm รายงานแพ็กเกจ 10 รายการ ส่วน Go พบ advisory ไม่ซ้ำ 18 รหัสที่มี call trace เชื่อมกับแอป
- `QA-01` และ `QA-02` มีบันทึกไว้แล้วใน `backend/README.md` ส่วน **Known gaps** รายงานนี้ทดสอบยืนยันข้อจำกัดดังกล่าว ไม่ได้อ้างว่าเป็นการค้นพบใหม่ทั้งหมด
- คงรหัส `QA-01` ถึง `QA-07` ให้ตรงกับรายงาน Word และหลักฐานเดิม แม้จัดลำดับเนื้อหาตามความสำคัญ

รายละเอียดหลักฐานอยู่ใน [สรุปผลแบบ JSON](evidence/results-summary.json), [โฟลเดอร์หลักฐาน](evidence/) และ [รายงาน Word](ParcelHub_Test_and_Security_Review.docx)

---

## 🔴 รายการความเสี่ยงสูง (High / P1)

### [QA-01] Session เดิมยังใช้งานได้หลังออกจากระบบ (Session Revocation)

* **สถานะ:** ✅ แก้แล้ว (1 พ.ย. 2026) — `TestQA01LogoutRevokesCopiedSession`
* **ไฟล์ที่เกี่ยวข้อง:**
  * `backend/internal/api/auth_handlers.go` — ฟังก์ชัน `logout` บรรทัด 81 และ `clearSession` บรรทัด 95
  * `backend/internal/auth/auth.go` — ฟังก์ชัน `Issue` บรรทัด 60 และการตรวจ signed token
  * `backend/README.md` — ส่วน Known gaps
* **สาเหตุ:**
  ระบบใช้ signed session cookie แบบ stateless การ logout ทำเพียงล้าง cookie ในเบราว์เซอร์ แต่ไม่มีสถานะ session ฝั่งเซิร์ฟเวอร์ให้เพิกถอน สำเนา cookie ที่ถูกเก็บไว้ก่อน logout จึงยังผ่านการตรวจลายเซ็นและวันหมดอายุ
* **ผลกระทบ:**
  หากมีผู้ได้สำเนา cookie ไปแล้ว การ logout ไม่ได้ตัดสิทธิ์ของสำเนานั้นทันที ผู้ถือสำเนายังใช้งานด้วยสิทธิ์เจ้าหน้าที่ได้จน token หมดอายุ ทั้งนี้ **การทดสอบไม่ได้พิสูจน์ว่ามีช่องทางขโมย cookie**
* **วิธีทำซ้ำ:**
  1. ล็อกอินด้วยบัญชีทดสอบ `op1` และเก็บสำเนา session cookie ในหน่วยความจำ
  2. เรียก `POST /api/v1/auth/logout`
  3. ใช้ cookie เดิมเรียก `GET /api/v1/auth/me`
* **ผลที่คาดหวัง:** คำขอด้วย session ที่ถูกเพิกถอนควรได้ `401 Unauthorized`
* **ผลจริง:** Logout ได้ `204` แต่คำขอด้วย cookie เดิมยังได้ `200`
* **แนวทางแก้ไข:**
  ใช้ session ID แบบสุ่มที่มีสถานะฝั่งเซิร์ฟเวอร์ และ revoke เมื่อ logout หรือออกแบบ token identifier พร้อม revocation ที่มีอายุครอบคลุม token กำหนดนโยบายเมื่อเปลี่ยนรหัสผ่านหรือปิดบัญชีด้วย
* **หลักฐาน:** [go-review-findings.log](evidence/go-review-findings.log) — `TestReviewLogoutMustRevokeCopiedSession`
* **Checklist:**
  - [x] เลือกแนวทางเก็บและเพิกถอน session ที่ทีมดูแลต่อได้: session ID สุ่มใน token + ตาราง `revoked_sessions` ที่ลบแถวหมดอายุเอง
  - [x] เพิ่มการเพิกถอนฝั่งเซิร์ฟเวอร์เมื่อ logout
  - [x] ตรวจว่า cookie เก่าได้ `401` หลัง logout
  - [x] ตรวจว่า session ใหม่ยังใช้ได้ และ session ของผู้อื่นไม่ถูกยกเลิกโดยไม่ตั้งใจ
  - นโยบายเมื่อปิดบัญชี: ตัดทุก session ทันที (มีอยู่เดิม) ส่วนการเปลี่ยนรหัสผ่านยังไม่มี endpoint ในระบบ

---

### [QA-02] ไม่มีการจำกัดการล็อกอินผิดซ้ำในตัวแอป (Login Rate Limiting)

* **สถานะ:** ✅ แก้แล้ว (1 พ.ย. 2026) — `TestQA02LoginThrottlesRepeatedFailures` แต่ยังต้องตั้ง `TRUSTED_PROXIES` บน Render
* **ไฟล์ที่เกี่ยวข้อง:**
  * `backend/internal/api/auth_handlers.go` — ฟังก์ชัน `login` บรรทัด 24
  * `backend/internal/api/router.go` — Route `/auth/login` บรรทัด 67
  * `backend/README.md` — ส่วน Known gaps
* **สาเหตุ:**
  เส้นทางล็อกอินในตัวแอปไม่มี limiter หรือนโยบายควบคุมความถี่สำหรับการยืนยันรหัสผ่านผิดซ้ำ
* **ผลกระทบ:**
  เพิ่มความเสี่ยงต่อการลองรหัสผ่านจำนวนมากและการใช้ทรัพยากรตรวจรหัสผ่าน อย่างไรก็ตาม **ยังไม่ได้ตรวจว่า production มี limiter ที่ reverse proxy หรือชั้นอื่นหรือไม่**
* **วิธีทำซ้ำ:**
  ส่งรหัสผ่านผิดไปยัง `POST /api/v1/auth/login` จำนวน 25 ครั้ง โดยใช้บัญชีและ client เดียวกันในสภาพแวดล้อมทดสอบ
* **ผลที่คาดหวัง:** มีนโยบายจำกัดความถี่ที่สังเกตได้เมื่อเกินเกณฑ์ เช่น `429` และช่วงเวลารอก่อนลองใหม่
* **ผลจริง:** ทั้ง 25 ครั้งได้ `401` ไม่พบ `429` หรือการควบคุมความถี่จากแอป การตอบ `401` ถูกต้องสำหรับรหัสผ่านผิด แต่ยังไม่ทดแทน rate limiting
* **แนวทางแก้ไข:**
  จำกัดความถี่ตามบัญชีและ IP ร่วมกัน เพิ่มช่วงหน่วงและบันทึกเหตุการณ์ ระวังไม่ใช้การล็อกถาวรที่ผู้อื่นใช้ปิดกั้นเจ้าของบัญชีได้ง่าย หากใช้ limiter ภายนอก ต้องตรวจว่าไม่สามารถข้ามไปเรียก backend โดยตรงได้
* **หลักฐาน:** [go-review-findings.log](evidence/go-review-findings.log) — `TestReviewStaffLoginShouldThrottleRepeatedFailures`
* **Checklist:**
  - [x] ตรวจมาตรการ limiter ของ production และช่องทางเข้า backend: Render ไม่มี limiter และไม่ได้ตั้ง `TRUSTED_PROXIES` (`access_logs` บน Render มีแต่ IP `10.x` ของ proxy)
  - [x] กำหนดจำนวนครั้ง ช่วงเวลา และการคืนสิทธิ์ให้ชัดเจน: 5 ครั้งใน 15 นาทีต่อ (username, IP); คืนสิทธิ์เมื่อครั้งที่ผิดเก่าสุดครบ 15 นาที หรือเมื่อ login สำเร็จ; ไม่ล็อกถาวร
  - [x] เพิ่ม limiter ที่ครอบคลุมทุกช่องทาง: limiter อยู่ในแอป จึงครอบคลุมทั้งการเรียกผ่านเว็บและการเรียก API ตรง
  - [x] ทดสอบกรณีเกินเกณฑ์และผู้ใช้ปกติที่ไม่ควรถูกกระทบ (integration test); การคืนสิทธิ์เมื่อครบเวลาเป็นตรรกะช่วงเวลาเลื่อน (`recent()`)
  - [ ] ตั้ง `TRUSTED_PROXIES=10.0.0.0/8` บน Render

---

### [QA-07] Go Toolchain และ Dependency มี Advisory ที่ต้องประเมิน

* **สถานะ:** ✅ แก้แล้ว (1 พ.ย. 2026) — govulncheck เหลือ 0 advisory ที่ถูกเรียกใช้
* **ไฟล์ที่เกี่ยวข้อง:**
  * `backend/go.mod` และ `backend/go.sum`
  * `docker/backend.Dockerfile` และ `docker/app.Dockerfile` — สำหรับตรวจความสอดคล้องของ toolchain ก่อน deploy
  * `backend/internal/push/push.go` บรรทัด 361 — ตัวอย่าง call trace ที่ปรากฏในผลสแกน
* **สาเหตุและผลตรวจ:**
  `govulncheck 1.9.0` วิเคราะห์ source ด้วย Go `1.26.5` ที่ระดับ symbol พบ advisory ไม่ซ้ำ **18 รหัส** ซึ่งมี trace เชื่อมกับโมดูล `dpms/backend` ฐานข้อมูล `vuln.go.dev` ที่ใช้มีเวลาปรับปรุงล่าสุด 27 ตุลาคม 2026

| องค์ประกอบ | เวอร์ชันที่ตรวจ | เวอร์ชันแก้ที่ปรากฏในผล |
|---|---|---|
| Go standard library | `1.26.5` | สูงสุดในชุดผลนี้ `1.26.10` |
| `golang.org/x/net` | `0.58.0` | `0.60.0` สำหรับรายการที่เกี่ยวข้อง |
| `github.com/quic-go/quic-go` | `0.59.0` | `0.59.1` |

* **ผลกระทบและข้อจำกัด:**
  ผลวิเคราะห์ครอบคลุมประเด็น HTTP, TLS และการใช้ทรัพยากรตามเงื่อนไขของแต่ละ advisory การมี call trace **ไม่ยืนยันว่าโจมตีผ่าน production ได้** ต้องตรวจ protocol, platform, build tags และ artifact ที่ deploy จริง เช่น advisory HTTP/3 อาจไม่ตรงกับโหมดใช้งานของระบบนี้
* **วิธีตรวจซ้ำ:**
  รันคำสั่งต่อไปนี้จากโฟลเดอร์ `backend` ใน checkout ทดสอบ โดยไม่แก้ dependency ก่อนเก็บผล

  ```bash
  go run golang.org/x/vuln/cmd/govulncheck@v1.9.0 -json ./...
  ```

  **ต้องอ่าน `finding` ใน JSON:** รอบที่ตรวจนี้เครื่องมือ exit `0` แม้มี findings จึงห้ามแปล exit `0` ว่าปลอดช่องโหว่
* **แนวทางแก้ไข:**
  ประเมินอัปเดต Go, `x/net` และ `quic-go` ให้พ้น affected range พร้อมปรับ minimum version, Docker image และ workflow ให้สอดคล้องกัน จากนั้นตรวจ artifact ที่จะปล่อยและรันชุดทดสอบเดิมซ้ำ
* **หลักฐาน:** [govulncheck.json](evidence/govulncheck.json) และ [สรุป Advisory พร้อม Trace](evidence/govulncheck-summary.json)
* **Checklist:**
  - [x] ประเมิน advisory ทั้ง 18 รหัส: ไม่ต้องแยกประเมิน เพราะอัปเดตจนพ้น affected range ทั้งหมด
  - [x] เลือกรุ่นที่แก้แล้วและเข้ากันได้กับ dependency อื่น: Go 1.26.10, x/net 0.62.0, quic-go 0.59.1
  - [x] อัปเดต toolchain และ dependency
  - [x] รัน `govulncheck`, `go vet` และ integration tests ซ้ำ (race tests รันใน CI)
  - [x] เหลือ GO-2026-5932 ระดับ module เท่านั้น (`x/crypto/openpgp` ไม่ได้ import และยังไม่มีรุ่นแก้) จึงยอมรับความเสี่ยงข้อนี้

---

## 🟡 รายการระดับปานกลาง (Medium / P2)

### [QA-03] บันทึกเลขพัสดุที่มี Slash ได้ แต่เปิดรายละเอียดไม่ได้

* **สถานะ:** ✅ แก้แล้ว (1 พ.ย. 2026) — `TestQA03TrackingCodeMustBeRetrievable`
* **ไฟล์ที่เกี่ยวข้อง:**
  * `backend/internal/api/parcel_handlers.go` — `trackingCodePattern` บรรทัด 29
  * `backend/internal/api/router.go` — Route `/parcels/:trackingCode` บรรทัด 90
  * `docs/02-design/prototype/src/api/client.js` — การใช้ `encodeURIComponent` ใน `getParcel`
* **สาเหตุ:**
  Validation ยอมรับ printable ASCII รวม `/` แต่ API เปิดรายละเอียดผ่าน path parameter เมื่อ URL ถูกถอดรหัส `/` กลายเป็นส่วนของเส้นทาง จึงไม่ตรงกับ route ที่คาดหวัง tracking code เพียงหนึ่ง segment
* **ผลกระทบ:**
  เกิดข้อมูลที่รับเข้าระบบสำเร็จ แต่ไม่สามารถเปิดรายละเอียดด้วยรหัสเดิมผ่าน endpoint ที่ client ใช้
* **วิธีทำซ้ำ:**
  1. เลือกห้องจากทะเบียนทดสอบ
  2. เรียก `POST /api/v1/parcels` ด้วย `trackingCode: "REVIEW/SLASH"` และ `roomId` ที่ถูกต้อง
  3. เรียก `GET /api/v1/parcels/REVIEW%2FSLASH`
* **ผลที่คาดหวัง:** ปฏิเสธอักขระที่ไม่รองรับตั้งแต่รับเข้า หรือหากยอมรับต้องเปิดรายละเอียดได้
* **ผลจริง:** รับเข้าได้ `201` แต่เปิดรายละเอียดได้ `404`
* **แนวทางแก้ไข:**
  กำหนดชุดอักขระตามรูปแบบบาร์โค้ดที่รองรับ และตรวจ client กับ API ให้ตรงกัน หรือใช้ stable parcel ID/query parameter สำหรับ lookup พร้อมจัดการข้อมูลเดิมที่ได้รับผลกระทบ
* **หลักฐาน:** [go-review-findings.log](evidence/go-review-findings.log) — `TestReviewAcceptedTrackingCodeMustBeRetrievable`
* **Checklist:**
  - [x] ตกลงชุดอักขระที่รองรับ: ASCII ที่พิมพ์ได้และไม่มีช่องว่าง ยกเว้น `/ \ ? # %` และรหัสที่เป็นจุดล้วน ใช้กติกาเดียวกันตอนรับเข้า แก้ไข นำออก และเปิดดู
  - [x] ตรวจข้อมูลเดิมที่มีอักขระดังกล่าวก่อนเปลี่ยนกติกา: ฐานข้อมูลบน Render มี 0 รายการ
  - [x] เพิ่มกรณี `/`, `\`, `.`, `..`, `%`, `?`, `#`
  - [x] ยืนยันว่ารหัสที่มีเครื่องหมายอื่น (`-` `_` `.` `+`) บันทึกแล้วเปิดดูได้

---

### [QA-04] ค่าหน้าตารางขนาดใหญ่ทำให้ API ตอบ Internal Server Error

* **สถานะ:** ✅ แก้แล้ว (1 พ.ย. 2026) — `TestQA04HugePageIsAValidationError`
* **ไฟล์ที่เกี่ยวข้อง:**
  * `backend/internal/api/parcel_handlers.go` — `parsePaging` บรรทัด 47
  * `backend/internal/store/parcels.go` บรรทัด 641
  * `backend/internal/store/directory.go` บรรทัด 93
  * `backend/internal/store/store.go` บรรทัด 113
* **สาเหตุ:**
  การตรวจ `page` ยอมรับจำนวนเต็มบวกขนาดใหญ่ แต่การคำนวณ `(page - 1) * pageSize` ไม่มีการตรวจ integer overflow ผลลัพธ์อาจกลายเป็นค่า OFFSET ติดลบ
* **ผลกระทบ:**
  ผู้ใช้ที่มีสิทธิ์ส่งค่าผิดปกติสามารถทำให้คำขอตอบ `500` แทน validation error การทดสอบนี้ไม่ได้ทำให้เซิร์ฟเวอร์หยุดทำงานหรือพิสูจน์ DoS ทั้งระบบ
* **วิธีทำซ้ำ:**
  1. สร้างข้อมูลทดสอบให้ตารางไม่ว่าง
  2. ส่ง `page=9223372036854775807&pageSize=100` ไปยัง `/api/v1/parcels`, `/api/v1/directory` และ `/api/v1/admin/access-logs`
  3. ใช้บัญชีที่มีสิทธิ์ตาม endpoint โดยเฉพาะ access logs ต้องเป็น admin
* **ผลที่คาดหวัง:** `400` สำหรับค่าที่เกินขอบเขต หรือผลลัพธ์ว่างที่ระบบรองรับโดยไม่เกิด `5xx`
* **ผลจริง:** ทั้งสาม endpoint ได้ `500` และ log มี `OFFSET must not be negative`
* **แนวทางแก้ไข:**
  กำหนดขอบเขต `page` และตรวจ overflow ก่อนคำนวณ OFFSET ให้ใช้กติกาเดียวกันทุก endpoint พิจารณา cursor pagination หากปริมาณข้อมูลเพิ่มขึ้น ไม่แก้เพียงซ่อน SQL error เป็นผลลัพธ์ว่าง
* **หลักฐาน:** [go-review-findings.log](evidence/go-review-findings.log) — `TestReviewLargePageMustNotReturnInternalError`
* **Checklist:**
  - [x] เพิ่มการตรวจขอบเขตและ integer overflow: `page` สูงสุด 100,000 (คูณ pageSize 100 แล้วยังห่างจาก overflow มาก)
  - [x] ใช้กติกาเดียวกันในทั้งสาม endpoint (`parsePaging`)
  - [x] ทดสอบ page ปกติ ศูนย์ ติดลบ ค่าขอบเขต และค่าสูงสุด
  - [x] ยืนยันว่า pagination ปกติยังถูกต้อง (`TestSearchAndPagination` ผ่าน) และค่าที่ไม่รองรับไม่ทำให้เกิด `5xx`

---

### [QA-05] พิมพ์เลขพัสดุช้าแล้วระบบค้นหาและล้างทีละอักษร

* **สถานะ:** ✅ แก้แล้ว (1 พ.ย. 2026) — ทดสอบด้วย Vitest แต่ยังไม่ได้รัน Playwright บน Chromium ซ้ำ
* **ไฟล์ที่เกี่ยวข้อง:**
  * `docs/02-design/prototype/src/components/Modals.jsx` — `enqueueScan` บรรทัด 109 และ timer บรรทัด 115
* **สาเหตุ:**
  เมื่อช่องกรอกหยุดเปลี่ยนเป็นเวลา 400 มิลลิวินาที ระบบเรียกค้นหาและล้างค่า `scan` ทันที โดยไม่แยกการพักระหว่างพิมพ์มือออกจากการส่งรหัสครบของเครื่องสแกน
* **ผลกระทบ:**
  ผู้ใช้ที่ต้องพิมพ์เลขพัสดุแทนการสแกนและหยุดระหว่างตัวอักษรอาจกรอกรหัสไม่สำเร็จ แม้รหัสเต็มมีอยู่ในระบบ
* **วิธีทำซ้ำ:**
  1. บันทึกพัสดุ `QASLOW1234` ให้สำเร็จในฐานข้อมูลทดสอบ
  2. เปิดหน้านำพัสดุออก
  3. พิมพ์รหัสทีละอักษร โดยเว้น 450 มิลลิวินาทีระหว่างตัว ไม่กด Enter
* **ผลที่คาดหวัง:** รักษาข้อความระหว่างกรอกจนได้รหัสครบ และค้นพบ `QASLOW1234`
* **ผลจริง:** ส่งค้นหา `Q`, `A`, `S`, `L`, `O`, `W`, `1`, `2`, `3`, `4` แยกกัน ช่องกรอกว่างหลังจบ และไม่มีรหัสเต็มในรายการรอนำออก
* **แนวทางแก้ไข:**
  แยก scanner burst จากการพิมพ์มือโดยพิจารณาความเร็ว keystroke และรูปแบบรหัส เก็บค่าที่พิมพ์ไว้จนตรวจพบรายการหรือผู้ใช้ยืนยัน ให้ Enter เป็นทางเลือกของการกรอกมือ โดยยังรักษาการสแกนต่อเนื่องที่ไม่ต้องคลิก
* **หลักฐาน:** [playwright-review-findings.log](evidence/playwright-review-findings.log), [ภาพ Dialog](evidence/manual-input-dialog.png) และภาพเต็ม/trace ใน [playwright-findings](evidence/playwright-findings/)
* **Checklist:**
  - [x] แยกเงื่อนไขสแกนออกจากการพิมพ์มือ: ส่งอัตโนมัติเฉพาะเมื่อทุกตัวอักษรห่างกันไม่เกิน 50 ms หรือเป็นการวาง
  - [x] ไม่ล้างอักษรเมื่อผู้ใช้หยุดกลางรหัส: คงข้อความไว้และบอกให้กด Enter
  - [x] ทดสอบ scanner burst, paste, การพิมพ์ช้า (450 ms) และการหยุดกลางรหัสด้วย Vitest
  - [x] ยืนยันว่าเพิ่มเฉพาะรหัสครบ ไม่เพิ่มซ้ำ และยังสแกนหลายรายการต่อเนื่องได้ (test เดิมผ่านทั้งหมด)
  - [ ] รัน Playwright บน Chromium และทดสอบกับเครื่องสแกนจริง

---

### [QA-06] npm Audit พบ Advisory ในเครื่องมือพัฒนา

* **สถานะ:** ✅ แก้แล้ว (1 พ.ย. 2026) — `npm audit` = 0
* **ไฟล์ที่เกี่ยวข้อง:**
  * `docs/02-design/prototype/package.json`
  * `docs/02-design/prototype/package-lock.json`
  * การตั้งค่าและวิธีเปิด Vite/Vitest UI ในเครื่องพัฒนา
* **ผลตรวจ:**
  `npm audit` รายงานแพ็กเกจได้รับผลกระทบ **10 รายการ** แบ่งเป็น critical 3, high 3 และ moderate 4 ส่วน `npm audit --omit=dev` รายงาน **0 รายการ** จำนวนแพ็กเกจไม่ใช่จำนวน advisory/CVE ที่ไม่ซ้ำ

| แพ็กเกจ | เวอร์ชันที่ตรวจ | ระดับจาก npm audit |
|---|---|---|
| `@vitest/mocker` | `2.1.9` | Moderate |
| `@vitest/ui` | `2.1.9` | Critical |
| `esbuild` | `0.21.5` | Moderate |
| `postcss-selector-parser` | `6.1.4` | Moderate |
| `source-map-js` | `1.2.1` | High |
| `tinypool` | `1.1.1` | Critical |
| `undici` | `7.29.1` | High |
| `vite` | `5.4.21` | High |
| `vite-node` | `2.1.9` | Moderate |
| `vitest` | `2.1.9` | Critical |

* **สาเหตุและผลกระทบ:**
  เวอร์ชันใน lockfile อยู่ในช่วงที่ฐานข้อมูล advisory ระบุว่ามีผลกระทบ เช่น Vitest UI มีเงื่อนไขเกี่ยวกับ UI server ส่วน Vite/esbuild มีเงื่อนไขเกี่ยวกับ development server และบาง advisory เฉพาะ Windows จึง **ยังสรุปไม่ได้ว่าใช้โจมตี production ของโครงการได้**
* **วิธีตรวจซ้ำ:**
  จากโฟลเดอร์ `docs/02-design/prototype` รัน:

  ```bash
  npm audit --json
  npm audit --omit=dev --json
  ```

* **แนวทางแก้ไข:**
  ประเมินอัปเดต Vitest/Vite และ plugin ที่เกี่ยวข้องเป็นชุดที่เข้ากันได้ อัปเดต transitive dependency ที่ทำได้โดยไม่เปลี่ยนพฤติกรรมก่อน ห้ามใช้ `npm audit fix --force` โดยไม่ตรวจผล ระหว่างรอให้จำกัดการเข้าถึง dev server และ Vitest UI เฉพาะผู้ที่จำเป็น
* **หลักฐาน:** [npm-audit.json](evidence/npm-audit.json), [npm-runtime-audit.json](evidence/npm-runtime-audit.json) และ [dependency-versions.json](evidence/dependency-versions.json)
* **Checklist:**
  - [x] ประเมิน advisory: ไม่ต้องแยกประเมิน เพราะอัปเดตจนไม่เหลือ
  - [x] เลือกรุ่นที่แก้แล้วและตรวจ compatibility: Vite 6.4.5 + Vitest 4.1.12 + plugin-react 4.7.0
  - [x] อัปเดต lockfile; ข้อควรระวัง: `npm run dev` ยังเปิดที่ `0.0.0.0` เพื่อให้มือถือในวง LAN เดียวกันเข้าได้ อย่ารันบนเครือข่ายสาธารณะ
  - [x] รัน audit, Vitest และ build หลังอัปเดต (ยังไม่ได้รัน Playwright)
  - [x] ไม่มีคำเตือนเหลือ

---

## 🟢 รายการปรับปรุงทั่วไป (Low / Improvements)

ไม่มีรายการเพิ่มเติมในรายงานรอบนี้ เพื่อไม่เพิ่มข้อเสนอที่ยังไม่มีหลักฐานเป็นบั๊กที่ยืนยันแล้ว ทั้งนี้ไม่ได้หมายความว่าได้ตรวจทุกส่วนของระบบครบถ้วน

---

## ผลทดสอบที่ผ่านและขอบเขตที่ยังไม่ได้ตรวจ

| ชุดตรวจ | ผลรอบนี้ | หมายเหตุ |
|---|---|---|
| Vitest | 120 tests ผ่าน ใน 14 ไฟล์ | Component, validation และ error state ตาม cases ที่มี |
| Go integration และ race detector | ผ่าน | PostgreSQL จริง, auth, สิทธิ์ลูกหอ และ Web Push จำลอง |
| Playwright โฟลเดิม | 3 tests ผ่าน | Login/logout, รับเข้าเดี่ยว/batch, สแกนนำออกและบันทึกสถานะจริง |
| Go vet และ production build | ผ่าน | ผลเฉพาะ source และสภาพแวดล้อมที่ระบุ |
| Gitleaks | ไม่พบรหัสลับจาก 40 commits ที่สแกน | ไม่ใช่การยืนยันว่ารหัสลับไม่เคยหลุดทุกช่องทาง |
| Go regression เพิ่มเติม | 4 tests ไม่ผ่านตามที่รายงาน | ใช้ยืนยัน `QA-01` ถึง `QA-04` |
| Playwright เพิ่มเติม | 1 test ไม่ผ่านตามที่รายงาน | ใช้ยืนยัน `QA-05` ส่วน 3 tests เดิมยังผ่าน |

**ยังไม่ได้ตรวจ:** CodeQL CLI/workflow บน GitHub, Render จริง, เครื่องสแกนจริง, push notification บนอุปกรณ์ iOS/Android จริง, load test ระดับ production และ penetration test ครบทุกหมวด

ผล dependency scan เป็นข้อมูลตามวันที่และ toolchain ที่ตรวจ การตรวจด้วยเครื่องมือหรือการผ่าน test ไม่ใช่การรับรองว่าระบบไม่มีช่องโหว่

---

## วิธีใช้สคริปต์และส่งต่อให้ผู้พัฒนา

1. เก็บเอกสารนี้คู่กับโฟลเดอร์ `evidence/` และ `scripts/` เพื่อให้เปิดหลักฐานตามลิงก์ได้
2. ใช้ checkout ของ branch เฉพาะในเครื่อง `test-security-automation` ที่ commit `4d85196` ซึ่งติดตั้ง Node, npm, Go, Docker และ Chromium ของ Playwright ไว้แล้ว
3. จากโฟลเดอร์รายงาน รัน:

   ```bash
   bash scripts/run-review.sh
   ```

   หาก checkout อยู่คนละที่ ให้ระบุ absolute path:

   ```bash
   PROJECT_DIR=/absolute/path/to/project bash scripts/run-review.sh
   ```

4. สคริปต์ไม่ checkout, push หรือแก้โค้ดการทำงานของแอป ใช้ฐานข้อมูลทดสอบบนพอร์ต `15432`, API `18080` และหน้าเว็บ `4174` ผลรอบใหม่อยู่ใน `reruns/` ไม่ทับหลักฐานเดิม
5. คาดว่าจะพบ regression ไม่ผ่าน 4 กรณีฝั่ง Go และ 1 กรณีฝั่ง browser จนกว่าจะแก้ไข ไม่ต้องตีความว่าเครื่องมือติดตั้งไม่สำเร็จ
6. ให้ผู้พัฒนาแก้ตามรายการและส่ง commit กลับมา จากนั้นผู้ทดสอบปรับตัวระบุ snapshot ในสคริปต์หลังตรวจรุ่น แล้วตรวจซ้ำก่อนติ๊ก Checklist ว่าเสร็จ

สคริปต์ย่อยและแต่ละกรณีถูกใช้ตรวจจริงแล้ว ตัวเรียกรวม `run-review.sh` ผ่านการตรวจ syntax แต่ไม่ได้รันทั้งชุดซ้ำอีกครั้งเพียงเพื่อตรวจตัวเรียกรวม

**ข้อสรุปการส่งมอบ (ฉบับเดิม):** รายงานนี้ส่งต่อผลตรวจและแนวทางแก้ไขเท่านั้น ไม่มีการแก้บั๊กในตัวแอปหรือเผยแพร่ชุดทดสอบขึ้น GitHub

**อัปเดต 1 พ.ย. 2026:** แก้ครบทั้ง 7 รายการแล้ว ดูหัวข้อ "ผลการแก้ไข" ด้านบน
