import React from "react";
import { Package, Check, X, Clock, AlertTriangle, Search } from "lucide-react";

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

export const INITIAL_PARCELS = [
  { id: "1", code: "TH3344556677", room: "090", name: "สมชาย ใจดี", line: "@somchai_j", qty: 1, receivedAt: "2026-08-15T08:30:00", status: "in" },
  { id: "2", code: "TH8827301923", room: "101/2", name: "ณัฐพล สุขใจ", line: "@nattapon_s", qty: 1, receivedAt: "2026-08-18T09:14:00", status: "in" },
  { id: "3", code: "TH1029384756", room: "203/1", name: "พิมพ์ชนก แสงทอง", line: "pimchanok.st", qty: 2, receivedAt: "2026-08-21T10:02:00", status: "in" },
  { id: "4", code: "PK12345678910TH", room: "305", name: "กันตพงศ์ วงศ์ไพร", line: "@kantapong99", qty: 1, receivedAt: "2026-08-22T16:02:00", status: "in" },
  { id: "5", code: "TH5566778899", room: "108/1", name: "อารียา คงสวัสดิ์", line: "areeya_ks", qty: 3, receivedAt: "2026-08-19T13:40:00", status: "out", exitedAt: "2026-08-20T08:10:00" },
  { id: "6", code: "TH2233445566", room: "212", name: "ธีรภัทร มั่นคง", line: "@teerapat.m", qty: 1, receivedAt: "2026-08-18T11:25:00", status: "out", exitedAt: "2026-08-18T18:47:00" },
  { id: "7", code: "TH9988001122", room: "150/3", name: "ชญานิษฐ์ เพชรรัตน์", line: "chayanit.p", qty: 1, receivedAt: "2026-08-17T09:05:00", status: "out", exitedAt: "2026-08-17T17:30:00" },
];

export const THAI_MONTHS = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

export function formatThaiDateTime(iso) {
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getDate()} ${THAI_MONTHS[d.getMonth()]} ${d.getFullYear() + 543} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function daysWaiting(iso) {
  return (Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24);
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

export const ROOM_DIRECTORY = {
  "090": ["สมชาย ใจดี"],
  "101/2": ["ณัฐพล สุขใจ"],
  "203/1": ["พิมพ์ชนก แสงทอง"],
  "305": ["กันตพงศ์ วงศ์ไพร"],
  "108/1": ["อารียา คงสวัสดิ์"],
  "212": ["ธีรภัทร มั่นคง"],
  "150/3": ["ชญานิษฐ์ เพชรรัตน์"],
};

export function roomLabel(p) {
  const residents = ROOM_DIRECTORY[p.room];
  if (residents && residents.length) return `${p.room} · ${residents.join(" / ")}`;
  if (p.name && p.name !== "-") return `${p.room} · ${p.name}`;
  return p.room;
}

export function StatusChip({ status }) {
  if (status === "in") {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium" style={{ background: C.navyChip, color: C.navy }}>
        <span className="w-1.5 h-1.5 rounded-full" style={{ background: C.navy }} />
        รอรับ
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium" style={{ background: C.successLight, color: C.success }}>
      <Check size={12} strokeWidth={3} />
      นำออกแล้ว
    </span>
  );
}

export function Banner({ message, tone = "success", onClose }) {
  if (!message) return null;
  const bg = tone === "success" ? C.successLight : C.primaryLight;
  const fg = tone === "success" ? C.success : C.primaryDark;

  return (
    <div className="fixed top-5 right-5 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-sm font-medium animate-fade" style={{ background: bg, color: fg, ...bodyFont }}>
      <Check size={16} strokeWidth={3} />
      {message}
      <button onClick={onClose} className="ml-2 opacity-60 hover:opacity-100">
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
    <div className="flex items-center gap-3 px-5 py-4 rounded-2xl border-2 w-full" style={{ borderColor: C.border, background: C.card }}>
      <Search size={24} strokeWidth={2.5} style={{ color: C.textMuted }} />
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="w-full outline-none text-lg bg-transparent" style={{ ...bodyFont, color: C.text }} />
    </div>
  );
}

export function ParcelTable({ parcels, emptyLabel }) {
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
            {["ห้อง / ชื่อ / Line", "เลขพัสดุ", "จำนวน", "วันที่รับเข้า", "สถานะ", "วันที่นำจ่าย"].map((h) => (
              <th key={h} className="text-left py-3 px-3 font-medium first:pl-1" style={{ color: C.textMuted, fontSize: 12.5 }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {parcels.map((p) => (
            <tr key={p.id} style={{ borderBottom: `1px solid ${C.border}` }}>
              <td className="py-3.5 px-3 pl-1">
                <div className="flex items-center gap-1.5">
                  <p className="font-semibold" style={{ color: C.text }}>{roomLabel(p)}</p>
                  {p.damaged && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded flex-shrink-0" style={{ background: C.warning, color: "#fff" }} title={p.damageReason || "พัสดุมีปัญหา"}>ชำรุด</span>}
                </div>
                {p.line && p.line !== "-" && <p className="text-xs mt-0.5" style={{ color: C.textMuted }}>{p.line}</p>}
              </td>
              <td className="py-3.5 px-3" style={{ color: C.text }}>{p.code}</td>
              <td className="py-3.5 px-3" style={{ color: C.text }}>{p.qty}</td>
              <td className="py-3.5 px-3" style={{ color: C.textMuted }}>{formatThaiDateTime(p.receivedAt)}</td>
              <td className="py-3.5 px-3"><StatusChip status={p.status} /></td>
              <td className="py-3.5 px-3" style={{ color: C.textMuted }}>{p.exitedAt ? formatThaiDateTime(p.exitedAt) : "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>
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
            <p className="text-sm font-semibold" style={{ ...bodyFont, color: C.text }}>พัสดุตกค้างนานที่สุด</p>
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
    link.href = "https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Space+Grotesk:wght@500;600;700&display=swap";
    document.head.appendChild(link);
  }, []);
}
