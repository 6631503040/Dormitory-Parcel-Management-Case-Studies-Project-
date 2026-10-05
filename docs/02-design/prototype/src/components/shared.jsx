import { pageNumbers } from "../lib/pagination";
import React, { useEffect, useId, useState } from "react";
import { ROOM_DIRECTORY, residentsFor, formatBangkokDate, parseParcelDate } from "../lib/parcelRules";
export { ROOM_DIRECTORY } from "../lib/parcelRules";
import { Package, Check, X, Clock, AlertTriangle, Search, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";

export const C = {
  bg: "var(--desk-bg)",
  card: "var(--desk-surface)",
  sidebar: "var(--desk-surface)",
  border: "var(--desk-border)",
  text: "var(--desk-text)",
  textMuted: "var(--desk-muted)",
  primary: "var(--desk-primary)",
  primaryDark: "var(--desk-primary)",
  primaryLight: "var(--desk-primary-light)",
  success: "var(--desk-success)",
  successLight: "var(--desk-success-light)",
  navyChip: "var(--desk-primary-light)",
  navy: "var(--desk-primary)",
  warning: "var(--desk-warning)",
  warningLight: "var(--desk-warning-light)",
};

export const bodyFont = { fontFamily: "var(--desk-font)" };
export const displayFont = bodyFont;

export const INITIAL_PARCELS = [
  { id: "1", code: "TH3344556677", room: "090", name: "สมชาย ใจดี", line: "@somchai_j", qty: 1, damaged: true, damageReason: "ตัวอย่าง: กรุณาตรวจสอบว่า LINE ID ตรงกับห้อง 090", receivedAt: "2026-08-15T08:30:00", status: "in" },
  { id: "2", code: "TH8827301923", room: "101/2", name: "ณัฐพล สุขใจ", line: "@nattapon_s", qty: 1, receivedAt: "2026-08-18T09:14:00", status: "in" },
  { id: "3", code: "TH1029384756", room: "203/1", name: "พิมพ์ชนก แสงทอง", line: "pimchanok.st", qty: 2, receivedAt: "2026-08-21T10:02:00", status: "in" },
  { id: "4", code: "PK12345678910TH", room: "305", name: "กันตพงศ์ วงศ์ไพร", line: "@kantapong99", qty: 1, receivedAt: "2026-08-22T16:02:00", status: "in" },
  { id: "5", code: "TH5566778899", room: "108/1", name: "อารียา คงสวัสดิ์", line: "areeya_ks", qty: 3, receivedAt: "2026-08-19T13:40:00", status: "out", exitedAt: "2026-08-20T08:10:00" },
  { id: "6", code: "TH2233445566", room: "212", name: "ธีรภัทร มั่นคง", line: "@teerapat.m", qty: 1, receivedAt: "2026-08-18T11:25:00", status: "out", exitedAt: "2026-08-18T18:47:00" },
  { id: "7", code: "TH9988001122", room: "150/3", name: "ชญานิษฐ์ เพชรรัตน์", line: "chayanit.p", qty: 1, receivedAt: "2026-08-17T09:05:00", status: "out", exitedAt: "2026-08-17T17:30:00" },
];

export const THAI_MONTHS = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

export const formatThaiDateTime = formatBangkokDate;

export function daysWaiting(iso) {
  return (Date.now() - parseParcelDate(iso).getTime()) / (1000 * 60 * 60 * 24);
}

export function waitLabel(days) {
  if (days < 1) return `${Math.max(1, Math.round(days * 24))} ชม.`;
  return `${Math.floor(days)} วัน`;
}

export const WAIT_WARN_DAYS = 2;
export const WAIT_CRITICAL_DAYS = 4;

export function waitSeverity(days) {
  if (days >= WAIT_CRITICAL_DAYS) return "critical";
  if (days >= WAIT_WARN_DAYS) return "warn";
  return "ok";
}

export function roomLabel(p) {
  const residents = residentsFor(p.room);
  if (residents && residents.length) return `${p.room} · ${residents.join(" / ")}`;
  if (p.name && p.name !== "-") return `${p.room} · ${p.name}`;
  return p.room;
}

export function StatusChip({ status }) {
  if (status === "in") {
    return (
      <span className="parcel-status parcel-status-pending">
        <span className="pending-dot" aria-hidden="true" />
        รอรับ
      </span>
    );
  }

  return (
    <span className="parcel-status parcel-status-out">
      <Check size={14} aria-hidden="true" />
      นำออกแล้ว
    </span>
  );
}

export function Banner({ message, tone = "success", onClose }) {
  if (!message) return null;
  const bg = tone === "success" ? C.successLight : C.primaryLight;
  const fg = tone === "success" ? C.success : C.primaryDark;

  return (
    <div role="status" className="desk-banner animate-fade" style={{ background: bg, color: fg, ...bodyFont }}>
      <Check size={16} strokeWidth={3} aria-hidden="true" />
      {message}
      <button onClick={onClose} className="icon-button" aria-label="ปิดข้อความแจ้งผล">
        <X size={14} aria-hidden="true" />
      </button>
    </div>
  );
}

export function PageHeader({ title, description }) {
  return (
    <div className="page-heading">
      <h1>{title}</h1>
      {description && <p>{description}</p>}
    </div>
  );
}

export function SearchBar({ value, onChange, placeholder, label = "ค้นหาพัสดุ" }) {
  const id = useId();
  return (
    <div className="register-search">
      <label htmlFor={id}>{label}</label>
      <div className="search-control">
        <Search size={19} aria-hidden="true" />
        <input id={id} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
      </div>
    </div>
  );
}

export function ParcelTable({ parcels, emptyLabel, showLine = true, label = "รายการพัสดุ", pageSize = 25, numberedPages = false, variant = "default", resetKey = parcels }) {
  const [expandedDamageId, setExpandedDamageId] = useState(null);
  const damagePrefix = useId();
  const [page, setPage] = useState(0);
  const isDashboard = variant === "dashboard";
  const historyColumns = !isDashboard;
  const pageCount = Math.max(1, Math.ceil(parcels.length / pageSize));
  const currentPage = Math.min(page, pageCount - 1);
  const pageParcels = parcels.slice(currentPage * pageSize, (currentPage + 1) * pageSize);
  useEffect(() => { setPage(0); setExpandedDamageId(null); }, [resetKey, pageSize]);
  useEffect(() => { setPage((value) => Math.min(value, pageCount - 1)); }, [pageCount]);

  if (parcels.length === 0) {
    return (
      <div className="table-empty" role="status">
        <Package size={24} aria-hidden="true" />
        <p>{emptyLabel}</p>
      </div>
    );
  }

  return (
    <div className={isDashboard ? "parcel-results dashboard-results" : "parcel-results"}>
      {numberedPages && <div className="table-pagination archive-pagination">
        <span role="status">{currentPage * pageSize + 1}–{Math.min((currentPage + 1) * pageSize, parcels.length)} จาก {parcels.length} รายการ</span>
        {pageCount > 1 && <nav aria-label={`แบ่งหน้า${label}`} className="page-number-controls">
          <button className="page-number-button" disabled={currentPage === 0} onClick={() => { setPage(currentPage - 1); setExpandedDamageId(null); }} aria-label="หน้าก่อนหน้า"><ChevronLeft size={16} aria-hidden="true" /></button>
          {pageNumbers(currentPage, pageCount).map((number) => typeof number === 'number' ? <button key={number} className="page-number-button" aria-label={`หน้า ${number + 1}`} aria-current={number === currentPage ? 'page' : undefined} onClick={() => { setPage(number); setExpandedDamageId(null); }}><span className="page-number-label">{number + 1}</span></button> : <span className="page-number-ellipsis" key={number} aria-hidden="true">…</span>)}
          <button className="page-number-button" disabled={currentPage === pageCount - 1} onClick={() => { setPage(currentPage + 1); setExpandedDamageId(null); }} aria-label="หน้าถัดไป"><ChevronRight size={16} aria-hidden="true" /></button>
        </nav>}
      </div>}
      <div className={`parcel-table-frame${isDashboard && pageCount > 1 ? " parcel-table-reserved" : ""}`} style={isDashboard ? { "--parcel-page-size": pageSize } : undefined}>
        <div className={`table-scroll${isDashboard ? " dashboard-desktop-table" : ""}`} role="region" aria-label={label} tabIndex={0}>
          <table className="parcel-table">
            <caption className="sr-only">{label}</caption>
            <thead>
              <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                {[(showLine ? "ห้อง / ชื่อ / Line" : "ห้อง / ชื่อ"), "เลขพัสดุ", "จำนวน", "วันที่รับเข้า", ...(historyColumns ? ["สถานะ", "วันที่นำจ่าย"] : [])].map((h) => <th key={h} scope="col">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {pageParcels.map((p) => (
                <React.Fragment key={p.id}>
                  <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                    <td>
                      <p className="resident-label">{roomLabel(p)}</p>
                      {showLine && p.line && p.line !== "-" && <p className="text-xs mt-0.5" style={{ color: C.textMuted }}>{p.line}</p>}
                    </td>
                    <td className="tracking-cell"><div className="tracking-content">
                      <p>{p.code}</p>
                      {p.damaged && <button type="button" onClick={() => setExpandedDamageId((id) => (id === p.id ? null : p.id))} aria-expanded={expandedDamageId === p.id} aria-controls={expandedDamageId === p.id ? `${damagePrefix}-${p.id}` : undefined} aria-label={`ดูเหตุผลพัสดุชำรุด ${p.code}`} className="damage-button">ชำรุด<ChevronDown size={14} aria-hidden="true" /></button>}
                    </div></td>
                    <td className="quantity-cell">{p.qty}</td>
                    <td className="date-cell">{formatThaiDateTime(p.receivedAt)}</td>
                    {historyColumns && <><td><StatusChip status={p.status} /></td><td className="date-cell">{p.exitedAt ? formatThaiDateTime(p.exitedAt) : "–"}</td></>}
                  </tr>
                  {p.damaged && expandedDamageId === p.id && (
                    <tr className="damage-detail-row">
                      <td colSpan={historyColumns ? 6 : 4} className="damage-reason-cell">
                        <div className="damage-reason" id={`${damagePrefix}-${p.id}`}>
                          <AlertTriangle size={18} aria-hidden="true" />
                          <div><p className="damage-reason-heading">หมายเหตุชำรุด</p><p className="damage-reason-text">{p.damageReason || "ไม่ได้ระบุเหตุผล"}</p></div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
        {isDashboard && <ul className="parcel-mobile-list" aria-label={label}>
          {pageParcels.map((p) => (
            <li key={p.id}>
              <div className="parcel-mobile-identity"><p>{roomLabel(p)}</p>{historyColumns && <StatusChip status={p.status} />}</div>
              <p className="parcel-mobile-code">{p.code}</p>
              <details className="parcel-mobile-details">
                <summary aria-label={`${p.damaged ? "พัสดุชำรุด · " : ""}รายละเอียดพัสดุ ${p.code} จำนวน ${p.qty} ชิ้น`}>
                  <span>จำนวน {p.qty} ชิ้น</span>
                  <span className={p.damaged ? "parcel-mobile-damaged" : ""}>{p.damaged ? "ชำรุด" : "รายละเอียด"}<ChevronDown size={16} aria-hidden="true" /></span>
                </summary>
                <dl>
                  <div><dt>รับเข้า</dt><dd>{formatThaiDateTime(p.receivedAt)}</dd></div>
                  {!historyColumns && <div><dt>สถานะ</dt><dd><StatusChip status={p.status} /></dd></div>}
                  {p.exitedAt && <div><dt>นำจ่าย</dt><dd>{formatThaiDateTime(p.exitedAt)}</dd></div>}
                </dl>
                {p.damaged && <div className="parcel-mobile-note"><p className="damage-reason-heading">หมายเหตุชำรุด</p><p className="damage-reason-text">{p.damageReason || "ไม่ได้ระบุเหตุผล"}</p></div>}
              </details>
            </li>
          ))}
        </ul>}
      </div>
      {!numberedPages && pageCount > 1 && <div className="table-pagination" aria-label="แบ่งหน้ารายการพัสดุ"><button className="text-button" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>ก่อนหน้า</button><span role="status">หน้า {currentPage + 1} / {pageCount} · ทั้งหมด {parcels.length} รายการ</span><button className="text-button" disabled={currentPage === pageCount - 1} onClick={() => setPage(currentPage + 1)}>ถัดไป</button></div>}
    </div>
  );
}

export function BottleneckPanel({ parcels }) {
  const pending = parcels.filter((p) => p.status === "in");
  const ranked = [...pending].sort((a, b) => new Date(a.receivedAt) - new Date(b.receivedAt)).slice(0, 5);
  const criticalCount = pending.filter((p) => waitSeverity(daysWaiting(p.receivedAt)) === "critical").length;

  const sevStyle = {
    ok: { bg: C.navyChip, fg: C.navy },
    warn: { bg: C.primaryLight, fg: C.primaryDark },
    critical: { bg: C.warningLight, fg: C.warning },
  };

  return (
    <div className="rounded-2xl border p-5 mb-6" style={{ background: C.card, borderColor: C.border }}>
      <div className="flex items-center justify-between gap-3 flex-wrap mb-1">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: C.warningLight }}>
            <AlertTriangle size={17} style={{ color: C.warning }} />
          </div>
          <div>
            <p className="text-sm font-semibold" style={{ ...bodyFont, color: C.text }}>พัสดุตกค้างนานที่สุดและพัสดุมีปัญหา</p>
            <p className="text-xs" style={{ ...bodyFont, color: C.textMuted }}>เรียงลำดับพัสดุที่รอรับนานที่สุดก่อน</p>
          </div>
        </div>
        {criticalCount > 0 && (
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full flex-shrink-0" style={{ background: C.warningLight, color: C.warning, ...bodyFont }}>
            {criticalCount} รายการเกิน {WAIT_CRITICAL_DAYS} วัน
          </span>
        )}
      </div>

      {ranked.length === 0 ? (
        <p className="text-sm py-6 text-center" style={{ ...bodyFont, color: C.textMuted }}>ไม่มีพัสดุตกค้างในขณะนี้</p>
      ) : (
        <div className="mt-3">
          {ranked.map((p, i) => {
            const days = daysWaiting(p.receivedAt);
            const sev = waitSeverity(days);
            const style = sevStyle[sev];
            return (
              <div key={p.id} className="flex items-center justify-between gap-3 py-3" style={{ borderBottom: i < ranked.length - 1 ? `1px solid ${C.border}` : "none" }}>
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-xs font-bold w-5 text-center flex-shrink-0" style={{ ...bodyFont, color: C.textMuted }}>{i + 1}</span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold truncate" style={{ ...bodyFont, color: C.text }}>{roomLabel(p)}</p>
                    <p className="text-xs truncate" style={{ ...bodyFont, color: C.textMuted }}>{p.code}</p>
                  </div>
                </div>
                <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold flex-shrink-0" style={{ background: style.bg, color: style.fg, ...bodyFont }}>
                  <Clock size={11} />
                  {waitLabel(days)}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export const FONT_LINK_ID = "parcelhub-fonts";
export function useFonts() {
  React.useEffect(() => {
    if (document.getElementById(FONT_LINK_ID)) return;
    const link = document.createElement("link");
    link.id = FONT_LINK_ID;
    link.rel = "stylesheet";
    link.href = "https://fonts.googleapis.com/css2?family=Noto+Sans+Thai:wght@400;500;600;700&display=swap";
    document.head.appendChild(link);
  }, []);
}
