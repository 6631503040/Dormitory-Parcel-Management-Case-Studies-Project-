# Frontend UX/UI re-audit — 5 ตุลาคม 2026

## Implementation integrity verdict

**ผ่านด้านความสอดคล้องของหน้าตาและโครงสร้างกับงานจัดการพัสดุ**: หน้าปัจจุบันใช้ทะเบียนพัสดุเป็นข้อมูลหลัก ปุ่มรับเข้า/นำออกบอกงานชัด สีสถานะมีข้อความประกอบ และใช้ชุดสี/ตัวอักษรจาก tokens ร่วมกัน การลดพื้นหลังจุด การ์ดตกแต่ง และปุ่มทรงแคปซูลทำให้ข้อมูลเด่นขึ้น อย่างไรก็ตาม ขั้นตอนเลือกผู้รับ สแกน และจัดการร่างรายการยังมีข้อบกพร่องที่ต้องแก้ก่อนใช้งานจริง

ตัวตรวจ `impeccable detect` พบหนึ่งรายการ: `overused-font` สำหรับ Inter ที่ `src/components/ParcelHub.jsx:44` ไฟล์นี้เป็นต้นแบบเก่าที่ไม่ได้ถูก import จาก entry ปัจจุบัน จึงไม่นับเป็นปัญหาหน้าปัจจุบัน และไม่แก้/ignore กฎเพื่อให้ผลตรวจสะอาด เส้นทางที่ตรวจจริงคือ `src/App.jsx` → `components/ParcelHubApp.jsx` ผลตรวจอัตโนมัติที่สะอาดในเส้นทางนี้ไม่ได้ยืนยันว่าขั้นตอนใช้งานถูกต้อง

## Executive summary

**Audit Health Score: 13/20 — Acceptable: ยังมีงานสำคัญต้องปรับ**

| มิติ | คะแนน | ข้อค้นพบหลัก |
|---|---:|---|
| Accessibility | 2/4 | เส้นขอบช่องกรอกจาง และผลรับสแกนไม่มี live status |
| Performance | 3/4 | Bundle เล็กพอสำหรับต้นแบบ แต่รายการและ local storage ยังไม่มีขอบเขต |
| Responsive design | 3/4 | หน้าหลักและ dialog อยู่ในจอแคบได้ แต่สถานะพัสดุอยู่นอกส่วนที่เห็นแรก |
| Theming | 3/4 | ใช้ tokens ร่วมกันดี ควรแยกสีขอบ control จากสีเส้นแบ่งตกแต่ง |
| Implementation integrity | 2/4 | ระบบหน้าตาสอดคล้องกัน แต่พบข้อบกพร่องในขั้นตอนสแกน/ค้นหา/ร่างรายการ |
| **รวม** | **13/20** | **Acceptable** |

พบ **12 ข้อ: P0 = 0, P1 = 5, P2 = 7, P3 = 0** โดย F12 เป็นข้อจำกัดด้านการขยายจำนวนข้อมูลที่ยืนยันจากโค้ด ไม่ใช่ผลวัดว่าหน้าเว็บช้า ช่องว่างจากสเปกที่ต้นแบบยังไม่ได้ทำแยกไว้ต่างหาก ไม่นับเพิ่มในยอดนี้

สิ่งที่ควรทำก่อน: รอให้สแกนจบก่อนเลือกพัสดุ; ให้การนำออกมีขอบเขตห้อง/ผู้รับชัดเจน; รักษาหมายเหตุสภาพกล่อง; เพิ่ม contrast ของช่องกรอกและประกาศผลสแกน หลังจากนั้นลดการค้นหาซ้ำและป้องกันร่างรายการหาย

คะแนนนี้เป็นการตรวจ implementation และทดลองงานในต้นแบบ ไม่ใช่ผลทดสอบความพึงพอใจ ความเร็วเจ้าหน้าที่ หรือการรับรอง WCAG ทั้งระบบ ข้อบกพร่องด้านพฤติกรรมส่วนใหญ่เป็นข้อจำกัดเดิมที่การปรับหน้าตารอบก่อนยังไม่ได้แก้

## วิธีตรวจและขอบเขตหลักฐาน

- ตรวจ frontend ที่ `docs/02-design/prototype` และหน้า `http://localhost:5173/` บน branch `codex/frontend-ux-ui-refresh` ไม่แก้ source หน้าเว็บหรือ backend ในรอบนี้
- เทียบกับ `PRODUCT.md`, `DESIGN.md`, สเปกที่ล็อกไว้ และงานวิจัยเจ้าหน้าที่ งานวิจัยระบุความเสี่ยงจากเลขห้องไม่ชัด ชื่อเล่น ห้องสลับ และคิวที่เร่งให้เกิดความผิดพลาด ([บทวิเคราะห์:50](/home/danaiphong/CascadeProjects/Dormitory-Parcel-Management-Case-Studies-Project/docs/02-design/survey_interview_analysis.md:50))
- ตรวจ source โดยผู้รีวิวแยกสองด้าน: คุณภาพ implementation และขั้นตอนงานเคาน์เตอร์ แล้วตรวจพฤติกรรมสำคัญใน browser
- ทดลองค้นหาห้อง → เปิดนำออก, Enter หลังค้นหาห้อง, เลือกทั้งหมดข้ามห้อง, พิมพ์รหัสทีละตัว, เตรียมร่างรับเข้า, ปิดด้วย Escape และเปิดใหม่ รวมถึง Archive filters/ผลค้นหาว่าง
- ใช้รหัสทดสอบเฉพาะร่างที่ยังไม่บันทึก ไม่กดบันทึกรับเข้า ไม่ยืนยันนำออก และไม่ยืนยัน LINE คืน Dashboard คำค้นหาว่าง ปิด dialog และ reset viewport หลังตรวจ
- ตรวจ desktop override 1440×900 และ mobile override 390×844 ใน Codex In-app Browser ภาพมือถือที่เก็บผ่าน surface screenshot มีพื้นที่เนื้อหากว้าง 375px เนื่องจาก scrollbar ตรวจจาก DOM ว่าหน้าไม่ล้นแนวนอนและ table scroll มี client width 348px / scroll width 850px
- ภาพจากการจับ full-page ทันทีหลังเปลี่ยนขนาดบางภาพไม่ตรงกับ geometry ของ DOM จึงแทนที่ด้วยภาพหลังอ่านสถานะ UI และตรวจภาพจริง ไม่นำภาพที่คลาดเคลื่อนมารายงานเป็น layout defect
- Production build ผ่าน: JavaScript 174.80 kB / gzip 55.54 kB; CSS 26.00 kB / gzip 6.25 kB ตัวเลขนี้ไม่รวมการดาวน์โหลด web font ภายนอก และไม่ใช่การวัดเวลาทำงานบนเครื่องเคาน์เตอร์
- พบ console error ของ Vite development WebSocket หนึ่งรายการ หน้าที่ลองยังตอบสนองและ production build ผ่าน จึงแยกเป็นข้อสังเกตสภาพแวดล้อมพัฒนา ไม่ใช้ตัดสินว่า production UI ทำงานเสีย
- ไม่ได้ทดสอบเครื่องสแกนจริง, physical touch, software keyboard, screen reader จริง, browser zoom 200–400%, ความเร็วเมื่อมีข้อมูลสะสมจำนวนมาก หรือ backend/authentication/API

## Detailed findings — P1 Major

### F01 [P1] ระบบเลือกรหัสพัสดุก่อนพิมพ์หรือสแกนครบ

- **Location:** [Modals.jsx:76](/home/danaiphong/CascadeProjects/Dormitory-Parcel-Management-Case-Studies-Project/docs/02-design/prototype/src/components/Modals.jsx:76)
- **Category:** Implementation Integrity
- **Evidence:** effect ตรวจ exact match ทุกครั้งที่ข้อความเปลี่ยน แล้วเลือกพัสดุและล้างช่องทันที ทดลองพิมพ์ `TH8827301923X` ทีละตัวโดยไม่กด Enter พบว่าระบบเลือก `TH8827301923` และเหลือ `X` ในช่อง แม้รหัสเต็มไม่ตรงกับรายการ หากรหัสที่ถูกต้องสองรหัสมี prefix ร่วมกัน เช่น `PK123` และ `PK1234` พัสดุรหัสสั้นอาจถูกเลือกก่อนรหัสยาวครบ
- **Impact:** เจ้าหน้าที่อาจยืนยันนำออกพัสดุคนละชิ้นกับที่สแกน การเลือกอัตโนมัติยังเกิดในช่องที่บอกว่าสามารถใช้ค้นหาได้
- **Standard:** ความถูกต้องของงานนำออก; ไม่อ้างเป็น WCAG violation
- **Recommendation:** ระหว่างพิมพ์ให้กรองข้อมูลเท่านั้น เมื่อกด Enter/ได้รับ scanner terminator จึงตรวจรหัสเต็มและเลือก แสดงรหัส ห้อง และผลรับสแกนทันที รหัสไม่พบ/ซ้ำควรมีข้อความเฉพาะ
- **Suggested command:** `$impeccable harden`

### F02 [P1] “เลือกทั้งหมดที่พบ” ไม่มีขอบเขตผู้รับก่อนนำออก

- **Location:** [Modals.jsx:52](/home/danaiphong/CascadeProjects/Dormitory-Parcel-Management-Case-Studies-Project/docs/02-design/prototype/src/components/Modals.jsx:52), [Modals.jsx:139](/home/danaiphong/CascadeProjects/Dormitory-Parcel-Management-Case-Studies-Project/docs/02-design/prototype/src/components/Modals.jsx:139), [ParcelHubApp.jsx:80](/home/danaiphong/CascadeProjects/Dormitory-Parcel-Management-Case-Studies-Project/docs/02-design/prototype/src/components/ParcelHubApp.jsx:80)
- **Category:** Implementation Integrity
- **Evidence:** ช่องค้นหาว่างแสดงพัสดุรอรับทุกห้อง ทดลองเลือกทั้งหมดแล้วเลือกได้ทั้ง 090, 101/2, 203/1 และ 305 ในครั้งเดียว ปุ่มยืนยันเรียกเปลี่ยนสถานะทันที ไม่มีการตรวจขอบเขตห้อง การเลือกยังสะสมข้ามคำค้นหา สรุปรายการที่เลือกมีอยู่จริงและลบรายชิ้นได้ จึงไม่รายงานว่ารายการที่เลือกถูกซ่อน
- **Impact:** คำแนะนำในหน้าต่างพูดถึงผู้รับคนเดียวกัน แต่ปุ่ม All สามารถนำออกข้ามผู้รับได้ ความผิดพลาดนี้กระทบการส่งมอบจริง
- **Standard:** ขั้นตอน Check Out All / Check Out Selected ของห้องที่เลือก ตาม [design-spec.md:182](/home/danaiphong/CascadeProjects/Dormitory-Parcel-Management-Case-Studies-Project/docs/02-design/design-spec.md:182)
- **Recommendation:** ให้เลือกห้องที่ยืนยันจากทะเบียนก่อน แสดงห้อง/รายชื่อผู้พัก/จำนวนรอรับค้างไว้ แล้วสแกนพัสดุในขอบเขตนั้น ใช้ปุ่ม “นำออกทั้งหมดของห้อง …” กับ “นำออกเฉพาะที่เลือก” ชัดเจน หากจะรองรับงานหลายห้องจริง ให้แยกเป็นขั้นตอนที่ตั้งใจเลือกและทบทวนรายห้อง
- **Suggested command:** `$impeccable shape` ตามด้วย `$impeccable harden`

### F03 [P1] การยืนยัน LINE สามารถลบหมายเหตุชำรุด

- **Location:** [TopNav.jsx:18](/home/danaiphong/CascadeProjects/Dormitory-Parcel-Management-Case-Studies-Project/docs/02-design/prototype/src/components/TopNav.jsx:18), [TopNav.jsx:27](/home/danaiphong/CascadeProjects/Dormitory-Parcel-Management-Case-Studies-Project/docs/02-design/prototype/src/components/TopNav.jsx:27), [ParcelHubApp.jsx:115](/home/danaiphong/CascadeProjects/Dormitory-Parcel-Management-Case-Studies-Project/docs/02-design/prototype/src/components/ParcelHubApp.jsx:115), [Modals.jsx:230](/home/danaiphong/CascadeProjects/Dormitory-Parcel-Management-Case-Studies-Project/docs/02-design/prototype/src/components/Modals.jsx:230)
- **Category:** Implementation Integrity
- **Evidence:** ใช้ flag `damaged` ร่วมกันสำหรับสภาพกล่องและปัญหาผู้รับ รายการที่มีทั้ง flag นี้และ LINE ID เข้าคิวตรวจ LINE; handler ยืนยันตั้ง `damaged: false` และ `damageReason: ""` โดยไม่ตรวจว่าเป็นเหตุผลประเภทใด ยืนยันจาก source ไม่ได้กดทำรายการนี้ใน browser
- **Impact:** ข้อมูลสภาพกล่องอาจหายหลังยืนยันตัวตน ทำให้ตอนส่งมอบไม่เห็นเหตุผลเดิม
- **Standard:** รักษาความหมายของสถานะและข้อมูลสภาพพัสดุ
- **Recommendation:** การเลือกห้องควรจัดการการตรวจผู้รับ ส่วนสภาพกล่องเป็นหมายเหตุแยกและต้องคงอยู่ สำหรับสเปกที่ล็อกไว้ควรถอดทางลัดยืนยัน LINE ออกจากขั้นตอนหลัก; LINE/unmatched queue เป็นส่วนขยายที่ยังไม่ได้ยืนยันขอบเขต ไม่จำเป็นต้องสร้างระบบใหม่นั้นเพื่อแก้ UI นี้
- **Suggested command:** `$impeccable harden`

### F04 [P1] เส้นขอบช่องกรอกจางเกินไปบนพื้นขาว

- **Location:** [styles.css:8](/home/danaiphong/CascadeProjects/Dormitory-Parcel-Management-Case-Studies-Project/docs/02-design/prototype/src/styles.css:8), [styles.css:144](/home/danaiphong/CascadeProjects/Dormitory-Parcel-Management-Case-Studies-Project/docs/02-design/prototype/src/styles.css:144), [LoginPage.jsx:25](/home/danaiphong/CascadeProjects/Dormitory-Parcel-Management-Case-Studies-Project/docs/02-design/prototype/src/components/LoginPage.jsx:25)
- **Category:** Accessibility / Theming
- **Evidence:** ขอบ `#DDE3EC` เทียบพื้นขาวมี contrast **1.29:1** ช่องกรอกว่าง เช่นรหัสผ่าน มีพื้นขาวเดียวกับบริเวณรอบข้าง และใช้ขอบนี้ระบุพื้นที่กรอก focus outline สีน้ำเงินมี contrast ดี แต่ไม่ช่วยสถานะก่อน focus
- **Impact:** ผู้ใช้สายตาเลือนรางแยกพื้นที่ที่พิมพ์ได้ยาก
- **WCAG:** [1.4.11 Non-text Contrast](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html) ต้องการ 3:1 สำหรับ visual information ที่จำเป็นต่อการระบุ control ไม่ใช่ข้อกำหนดให้ทุกเส้นแบ่ง/ขอบปุ่มตกแต่งต้องเข้ม
- **Recommendation:** แยก `control-border` token ที่ผ่าน 3:1 จาก `divider` token ใช้ขอบที่เข้มขึ้นกับช่องกรอกและตัวเลือกที่ต้องพึ่งขอบในการสื่อสถานะ คงเส้นแบ่งตารางจางไว้ได้
- **Suggested command:** `$impeccable harden`

### F05 [P1] ผลสแกนสำเร็จไม่มีการประกาศให้เทคโนโลยีช่วยเหลือ

- **Location:** [Modals.jsx:82](/home/danaiphong/CascadeProjects/Dormitory-Parcel-Management-Case-Studies-Project/docs/02-design/prototype/src/components/Modals.jsx:82), [Modals.jsx:138](/home/danaiphong/CascadeProjects/Dormitory-Parcel-Management-Case-Studies-Project/docs/02-design/prototype/src/components/Modals.jsx:138), [Modals.jsx:242](/home/danaiphong/CascadeProjects/Dormitory-Parcel-Management-Case-Studies-Project/docs/02-design/prototype/src/components/Modals.jsx:242)
- **Category:** Accessibility
- **Evidence:** รับสแกนแล้วช่องว่างและจำนวนรายการเปลี่ยน แต่ focus อยู่ที่ input ข้อความ “เลือกแล้ว …” และจำนวนร่างเป็น paragraph ธรรมดา ไม่มี status/live property ต่างจากผลค้นหา Dashboard และ Banner ที่มี `role="status"` แล้ว
- **Impact:** ผู้ใช้ screen reader ต้องย้าย focus เพื่อตรวจว่าสแกนสำเร็จหรือไม่ ระบุจาก semantics และการเปลี่ยนข้อความ ไม่ได้อ้างว่าทดสอบ screen reader จริง
- **WCAG:** [4.1.3 Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html) ครอบคลุมข้อความแจ้งผลการกระทำที่เปลี่ยนโดยไม่รับ focus
- **Recommendation:** เพิ่ม polite status สั้น ๆ เช่น “รับรหัส … ห้อง … แล้ว เลือกทั้งหมด 2 รายการ” และ “เพิ่มลงร่างแล้ว ยังไม่บันทึก” ไม่ประกาศทั้งรายการยาวซ้ำทุกครั้ง
- **Suggested command:** `$impeccable harden`

## Detailed findings — P2 Minor

### F06 [P2] ค้นหาชื่อที่แสดงอยู่ไม่พบสำหรับพัสดุรับเข้าใหม่

- **Location:** [ParcelHubApp.jsx:98](/home/danaiphong/CascadeProjects/Dormitory-Parcel-Management-Case-Studies-Project/docs/02-design/prototype/src/components/ParcelHubApp.jsx:98), [shared.jsx:71](/home/danaiphong/CascadeProjects/Dormitory-Parcel-Management-Case-Studies-Project/docs/02-design/prototype/src/components/shared.jsx:71), [DashboardPage.jsx:39](/home/danaiphong/CascadeProjects/Dormitory-Parcel-Management-Case-Studies-Project/docs/02-design/prototype/src/components/DashboardPage.jsx:39), [ArchivePage.jsx:34](/home/danaiphong/CascadeProjects/Dormitory-Parcel-Management-Case-Studies-Project/docs/02-design/prototype/src/components/ArchivePage.jsx:34), [Modals.jsx:56](/home/danaiphong/CascadeProjects/Dormitory-Parcel-Management-Case-Studies-Project/docs/02-design/prototype/src/components/Modals.jsx:56)
- **Category:** Implementation Integrity
- **Evidence:** รายการใหม่เก็บ `name: "-"` แต่ตารางแสดงชื่อจาก `ROOM_DIRECTORY` ขณะทุกช่องค้นหาทดสอบเฉพาะชื่อที่เก็บไว้ ไม่ค้นชื่อที่ resolve จากทะเบียน เป็นข้อบกพร่องที่ยืนยันจาก source; ไม่บันทึกพัสดุใหม่เพื่อพิสูจน์ในข้อมูลผู้ใช้
- **Impact:** เจ้าหน้าที่เห็นชื่อแล้วค้นชื่อนั้นไม่พบ ต้องกลับไปค้นเลขห้อง/รหัสพัสดุ
- **Standard:** ความสอดคล้องของ display identity กับ search identity
- **Recommendation:** ใช้ helper ร่วมสำหรับชื่อที่แสดงและชื่อที่ค้นหาได้ อ้างอิง directory room เดียวกัน และรองรับชื่อเล่นเมื่อข้อมูลทะเบียนมีจริง
- **Suggested command:** `$impeccable harden`

### F07 [P2] ร่างรับเข้าหายเมื่อปิด และรายการที่กรอกไม่ครบอาจถูกทิ้งตอนบันทึกชุด

- **Location:** [Modals.jsx:18](/home/danaiphong/CascadeProjects/Dormitory-Parcel-Management-Case-Studies-Project/docs/02-design/prototype/src/components/Modals.jsx:18), [Modals.jsx:147](/home/danaiphong/CascadeProjects/Dormitory-Parcel-Management-Case-Studies-Project/docs/02-design/prototype/src/components/Modals.jsx:147), [Modals.jsx:194](/home/danaiphong/CascadeProjects/Dormitory-Parcel-Management-Case-Studies-Project/docs/02-design/prototype/src/components/Modals.jsx:194)
- **Category:** Implementation Integrity / Accessibility (การแจ้งข้อผิดพลาด)
- **Evidence:** ทดลองเตรียมหนึ่งรายการและกรอกรายการถัดไป กด Escape แล้วเปิดใหม่พบร่างว่างโดยไม่เตือน อีกกรณีมีร่างหนึ่งชิ้นแล้วกรอกชิ้นถัดไปเป็นชำรุดแต่ไม่ใส่เหตุผล ปุ่มบันทึกยัง enabled จากร่างเดิม; source `saveAll` จะส่งเฉพาะ batch แล้วปิดหน้าต่าง จึงทิ้งข้อมูลชิ้นถัดไป ไม่ได้กดบันทึกกรณีนี้จริง
- **Impact:** ต้องสแกน/กรอกใหม่และอาจเข้าใจว่าบันทึกครบทั้งชุด ขณะเพิ่มรายการระบบยังคงเลขห้องเดิมซึ่งต้องสื่อให้ชัดเพื่อป้องกันใส่ห้องเดิมโดยไม่ตั้งใจ
- **Standard:** การกู้คืนงานที่ยังไม่บันทึก; ไม่อ้าง WCAG error identification failure ที่ยังไม่ได้ submit จริง
- **Recommendation:** คงร่างเมื่อ dismiss หรือเตือนทิ้งร่างเมื่อมีการแก้ไข ตรวจรายการปัจจุบันที่เริ่มกรอกแล้วก่อน save พร้อม error รายช่อง ให้เลขห้องที่คงไว้เพียงอย่างเดียวไม่ถูกนับเป็นร่างผิดพลาด แสดงห้องปัจจุบัน/เปลี่ยนห้องชัด และคืน focus ไปสแกนหลังเพิ่มสำเร็จ
- **Suggested command:** `$impeccable harden` และ `$impeccable clarify`

### F08 [P2] ผลค้นหา Dashboard ไม่ส่งต่อไปงานนำออก

- **Location:** [DashboardPage.jsx:34](/home/danaiphong/CascadeProjects/Dormitory-Parcel-Management-Case-Studies-Project/docs/02-design/prototype/src/components/DashboardPage.jsx:34), [DashboardPage.jsx:48](/home/danaiphong/CascadeProjects/Dormitory-Parcel-Management-Case-Studies-Project/docs/02-design/prototype/src/components/DashboardPage.jsx:48), [ParcelHubApp.jsx:150](/home/danaiphong/CascadeProjects/Dormitory-Parcel-Management-Case-Studies-Project/docs/02-design/prototype/src/components/ParcelHubApp.jsx:150), [Modals.jsx:48](/home/danaiphong/CascadeProjects/Dormitory-Parcel-Management-Case-Studies-Project/docs/02-design/prototype/src/components/Modals.jsx:48)
- **Category:** Implementation Integrity
- **Evidence:** ค้นหาห้อง 101/2 บน Dashboard พบหนึ่งรายการ แต่เปิดนำออกแล้วเริ่มช่องว่างและแสดงทุกห้อง
- **Impact:** ต้องค้นและระบุผู้รับซ้ำ เพิ่มงานที่เคาน์เตอร์และโอกาสเลือกผิด
- **Standard:** ความต่อเนื่องของ task; ไม่มี WCAG claim
- **Recommendation:** เพิ่ม action “นำออกสำหรับห้อง 101/2” จากผลที่ resolve ได้ ส่ง room context ต่อไป modal เก็บผลค้นหาเดิมเมื่อกลับมา และแยก action ดูรายละเอียดเพื่อไม่ให้กดแถวแล้วทำรายการทันที
- **Suggested command:** `$impeccable shape`

### F09 [P2] Enter หลังค้นหาห้องแจ้งว่าไม่พบเลขพัสดุทั้งที่มีผลลัพธ์

- **Location:** [Modals.jsx:90](/home/danaiphong/CascadeProjects/Dormitory-Parcel-Management-Case-Studies-Project/docs/02-design/prototype/src/components/Modals.jsx:90), [Modals.jsx:100](/home/danaiphong/CascadeProjects/Dormitory-Parcel-Management-Case-Studies-Project/docs/02-design/prototype/src/components/Modals.jsx:100)
- **Category:** Implementation Integrity
- **Evidence:** พิมพ์ `101/2` แล้ว Enter แสดงคำเตือน “ไม่พบเลขพัสดุนี้ในรายการที่รอนำออก” แต่รายการของห้องเดียวกันยังแสดงอยู่ เนื่องจาก Enter ตรวจเฉพาะ exact Tracking Code ในช่องที่ระบุว่าค้นชื่อและห้องได้
- **Impact:** ข้อความขัดกันทำให้ไม่แน่ใจว่าพบพัสดุหรือทำอะไรผิด
- **Standard:** ความสอดคล้องของ input intent และ feedback
- **Recommendation:** แยกค้นหาห้อง/ผู้รับออกจากช่องสแกน หรือทำให้ Enter เคารพ mode ของช่อง ปุ่มเลือกห้องต้องไม่ส่งคำค้นไปเป็น Tracking Code
- **Suggested command:** `$impeccable harden` และ `$impeccable clarify`

### F10 [P2] บนมือถือ ห้อง/ชื่อกับสถานะพัสดุไม่อยู่ในมุมมองเดียวกัน

- **Location:** [styles.css:190](/home/danaiphong/CascadeProjects/Dormitory-Parcel-Management-Case-Studies-Project/docs/02-design/prototype/src/styles.css:190), [shared.jsx:152](/home/danaiphong/CascadeProjects/Dormitory-Parcel-Management-Case-Studies-Project/docs/02-design/prototype/src/components/shared.jsx:152)
- **Category:** Responsive Design
- **Evidence:** ตารางกว้าง 850px ในพื้นที่ 348px ที่ viewport override 390px สถานะเริ่มประมาณ x=688px จึงต้องเลื่อนแนวนอน; หน้าโดยรวมไม่ล้น และ scroll region ใช้คีย์บอร์ดได้
- **Impact:** ต้องเลื่อนแล้วจำว่าเป็นแถว/ห้องใดเพื่อดูว่ายังรอรับหรือจ่ายแล้ว
- **Standard:** ไม่จัดตารางข้อมูลที่เลื่อนได้เป็น WCAG reflow failure โดยอัตโนมัติ
- **Recommendation:** เก็บตาราง desktop และทำแถว compact สำหรับมือถือที่เห็นห้อง/ชื่อ รหัส และสถานะพร้อมกัน กดขยายดูวันเวลา/หมายเหตุ ใช้โครงสร้างซ้ำที่ตรวจข้อมูลเร็ว หลีกเลี่ยงสร้างการ์ดตกแต่งหลายชั้น
- **Suggested command:** `$impeccable adapt`

### F11 [P2] เวลาพัสดุขึ้นกับ timezone ของเครื่อง

- **Location:** [shared.jsx:37](/home/danaiphong/CascadeProjects/Dormitory-Parcel-Management-Case-Studies-Project/docs/02-design/prototype/src/components/shared.jsx:37), [ParcelHubApp.jsx:82](/home/danaiphong/CascadeProjects/Dormitory-Parcel-Management-Case-Studies-Project/docs/02-design/prototype/src/components/ParcelHubApp.jsx:82)
- **Category:** Implementation Integrity
- **Evidence:** เก็บเวลาใหม่ด้วย UTC ISO แต่แสดงด้วย local Date getters ไม่มี `Asia/Bangkok` เป็นข้อจำกัดเดิมที่บันทึกไว้ใน DESIGN.md แล้ว ข้อมูล demo ยังไม่มี offset ระบุชัด
- **Impact:** เครื่องที่ตั้ง timezone ต่างกันเห็นเวลารับ/จ่ายต่างกัน ซึ่งทำให้ตรวจประวัติสับสน
- **Standard:** [PRODUCT.md:40](/home/danaiphong/CascadeProjects/Dormitory-Parcel-Management-Case-Studies-Project/PRODUCT.md:40) ระบุ Bangkok display
- **Recommendation:** frontend format ด้วย timezone `Asia/Bangkok` โดยตรง และกำหนดความหมาย timezone ของ fixture ให้ชัด
- **Suggested command:** `$impeccable harden`

### F12 [P2] ไม่มีขอบเขตจำนวนรายการที่ render และเขียน local storage

- **Location:** [shared.jsx:158](/home/danaiphong/CascadeProjects/Dormitory-Parcel-Management-Case-Studies-Project/docs/02-design/prototype/src/components/shared.jsx:158), [ParcelHubApp.jsx:61](/home/danaiphong/CascadeProjects/Dormitory-Parcel-Management-Case-Studies-Project/docs/02-design/prototype/src/components/ParcelHubApp.jsx:61)
- **Category:** Performance
- **Evidence:** render ทุกรายการที่ตรงคำค้น และ serialize/เขียนทั้ง array แบบ synchronous ทุกครั้งที่ข้อมูลเปลี่ยน ยังไม่มี pagination/windowing หรือ feedback การเขียนล้มเหลว ยืนยันโครงสร้างจาก source; ชุดข้อมูลที่ลองมีเจ็ดรายการเท่านั้น
- **Impact:** ประสิทธิภาพและการบันทึกเมื่อข้อมูลสะสมยังไม่มีหลักฐานรองรับ งานวิจัยระบุจำนวนรับเข้าเฉลี่ยราว 417.5 และ peak 1,024 ต่อวัน แต่ไม่ได้ใช้ตัวเลขนี้อ้างว่าหน้าเว็บปัจจุบันช้าแล้ว
- **Standard:** ความพร้อมต่อปริมาณข้อมูลเป้าหมาย และ pagination ที่ระบุไว้ใน [design-spec.md:154](/home/danaiphong/CascadeProjects/Dormitory-Parcel-Management-Case-Studies-Project/docs/02-design/design-spec.md:154); ไม่ใช่ WCAG claim
- **Recommendation:** ทำ pagination ตามสเปก แล้ววัดการค้นหา/นำออกกับ fixture ปริมาณสมจริงบนเครื่องเป้าหมายเพื่อเลือกจำนวนต่อหน้าและตัดสินว่าต้องใช้ windowing เพิ่มหรือไม่ แสดงสถานะการบันทึกผิดพลาดของต้นแบบ หลีกเลี่ยงเพิ่ม memoization ทุกที่โดยไม่มีผลวัด
- **Suggested command:** `$impeccable optimize`

## ช่องว่างจากสเปกที่ต้องตัดสินใจก่อนนำไปใช้งานจริง

สิ่งต่อไปนี้ยังไม่ได้ส่งมอบในต้นแบบ ไม่ใช่ regression จากการลด AI pattern และไม่ได้รวมเพิ่มในจำนวนข้อบกพร่องด้านบน:

| สิ่งที่สเปกระบุ | สถานะปัจจุบัน / ข้อเสนอ frontend |
|---|---|
| เลือกห้องจากทะเบียนที่ตรวจสอบแล้ว | ช่องห้องเป็นข้อความอิสระ ทดลอง `ZZ99` แล้วปุ่มบันทึก enabled ไม่มีชื่อผู้พักให้ตรวจ จึงยังไม่ตอบปัญหาห้องสลับ ควรทำ searchable directory selection จากข้อมูล mock ที่ยืนยันแล้วก่อนเป็นอันดับแรก |
| Daily totals / เลือกวันที่ | ปัจจุบันแสดงจำนวนรายการรอรับรวม ยังไม่ใช่สถิติการรับ/จ่ายรายวัน |
| Read-only Directory | ยังไม่มี destination สำหรับตรวจห้องและรายชื่อ |
| Parcel Detail / append-only Parcel History / Staff ที่ทำรายการ | Archive เป็นรายการพัสดุและเวลารับ/จ่าย ไม่ได้แสดง audit trail หรือคนทำรายการ |
| English strings v1 ตามสเปก | ต้นแบบยังใช้ Thai/ParcelHub/Archive ตาม incumbent เป็นช่องว่างที่ต้องปรับให้ตรงภาษาและชื่อที่ยืนยันไว้ใน PRODUCT.md:48 เว้นแต่ผู้ใช้เปลี่ยนขอบเขตภายหลัง |

อ้างอิง [design-spec.md:151](/home/danaiphong/CascadeProjects/Dormitory-Parcel-Management-Case-Studies-Project/docs/02-design/design-spec.md:151) และ [PRODUCT.md:29](/home/danaiphong/CascadeProjects/Dormitory-Parcel-Management-Case-Studies-Project/PRODUCT.md:29) การตรวจ directory ใน UI สามารถทำใน frontend ได้ แต่รายงานนี้ไม่ได้ยืนยัน server validation, RBAC, API, การบันทึกข้ามเครื่อง หรือระบบ audit จริง และไม่เสนอให้แก้ backend ในรอบ UX/UI นี้

ควรกำหนดหน่วยนับให้ชัดด้วย: fixture มีหนึ่ง tracking record ที่ qty=2 ส่วนรายการใหม่ qty=1 การนำออกแบบกลุ่มนับจำนวน records แล้วใช้คำว่า “ชิ้น” อย่าใช้จำนวน records เป็นหลักฐานว่าได้ตรวจและส่งมอบกล่องครบ การตรวจวัตถุจริงยังต้องจับคู่เป็นชิ้นตามงานเคาน์เตอร์

## รูปแบบปัญหาที่เกิดซ้ำ

- ข้อมูลห้อง/ชื่อ/สภาพกล่องถูกใช้ต่างความหมายระหว่าง display, search และ action ควรมีการ resolve identity ร่วมและแยก physical condition
- ช่องเดียวใช้ทั้งค้นหาและสแกน แต่ Enter กับการพิมพ์ตีความต่างกัน การเลือกจึงเกิดก่อนผู้ใช้จบ input
- ร่างรายการอยู่ในอายุของ modal จึงไม่มีการกู้คืนหลัง dismiss และไม่แยกระหว่างร่างที่เตรียมแล้วกับชิ้นที่ยังกรอกไม่ครบ
- ใช้ border token เดียวกันทั้งเส้นตกแต่งกับช่องกรอก ทำให้การลดความหนักของหน้าตากระทบการมองเห็น control

## สิ่งที่ดีและควรรักษา

- ปุ่ม “รับพัสดุเข้า” และ “นำพัสดุออก” สื่อการกระทำชัดกว่าคำสั้น “เข้า/ออก”
- ตาราง desktop สแกนข้อมูลได้เป็นแนวเดียว ลดตารางชำรุดที่ซ้ำจากมุมมองแรกด้วย disclosure
- มี persistent input labels, captions, column scopes, named scroll region และข้อความสถานะที่ไม่พึ่งสีอย่างเดียว
- native modal เปิดเป็น `:modal`, focus เริ่มช่องกรอก, Escape ปิดและคืน focus ผ่าน opener logic บนมือถือ dialog ไม่มีการล้นแนวนอน
- ปุ่มหลัก/ไอคอนมีพื้นที่กดส่วนใหญ่ 44px และมี focus indicator ชัด
- ค้นหาบน Dashboard มี live count และ Archive filter ใช้ pressed state; no-result state บอกวิธีแก้คำค้น
- contrast ข้อความบนขาวที่วัดได้: muted 5.90:1, primary 6.85:1, success 5.02:1, warning 6.57:1
- tokens ใช้ร่วมกันระหว่าง CSS และ inline styles; light-only เป็นข้อกำหนดปัจจุบัน ไม่รายงานการไม่มี dark mode เป็น defect
- reduced-motion alternative ยังรักษาข้อความและสถานะ ลด transition/animation โดยไม่ซ่อนผลการทำงาน
- ไม่มีภาพใหญ่หรือ motion หนักในเส้นทางทำงานหลัก และ production build ผ่าน

## ขั้นตอนใช้งานที่แนะนำ

**รับเข้า:** สแกนรหัส → เลือกห้องจากทะเบียน → ตรวจห้องและชื่อผู้พัก → เพิ่มลงร่างพร้อมสภาพกล่อง → บันทึกชุด → แสดงผลบันทึกและคืน focus ไปสแกนรายการถัดไป ร่างที่ยังไม่บันทึกต้องมีคำบอกสถานะชัด และการใช้ห้องเดิมต่อควรเป็นตัวเลือกที่มองเห็น

**นำออก:** ค้นหาห้อง/ชื่อ/รหัส → resolve ห้องเดียว → แสดงรายชื่อกับจำนวนรอรับ → หยิบและสแกนจับคู่พัสดุจริงแต่ละชิ้น → นำออกเฉพาะที่เลือก หรือยืนยันนำออกทั้งหมดของห้อง → แสดงห้องและจำนวนที่บันทึกแล้ว → เริ่มผู้รับถัดไป

แนวทางนี้ลดการกรอกซ้ำต่อผู้รับ แต่ยังคงการตรวจพัสดุจริงเป็นรายชิ้นตาม [งานวิจัย:56](/home/danaiphong/CascadeProjects/Dormitory-Parcel-Management-Case-Studies-Project/docs/02-design/survey_interview_analysis.md:56) ไม่ใช้ปุ่ม bulk เป็นทางลัดข้ามการตรวจกล่อง

## Recommended actions

1. **[P1] `$impeccable shape`** — กำหนด directory room selection, การส่งผลค้นหาไปนำออก และขอบเขต All/Selected ของผู้รับ; เป็นงาน frontend พร้อม mock data ตามขอบเขตที่ยืนยันแล้ว
2. **[P1 → P2] `$impeccable harden`** — แก้ scanner terminator, mixed-room guard, รักษาหมายเหตุชำรุด, control contrast, live scan result, search identity, draft recovery และ Bangkok time โดยเริ่มจาก F01–F05
3. **[P2] `$impeccable clarify`** — แยก copy ของค้นหา/สแกน/เพิ่มลงร่าง/บันทึกสำเร็จ ปรับ feedback Enter และอธิบายการใช้ห้องเดิมต่อ; ใช้ภาษาตามที่โครงการยืนยัน
4. **[P2] `$impeccable adapt`** — ให้ข้อมูลห้อง/รหัส/สถานะอยู่ด้วยกันบนมือถือ และตรวจ zoom/keyboard/touch หลังทำ
5. **[P2] `$impeccable optimize`** — ทำ pagination ตามสเปก วัดด้วยข้อมูลปริมาณสมจริงเพื่อเลือกขนาดหน้า/ความจำเป็นของ windowing และตรวจการบันทึกล้มเหลว
6. **[ขั้นสุดท้าย] `$impeccable polish`** — ตรวจรายละเอียดหลังขั้นตอนใช้งานถูกต้องและทดสอบผ่านแล้ว

สามารถสั่งให้ทำทีละข้อ ทำทั้งหมด หรือเรียงตามลำดับที่ต้องการได้ หลังแก้ให้รัน `$impeccable audit` อีกครั้งเพื่อตรวจคะแนนและข้อคงเหลือ

การยืนยันว่า “ใช้ง่ายขึ้นจริง” ควรทดลองกับเจ้าหน้าที่ 2–3 คน ด้วยโจทย์ห้องชื่อใกล้กัน, รหัส prefix ใกล้กัน, ผู้รับมีหลายชิ้น, สลับห้องระหว่างรับเข้า, duplicate code, พัสดุชำรุด และการปิดร่างโดยเผลอ จับเวลา/จำนวนการค้นหาซ้ำ/การเลือกผิด/การกู้คืน แล้วเทียบก่อน–หลัง ไม่ตั้งตัวเลขผลสำเร็จที่ยังไม่ได้วัด

## ภาพหลักฐาน

- [Desktop ปัจจุบัน](/home/danaiphong/CascadeProjects/Dormitory-Parcel-Management-Case-Studies-Project/.impeccable/review/reaudit-desktop.jpg)
- [Mobile ปัจจุบัน](/home/danaiphong/CascadeProjects/Dormitory-Parcel-Management-Case-Studies-Project/.impeccable/review/reaudit-mobile.jpg)
- [Dialog บน mobile](/home/danaiphong/CascadeProjects/Dormitory-Parcel-Management-Case-Studies-Project/.impeccable/review/reaudit-mobile-dialog.jpg)
- [ค้นหาห้องพบ แต่ Enter แจ้งไม่พบเลขพัสดุ](/home/danaiphong/CascadeProjects/Dormitory-Parcel-Management-Case-Studies-Project/.impeccable/review/reaudit-checkout-room-error.jpg)
- [พิมพ์รหัสมี X ต่อท้าย แต่พัสดุรหัสสั้นถูกเลือกแล้ว](/home/danaiphong/CascadeProjects/Dormitory-Parcel-Management-Case-Studies-Project/.impeccable/review/reaudit-checkout-prefix.jpg)
- [รายการที่สองไม่ครบ แต่บันทึกชุดยัง enabled](/home/danaiphong/CascadeProjects/Dormitory-Parcel-Management-Case-Studies-Project/.impeccable/review/reaudit-incomplete-draft.jpg)
