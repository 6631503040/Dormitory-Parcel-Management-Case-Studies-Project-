import React, { useRef, useState } from "react";
import { Download, FileSpreadsheet, Upload } from "lucide-react";
import { C, bodyFont, PageHeader } from "./shared";
import { api } from "../api/client";
import { errorMessage } from "../api/errorMessages";

const HEADER = "room_number,full_name,phone";
const TEMPLATE = `${HEADER}\n1101,วิภาวี อินทร์แก้ว,\n1102,สมชาย เพชรรัตน์,0812345678\n`;
const BOM = String.fromCharCode(0xfeff); // so Excel reads the Thai names as UTF-8
const MAX_FILE_BYTES = 900 * 1024; // the API takes 1 MB bodies, JSON-wrapped

const COLUMNS = [
  { name: "room_number", meaning: "เลขห้องเต็ม (อาคาร + ห้อง 3 หลัก)", required: true, example: "1101 = อาคาร 1 ห้อง 101" },
  { name: "full_name", meaning: "ชื่อ-นามสกุลผู้พัก", required: true, example: "สมชาย เพชรรัตน์" },
  { name: "phone", meaning: "เบอร์โทรศัพท์", required: false, example: "0812345678 หรือเว้นว่าง" },
];

const ISSUE_TEXT = {
  "file:not_utf8": "ไฟล์ไม่ได้บันทึกเป็น UTF-8 — ใน Excel ให้เลือก Save As → CSV UTF-8 (Comma delimited)",
  "file:empty": "ไฟล์ว่างเปล่า",
  "file:no_rows": "ไม่มีรายชื่อผู้พักในไฟล์ (มีแต่หัวคอลัมน์)",
  "header:invalid_header": `แถวแรกต้องเป็นหัวคอลัมน์ ${HEADER} ตามลำดับนี้`,
  "row:unreadable": "อ่านแถวนี้ไม่ได้ (ตรวจเครื่องหมายคำพูดหรือจุลภาค)",
  "row:wrong_column_count": "จำนวนคอลัมน์ไม่ครบ 3 คอลัมน์",
  "row:duplicate": "ชื่อและห้องซ้ำกับแถวก่อนหน้า",
  "room_number:invalid_format": "เลขห้องต้องเป็นตัวเลข 4–6 หลัก (อาคาร + ห้อง 3 หลัก) เช่น 1101",
  "full_name:required": "ไม่ได้กรอกชื่อ-นามสกุล",
  "full_name:too_long": "ชื่อ-นามสกุลยาวเกิน 100 ตัวอักษร",
  "phone:invalid_format": "เบอร์โทรต้องเป็นตัวเลข 9–15 หลัก",
};

function issueText(issue) {
  return ISSUE_TEXT[`${issue.field}:${issue.reason}`] ?? "ข้อมูลไม่ถูกต้อง";
}

function saveBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// Rejects non-UTF-8 files here: decoding a Windows-874 (Thai ANSI) file as UTF-8 would silently
// turn every name into replacement characters.
async function readUtf8(file) {
  const buffer = await file.arrayBuffer();
  return new TextDecoder("utf-8", { fatal: true }).decode(buffer);
}

function ChangeList({ title, items, count, render, tone }) {
  if (!count) return null;
  return (
    <details className="mt-3">
      <summary className="cursor-pointer text-sm font-semibold" style={{ color: tone ?? C.text }}>{title} ({count.toLocaleString()})</summary>
      <ul className="mt-2 text-sm" style={{ color: C.text }}>
        {items.map((it, i) => <li key={i} className="py-1">{render(it)}</li>)}
        {count > items.length && <li className="py-1" style={{ color: C.textMuted }}>…และอีก {(count - items.length).toLocaleString()} รายการ</li>}
      </ul>
    </details>
  );
}

export default function ResidentsPage({ onImported }) {
  const [fileName, setFileName] = useState("");
  const [csv, setCsv] = useState(null);
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const fileInput = useRef(null);

  const reset = () => {
    setCsv(null);
    setPreview(null);
    setFileName("");
    if (fileInput.current) fileInput.current.value = "";
  };

  const chooseFile = async (e) => {
    const file = e.target.files?.[0];
    setError("");
    setPreview(null);
    setCsv(null);
    if (!file) return;
    setFileName(file.name);
    if (file.size > MAX_FILE_BYTES) {
      setError("ไฟล์ใหญ่เกิน 900 KB");
      return;
    }
    let text;
    try {
      text = await readUtf8(file);
    } catch {
      setError(ISSUE_TEXT["file:not_utf8"]);
      return;
    }
    setBusy(true);
    try {
      setPreview(await api.previewResidentImport(text));
      setCsv(text);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const apply = async () => {
    setBusy(true);
    setError("");
    try {
      const result = await api.applyResidentImport(csv);
      reset();
      onImported?.(result);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const downloadCurrent = async () => {
    setError("");
    try {
      saveBlob(await api.exportResidents(), "residents.csv");
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  const hasChanges = preview && preview.addedCount + preview.movedCount + preview.movedOutCount + preview.newRoomCount > 0;

  return (
    <>
      <PageHeader title="จัดการผู้พัก" description="อัปเดตรายชื่อผู้พักทั้งหมดด้วยไฟล์ CSV เมื่อมีผู้พักเข้าใหม่ ย้ายห้อง หรือย้ายออก" />

      <section className="parcel-register mb-6" aria-labelledby="format-heading">
        <div className="archive-toolbar">
          <p id="format-heading" className="text-base font-semibold mb-2" style={{ ...bodyFont, color: C.text }}>เตรียมไฟล์ก่อนอัปโหลด</p>
          <ol className="list-decimal pl-5 text-sm space-y-1 mb-4" style={{ color: C.text }}>
            <li>ไฟล์ต้องมี<strong>ผู้พักทุกคนที่พักอยู่ตอนนี้</strong> — ผู้พักที่ไม่มีชื่อในไฟล์จะถูกบันทึกว่า<strong>ย้ายออก</strong> (ประวัติพัสดุยังอยู่ครบ)</li>
            <li>แถวแรกต้องเป็นหัวคอลัมน์ <code>{HEADER}</code> ตามลำดับนี้</li>
            <li>บันทึกเป็น <strong>CSV UTF-8</strong> — ใน Excel เลือก Save As → CSV UTF-8 (Comma delimited) ไม่เช่นนั้นชื่อภาษาไทยจะอ่านไม่ออก</li>
            <li>ระบบจับคู่ผู้พักด้วยชื่อ-นามสกุล: ชื่อเดิมแต่ห้องเปลี่ยน = ย้ายห้อง จึงควรสะกดชื่อให้ตรงกับเดิม</li>
          </ol>
        </div>
        <div className="table-scroll" role="region" aria-label="รูปแบบคอลัมน์" tabIndex={0}>
          <table className="parcel-table">
            <caption className="sr-only">รูปแบบคอลัมน์ของไฟล์ CSV</caption>
            <thead><tr><th scope="col">คอลัมน์</th><th scope="col">ความหมาย</th><th scope="col">จำเป็น</th><th scope="col">ตัวอย่าง</th></tr></thead>
            <tbody>
              {COLUMNS.map((c) => (
                <tr key={c.name}><td><code>{c.name}</code></td><td>{c.meaning}</td><td>{c.required ? "ต้องกรอก" : "ไม่บังคับ"}</td><td>{c.example}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="archive-toolbar pt-5">
          <div className="desk-actions flex-wrap">
            <button type="button" className="desk-button desk-button-in" onClick={() => saveBlob(new Blob([BOM + TEMPLATE], { type: "text/csv" }), "residents-template.csv")}>
              <FileSpreadsheet size={18} aria-hidden="true" />ดาวน์โหลดไฟล์ตัวอย่าง
            </button>
            <button type="button" className="desk-button desk-button-in" onClick={downloadCurrent}>
              <Download size={18} aria-hidden="true" />ดาวน์โหลดรายชื่อปัจจุบัน
            </button>
          </div>
          <p className="text-xs mt-2" style={{ color: C.textMuted }}>แนะนำ: ดาวน์โหลดรายชื่อปัจจุบัน แก้ไขใน Excel แล้วอัปโหลดกลับ ไฟล์นี้มีเบอร์โทรผู้พัก เก็บรักษาให้ปลอดภัยและลบเมื่อใช้เสร็จ</p>
        </div>
      </section>

      <section className="parcel-register" aria-labelledby="upload-heading">
        <div className="archive-toolbar">
          <p id="upload-heading" className="text-base font-semibold mb-3" style={{ ...bodyFont, color: C.text }}>อัปโหลดรายชื่อ</p>
          <input ref={fileInput} id="resident-csv" type="file" accept=".csv,text/csv" className="sr-only" onChange={chooseFile} disabled={busy} />
          <div className="flex items-center gap-3 flex-wrap">
            <label htmlFor="resident-csv" className="desk-button desk-button-primary cursor-pointer" aria-disabled={busy}>
              <Upload size={18} aria-hidden="true" />เลือกไฟล์ CSV
            </label>
            <span className="text-sm" style={{ color: C.textMuted }}>{busy ? "กำลังตรวจสอบไฟล์…" : fileName || "ยังไม่ได้เลือกไฟล์"}</span>
          </div>
          {error && <p className="field-error mt-3" role="alert">{error}</p>}

          {preview && (
            <div className="mt-5" aria-live="polite">
              <p className="text-sm font-semibold" style={{ color: C.text }}>ผลการตรวจสอบ {preview.rows.toLocaleString()} แถว</p>
              <ul className="text-sm mt-2 space-y-1" style={{ color: C.text }}>
                <li>ไม่เปลี่ยนแปลง: {preview.unchanged.toLocaleString()} คน</li>
                <li>เพิ่มใหม่: {preview.addedCount.toLocaleString()} คน</li>
                <li>ย้ายห้อง: {preview.movedCount.toLocaleString()} คน</li>
                <li>ย้ายออก: {preview.movedOutCount.toLocaleString()} คน</li>
                <li>ห้องใหม่ที่จะสร้าง: {preview.newRoomCount.toLocaleString()} ห้อง</li>
                {preview.errorCount > 0 && <li style={{ color: C.warning }}>แถวที่ผิดพลาด: {preview.errorCount.toLocaleString()} แถว</li>}
              </ul>

              {preview.errorCount > 0 && (
                <div className="mt-3" role="alert">
                  <p className="field-error">แก้ไขแถวต่อไปนี้ในไฟล์แล้วอัปโหลดใหม่ — ไฟล์ที่มีข้อผิดพลาดจะไม่ถูกบันทึกเลย</p>
                  <ul className="text-sm mt-2" style={{ color: C.text }}>
                    {preview.errors.map((it, i) => <li key={i} className="py-1">{it.line > 0 ? `บรรทัด ${it.line}: ` : ""}{issueText(it)}</li>)}
                    {preview.errorCount > preview.errors.length && <li style={{ color: C.textMuted }}>…และอีก {preview.errorCount - preview.errors.length} แถว</li>}
                  </ul>
                </div>
              )}

              <ChangeList title="เพิ่มใหม่" items={preview.added} count={preview.addedCount} render={(c) => `${c.roomNumber} · ${c.fullName}`} />
              <ChangeList title="ย้ายห้อง" items={preview.moved} count={preview.movedCount}
                render={(c) => <>{c.fullName}: {c.fromRoomNumber} → {c.roomNumber}{c.pendingParcels > 0 && <span style={{ color: C.warning }}> · มีพัสดุรอรับ {c.pendingParcels} ชิ้นที่ห้องเดิม</span>}</>} />
              <ChangeList title="ย้ายออก" items={preview.movedOut} count={preview.movedOutCount} tone={preview.movedOut.some((c) => c.pendingParcels > 0) ? C.warning : undefined}
                render={(c) => <>{c.roomNumber} · {c.fullName}{c.pendingParcels > 0 && <span style={{ color: C.warning }}> · ยังมีพัสดุรอรับ {c.pendingParcels} ชิ้น</span>}</>} />
              <ChangeList title="ห้องใหม่" items={preview.newRooms} count={preview.newRoomCount} render={(r) => r} />

              <div className="desk-actions mt-5">
                <button type="button" className="desk-button desk-button-primary" onClick={apply} disabled={busy || preview.errorCount > 0 || !hasChanges}>
                  {busy ? "กำลังบันทึก…" : "ยืนยันอัปเดตรายชื่อ"}
                </button>
                <button type="button" className="desk-button desk-button-in" onClick={reset} disabled={busy}>ยกเลิก</button>
              </div>
              {!hasChanges && preview.errorCount === 0 && <p className="text-sm mt-2" style={{ color: C.textMuted }}>รายชื่อในไฟล์ตรงกับในระบบแล้ว ไม่มีอะไรต้องอัปเดต</p>}
            </div>
          )}
        </div>
      </section>
    </>
  );
}
