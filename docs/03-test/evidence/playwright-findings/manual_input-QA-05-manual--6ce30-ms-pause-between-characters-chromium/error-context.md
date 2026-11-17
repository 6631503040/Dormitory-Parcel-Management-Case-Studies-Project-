# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: manual_input.spec.js >> QA-05 manual barcode typing survives a 450 ms pause between characters
- Location: e2e/manual_input.spec.js:3:1

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByRole('dialog', { name: 'นำพัสดุออก', exact: true }).getByRole('cell', { name: 'QASLOW1234', exact: true })
Expected: visible
Timeout: 2000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" getByRole('dialog', { name: 'นำพัสดุออก', exact: true }).getByRole('cell', { name: 'QASLOW1234', exact: true }) with timeout 2000ms
  - waiting for getByRole('dialog', { name: 'นำพัสดุออก', exact: true }).getByRole('cell', { name: 'QASLOW1234', exact: true })

```

```yaml
- banner:
  - link "ข้ามไปยังเนื้อหา":
    - /url: "#main-content"
  - text: ParcelHub
  - navigation "หน้าหลัก":
    - button "หน้าหลัก"
    - button "ประวัติ"
  - button "รหัสลงทะเบียนรับแจ้งเตือน"
  - text: Admin
  - button "ออกจากระบบ"
- main:
  - heading "Dashboard" [level=1]
  - paragraph: ค้นหาและจัดการพัสดุที่เคาน์เตอร์
  - button "รับพัสดุเข้า"
  - button "นำพัสดุออก"
  - region "สรุปการรับ–จ่ายพัสดุ":
    - heading "สรุปการรับ–จ่ายพัสดุ" [level=2]
    - button "วันก่อนหน้า"
    - status: 1 พ.ย. 2569
    - button "วันถัดไป" [disabled]
    - group "ช่วงเวลา":
      - button "วัน" [pressed]
      - button "สัปดาห์"
      - button "เดือน"
    - paragraph: รายการในวันที่เลือก
    - term: รับเข้า
    - definition: 3 ชิ้น
    - term: นำออก
    - definition: 3 ชิ้น
    - term: คงเหลือรอรับ
    - definition: 0 ชิ้น
  - region "ค้นหาและจัดการพัสดุ":
    - text: ค้นหาพัสดุรอรับ
    - textbox "ค้นหาพัสดุรอรับ":
      - /placeholder: เลขห้อง ชื่อผู้รับ หรือเลขพัสดุ
    - status: 0 รายการ
    - status:
      - paragraph: ไม่มีพัสดุรอรับ
  - button "พัสดุไม่ทราบห้อง 0 รายการ ดูรายการ"
- dialog "นำพัสดุออก":
  - heading "นำพัสดุออก" [level=2]
  - button "ปิด":
    - img
  - text: เลขพัสดุ
  - textbox "เลขพัสดุ" [invalid]:
    - /placeholder: สแกนหรือพิมพ์เลขพัสดุ
  - alert: "ไม่พบพัสดุ: 4"
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | // Negative regression case. Expected to fail until manual-entry handling is corrected.
  3  | test('QA-05 manual barcode typing survives a 450 ms pause between characters', async ({ page }, info) => {
  4  |   await page.goto('/');
  5  |   await page.getByLabel('ชื่อผู้ใช้', {exact:true}).fill('admin');
  6  |   await page.getByLabel('รหัสผ่าน', {exact:true}).fill('<test-account password>');
  7  |   await page.getByRole('button',{name:'เข้าสู่ระบบ',exact:true}).click();
  8  |   await expect(page.getByRole('heading',{name:'Dashboard',exact:true})).toBeVisible();
  9  |   const rooms=await (await page.request.get('/api/v1/rooms/search?q=1101')).json();
  10 |   const code='QASLOW1234';
  11 |   const created=await page.request.post('/api/v1/parcels',{data:{trackingCode:code,roomId:rooms.items[0].id}});
  12 |   expect(created.status()).toBe(201);
  13 |   const lookups=[];
  14 |   page.on('request',r=>{ if (r.method()==='GET' && r.url().includes('/api/v1/parcels/') && !r.url().includes('?')) lookups.push(new URL(r.url()).pathname); });
  15 |   await page.getByRole('button',{name:'นำพัสดุออก',exact:true}).click();
  16 |   const dialog=page.getByRole('dialog',{name:'นำพัสดุออก',exact:true});
  17 |   await dialog.getByLabel('เลขพัสดุ',{exact:true}).pressSequentially(code,{delay:450});
  18 |   await page.waitForTimeout(650); // deliberately crosses the app's 400 ms inactivity threshold
  19 |   const evidence={code,delayMs:450,lookupRequests:lookups,remainingInput:await dialog.getByLabel('เลขพัสดุ',{exact:true}).inputValue()};
  20 |   console.log('QA-05 evidence',JSON.stringify(evidence));
  21 |   await info.attach('manual-input-evidence',{body:JSON.stringify(evidence,null,2),contentType:'application/json'});
> 22 |   await expect(dialog.getByRole('cell',{name:code,exact:true})).toBeVisible({timeout:2000});
     |                                                                 ^ Error: expect(locator).toBeVisible() failed
  23 | });
  24 | 
```