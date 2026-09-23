import React from "react";
import { Package, Check, HelpCircle, X, Search } from "lucide-react";
import { unmatchedReasonLabel } from "../constants/unmatchedReasons";

export const C = {
  bg: "#FFFDF8",
  card: "#FFFFFF",
  sidebar: "#FFFFFF",
  border: "#DDE3EC",
  text: "#202124",
  textMuted: "#697586",
  primary: "#4285F4",
  primaryDark: "#1A56B8",
  primaryLight: "#E8F0FE",
  success: "#188038",
  successLight: "#E6F4EA",
  navyChip: "#E8F0FE",
  navy: "#1967D2",
  warning: "#D93025",
  warningLight: "#FCE8E6",
};

export const displayFont = { fontFamily: "'Space Grotesk', sans-serif" };
export const bodyFont = { fontFamily: "'DM Sans', sans-serif" };

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
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium" style={{ background: C.successLight, color: C.success }}>
        <Check size={12} strokeWidth={3} />
        นำออกแล้ว
      </span>
    );
  }
  if (parcel.status === "archived") {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium" style={{ background: C.bg, color: C.textMuted }}>
        เก็บประวัติ
      </span>
    );
  }
  if (isUnmatched(parcel)) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium" style={{ background: C.warningLight, color: C.warning }}>
        <HelpCircle size={12} strokeWidth={3} />
        มีปัญหา
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium" style={{ background: C.navyChip, color: C.navy }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: C.navy }} />
      รอรับ
    </span>
  );
}

export function Banner({ message, tone = "success", onClose }) {
  if (!message) return null;
  const bg = tone === "success" ? C.successLight : tone === "error" ? C.warningLight : C.primaryLight;
  const fg = tone === "success" ? C.success : tone === "error" ? C.warning : C.primaryDark;

  return (
    <div role="status" aria-live="polite" className="fixed top-5 right-5 z-[70] flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-sm font-medium animate-fade max-w-md" style={{ background: bg, color: fg, ...bodyFont }}>
      <Check size={16} strokeWidth={3} className="flex-shrink-0" />
      <span>{message}</span>
      <button onClick={onClose} aria-label="ปิดข้อความ" className="ml-2 opacity-60 hover:opacity-100 flex-shrink-0">
        <X size={14} />
      </button>
    </div>
  );
}

export function PageHeader({ eyebrow, title }) {
  return (
    <div className="mb-6">
      <p className="text-xs font-semibold tracking-wide uppercase mb-1" style={{ ...bodyFont, color: C.primary }}>{eyebrow}</p>
      <h1 className="text-2xl font-bold" style={{ ...displayFont, color: C.text }}>{title}</h1>
    </div>
  );
}

export function SearchBar({ value, onChange, placeholder }) {
  return (
    <div className="flex items-center gap-3 px-5 py-4 rounded-2xl border-2 w-full focus-within:ring-2 focus-within:ring-blue-300" style={{ borderColor: C.border, background: C.card }}>
      <Search size={24} strokeWidth={2.5} style={{ color: C.textMuted }} />
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label={placeholder} className="w-full outline-none text-lg bg-transparent" style={{ ...bodyFont, color: C.text }} />
    </div>
  );
}

export function LoadMoreFooter({ shown, total, onLoadMore, loading }) {
  return (
    <div className="flex items-center justify-between gap-3 pt-3">
      <p className="text-xs" style={{ ...bodyFont, color: C.textMuted }}>แสดง {shown.toLocaleString()} จาก {total.toLocaleString()} รายการ</p>
      {shown < total && (
        <button onClick={onLoadMore} disabled={loading} className="text-sm font-semibold px-3 py-1.5 rounded-lg hover:bg-gray-50 disabled:opacity-50" style={{ ...bodyFont, color: C.primaryDark }}>
          {loading ? "กำลังโหลด…" : "แสดงเพิ่ม"}
        </button>
      )}
    </div>
  );
}

const TABLE_HEADERS = ["ห้อง / ผู้พัก", "เลขพัสดุ", "วันที่รับเข้า", "สถานะ", "วันที่นำจ่าย"];

// A plain table: it renders exactly the Parcels it is given. Callers own pagination (the API
// paginates every list, so there is never an unbounded array to slice client-side).
export function ParcelTable({ parcels, emptyLabel, onSelect }) {
  if (parcels.length === 0) {
    return (
      <div className="py-16 flex flex-col items-center justify-center text-center">
        <div className="w-12 h-12 rounded-full flex items-center justify-center mb-3" style={{ background: C.bg }}>
          <Package size={20} style={{ color: C.textMuted }} />
        </div>
        <p className="text-sm" style={{ ...bodyFont, color: C.textMuted }}>{emptyLabel}</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-base" style={bodyFont}>
        <thead>
          <tr style={{ borderBottom: `1px solid ${C.border}` }}>
            {TABLE_HEADERS.map((h) => (
              <th key={h} className="text-left py-3 px-3 font-medium first:pl-1" style={{ color: C.textMuted, fontSize: 12.5 }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {parcels.map((p) => (
            <tr
              key={p.trackingCode}
              onClick={onSelect ? () => onSelect(p) : undefined}
              onKeyDown={onSelect ? (e) => { if (e.key === "Enter") onSelect(p); } : undefined}
              tabIndex={onSelect ? 0 : undefined}
              title={onSelect ? "ดูประวัติพัสดุ" : undefined}
              className={onSelect ? "cursor-pointer hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-400" : ""}
              style={{ borderBottom: `1px solid ${C.border}` }}
            >
              <td className="py-3.5 px-3 pl-1">
                <p className="font-semibold" style={{ color: isUnmatched(p) ? C.warning : C.text }}>{roomLabel(p)}</p>
                {isUnmatched(p) && p.unmatchedReason && <p className="text-xs mt-0.5" style={{ color: C.textMuted }}>{unmatchedReasonLabel(p.unmatchedReason)}</p>}
              </td>
              <td className="py-3.5 px-3" style={{ color: C.text }}>{p.trackingCode}</td>
              <td className="py-3.5 px-3" style={{ color: C.textMuted }}>{formatThaiDateTime(p.checkedInAt)}</td>
              <td className="py-3.5 px-3"><StatusChip parcel={p} /></td>
              <td className="py-3.5 px-3" style={{ color: C.textMuted }}>{p.checkedOutAt ? formatThaiDateTime(p.checkedOutAt) : "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>
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
    link.href = "https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Space+Grotesk:wght@500;600;700&display=swap";
    document.head.appendChild(link);
  }, []);
}
