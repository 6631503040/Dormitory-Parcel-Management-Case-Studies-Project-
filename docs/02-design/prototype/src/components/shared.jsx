import React, { useEffect, useId, useRef } from "react";
import { Package, Check, HelpCircle, Info, X, Search, ChevronLeft, ChevronRight } from "lucide-react";
import { unmatchedReasonLabel } from "../constants/unmatchedReasons";

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

export const THAI_MONTHS = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

const pad = (n) => String(n).padStart(2, "0");

export function formatThaiDateTime(iso) {
  if (!iso) return "-";
  const d = new Date(iso);
  return `${d.getDate()} ${THAI_MONTHS[d.getMonth()]} ${d.getFullYear() + 543} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// yyyy-mm-dd in local time, the format <input type="date"> and the API's `date` param both use.
export function toDateInputValue(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// A Parcel from the API has `room: null` exactly when it is parked in the unmatched queue
// (backend/README.md: room_id is nullable only while status is pending and unmatched_reason is set).
export function isUnmatched(parcel) {
  return !parcel.room;
}

// A room's resident-facing number is building+floor+room concatenated with no separator, e.g.
// building 3, floor 1, room 01 -> "3101" — never "B3 101".
export function roomLabel(parcel) {
  if (!parcel.room) return "ไม่ระบุห้อง";
  const names = (parcel.residents || []).map((r) => r.fullName);
  const place = `${parcel.room.buildingCode}${parcel.room.roomNumber}`;
  return names.length ? `${place} · ${names.join(" / ")}` : place;
}

export function StatusChip({ parcel }) {
  if (parcel.status === "picked_up") {
    return (
      <span className="parcel-status parcel-status-out">
        <Check size={14} aria-hidden="true" />
        นำออกแล้ว
      </span>
    );
  }
  if (parcel.status === "archived") {
    return (
      <span className="parcel-status parcel-status-archived">
        เก็บประวัติ
      </span>
    );
  }
  if (isUnmatched(parcel)) {
    return (
      <span className="parcel-status parcel-status-unmatched">
        <HelpCircle size={14} aria-hidden="true" />
        มีปัญหา
      </span>
    );
  }
  return (
    <span className="parcel-status parcel-status-pending">
      <span className="pending-dot" aria-hidden="true" />
      รอรับ
    </span>
  );
}

export function Banner({ message, tone = "success", onClose, notificationId, duration = 6000 }) {
  const timer = useRef(null);
  const remaining = useRef(duration);
  const started = useRef(0);
  const hovered = useRef(false);
  const focused = useRef(false);
  const close = useRef(onClose);
  close.current = onClose;
  const clearTimer = () => { clearTimeout(timer.current); timer.current = null; };
  const resume = () => {
    if (!message || hovered.current || focused.current || timer.current !== null) return;
    started.current = performance.now();
    timer.current = setTimeout(() => { timer.current = null; close.current(); }, remaining.current);
  };
  const pause = () => {
    if (timer.current === null) return;
    remaining.current = Math.max(0, remaining.current - (performance.now() - started.current));
    clearTimer();
  };
  useEffect(() => {
    clearTimer(); remaining.current = duration;
    if (!message) { hovered.current = false; focused.current = false; return; }
    resume();
    return clearTimer;
  }, [message, notificationId, duration]);
  if (!message) return null;
  const Icon = tone === "success" ? Check : Info;
  return (
    <div className="desk-banner" data-visible="true" data-tone={tone}
      onMouseEnter={() => { hovered.current = true; pause(); }}
      onMouseLeave={() => { hovered.current = false; resume(); }}
      onFocusCapture={() => { focused.current = true; pause(); }}
      onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) { focused.current = false; resume(); } }}>
      <div role="status" aria-live="polite" aria-atomic="true" className="desk-banner-status">
        <span className="desk-banner-icon" aria-hidden="true"><Icon size={18} strokeWidth={2.5} /></span>
        <p className="desk-banner-message">{message}</p>
      </div>
      <button type="button" onClick={onClose} className="icon-button desk-banner-close" aria-label="ปิดข้อความแจ้งผล"><X size={16} aria-hidden="true" /></button>
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

export function LoadMoreFooter({ shown, total, onLoadMore, loading }) {
  return (
    <div className="flex items-center justify-between gap-3 pt-3 px-1">
      <p className="text-xs" style={{ ...bodyFont, color: C.textMuted }}>แสดง {shown.toLocaleString()} จาก {total.toLocaleString()} รายการ</p>
      {shown < total && (
        <button onClick={onLoadMore} disabled={loading} className="text-sm font-semibold px-3 py-1.5 rounded-lg hover:bg-gray-50 disabled:opacity-50" style={{ ...bodyFont, color: C.primaryDark }}>
          {loading ? "กำลังโหลด…" : "แสดงเพิ่ม"}
        </button>
      )}
    </div>
  );
}

export function PagePagination({ page, total, pageSize = 8, onChange, loading, label }) {
  const count = Math.max(1, Math.ceil(total / pageSize));
  const numbers = Array.from(new Set([1, page - 1, page, page + 1, count])).filter((n) => n > 0 && n <= count).sort((a, b) => a - b);
  return <div className="table-pagination archive-pagination">
    <span role="status">{total ? `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, total)} จาก ${total} รายการ` : "0 รายการ"}</span>
    {count > 1 && <nav aria-label={`แบ่งหน้า${label}`} className="page-number-controls">
      <button type="button" className="page-number-button" disabled={loading || page === 1} onClick={() => onChange(page - 1)} aria-label="หน้าก่อนหน้า"><ChevronLeft size={16} aria-hidden="true" /></button>
      {numbers.map((n, i) => <React.Fragment key={n}>{i > 0 && n - numbers[i - 1] > 1 && <span className="page-number-ellipsis" aria-hidden="true">…</span>}<button type="button" className="page-number-button" disabled={loading} aria-label={`หน้า ${n}`} aria-current={n === page ? "page" : undefined} onClick={() => onChange(n)}><span className="page-number-label">{n}</span></button></React.Fragment>)}
      <button type="button" className="page-number-button" disabled={loading || page === count} onClick={() => onChange(page + 1)} aria-label="หน้าถัดไป"><ChevronRight size={16} aria-hidden="true" /></button>
    </nav>}
  </div>;
}

// API fields are preserved; dashboard shows pending records and Archive retains handover dates.
export function ParcelTable({ parcels, emptyLabel, onSelect, label = "รายการพัสดุ", variant }) {
  const dashboard = variant === "dashboard";
  if (!parcels.length) return <div className="table-empty" role="status"><Package size={24} aria-hidden="true" /><p>{emptyLabel}</p></div>;
  const headers = ["ห้อง / ผู้พัก", "เลขพัสดุ", "วันที่รับเข้า", "สถานะ", ...(!dashboard ? ["วันที่นำออก"] : [])];
  return <div className={dashboard ? "parcel-results dashboard-results" : "parcel-results"}>
    <div className={`table-scroll${dashboard ? " dashboard-desktop-table" : ""}`} role="region" aria-label={label} tabIndex={0}>
      <table className="parcel-table"><caption className="sr-only">{label}</caption>
        <thead><tr>{headers.map((h) => <th scope="col" key={h}>{h}</th>)}</tr></thead>
        <tbody>{parcels.map((p) => <tr key={p.trackingCode}>
          <td><p className="resident-label">{roomLabel(p)}</p>{isUnmatched(p) && p.unmatchedReason && <p className="search-feedback">{unmatchedReasonLabel(p.unmatchedReason)}</p>}</td>
          <td className="tracking-cell"><div className="tracking-content">{onSelect ? <button type="button" className="parcel-history-button" onClick={() => onSelect(p)} aria-label={`ดูประวัติพัสดุ ${p.trackingCode}`}>{p.trackingCode}</button> : p.trackingCode}{p.note?.startsWith("ชำรุด:") && <details className="parcel-damage-note"><summary>ชำรุด</summary><p>{p.note.slice("ชำรุด:".length).trim() || "ไม่ได้ระบุเหตุผล"}</p></details>}</div></td>
          <td className="date-cell">{formatThaiDateTime(p.checkedInAt)}</td><td><StatusChip parcel={p} /></td>
          {!dashboard && <td className="date-cell">{p.checkedOutAt ? formatThaiDateTime(p.checkedOutAt) : "–"}</td>}
        </tr>)}</tbody>
      </table>
    </div>
    {dashboard && <ul className="parcel-mobile-list" aria-label={label}>{parcels.map((p) => <li key={p.trackingCode}>
      <div className="parcel-mobile-identity"><p>{roomLabel(p)}</p><StatusChip parcel={p} /></div>
      <button type="button" className="parcel-history-button parcel-mobile-code" onClick={() => onSelect?.(p)}>{p.trackingCode}</button>
      <p className="date-cell">รับเข้า {formatThaiDateTime(p.checkedInAt)}</p>{p.note?.startsWith("ชำรุด:") && <details className="parcel-damage-note"><summary>ชำรุด</summary><p>{p.note.slice("ชำรุด:".length).trim() || "ไม่ได้ระบุเหตุผล"}</p></details>}
    </li>)}</ul>}
  </div>;
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
