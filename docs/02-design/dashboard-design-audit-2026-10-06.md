# Dashboard UX/UI audit — 6 ตุลาคม 2569

**สถานะล่าสุด: แก้ทั้ง 6 ข้อตามการอนุมัติของผู้ใช้และตรวจซ้ำแล้ว — 17/20 ในขอบเขตที่ตรวจ** รายงานด้านล่างบันทึก baseline ก่อนแก้; ผลหลังแก้อยู่ท้ายเอกสาร

## Implementation Integrity Verdict

**ผ่านด้านความสอดคล้องของระบบ แต่มีข้อบกพร่องด้านสถานะและขอบเขตข้อมูลที่ควรแก้** หน้าเน้นงานเคาน์เตอร์จริง: ค้นหาพัสดุ รับเข้า นำออก และตรวจพัสดุชำรุด ใช้สีและองค์ประกอบร่วมกัน ไม่มีกราฟหรือตัวเลขตกแต่งที่ไม่สัมพันธ์กับงาน

Detector ของ Impeccable ตรวจ DashboardPage, shared, TopNav และ styles แล้วคืน `[]` — ไม่พบกฎผิดแบบอัตโนมัติ ผลนี้ไม่ได้ยืนยันว่าการใช้งานไม่มีปัญหา การทดลองพบว่าค้นหาแล้วหน้าของตารางชำรุดถูกรีเซ็ต และตารางมือถือซ่อนส่วนสำคัญของเลขพัสดุ

## สรุปผล

**14/20 — Good: ใช้งานได้ แต่ควรปรับด้านที่อ่อนก่อนเพิ่มรายละเอียดตกแต่ง** คะแนนเป็นการประเมิน frontend prototype ในขอบเขตนี้ ไม่ใช่การรับรอง WCAG หรือความพร้อม production

| ด้าน | คะแนน /4 | หลักฐานสำคัญ |
|---|---:|---|
| Accessibility | 3 | มี label, native table, heading, focus, status และ disclosure; ตรวจ keyboard บางเส้นทางและ contrast ผ่าน แต่ยังไม่ทดสอบ screen reader/ขยายตัวอักษรครบ |
| Performance | 3 | จำกัด DOM ที่ 8 รายการต่อหน้าและ memo ผลค้นหา; ตารางชำรุดยัง filter/sort ใหม่ทุกครั้งที่พิมพ์ ไม่ได้วัดเวลาที่ปริมาณสูง |
| Responsive Design | 2 | หน้าไม่ล้นแนวนอน แต่บนมือถือเลขพัสดุอ่านไม่ครบพร้อมเลขห้อง ต้องเลื่อนตาราง |
| Theming | 4 | ในขอบเขตธีมสว่างที่รองรับ ใช้ CSS tokens และ shared color mapping สอดคล้องกัน; ไม่มีการประเมิน dark mode |
| Implementation Integrity | 2 | พบการรีเซ็ตหน้าที่ไม่เกี่ยวกับค้นหา ขอบเขตค้นหาเปลี่ยน และการเรียงวันที่ที่ไม่ใช้กติกาเดียวกับวันที่แสดง |
| **รวม** | **14/20** | **Good** |

พบ **P0: 0, P1: 0, P2: 5, P3: 1** ไม่พบปัญหาที่ขัดขวางงานหลักจากเส้นทางที่ตรวจ

สิ่งที่ควรทำก่อน: จัดตารางมือถือให้อ่านห้องคู่กับรหัสได้ → รักษาหน้าของตารางชำรุดระหว่างค้นหา → ย่อพื้นที่ควบคุมเหนือรายการ โดยคงการแบ่งหน้า 8 รายการไว้

## ขอบเขตและหลักฐาน

- ภาพที่ผู้ใช้แนบ: Dashboard, 10 รายการ, หน้า 1 แสดง 8 รายการ, browser zoom 110% ใช้ประเมินภาพรวมและความหนาแน่น ไม่ถือว่าตำแหน่ง header ที่ถูกเลื่อนขึ้นเป็นข้อบกพร่อง
- ตรวจ source ปัจจุบันบน branch `codex/frontend-ux-ui-refresh` และหน้า localhost ใน Codex in-app browser ที่ desktop 1440×1000 และ mobile viewport 390×844
- ข้อมูล demo ใน browser ที่ตรวจมี 4 รายการรอรับ แตกต่างจากภาพแนบ จึงใช้ fixture ชั่วคราว 17 รายการ pending/damaged เพื่อทดลอง pagination โดยไม่แก้ข้อมูลเดิม ไม่เรียก backend และลบ fixture/ปิดแท็บทดสอบแล้ว
- ทดลองค้นหา `108/1` บน demo, เปลี่ยนหน้า main table และ damaged table และตรวจ focus จากช่องค้นหาไปยังตาราง
- [ภาพ desktop ที่ตรวจ](/home/danaiphong/CascadeProjects/Dormitory-Parcel-Management-Case-Studies-Project/.impeccable/review/dashboard-audit-desktop-20261006.jpg), [ภาพ mobile ที่ตรวจ](/home/danaiphong/CascadeProjects/Dormitory-Parcel-Management-Case-Studies-Project/.impeccable/review/dashboard-audit-mobile-20261006.jpg)
- ตรวจ responsive ด้วย viewport จำลอง ไม่ได้ทดสอบ gesture บนโทรศัพท์จริง, screen reader, text zoom 200%, network performance หรือ backend ไม่อ้างว่าผ่านรายการเหล่านี้

## รายละเอียดตามความสำคัญ

### 1. [P2] มือถือต้องเลื่อนแนวนอนเพื่ออ่านรหัสพัสดุคู่กับห้อง

**ตำแหน่ง:** [styles.css:200](/home/danaiphong/CascadeProjects/Dormitory-Parcel-Management-Case-Studies-Project/docs/02-design/prototype/src/styles.css:200), [shared.jsx:154](/home/danaiphong/CascadeProjects/Dormitory-Parcel-Management-Case-Studies-Project/docs/02-design/prototype/src/components/shared.jsx:154)

**หมวด:** Responsive Design

**หลักฐาน:** ที่ viewport 390px หน้า document กว้าง 375px และพื้นที่ตารางกว้าง 333px แต่ตารางมีความกว้าง 850px เซลล์รหัสของแถวแรกเริ่ม x≈282 และสิ้นสุด x≈455 เกินขอบด้านขวาของพื้นที่ตาราง เลขพัสดุจึงถูกตัด ขณะที่ห้อง/ชื่อยังมองเห็น ภาพ mobile ยืนยันผลนี้

**ผลกระทบ:** เจ้าหน้าที่ต้องเลื่อนซ้ายขวาเพื่อเทียบห้องกับรหัส เสี่ยงอ่านข้ามแถว โดยเฉพาะหลายรายการในห้องเดียวกัน

**มาตรฐาน:** ยังไม่ถือว่าเป็น WCAG 1.4.10 violation โดยอัตโนมัติ เพราะตารางสองมิติมีข้อยกเว้น reflow และ scroll ถูกจำกัดอยู่ในตาราง นี่เป็นปัญหาความสะดวกในการทำงานที่ยืนยันได้

**ข้อเสนอ:** บนมือถือจัดหนึ่งรายการให้แสดงห้อง/ชื่อและรหัสเต็มพร้อมจำนวนในพื้นที่เดียวกัน วันที่และรายละเอียดรองเปิดดูได้ แสดงข้อมูลเดิมครบและรักษาชื่อ/สถานะที่เข้าถึงได้ บน desktop สามารถคงตารางไว้ได้ ในมุมมอง pending คอลัมน์สถานะที่ซ้ำทุกแถวและวันที่นำจ่ายที่เป็น `–` ทุกแถวอาจย้ายไปส่วนรายละเอียด; เมื่อค้นหาประวัติยังต้องแสดงสถานะนำออกให้ชัด

**คำสั่ง:** `$impeccable adapt Dashboard`

### 2. [P2] พิมพ์ค้นหาแล้วตารางชำรุดย้อนกลับหน้า 1

**ตำแหน่ง:** [DashboardPage.jsx:18](/home/danaiphong/CascadeProjects/Dormitory-Parcel-Management-Case-Studies-Project/docs/02-design/prototype/src/components/DashboardPage.jsx:18), [shared.jsx:127](/home/danaiphong/CascadeProjects/Dormitory-Parcel-Management-Case-Studies-Project/docs/02-design/prototype/src/components/shared.jsx:127)

**หมวด:** Implementation Integrity / Performance

**หลักฐาน:** fixture มี 17 รายการชำรุด เปิดตารางชำรุด เลือกหน้า 2 แล้วพิมพ์ `090` ในช่องค้นหาหลัก พบว่า active page ของตารางชำรุดเปลี่ยนจาก `2` เป็น `1` แม้ชุดข้อมูลชำรุดไม่ได้เปลี่ยน สาเหตุคือ filter/sort สร้าง array ใหม่ในแต่ละ render และ effect ของ ParcelTable รีเซ็ตเมื่อ reference ของ `parcels` เปลี่ยน

**ผลกระทบ:** ผู้ใช้เสียตำแหน่งที่กำลังตรวจ ต้องกลับไปเปิดหน้าเดิม และเหตุผลชำรุดที่เปิดไว้อาจถูกปิดร่วมด้วย การค้นหาตารางหลักไม่ควรเปลี่ยนตำแหน่งของตารางที่ไม่ได้ถูกกรอง

**มาตรฐาน:** ไม่มี WCAG violation ที่ยืนยันจากการทดลองนี้

**ข้อเสนอ:** memo ชุดข้อมูลชำรุดตามข้อมูลพัสดุจริง และรีเซ็ต page เฉพาะเมื่อ query/filter ของตารางนั้นเปลี่ยน เมื่อข้อมูลลดลงให้ clamp หน้าปัจจุบันให้ถูกต้อง การค้นหาหลักยังควรเริ่มที่หน้า 1 ตามเดิม

**คำสั่ง:** `$impeccable harden Dashboard pagination`

### 3. [P2] พื้นที่ค้นหาและแถบแบ่งหน้าแยกชั้นมากกว่าที่จำเป็น

**ตำแหน่ง:** [DashboardPage.jsx:55](/home/danaiphong/CascadeProjects/Dormitory-Parcel-Management-Case-Studies-Project/docs/02-design/prototype/src/components/DashboardPage.jsx:55), [shared.jsx:142](/home/danaiphong/CascadeProjects/Dormitory-Parcel-Management-Case-Studies-Project/docs/02-design/prototype/src/components/shared.jsx:142), [styles.css:70](/home/danaiphong/CascadeProjects/Dormitory-Parcel-Management-Case-Studies-Project/docs/02-design/prototype/src/styles.css:70), [styles.css:314](/home/danaiphong/CascadeProjects/Dormitory-Parcel-Management-Case-Studies-Project/docs/02-design/prototype/src/styles.css:314)

**หมวด:** Implementation Integrity — ข้อเสนอด้านลำดับชั้นภาพ ไม่ใช่ detector finding

**หลักฐาน:** ที่ desktop 1440×1000 พื้นที่ค้นหาสูงประมาณ 153px แถบ range เมื่อมีหน้าเดียวสูง 42px และเมื่อมี numbered controls สูง 65px แถวข้อมูลแรกของหน้าจริงเริ่มที่ y≈512 ทั้งที่การทำงานหลักอยู่ในรายการ มีจำนวนข้อมูลซ้ำใน context เหนือตาราง, count ข้าง label และ range ใต้ช่องค้นหา

**ผลกระทบ:** ตารางเริ่มต่ำและข้อมูลรองแย่งพื้นที่จากรายการจริง บนหน้าจอสั้น ผู้ใช้ยังต้องเลื่อนเพื่อเห็นข้อมูลท้าย 8 รายการ แม้แบ่งหน้าแล้ว

**มาตรฐาน:** เป็น judgment เรื่องพื้นที่และการอ่าน ไม่อ้าง WCAG violation หรือผลความเร็วจาก user test

**ข้อเสนอ:** รวมจำนวน/range ให้เหลือจุดหลักเดียว ลด padding และช่องว่างที่ซ้ำ จัดปุ่มเลขหน้าในแถบควบคุมที่กระชับเหนือรายการ คง search เต็มพื้นที่และปุ่มกดอย่างน้อย 44px โดยไม่ลดความอ่านง่ายของข้อความ ห้ามแก้ด้วยการเพิ่ม widget หรือข้อความอธิบาย

**คำสั่ง:** `$impeccable layout Dashboard toolbar` แล้ว `$impeccable distill Dashboard`

### 4. [P2] ขอบเขตค้นหาขยายจากรอรับเป็นทุกสถานะโดยไม่มีตัวเลือกให้เห็นก่อน

**ตำแหน่ง:** [DashboardPage.jsx:37](/home/danaiphong/CascadeProjects/Dormitory-Parcel-Management-Case-Studies-Project/docs/02-design/prototype/src/components/DashboardPage.jsx:37), [DashboardPage.jsx:6](/home/danaiphong/CascadeProjects/Dormitory-Parcel-Management-Case-Studies-Project/docs/02-design/prototype/src/components/DashboardPage.jsx:6)

**หมวด:** Implementation Integrity

**หลักฐาน:** ก่อนค้นหาแสดงเฉพาะ status `in` และข้อความ “พัสดุรอรับทั้งหมด” แต่เมื่อมี query จะค้นหาจาก parcels ทุกสถานะ ทดลองค้นหา `108/1` ได้รายการ “นำออกแล้ว” แม้ไม่มีพัสดุ pending ของห้องนั้น ข้อความหลังค้นหาแสดง “รับครบแล้ว” จึงมี feedback รองรับบางส่วนอยู่แล้ว

**ผลกระทบ:** เจ้าหน้าที่อาจเข้าใจว่าการค้นหาอยู่ในชุดรอรับเดิม และสับสนเมื่อรายการที่นำออกแล้วปรากฏ โดยเฉพาะเมื่อกำลังส่งพัสดุคืนให้ผู้รับ

**มาตรฐาน:** ไม่พบ WCAG violation; เป็นความชัดเจนของขอบเขตข้อมูล

**ข้อเสนอ:** ระบุ scope ให้สั้นและเห็นก่อนค้นหา เช่น “รอรับ” พร้อมตัวเลือก “รวมประวัติ” หรือแยก history results พร้อมสถานะให้ชัด รักษาความสามารถค้นหาประวัติเดิม ไม่เปลี่ยนเป็นค้นหา pending เท่านั้นโดยไม่มีทางเลือก

**คำสั่ง:** `$impeccable clarify Dashboard search`

### 5. [P2] ตารางชำรุดเรียงวันที่ต่างจากเวลาที่แสดงได้เมื่อ timezone ของเครื่องต่างกัน

**ตำแหน่ง:** [DashboardPage.jsx:20](/home/danaiphong/CascadeProjects/Dormitory-Parcel-Management-Case-Studies-Project/docs/02-design/prototype/src/components/DashboardPage.jsx:20), [parcelRules.js:61](/home/danaiphong/CascadeProjects/Dormitory-Parcel-Management-Case-Studies-Project/docs/02-design/prototype/src/lib/parcelRules.js:61)

**หมวด:** Implementation Integrity

**หลักฐาน:** ตารางแสดงวันที่ผ่าน helper ที่ตีความ timestamp รุ่นเก่าซึ่งไม่มี offset ว่าเป็นเวลาบางกอก แต่การ sort ใช้ `new Date` โดยตรง ทดลอง runtime ที่ TZ=UTC ด้วย legacy `2026-08-15T08:30:00` และ UTC `2026-08-15T02:00:00Z` ซึ่งแสดง 08:30 และ 09:00 ตามลำดับ พบว่าการ sort ปัจจุบันให้ 09:00 มาก่อน 08:30 ส่วน sort ด้วย parseParcelDate ให้ลำดับตรงกับเวลาที่แสดง

**ผลกระทบ:** ตารางที่ตั้งใจแสดงรายการเก่าก่อนอาจจัดลำดับผิดบนเครื่องที่ timezone ต่างจากบางกอก เป็นกรณี edge case ของข้อมูล demo/ข้อมูลเดิมที่ผสมรูปแบบ ไม่ได้อ้างว่าภาพของผู้ใช้เรียงผิดแล้ว

**มาตรฐาน:** ไม่เกี่ยวกับ WCAG

**ข้อเสนอ:** ใช้ parseParcelDate ใน comparator เดียวกับการแสดงวันที่ และตรวจกรณี timestamp เก่า/UTC ผสมกันภายใต้ timezone ต่างกัน แก้เฉพาะ frontend; ไม่เปลี่ยน backend

**คำสั่ง:** `$impeccable harden Dashboard dates`

### 6. [P3] ตารางหดลงมากในหน้าสุดท้ายที่มีข้อมูลน้อย

**ตำแหน่ง:** [shared.jsx:161](/home/danaiphong/CascadeProjects/Dormitory-Parcel-Management-Case-Studies-Project/docs/02-design/prototype/src/components/shared.jsx:161), [styles.css:83](/home/danaiphong/CascadeProjects/Dormitory-Parcel-Management-Case-Studies-Project/docs/02-design/prototype/src/styles.css:83)

**หมวด:** Responsive Design / Implementation Integrity

**หลักฐาน:** fixture 17 รายการ: หน้า 1 มี 8 แถว card สูง≈688px; หน้า 3 มี 1 แถว card สูง≈317px ส่วนชำรุดด้านล่างจึงขยับขึ้นประมาณ 371px

**ผลกระทบ:** จุดอ่านและเนื้อหาถัดไปขยับเมื่อเปลี่ยนหน้า อย่างไรก็ตามเป็นการเปลี่ยนที่ผู้ใช้สั่งเองและยังใช้งานได้ จึงจัดเป็น polish ไม่อ้างว่าเป็น CLS failure

**มาตรฐาน:** ไม่มี violation ที่ยืนยัน

**ข้อเสนอ:** ถ้าผู้ใช้ยังรู้สึกว่าหน้ากระโดด ให้ทดลองพื้นที่รายการที่คงระดับพอดีกับหน้าจอบน desktop และเก็บ pager ไว้ตำแหน่งเดิม ไม่จำเป็นต้องบังคับช่องว่าง 8 แถวบนมือถือหรือผลค้นหาสั้นจนเกิดพื้นที่ว่างจำนวนมาก

**คำสั่ง:** `$impeccable polish Dashboard pagination`

## Patterns & Systemic Issues

- Shared ParcelTable ถ่ายทอดโครงสร้าง 6 คอลัมน์เหมือนกันให้ Dashboard และ Archive แม้บริบทข้อมูลต่างกัน ควรให้ layout รองรับทั้ง pending operations และ history โดยยังใช้ semantics/tokens ร่วมกัน
- การใช้ reference ของ array เป็นเหตุรีเซ็ตสถานะทำให้ “render ใหม่” เท่ากับ “ผู้ใช้เปลี่ยนชุดข้อมูล” ควรแยกเหตุการณ์ทั้งสองให้ชัด
- กติกาการตีความวันที่มี helper อยู่แล้ว แต่การ sort ยังใช้กติกาของเครื่อง จุดเปรียบเทียบและจุดแสดงควรอ้างอิงเวลาแบบเดียวกัน

## สิ่งที่ทำได้ดีและควรรักษา

- จำกัด 8 รายการต่อหน้าและมีเลขหน้า/range ชัดเจน ลดความยาวหน้าจริง ควรคงไว้ทั้ง main table และ damaged table
- Pagination เป็น native buttons มี aria-current และ disabled ที่ขอบหน้า; ปุ่มหลักและปุ่มเลขหน้ามีพื้นที่กดขั้นต่ำ 44px
- Table ใช้ caption, column scope และ named focusable scroll region ทดสอบ Tab จากช่องค้นหาแล้ว focus ไปที่ region ผลการค้นหา พร้อม outline 2px ที่มองเห็น
- มี label คงที่สำหรับช่องค้นหาและปุ่มล้างคำค้นหา feedback ใช้ role=status
- ข้อความบนพื้นขาวมี contrast: body 16.10:1, muted 5.90:1, primary 6.85:1, warning 6.57:1, success 5.02:1 ผ่านเกณฑ์ AA สำหรับ normal text ของคู่สีที่ตรวจ ไม่ควรเพิ่มความเข้มเพียงเพื่อสร้างลำดับชั้น
- พัสดุชำรุดใช้ข้อความร่วมกับสีและ disclosure จึงไม่สื่อด้วยสีเพียงอย่างเดียว
- มี reduced-motion rule; ไม่พบการเคลื่อนไหวหนักหรือ effect ตกแต่งที่ขัดกับงานในหน้าเป้าหมาย
- โครงสร้างสงบและตรงกับงานเคาน์เตอร์อยู่แล้ว การแก้ควรเป็นการจัดพื้นที่และป้องกันความสับสน ไม่ต้องเพิ่ม dashboard widgets หรือเปลี่ยนสีทั้งระบบ

## Recommended Actions

1. **[P2] `$impeccable adapt Dashboard`** — ให้มือถืออ่านเลขห้องคู่รหัสเต็มได้พร้อมกัน
2. **[P2] `$impeccable harden Dashboard`** — รักษาหน้าตารางชำรุดเมื่อค้นหา และใช้กติกาเวลาบางกอกใน sort
3. **[P2] `$impeccable layout Dashboard`** และ **`$impeccable distill Dashboard`** — ลดชั้น toolbar/ข้อมูลจำนวนซ้ำ คง pagination 8 รายการเหนือข้อมูล
4. **[P2] `$impeccable clarify Dashboard`** — ทำให้ขอบเขตค้นหารอรับ/รวมประวัติชัดก่อนเริ่มค้นหา
5. **[P3] `$impeccable polish Dashboard`** — ตรวจความนิ่งของหน้า sparse และลำดับชั้นหลังแก้ โดยรักษาระดับสีที่ผู้ใช้ชอบ

สามารถขอให้ทำทีละข้อ ทำทั้งหมด หรือเลือกตามลำดับที่ต้องการได้ หลังแก้ให้รัน `$impeccable audit` อีกครั้งเพื่อตรวจผลและคะแนนใหม่

รอบนี้เป็นการรีวิวเท่านั้น ไม่มีการแก้ source ของหน้าเว็บหรือ backend


## ตรวจซ้ำหลังแก้ตามการอนุมัติของผู้ใช้

**17/20 — Good**: Accessibility 3, Performance 3, Responsive 3, Theming 4, Implementation Integrity 4. ไม่พบ P0/P1/P2/P3 คงค้างจากหกข้อเดิมในเส้นทางและข้อมูลที่ทดลอง คะแนนยังไม่เต็มเพราะไม่ได้ตรวจ screen reader, text zoom 200%, physical touch devices และ performance benchmark จึงไม่อ้างการรับรองหรือ production readiness

| ข้อเดิม | ผลหลังแก้ | หลักฐาน |
|---|---|---|
| มือถืออ่านรหัสไม่ครบ | แก้แล้ว | ห้อง/ชื่อและรหัสเต็มอยู่ใน flat list เดียวกัน ไม่มี horizontal overflow ที่ 390 และ 320px; รหัส 256 ตัวอักษรและหมายเหตุยาว wrap ได้ |
| ตารางชำรุดกลับหน้า 1 | แก้แล้ว | เปิดหน้า 2 แล้วค้นหา `090` ในตารางหลัก ยังอยู่หน้า 2; ลดข้อมูลจาก 17 เป็น 9 ขณะอยู่หน้า 3 clamp เป็นหน้า 2 |
| พื้นที่ค้นหา/จำนวนซ้ำ | แก้แล้ว | ปุ่มงานรวมกับ heading, count ซ้ำและคำอธิบายค่าเริ่มต้นถูกนำออก; search toolbar 120px จาก 153px, แถวแรกที่ desktop fixture y≈426 |
| ขอบเขตค้นหาเปลี่ยนเงียบ ๆ | แก้แล้ว | ค้นหา pending เป็นค่าเริ่มต้น, native “รวมประวัติ” เปิดผล `out` และแสดง status/checkout columns ชัดเจน |
| วันที่เรียงผิดตาม timezone | แก้แล้ว | ใช้ parseParcelDate comparator; regression ผ่านใน UTC, Bangkok และ New York โดยไม่แก้ข้อมูลต้นทาง |
| sparse last page ขยับ | แก้แล้ว | card หน้า 1 (8 records) และหน้า 3 (1 record) ของ fixture สูงเท่ากัน 636px บน desktop; ไม่บังคับพื้นที่ว่างบนมือถือหรือผลค้นหาหน้าเดียว |

ทดสอบชุดจำลอง 1,024 รายการแล้ว pagination แสดง 8 รายการต่อหน้าและค้นหารหัสท้ายชุดได้; นี่เป็น functional check ไม่ใช่ latency/load benchmark ทดสอบ 16 ข้อและ production build ผ่าน Detector ไม่พบกฎผิด (`[]`). ปุ่มรับเข้า/นำออกเปิด modal เดิมได้; Archive คง 6 คอลัมน์และ pagination เดิม สี root และสีอ่อนเฉพาะ checkout คงเดิม

[ภาพ Dashboard หลังปรับ](/home/danaiphong/CascadeProjects/Dormitory-Parcel-Management-Case-Studies-Project/.impeccable/review/dashboard-refined-desktop-20261006.jpg), [ภาพมือถือหลังปรับ](/home/danaiphong/CascadeProjects/Dormitory-Parcel-Management-Case-Studies-Project/.impeccable/review/dashboard-refined-mobile-20261006.jpg), [ตัวอย่างแบ่งหน้าด้วยข้อมูลจำลอง](/home/danaiphong/CascadeProjects/Dormitory-Parcel-Management-Case-Studies-Project/.impeccable/review/dashboard-refined-pagination-20261006.jpg). รายละเอียดการตรวจอยู่ใน [บันทึกงาน](/home/danaiphong/CascadeProjects/Dormitory-Parcel-Management-Case-Studies-Project/docs/05-log/20261006-frontend-harden.md)

แก้เฉพาะ frontend และเอกสารที่เกี่ยวข้อง ไม่แก้ backend หรือข้อมูลพัสดุที่บันทึกไว้


### การตัดสินใจล่าสุดของผู้ใช้: นำ “รวมประวัติ” ออก

ผู้ใช้ขอเอาตัวเลือกนี้ออกหลังดูผลจริง จึงปรับ Dashboard ให้ค้นหาเฉพาะพัสดุรอรับเสมอ และใช้ Archive เป็นที่ค้นหาประวัติแทน ลดตัวเลือกและพื้นที่แถวควบคุม โดยยังแก้ปัญหาขอบเขตค้นหาที่เปลี่ยนโดยไม่เห็นก่อนอยู่ ทดสอบค้นหาห้องที่มีเฉพาะรายการนำออกแล้ว: Dashboard แจ้งไม่พบรอรับ ส่วน Archive ยังค้นหาเจอ พร้อมสถานะและวันที่นำจ่าย ตรวจจอใหญ่/มือถือแล้ว และทดสอบ 16 ข้อกับ build ผ่าน ผลเรื่อง Include History ในบันทึกก่อนหน้านี้เป็นประวัติของการปรับครั้งแรก
