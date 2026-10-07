# UX/UI shape brief — Parcel Desk

วันที่: 5 ตุลาคม 2026

สถานะ: **ร่างสำหรับยืนยัน — ยังไม่ได้อนุมัติให้เป็นข้อกำหนดการลงมือทำ**
ขอบเขต: frontend UX/UI; ไม่มีการแก้ application code หรือ backend ในรอบ shape นี้

## 1. งาน ผู้ใช้ และผลที่ต้องการ

ผู้ใช้หลักคือ Staff ที่เคาน์เตอร์หอพัก ทำ Check-In, ค้นหา Pending Parcels และ Check-Out ระหว่างมีผู้พักรอรับ โดยเฉพาะช่วงคิวหนาแน่น โหมดของหน้าจอคือ **Operate**: ทำรายการได้ถูกต้อง อ่านข้อมูลเร็ว และใช้คีย์บอร์ด/เครื่องสแกนต่อเนื่องได้

เป้าหมายคือให้ Staff ระบุห้องได้ครั้งเดียว เห็นว่า Parcel ใดเป็นของห้องนั้น และทำงานต่อได้โดยไม่ค้นใหม่หรือสูญเสียสิ่งที่กรอก ความสวยและความทันสมัยมาจากลำดับข้อมูล การจัดแนว พื้นที่ว่างที่พอดี และ control ที่สื่อสถานะชัด

ร่างนี้ใช้สมมติฐานชั่วคราวสองข้อระหว่างรอคำตอบ discovery:

- Check-In และ Check-Out สำคัญเท่ากัน
- เริ่มงานหลัก Dashboard / Check-In / Check-Out / Search แล้วขยายไป Directory และ Parcel Detail ให้ครบ frontend ตามสเปกในช่วงถัดไป หากผู้ใช้เลือกทำครบ frontend ตั้งแต่รอบแรก ให้รวมช่วงที่ 2 เข้าในขอบเขตรอบนั้นโดยไม่เปลี่ยนแนวทาง

ผล audit ล่าสุด **13/20** ใช้เป็นฐานระบุข้อบกพร่อง ไม่ใช้เป็นตัวเลขความพึงพอใจหรือผลวัดว่า Staff ทำงานเร็วขึ้น ([รายงาน re-audit](/home/danaiphong/CascadeProjects/Dormitory-Parcel-Management-Case-Studies-Project/docs/02-design/frontend-ux-ui-reaudit-2026-10-05.md))

## 2. หลักฐานและสิ่งที่ถือเป็นข้อกำหนด

**Product/design authority:** [design-spec.md](/home/danaiphong/CascadeProjects/Dormitory-Parcel-Management-Case-Studies-Project/docs/02-design/design-spec.md) ที่ยืนยันแล้วและ [PRODUCT.md](/home/danaiphong/CascadeProjects/Dormitory-Parcel-Management-Case-Studies-Project/PRODUCT.md) คงชื่อ **Dormitory Parcel Management System / Parcel Desk**, English v1, terminology, light theme, system fonts และโครงเมนูด้านบน

**Incumbent visual evidence:** frontend ปัจจุบันที่ `App.jsx → ParcelHubApp.jsx` และ [ภาพ desktop ล่าสุด](/home/danaiphong/CascadeProjects/Dormitory-Parcel-Management-Case-Studies-Project/.impeccable/review/reaudit-desktop.jpg) การจัดข้อมูลแบบตาราง สีหลักจำกัด และ focus/label/native dialog ที่ปรับแล้วเป็นสิ่งที่รักษาไว้ ส่วนชื่อ ParcelHub, Thai copy, Noto web font และ tokens บางค่าคือความต่างจาก target ที่บันทึกไว้แล้ว

**User evidence:** Staff รายงานปัญหาเลขห้องไม่ชัด ชื่อเล่น ห้องสลับ ความผิดพลาดขณะคิวหนาแน่น และต้องการบันทึก Check-Out รวมต่อห้องโดยยังตรวจ Parcel จริงรายชิ้น ([บทวิเคราะห์:50](/home/danaiphong/CascadeProjects/Dormitory-Parcel-Management-Case-Studies-Project/docs/02-design/survey_interview_analysis.md:50)) ไม่เพิ่มนโยบายตรวจบัตรประชาชนหรือข้ามการตรวจ Parcel จริง

| ข้อกำหนดที่ยืนยันแล้ว | ข้อเสนอเพิ่มเติมจาก audit |
|---|---|
| Room Number ต้องเลือกจาก Resident Directory | แสดง Building, Room Number และชื่อผู้พักในบริบทเดียวกัน; ใช้ข้อมูลเดียวกันทั้ง display/search |
| Check Out All และ Check Out Selected ต้องมีทั้งคู่ | การเลือกและสแกนอยู่ในขอบเขตหนึ่งห้อง; เปลี่ยนห้องต้องจัดการการเลือกเดิมอย่างชัดเจน |
| Check Out All มี confirm ห้องและจำนวน | รักษารายการที่เลือกและ feedback ไว้เมื่อการทำรายการล้มเหลว |
| Check-In สำเร็จแล้วอยู่หน้าเดิมและขึ้นใน running list | รอ scan completion เช่น Enter ก่อนรับรหัส; คืน focus ไปสแกนต่อ |
| มี Search/Directory pagination และ Parcel History | ปกป้องร่างที่ยังไม่บันทึก; ไม่ให้สถานะร่างดูเหมือนบันทึกสำเร็จ |
| Online validation/recording, Bangkok time | แยกการค้นหาผู้พักออกจากช่องสแกน และประกาศผล scan แบบสั้น |

ไม่มีการเลือก visual world ใหม่หรือเปิดการแข่งขัน concept: งานนี้ปรับหน้าจอและขั้นตอนที่สเปกกำหนดไว้ในโลกภาพลักษณ์เดิม ไม่สร้างแบรนด์ใหม่ ร่างนี้จึงไม่ใช่ direction contract และไม่เปลี่ยน DESIGN.md หรือ design tokens

## 3. ทิศทางภาพลักษณ์และโครงสร้างที่เสนอ

**แนวทาง: เคาน์เตอร์ที่อ่านเร็วและทำงานต่อเนื่อง**

- พื้นสว่าง พื้นที่ทำงานสีขาว ตารางมีเส้นแบ่งบางและหัวตารางชัด ใช้ blue ของสเปกกับ action/selection/focus, green กับ Check-In confirmation และ success สีอื่นต้องมีความหมายตามสถานะ
- ใช้ UI sans สำหรับข้อความทั่วไป และ UI mono ตาม stack/token ของสเปกสำหรับ Tracking Code และ Room Number ขนาดข้อมูลอ่านง่าย ตัวเลขอ่านเปรียบเทียบได้ ใช้ลำดับน้ำหนักตัวอักษรมากกว่าหัวเรื่องใหญ่
- แถบเมนูบนเรียบ มีชื่อ Parcel Desk และ Staff ที่ลงชื่อเข้าใช้ หัวเรื่องและปุ่มหลักอยู่ใกล้ข้อมูลที่เกี่ยวข้อง
- ความหนาแน่นเหมาะกับการสแกนตารางบนคอมพิวเตอร์ มีพื้นที่กดและ focus เพียงพอ รูปทรง control สม่ำเสมอ เงาใช้กับ dropdown/confirmation ที่ต้องแยกจากพื้นหลัง
- ใช้แถบตัวตนของห้องที่เลือกเป็นจุดหลักของ Check-Out: **Building · Room Number · Resident names · Pending count** คงไว้ขณะค้นย่อย เลือก และสแกน
- Check-In / Check-Out เป็นหน้าทำงานตาม route ของสเปก ช่วยให้รายการและบริบทไม่หายตามอายุ modal; ใช้ dialog สำหรับยืนยัน Check Out All และการทิ้งร่างเมื่อจำเป็น
- ความเป็นเอกลักษณ์อยู่ที่ห้อง ผู้พัก และความถูกต้องของ Parcel แต่ละชิ้น ไม่เพิ่ม hero, dotted pattern, decorative tiles, รูปประกอบ หรือ animation ที่ทำให้รอทำงาน

**ผลต่อการสร้าง:** ใช้ form/table/identity header ร่วมกัน, room directory resolver เดียวกัน, state ของ draft/selection ที่ไม่หายเมื่อเปิด–ปิด overlay และ copy กลางตามสเปก หน้าเว็บยังใช้ React/Vite/Tailwind และ Lucide ชุดเดิม

## 4. หน้าจอและลำดับข้อมูล

โครงเมนูเป้าหมายตามสเปก: **Dashboard · Check-In · Check-Out · Search · Directory** ข้อมูลหน้ารายละเอียดเปิดจาก Parcel ในผลค้นหาหรือรายการ Check-Out; ไม่มีเมนู Archive แยกแทน Search/Parcel History

| หน้า | สิ่งที่เห็นก่อน | งานและรายละเอียดถัดไป |
|---|---|---|
| Dashboard `/` | วันที่และข้อมูล Checked In / Picked Up / Pending สามช่องแบบกระชับ | recent Check-In table, ทางไป Check-In / Check-Out; ไม่ใช้หน้านี้ให้กรอกขั้นตอนทั้งหมด |
| Check-In `/check-in` | Tracking Code → directory Room Number → room identity summary → Check In Parcel | today's successful Check-Ins; หมายเหตุสภาพ Parcel เป็นรายละเอียดรอง; ถ้าคงตัวช่วย batch เดิมต้องแยกร่างจากรายการสำเร็จ |
| Check-Out `/check-out` | ค้นหาห้อง/ชื่อจาก directory → room identity header | Pending table, ช่อง scan แยก, selected summary, Check Out All / Check Out Selected |
| Search `/search` | ช่องค้นหา Room Number / Tracking Code / Resident name, filter สถานะและจำนวนผล | paginated table, action ไป Check-Out สำหรับห้องที่ resolve แล้ว, link ไป Parcel Detail |
| Directory `/directory` | ค้นหาชื่อ/ชื่อเล่น/ห้อง | read-only paginated Room / Building / Resident / Nickname table; ไม่มี edit action |
| Parcel Detail `/parcels/:trackingCode` | Tracking Code, สถานะ, ห้อง/ผู้พัก, หมายเหตุ | Parcel History ที่แสดง Staff และเวลา Bangkok; รักษาหมายเหตุแม้มีการยืนยันตัวตน |
| Sign In `/login` และ Not Found | form ที่มี label หรือข้อความผิด route | error ใกล้ช่องกรอก/กลับ Dashboard; ใช้ vocabulary และชุด control เดียวกัน |

ในงานแบ่งช่วง เมนูที่ส่งมอบต้องเชื่อมไปหน้าที่ใช้งานได้จริง ไม่มีปุ่มเปล่า/ลิงก์ dead end หากยังไม่ทำ Directory/Detail ให้บันทึกว่ายังเป็นการส่งมอบบางส่วนจนกว่าช่วงที่ 2 เสร็จ ไม่ถือว่าครบสเปก

## 5. ขั้นตอนและพฤติกรรม

### Check-In

1. เริ่ม focus ที่ Tracking Code รับ scan หรือพิมพ์ รอ completion event ก่อนยอมรับรหัส ข้อเสนอเริ่มต้นคือ Enter; ต้องยืนยันกับการตั้งค่าของเครื่องสแกนก่อนลงมือรองรับเครื่องจริง
2. ค้นหาห้องด้วยชื่อผู้พัก/Room Number และเลือก directory entry จริง แสดง Building เป็นข้อมูลระบุตัวห้องเมื่อเลขซ้ำกัน ไม่เพิ่ม Building assignment ให้ Parcel
3. แสดงห้องและรายชื่อผู้พักที่ resolve แล้วให้ตรวจ Room Number อย่างเดียวต้องไม่ตีความเป็น Resident คนใดคนหนึ่งโดยอัตโนมัติเมื่อห้องมีหลายคน
4. กด **Check In Parcel** ถ้ารหัสซ้ำแสดง Tracking Code, ห้องเดิมและเวลาที่ Check-In ให้แก้ได้ ข้อมูลไม่ครบแสดง error ใกล้ช่องและคงข้อมูลไว้
5. ระหว่าง submit ป้องกันกดซ้ำ สำเร็จเมื่อได้รับผลยืนยันเท่านั้น แล้วเพิ่มใน today's list พร้อม feedback รหัส/ห้องและคืน focus ไป Tracking Code
6. ห้องเดิมใช้ต่อได้เมื่อเป็นการเลือกที่มองเห็นและเปลี่ยนได้ชัด; ค่าเริ่มต้นสำหรับรายการถัดไปคือให้ตรวจ/เลือกห้องอีกครั้ง ไม่ carry ห้องเดิมอย่างเงียบ ๆ

ตัวช่วย batch ที่ต้นแบบมีอยู่เป็น **ส่วนเสริมเดิมที่ต้องรักษาความสามารถและป้องกันข้อมูลหาย** จนกว่าจะมีคำตัดสินเรื่องการปรับมัน ไม่ถือเป็น bulk Check-In requirement ของสเปก ร่างมีสถานะยังไม่บันทึกชัดเจน เปิดกลับมาทำต่อได้หรือทิ้งโดยตั้งใจ รายการปัจจุบันที่เริ่มกรอกแล้วแต่ไม่ครบต้องไม่ถูกละทิ้งเมื่อบันทึกร่างก่อนหน้า การออกแบบนี้ไม่ต้องสร้าง bulk API ใหม่ และห้ามแสดงว่าทั้งชุดสำเร็จหากยังไม่มีผลยืนยันของแต่ละรายการ

### Check-Out

1. เริ่มจากค้นหาห้อง/ชื่อ หรือรับ context จาก Search ผลค้นหาคงอยู่เมื่อกลับจากการทำรายการ
2. เลือกหนึ่ง directory room แสดง Building/Room Number/ชื่อผู้พักและ Pending count ค้างไว้ ห้องไม่มี Pending ต้องเป็น empty-room state ไม่ใช่ “รหัสพัสดุไม่พบ”
3. หยิบและตรวจ Parcel จริงตามงานเคาน์เตอร์ scan ช่วยเลือก Parcel เฉพาะของห้องนี้ด้วยรหัสเต็ม Enter จากช่องค้นหาห้องไม่ส่งไปตรวจเป็น Tracking Code
4. เลือกแถวด้วย checkbox หรือ scan แต่ละรหัส เห็น selected count และรายการทั้งหมดที่เลือกได้เสมอ รหัสของห้องอื่นให้ feedback ชัดและไม่เพิ่มเข้าการเลือก
5. **Check Out Selected** disabled จนเลือกอย่างน้อยหนึ่ง Parcel; ส่งเฉพาะที่เลือก **Check Out All** ใช้กับ Pending ของห้องปัจจุบันเท่านั้น และเปิด confirm ตามสเปกที่บอกห้อง/จำนวนชัด
6. ล้มเหลวให้รักษาห้องและ selection ไว้ สำเร็จ Selected เอาเฉพาะแถวที่ทำสำเร็จออก; All สำเร็จทำให้รายการห้องนั้นว่าง แสดงผลห้องและจำนวน แล้วพร้อมเริ่มผู้พักถัดไป
7. เปลี่ยนห้องต้องเคลียร์ selection เก่าหลังจัดการการยืนยันที่จำเป็น ไม่สะสม Parcel ข้ามห้องอย่างเงียบ ๆ การใช้ All ไม่แทนขั้นตอนตรวจ Parcel จริงรายชิ้น

All หมายถึง Pending ทุก Parcel ของห้องนั้น รวมหน้าผลลัพธ์ที่ยังไม่เปิด ไม่ใช่เฉพาะแถวบนหน้าปัจจุบัน ต้องมีจำนวนและข้อมูลที่ยืนยันได้ก่อนเปิด action จำนวนบน confirmation และ success ต้องใช้ scope เดียวกัน ส่วน Selected รักษาการเลือกข้าม pagination/filter ภายในห้องเดียวกันและแสดงสรุปทั้งหมด รวมรายการที่ไม่อยู่ในผลที่เห็น Checkbox ใช้เลือก Parcel และ Tracking Code link ใช้เปิด Detail; การเปิดรายละเอียดไม่เปลี่ยนสถานะหรือยืนยัน Check-Out

### Identity, notes และข้อมูลเดิม

- ชื่อที่แสดงกับชื่อที่ค้นหาได้มาจาก directory resolver เดียวกัน รวม nickname เมื่อมีในข้อมูลจริง
- Room identity ใช้ directory ID และ Building context ไม่ใช้ Room Number string เป็นตัวตนทั้งระบบ เพราะเลขเดียวกันอาจอยู่ต่าง Building
- สภาพกล่อง/หมายเหตุเก็บแยกจากการตรวจผู้พัก การยืนยัน identity ไม่ลบ note และไม่ผูกกับการยืนยัน LINE ใน scope นี้
- target มีหนึ่ง Parcel ต่อ unique Tracking Code และไม่มี quantity field การเตรียม fixture ใหม่ต้องรักษาข้อนี้ ข้อมูลต้นแบบเดิมที่มี qty=2/3 ต้องมีแผนอ่าน/ย้ายแยกต่างหากที่รักษาค่าเดิม ไม่แตกข้อมูล ลบรายการ หรือสร้าง Tracking Code ใหม่โดยเดา
- Archived เป็นสถานะข้อมูล ไม่ใช่คำแทนหน้าประวัติ และไม่ทำ hard delete หรือกำหนด retention window เอง

## 6. States, ranges และ responsive

| สถานะ | พฤติกรรมที่ต้องเห็น |
|---|---|
| Initial | มี label และ hint ว่าค้น/สแกน/เลือกอะไร; ไม่มีรายการถูกเลือกโดยอัตโนมัติ |
| Searching / loading | แสดงข้อความ/placeholder ในตำแหน่งผลลัพธ์เดิม; ไม่แสดง no-result ก่อนค้นเสร็จ |
| No results | บอกคำค้น/ห้องตามสเปกและวิธีค้นใหม่; ไม่แสดง error ของอีกชนิด input |
| Required / unknown room / duplicate | error ใกล้ช่อง, อธิบายการแก้, focus ไปตำแหน่งเกี่ยวข้อง; ข้อมูลไม่หาย |
| Scan accepted / already selected / wrong room | feedback รหัสกับห้องแบบสั้นและมี live status; ไม่เลือกจาก prefix ระหว่างพิมพ์ |
| Draft / selected | มองเห็นว่ารายการยังไม่บันทึกหรือกำลังจะนำออก; เปลี่ยนบริบทไม่ทำให้สูญหาย |
| Submitting | ป้องกัน submit ซ้ำ; ยังเห็นว่าจะทำรายการกับอะไร |
| Network unavailable / failed | ไม่แสดง success, ไม่ล้าง form/selection, มี retry; ไม่ทำ offline transaction queue |
| Session expired | ให้ไป Sign In ตาม target โดยรักษาบริบทที่ไม่ใช่ข้อมูล credential เท่าที่เหมาะสม; ไม่อ้างว่า auth demo เป็นการควบคุมสิทธิ์จริง |
| Success | บอก Tracking Code/ห้อง/จำนวนตามการกระทำ, update รายการ, focus พร้อมงานถัดไป |
| Notes / long names / many residents | wrap เนื้อหาจำเป็นหรือขยายอ่านได้ ไม่ตัดจนแยกคน/รหัสไม่ออก |

**ข้อมูลทดสอบ:** เริ่มจาก 0 รายการ, 1 รายการ, ข้อมูลทั่วไปหนึ่งหน้า และหลายหน้า; รวมห้องชื่อใกล้กัน เลขห้องเดียวกันคนละ Building ห้องมีหลายผู้พัก รหัสที่มี prefix ร่วม ชื่อยาวและหมายเหตุยาว ใช้ synthetic data เท่านั้น งานวิจัยรายงานประมาณ 418 รับเข้า/วัน และ peak 1,024/วัน ให้ใช้เป็นบริบทสร้างชุดทดสอบ ไม่ใช่คำกล่าวอ้างว่ารองรับปริมาณนี้แล้ว ขนาดหน้าเริ่มเสนอ 25 รายการแล้วปรับจากการวัด; pagination เป็น requirement อยู่แล้ว

Mock records ใหม่ใช้ UTC ISO 8601 พร้อม `Z` หรือ offset UTC ที่ชัดเจน และ format ด้วย `Asia/Bangkok` เสมอ Fixture เดิมที่ไม่มี offset ต้องบันทึกการตีความก่อนแปลง ไม่ใช้ timezone ของเครื่องเป็นค่าเริ่มต้น ข้อเสนอสำหรับ fixture ที่แสดงเวลาไทยเดิมคืออ่านเป็น Bangkok ใน adapter โดยคง raw value ไว้จนยืนยันแผนย้ายข้อมูล การเปลี่ยน timezone เครื่องต้องไม่เปลี่ยนเวลาที่เห็นใน UI และไม่ต้องแก้ backend เพื่อทดสอบเงื่อนไขนี้

**Desktop 1280px ขึ้นไป:** ตารางเป็นพื้นที่หลักของ Search/Check-Out และรายการ Check-In ข้อมูลห้องที่เลือกอยู่เหนือรายการ ช่องกรอกอยู่ในลำดับทำงาน หัวตารางช่วยรักษา column context ปุ่มสรุปการทำรายการอยู่ใกล้ selection

**Tablet 768px:** ปรับพื้นที่ระหว่าง control และคอลัมน์ ไม่ย่อข้อความจนอ่านไม่ออก Check-In วาง form/running list ต่อกันเมื่อสองคอลัมน์ไม่พอ แถบเมนูยังเป็น top navigation ตามสเปก

**Phone 390px เป็นการเสริมความทนทานของเว็บ:** โครงแถว compact เห็น Room Number/Resident, Tracking Code และสถานะพร้อมกัน เปิดดูเวลา/หมายเหตุได้ controls เรียงแนวตั้ง เมนูบน wrap ได้โดยไม่เปลี่ยนเป็น native app หรือ bottom tab ขอบเขตหลักของ v1 ยังเป็น desktop/tablet ตามสเปก

**Accessibility:** text/control contrast, persistent labels, keyboard combobox/checkbox/actions, visible focus, 44px target ที่ใช้งานสบาย, native confirmation dialog, live scan/save result และ reduced motion ต้องรักษาไว้ เส้นขอบ control ใช้ neutral token ที่ผ่าน contrast; divider คงจางได้ warning สี amber ใช้ร่วมกับข้อความสี onSurface ไม่ใช้เป็นข้อความเล็กบนขาว การเลือกนี้ใช้ tokens เดิมโดยไม่เปลี่ยนค่าที่ล็อกหรือเพิ่มสีเอง

## 7. ขอบเขตการส่งมอบและลำดับทำ

### ช่วงที่ 1 — งานหลักและข้อผิดพลาดที่กระทบเคาน์เตอร์

1. ตั้ง shared room identity, mock directory adapter และ state ของ draft/selection; รักษาข้อมูลเดิมและ capability ที่มี
2. ทำ Check-In / Check-Out เป็นหน้าทำงานตาม route แยก scan completion ออกจากการพิมพ์ และแยก search identity ออกจาก scan Parcel
3. ส่ง room context จาก Search ไป Check-Out; ทำ All/Selected และ confirm ของ All ให้ถูกห้อง
4. ป้องกัน draft loss, incomplete entry, duplicate, wrong-room scan และการลบ condition note โดยการยืนยัน identity
5. ทำ Dashboard daily view, Search filters/pagination และชุด label/feedback/control state ให้สอดคล้องกัน
6. ปรับ tokens consumption, ชื่อและ English v1 strings ให้ตรงสเปกหลัง brief ยืนยัน; ไม่แก้ค่าของ locked specification

### ช่วงที่ 2 — ครบ frontend ตามสเปก

- Directory read-only และ paginated พร้อมข้อมูล Building/Room/Resident/Nickname
- Parcel Detail และ Parcel History พร้อม Staff/timestamps ใน mock state ที่แยกจากความสามารถ backend จริง
- Sign In / session/network/error/not-found state previews และ final navigation ครบตามสเปก
- รองรับ layout tablet/phone, ข้อมูลยาวและจำนวนหลายหน้า; วัดและปรับ performance frontend

### ช่วงที่ 3 — ตรวจผลและเก็บรายละเอียด

- ตรวจหนึ่งรอบรวม desktop/tablet/phone และ states สำคัญ แก้ข้อที่พบเป็นชุดแล้ว confirm อีกรอบหนึ่งอย่างมาก
- ทดสอบคีย์บอร์ดและเครื่องสแกนจริงเมื่อมี ตรวจ screen reader และ zoom เมื่อมีเครื่องมือเหมาะสม; ระบุสิ่งที่ยังไม่ได้ทดสอบ
- ทดลองกับ Staff 2–3 คน เปรียบเทียบเวลาทำรายการ จำนวนการค้นหาซ้ำ การเลือกผิด และการกู้คืนร่างกับหน้าปัจจุบัน ไม่มีตัวเลขผลสำเร็จที่สร้างขึ้นเอง
- รัน audit หลังแก้ และ polish หลังผ่านพฤติกรรมหลัก

**Branch:** ใช้ `codex/frontend-ux-ui-refresh` ที่แยกไว้แล้ว เว้นแต่ผู้ใช้ต้องการแยก implementation รอบถัดไปอีก branch งาน shape นี้เพิ่มเฉพาะ brief ไม่แก้ application source

## 8. เกณฑ์รับงานสำหรับผู้สร้าง

1. พิมพ์ `TH8827301923X` ทีละตัวต้องไม่เลือก `TH8827301923` ระหว่างทาง และรหัส prefix ใกล้กันต้องเลือกตามรหัสเต็มหลัง completion เท่านั้น
2. Enter ใน directory search ใช้เลือก/ค้นหาห้อง ไม่ขึ้น “ไม่พบ Tracking Code” เมื่อพบห้อง
3. เลขห้องที่ไม่ได้เลือกจาก directory ส่ง Check-In ไม่ได้; ห้องเลขเดียวกันต่าง Building แยกได้; ชื่อที่แสดงค้นพบได้
4. ทำงาน Search → Check-Out ต่อด้วยห้องเดิม ไม่ต้องค้นซ้ำ; กลับ Search แล้วบริบทเดิมยังอยู่
5. การเลือก/scan ต่างห้องไม่ปะปน; All อยู่ภายในห้องเดียวและครอบคลุมทุกหน้าพร้อม confirm และ success count ใน scope เดียวกัน; Selected เปลี่ยนเฉพาะ Parcel ที่เลือก รักษา selection ข้ามหน้า/filter ภายในห้อง และสรุป hidden selections ครบ
6. ปิด/เปลี่ยนหน้าขณะมีร่างแล้วกู้คืนหรือทิ้งโดยตั้งใจได้ รายการปัจจุบันไม่ครบไม่หายไปเงียบ ๆ
7. Error/network failure เก็บข้อมูลไว้; pending action ป้องกันกดซ้ำ; success เกิดเมื่อได้รับผลยืนยัน และคืน focus ไปงานถัดไป
8. Notes คงอยู่หลังตรวจ identity; ห้ามล้าง damaged/condition note จากการยืนยัน LINE
9. จำนวนหน้าจอและจำนวนการทำรายการใช้หนึ่ง Parcel ต่อ unique Tracking Code ตาม model; ไม่ย้ายค่า qty เดิมด้วยการเดา
10. แถวบนมือถือเห็น identity/code/status ร่วมกัน; desktop/tablet มี controls และ focus ที่อ่าน/กดได้; ข้อมูลสำคัญไม่ถูกตัดจนตรวจไม่ได้
11. ทุก list ที่สเปกระบุมี pagination; mock timestamps ใหม่มี UTC offset ชัดและแสดง Bangkok เหมือนกันเมื่อเปลี่ยน timezone เครื่อง; fixture เก่ามีการตีความที่บันทึกไว้; strings/naming/UI sans/UI mono/tokens ตาม authority
12. ไม่มีการแก้ backend, API endpoint, database, auth policy, deployment หรือเพิ่ม LINE/storage tracking/resident self-service ระหว่างงาน frontend นี้

## 9. การตัดสินใจที่ยังเปิดและสิ่งที่ผู้สร้างห้ามเดา

- รอคำตอบเรื่องลำดับงานและ breadth ของรอบแรก; ร่างนี้ยังไม่ได้ยืนยัน
- รูปแบบ scanner completion และรุ่นเครื่องจริง: ใช้ Enter เป็นข้อเสนอ ไม่อ้างเป็นข้อกำหนดที่สเปกล็อกแล้ว
- ตัวช่วย batch เดิม: รักษาการเตรียมหลายรายการและแก้ความปลอดภัยของร่าง; การยุบ/ตัด capability นี้ต้องมีคำตัดสิน ไม่ถือว่าคำขอ shape อนุญาตให้ลบทันที
- การย้าย fixture/local storage เก่าที่มี qty, ชื่อ identity และเวลาที่ไม่มี offset: ต้องยืนยันการตีความและวาง adapter/migration ที่รักษาข้อมูลก่อนลงมือ; ห้ามลบหรือแก้ record จริงเพื่อให้ตรงหน้าตา
- Retention window ยังไม่ยืนยัน; Directory fields ต้องมาจากข้อมูลจริง/mock ที่ระบุชัด ไม่สมมติว่า API/Staff history/server validation ทำงานแล้ว
- Mock state previews แสดง network/loading/history ได้โดยไม่แก้ backend; การเชื่อมของจริงที่ต้องเปลี่ยน backend อยู่นอกงานนี้

ตาม [shape playbook](/home/danaiphong/CascadeProjects/Dormitory-Parcel-Management-Case-Studies-Project/.agents/skills/impeccable/reference/shape.md) ขั้นถัดไปคือยืนยัน brief หรือแก้หนึ่งรอบ แล้วหยุดก่อนเขียน application code หรือ direction contract
