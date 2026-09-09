import React, { useState, useMemo, useEffect } from "react";
import {
  Package,
  Search,
  LogOut,
  LogIn,
  X,
  Check,
  User,
  ScanLine,
  PackagePlus,
  Clock,
  Lock,
  AlertTriangle,
  Bell,
} from "lucide-react";

const C = {
  bg: "#F7F8FA",
  card: "#FFFFFF",
  sidebar: "#FFFFFF",
  border: "#E8EAEE",
  text: "#171A21",
  textMuted: "#7A8091",
  primary: "#EA6C3D",
  primaryDark: "#D65A2E",
  primaryLight: "#FCE7DC",
  success: "#2F9E58",
  successLight: "#E5F5EA",
  navyChip: "#EEF1FB",
  navy: "#4C5AAE",
  warning: "#D14343",
  warningLight: "#FBEAEA",
};

const FONT_LINK_ID = "parcelhub-fonts";
function useFonts() {
  React.useEffect(() => {
    if (document.getElementById(FONT_LINK_ID)) return;
    const link = document.createElement("link");
    link.id = FONT_LINK_ID;
    link.rel = "stylesheet";
    link.href =
      "https://fonts.googleapis.com/css2?family=Sora:wght@500;600;700;800&family=Inter:wght@400;500;600;700&display=swap";
    document.head.appendChild(link);
  }, []);
}

const displayFont = { fontFamily: "'Sora', sans-serif" };
const bodyFont = { fontFamily: "'Inter', sans-serif" };

const INITIAL_PARCELS = [
  {
    id: "1",
    code: "TH3344556677",
    room: "090",
    name: "สมชาย ใจดี",
    line: "@somchai_j",
    qty: 1,
    receivedAt: "2026-08-15T08:30:00",
    status: "in",
  },
  {
    id: "2",
    code: "TH8827301923",
    room: "101/2",
    name: "ณัฐพล สุขใจ",
    line: "@nattapon_s",
    qty: 1,
    receivedAt: "2026-08-18T09:14:00",
    status: "in",
  },
  {
    id: "3",
    code: "TH1029384756",
    room: "203/1",
    name: "พิมพ์ชนก แสงทอง",
    line: "pimchanok.st",
    qty: 2,
    receivedAt: "2026-08-21T10:02:00",
    status: "in",
  },
  {
    id: "4",
    code: "PK12345678910TH",
    room: "305",
    name: "กันตพงศ์ วงศ์ไพร",
    line: "@kantapong99",
    qty: 1,
    receivedAt: "2026-08-22T16:02:00",
    status: "in",
  },
  {
    id: "5",
    code: "TH5566778899",
    room: "108/1",
    name: "อารียา คงสวัสดิ์",
    line: "areeya_ks",
    qty: 3,
    receivedAt: "2026-08-19T13:40:00",
    status: "out",
    exitedAt: "2026-08-20T08:10:00",
  },
  {
    id: "6",
    code: "TH2233445566",
    room: "212",
    name: "ธีรภัทร มั่นคง",
    line: "@teerapat.m",
    qty: 1,
    receivedAt: "2026-08-18T11:25:00",
    status: "out",
    exitedAt: "2026-08-18T18:47:00",
  },
  {
    id: "7",
    code: "TH9988001122",
    room: "150/3",
    name: "ชญานิษฐ์ เพชรรัตน์",
    line: "chayanit.p",
    qty: 1,
    receivedAt: "2026-08-17T09:05:00",
    status: "out",
    exitedAt: "2026-08-17T17:30:00",
  },
];

let idCounter = INITIAL_PARCELS.length + 1;

const THAI_MONTHS = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

function formatThaiDateTime(iso) {
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getDate()} ${THAI_MONTHS[d.getMonth()]} ${d.getFullYear() + 543} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function daysWaiting(iso) {
  return (Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24);
}

function waitLabel(days) {
  if (days < 1) {
    return `${Math.max(1, Math.round(days * 24))} ชม.`;
  }
  return `${Math.floor(days)} วัน`;
}

const WAIT_WARN_DAYS = 2;
const WAIT_CRITICAL_DAYS = 4;

function waitSeverity(days) {
  if (days >= WAIT_CRITICAL_DAYS) return "critical";
  if (days >= WAIT_WARN_DAYS) return "warn";
  return "ok";
}

const ROOM_DIRECTORY = {
  "090": ["สมชาย ใจดี"],
  "101/2": ["ณัฐพล สุขใจ"],
  "203/1": ["พิมพ์ชนก แสงทอง"],
  "305": ["กันตพงศ์ วงศ์ไพร"],
  "108/1": ["อารียา คงสวัสดิ์"],
  "212": ["ธีรภัทร มั่นคง"],
  "150/3": ["ชญานิษฐ์ เพชรรัตน์"],
};

function roomLabel(p) {
  const residents = ROOM_DIRECTORY[p.room];
  if (residents && residents.length) return `${p.room} · ${residents.join(" / ")}`;
  if (p.name && p.name !== "-") return `${p.room} · ${p.name}`;
  return p.room;
}

function BottleneckPanel({ parcels }) {
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

function StatusChip({ status }) {
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

function Banner({ message, tone = "success", onClose }) {
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

function NavItem({ id, label, page, setPage }) {
  return (
    <button onClick={() => setPage(id)} className="px-5 py-2.5 rounded-xl text-lg font-bold transition-colors" style={page === id ? { background: C.primaryLight, color: C.primaryDark, ...bodyFont } : { color: C.textMuted, ...bodyFont }}>
      {label}
    </button>
  );
}

function NotificationItem({ parcel, onConfirm }) {
  const [room, setRoom] = useState(parcel.room || "");
  const [line, setLine] = useState(parcel.line && parcel.line !== "-" ? parcel.line : "");

  const save = () => {
    if (!room.trim()) return;
    onConfirm(parcel.id, { room: room.trim(), line: line.trim() || "-" });
  };

  return (
    <div className="rounded-xl p-3.5" style={{ background: C.warningLight }}>
      <p className="text-xs font-bold mb-0.5" style={{ ...bodyFont, color: C.text }}>{parcel.code}</p>
      {parcel.damageReason && <p className="text-xs mb-2.5" style={{ ...bodyFont, color: C.warning }}>เหตุ: {parcel.damageReason}</p>}
      <div className="space-y-2 mb-2.5">
        <input value={room} onChange={(e) => setRoom(e.target.value)} placeholder="ยืนยันเลขห้อง" className="w-full px-3 py-2.5 rounded-lg border text-sm outline-none" style={{ ...bodyFont, borderColor: C.border, color: C.text, background: C.card }} />
        <input value={line} onChange={(e) => setLine(e.target.value)} placeholder="ยืนยัน Line ID" className="w-full px-3 py-2.5 rounded-lg border text-sm outline-none" style={{ ...bodyFont, borderColor: C.border, color: C.text, background: C.card }} />
      </div>
      <button disabled={!room.trim()} onClick={save} className="w-full py-2.5 rounded-lg text-sm font-semibold text-white disabled:opacity-40" style={{ ...bodyFont, background: C.primary }}>
        ยืนยันข้อมูล
      </button>
    </div>
  );
}

function NotificationBell({ parcels, onConfirm }) {
  const [open, setOpen] = useState(false);
  const flagged = parcels.filter((p) => p.damaged);

  return (
    <div className="relative">
      <button onClick={() => setOpen((o) => !o)} className="relative p-2.5 rounded-xl hover:bg-gray-50" aria-label="การแจ้งเตือน">
        <Bell size={22} style={{ color: C.text }} />
        {flagged.length > 0 && (
          <span className="absolute top-1 right-1 min-w-[18px] h-[18px] px-1 rounded-full flex items-center justify-center text-[10px] font-bold text-white" style={{ background: C.warning }}>
            {flagged.length}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-2 w-80 max-h-[28rem] overflow-y-auto rounded-2xl border shadow-xl z-50" style={{ background: C.card, borderColor: C.border }}>
            <div className="flex items-center justify-between px-4 py-3 border-b sticky top-0" style={{ borderColor: C.border, background: C.card }}>
              <p className="text-sm font-bold" style={{ ...bodyFont, color: C.text }}>พัสดุที่ต้องยืนยันข้อมูล</p>
              <button onClick={() => setOpen(false)} className="p-1 rounded-lg hover:bg-gray-100">
                <X size={16} style={{ color: C.textMuted }} />
              </button>
            </div>
            {flagged.length === 0 ? (
              <p className="text-sm py-8 text-center" style={{ ...bodyFont, color: C.textMuted }}>ไม่มีรายการที่ต้องยืนยัน</p>
            ) : (
              <div className="p-3 space-y-3">{flagged.map((p) => <NotificationItem key={p.id} parcel={p} onConfirm={onConfirm} />)}</div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function TopNav({ page, setPage, onLogout, parcels, onConfirmParcel }) {
  return (
    <header className="border-b" style={{ background: C.sidebar, borderColor: C.border }}>
      <div className="max-w-6xl mx-auto px-5 md:px-8 py-4 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-6 flex-wrap">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: C.primary }}>
              <Package size={20} color="#fff" strokeWidth={2.5} />
            </div>
            <span className="text-xl font-bold" style={{ ...displayFont, color: C.text }}>ParcelHub</span>
          </div>
          <nav className="flex items-center gap-2">
            <NavItem id="dashboard" label="Dashboard" page={page} setPage={setPage} />
            <NavItem id="archive" label="Archive" page={page} setPage={setPage} />
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <NotificationBell parcels={parcels} onConfirm={onConfirmParcel} />
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: C.navyChip }}>
              <User size={16} style={{ color: C.navy }} />
            </div>
            <span className="text-base font-semibold hidden sm:inline" style={{ ...bodyFont, color: C.text }}>Administrator</span>
          </div>
          <button onClick={onLogout} className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-base font-semibold hover:bg-gray-50 transition-colors" style={{ color: C.textMuted, ...bodyFont }}>
            <LogOut size={18} />
            <span className="hidden sm:inline">ออกจากระบบ</span>
          </button>
        </div>
      </div>
    </header>
  );
}

function PageHeader({ eyebrow, title }) {
  return (
    <div className="mb-6">
      <p className="text-xs font-semibold tracking-wide uppercase mb-1" style={{ ...bodyFont, color: C.primary }}>{eyebrow}</p>
      <h1 className="text-2xl font-bold" style={{ ...displayFont, color: C.text }}>{title}</h1>
    </div>
  );
}

function SearchBar({ value, onChange, placeholder }) {
  return (
    <div className="flex items-center gap-3 px-5 py-4 rounded-2xl border-2 w-full" style={{ borderColor: C.border, background: C.card }}>
      <Search size={24} strokeWidth={2.5} style={{ color: C.textMuted }} />
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="w-full outline-none text-lg bg-transparent" style={{ ...bodyFont, color: C.text }} />
    </div>
  );
}

function ParcelTable({ parcels, emptyLabel }) {
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

function ModalShell({ title, icon: Icon, onClose, children }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-2xl shadow-2xl overflow-hidden" style={{ background: C.card }}>
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: C.border }}>
          <div className="flex items-center gap-2.5">
            <Icon size={18} style={{ color: C.primary }} />
            <h3 className="font-semibold" style={{ ...displayFont, color: C.text }}>{title}</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100">
            <X size={18} style={{ color: C.textMuted }} />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

function CheckOutModal({ parcels, onClose, onConfirm }) {
  const [scan, setScan] = useState("");
  const [selectedIds, setSelectedIds] = useState([]);
  const [notFound, setNotFound] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const pending = parcels.filter((p) => p.status === "in");
  const q = scan.trim().toLowerCase();
  const matches = q
    ? pending.filter(
        (p) => p.code.toLowerCase().includes(q) || p.name.toLowerCase().includes(q) || p.room.toLowerCase().includes(q)
      )
    : pending;

  const selectedParcels = pending.filter((p) => selectedIds.includes(p.id));
  const allMatchesSelected = matches.length > 0 && matches.every((p) => selectedIds.includes(p.id));

  const toggleSelect = (id) => {
    setSelectedIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));
  };

  const toggleSelectAllMatches = () => {
    if (allMatchesSelected) {
      const matchIds = matches.map((p) => p.id);
      setSelectedIds((ids) => ids.filter((id) => !matchIds.includes(id)));
    } else {
      setSelectedIds((ids) => Array.from(new Set([...ids, ...matches.map((p) => p.id)])));
    }
  };

  useEffect(() => {
    const code = scan.trim().toLowerCase();
    if (!code) {
      setNotFound(false);
      return;
    }
    const exact = pending.find((p) => p.code.toLowerCase() === code);
    if (exact) {
      setSelectedIds((ids) => (ids.includes(exact.id) ? ids : [...ids, exact.id]));
      setScan("");
      setNotFound(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scan]);

  const handleScanKeyDown = (e) => {
    if (e.key !== "Enter") return;
    const code = scan.trim().toLowerCase();
    if (!code) return;
    const exact = pending.find((p) => p.code.toLowerCase() === code);
    setNotFound(!exact);
  };

  if (confirming) {
    return (
      <ModalShell title="ยืนยันนำพัสดุออก" icon={ScanLine} onClose={onClose}>
        <p className="text-xs font-medium mb-3 flex items-center gap-1.5" style={{ ...bodyFont, color: C.success }}>
          <Check size={13} strokeWidth={3} />
          กรุณายืนยันรายการก่อนนำพัสดุออก ({selectedParcels.length} ชิ้น)
        </p>
        <div className="max-h-64 overflow-y-auto -mx-1 px-1 space-y-2 mb-4">
          {selectedParcels.map((p) => (
            <div key={p.id} className="rounded-xl p-3.5" style={{ background: C.bg }}>
              <div className="flex justify-between text-sm mb-1">
                <span className="font-semibold" style={{ ...bodyFont, color: C.text }}>{roomLabel(p)}</span>
                <span style={{ ...bodyFont, color: C.textMuted }}>x{p.qty}</span>
              </div>
              <p className="text-xs" style={{ ...bodyFont, color: C.textMuted }}>{p.code}{p.line && p.line !== "-" ? ` · ${p.line}` : ""}</p>
            </div>
          ))}
        </div>
        <div className="flex gap-2.5">
          <button onClick={() => setConfirming(false)} className="flex-1 py-2.5 rounded-xl text-sm font-medium border" style={{ ...bodyFont, borderColor: C.border, color: C.text }}>ย้อนกลับ</button>
          <button onClick={() => onConfirm(selectedParcels)} className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white" style={{ ...bodyFont, background: C.primary }}>ยืนยันนำออก ({selectedParcels.length})</button>
        </div>
      </ModalShell>
    );
  }

  return (
    <ModalShell title="สแกนพัสดุออก" icon={ScanLine} onClose={onClose}>
      <label className="block text-xs font-medium mb-2" style={{ ...bodyFont, color: C.textMuted }}>สแกน หรือ พิมพ์เลขพัสดุ / ชื่อ / เลขห้อง</label>
      <div className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border mb-1" style={{ borderColor: notFound ? C.warning : C.border }}>
        <ScanLine size={16} style={{ color: C.textMuted }} />
        <input autoFocus value={scan} onChange={(e) => setScan(e.target.value)} onKeyDown={handleScanKeyDown} placeholder="เช่น TH8827301923 หรือเลขห้อง 101/2" className="w-full outline-none text-sm bg-transparent" style={bodyFont} />
      </div>
      {notFound ? (
        <p className="text-xs mb-3" style={{ ...bodyFont, color: C.warning }}>ไม่พบเลขพัสดุนี้ในรายการที่รอนำออก</p>
      ) : (
        <p className="text-xs mb-3" style={{ ...bodyFont, color: C.textMuted }}>สแกนได้ต่อเนื่องหลายชิ้น หรือพิมพ์เลขห้องเพื่อเลือกพัสดุของผู้รับคนเดียวกันทั้งหมด</p>
      )}

      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-medium" style={{ ...bodyFont, color: C.textMuted }}>รายการที่รอนำออก ({matches.length})</p>
        {matches.length > 1 && (
          <button onClick={toggleSelectAllMatches} className="text-xs font-semibold" style={{ ...bodyFont, color: C.primaryDark }}>
            {allMatchesSelected ? "ยกเลิกเลือกทั้งหมด" : `เลือกทั้งหมดที่พบ (${matches.length})`}
          </button>
        )}
      </div>

      <div className="max-h-56 overflow-y-auto -mx-1 px-1 space-y-1.5 mb-4">
        {matches.length === 0 && <p className="text-sm py-6 text-center" style={{ ...bodyFont, color: C.textMuted }}>ไม่พบพัสดุที่ตรงกับคำค้นหา</p>}
        {matches.map((p) => {
          const checked = selectedIds.includes(p.id);
          return (
            <button key={p.id} onClick={() => toggleSelect(p.id)} className="w-full flex items-center gap-3 text-left px-3.5 py-3 rounded-xl border transition-colors" style={{ borderColor: checked ? C.primary : C.border, background: checked ? C.primaryLight : "transparent" }}>
              <div className="w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0" style={{ borderColor: checked ? C.primary : C.border, background: checked ? C.primary : "transparent" }}>
                {checked && <Check size={12} color="#fff" strokeWidth={3} />}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold truncate" style={{ color: C.text }}>{roomLabel(p)}</p>
                <p className="text-xs mt-0.5 truncate" style={{ color: C.textMuted }}>{p.code}</p>
              </div>
            </button>
          );
        })}
      </div>

      <button disabled={selectedIds.length === 0} onClick={() => setConfirming(true)} className="w-full py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-40" style={{ ...bodyFont, background: C.primary }}>
        ดำเนินการต่อ{selectedIds.length > 0 ? ` (เลือกแล้ว ${selectedIds.length} ชิ้น)` : ""}
      </button>
    </ModalShell>
  );
}

function LabeledInput({ label, value, onChange, onKeyDown, placeholder, type = "text", autoFocus }) {
  return (
    <div className="mb-4">
      <label className="block text-sm font-semibold mb-2" style={{ ...bodyFont, color: C.textMuted }}>{label}</label>
      <input type={type} value={value} onChange={onChange} onKeyDown={onKeyDown} placeholder={placeholder} autoFocus={autoFocus} className="w-full px-4 py-3.5 rounded-xl border-2 text-lg outline-none" style={{ ...bodyFont, borderColor: C.border, color: C.text }} />
    </div>
  );
}

function CheckInModal({ parcels, onClose, onSave }) {
  const [batch, setBatch] = useState([]);
  const [form, setForm] = useState({ code: "", room: "", damaged: false, damageReason: "" });
  const [duplicateWarning, setDuplicateWarning] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const canAdd = form.code.trim() && form.room.trim() && (!form.damaged || form.damageReason.trim());

  const isDuplicateCode = (code) => {
    const c = code.trim().toLowerCase();
    if (!c) return false;
    const inBatch = batch.some((item) => item.code.toLowerCase() === c);
    const inSystem = parcels.some((p) => p.code.toLowerCase() === c);
    return inBatch || inSystem;
  };

  const addToBatch = () => {
    if (!canAdd) return;
    if (isDuplicateCode(form.code)) {
      setDuplicateWarning(true);
      return;
    }
    setBatch((b) => [
      ...b,
      {
        code: form.code.trim(),
        room: form.room.trim(),
        damaged: form.damaged,
        damageReason: form.damaged ? form.damageReason.trim() : "",
      },
    ]);
    setForm((f) => ({ ...f, code: "", damaged: false, damageReason: "" }));
    setDuplicateWarning(false);
  };

  const removeFromBatch = (idx) => {
    setBatch((b) => b.filter((_, i) => i !== idx));
  };

  const handleCodeChange = (e) => {
    setForm((f) => ({ ...f, code: e.target.value }));
    setDuplicateWarning(false);
  };

  const handleCodeKeyDown = (e) => {
    if (e.key === "Enter") addToBatch();
  };

  const saveAll = () => {
    if (isDuplicateCode(form.code) && form.code.trim()) {
      setDuplicateWarning(true);
      return;
    }
    const all = canAdd
      ? [
          ...batch,
          {
            code: form.code.trim(),
            room: form.room.trim(),
            damaged: form.damaged,
            damageReason: form.damaged ? form.damageReason.trim() : "",
          },
        ]
      : batch;
    if (all.length === 0) return;
    onSave(all);
  };

  const totalCount = batch.length + (canAdd ? 1 : 0);

  return (
    <ModalShell title="บันทึกพัสดุเข้า" icon={PackagePlus} onClose={onClose}>
      <LabeledInput label="เลขห้อง" value={form.room} onChange={set("room")} placeholder="เช่น 101/2" autoFocus />
      <LabeledInput label="เลขพัสดุ (สแกนต่อเนื่องได้เลย)" value={form.code} onChange={handleCodeChange} onKeyDown={handleCodeKeyDown} placeholder="เช่น TH8827301923" />
      {duplicateWarning ? (
        <p className="text-xs -mt-2 mb-4 font-medium" style={{ ...bodyFont, color: C.warning }}>เลขพัสดุนี้ถูกสแกนไปแล้ว กรุณาตรวจสอบก่อนบันทึกซ้ำ</p>
      ) : (
        <p className="text-xs -mt-2 mb-4" style={{ ...bodyFont, color: C.textMuted }}>สแกนหรือพิมพ์แล้วกด Enter พัสดุจะถูกเพิ่มลงรายการทันที ไม่ต้องกดปุ่มเพิ่ม</p>
      )}

      <button onClick={() => setForm((f) => ({ ...f, damaged: !f.damaged, damageReason: f.damaged ? "" : f.damageReason }))} className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl border-2 mb-3 text-left" style={{ borderColor: form.damaged ? C.warning : C.border, background: form.damaged ? C.warningLight : "transparent" }}>
        <div className="w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0" style={{ borderColor: form.damaged ? C.warning : C.border, background: form.damaged ? C.warning : "transparent" }}>
          {form.damaged && <Check size={13} color="#fff" strokeWidth={3} />}
        </div>
        <span className="text-sm font-semibold" style={{ ...bodyFont, color: form.damaged ? C.warning : C.text }}>พัสดุมีปัญหา / ชำรุด (เช่น ไม่มีเลขห้อง กล่องเสียหาย ชื่อซ้ำ)</span>
      </button>

      {form.damaged && (
        <div className="mb-4">
          <textarea value={form.damageReason} onChange={set("damageReason")} placeholder="ระบุเหตุผล เช่น กล่องบุบ, ไม่มีเลขห้องนี้ในระบบ, ชื่อซ้ำกับห้องอื่น" rows={2} className="w-full px-4 py-3 rounded-xl border-2 text-sm outline-none resize-none" style={{ ...bodyFont, borderColor: C.warning, color: C.text }} />
        </div>
      )}

      {batch.length > 0 && (
        <div className="mb-4">
          <p className="text-sm font-semibold mb-2" style={{ ...bodyFont, color: C.textMuted }}>รายการที่กำลังจะบันทึก ({batch.length})</p>
          <div className="max-h-40 overflow-y-auto -mx-1 px-1 space-y-1.5">
            {batch.map((item, i) => (
              <div key={i} className="flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl" style={{ background: item.damaged ? C.warningLight : C.bg }}>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm font-semibold truncate" style={{ color: C.text }}>ห้อง {item.room}</p>
                    {item.damaged && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded flex-shrink-0" style={{ background: C.warning, color: "#fff" }}>ชำรุด</span>}
                  </div>
                  <p className="text-xs truncate" style={{ color: C.textMuted }}>{item.code}</p>
                </div>
                <button onClick={() => removeFromBatch(i)} className="p-1 rounded-lg hover:bg-gray-200 flex-shrink-0">
                  <X size={14} style={{ color: C.textMuted }} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <button disabled={totalCount === 0} onClick={saveAll} className="w-full mt-1 py-3.5 rounded-xl text-base font-semibold text-white disabled:opacity-40" style={{ ...bodyFont, background: C.primary }}>
        บันทึกพัสดุเข้าทั้งหมด{totalCount > 0 ? ` (${totalCount} ชิ้น)` : ""}
      </button>
    </ModalShell>
  );
}

function LoginPage({ onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const submit = () => {
    if (!username.trim() || !password.trim()) {
      setError("กรุณากรอกชื่อผู้ใช้และรหัสผ่าน");
      return;
    }
    setError("");
    onLogin(username.trim());
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") submit();
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: C.bg }}>
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4" style={{ background: C.primary }}>
            <Package size={26} color="#fff" strokeWidth={2.5} />
          </div>
          <h1 className="text-2xl font-bold" style={{ ...displayFont, color: C.text }}>ParcelHub</h1>
          <p className="text-sm mt-1" style={{ ...bodyFont, color: C.textMuted }}>ระบบจัดการพัสดุประจำอาคาร</p>
        </div>

        <div className="rounded-2xl border p-6 space-y-4" style={{ background: C.card, borderColor: C.border }}>
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ ...bodyFont, color: C.textMuted }}>ชื่อผู้ใช้</label>
            <div className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border" style={{ borderColor: C.border }}>
              <User size={16} style={{ color: C.textMuted }} />
              <input value={username} onChange={(e) => setUsername(e.target.value)} onKeyDown={handleKeyDown} placeholder="admin" className="w-full outline-none text-sm bg-transparent" style={bodyFont} />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ ...bodyFont, color: C.textMuted }}>รหัสผ่าน</label>
            <div className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border" style={{ borderColor: C.border }}>
              <Lock size={16} style={{ color: C.textMuted }} />
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={handleKeyDown} placeholder="••••••••" className="w-full outline-none text-sm bg-transparent" style={bodyFont} />
            </div>
          </div>
          {error && <p className="text-xs" style={{ ...bodyFont, color: "#D64545" }}>{error}</p>}
          <button type="button" onClick={submit} className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-white" style={{ ...bodyFont, background: C.primary }}>
            <LogIn size={16} />
            เข้าสู่ระบบ
          </button>
        </div>
      </div>
    </div>
  );
}

function SearchStatusBadge({ hasQuery, matchCount, pendingCount }) {
  let label = "รอค้นหา";
  let color = C.textMuted;
  let bg = C.bg;

  if (hasQuery) {
    if (matchCount === 0) {
      label = "ไม่พบพัสดุ";
    } else if (pendingCount > 0) {
      label = `มีพัสดุรอรับ ${pendingCount} ชิ้น`;
      color = C.warning;
      bg = C.warningLight;
    } else {
      label = "รับพัสดุครบแล้ว";
      color = C.success;
      bg = C.successLight;
    }
  }

  return (
    <div className="flex flex-col items-center justify-center gap-1 px-6 py-4 rounded-2xl md:min-w-[200px]" style={{ background: bg }}>
      <span className="text-xs font-semibold uppercase tracking-wide" style={{ ...bodyFont, color, opacity: 0.75 }}>สถานะ</span>
      <span className="text-xl font-bold text-center" style={{ ...displayFont, color }}>{label}</span>
    </div>
  );
}

function DashboardPage({ parcels, onOpenCheckOut, onOpenCheckIn }) {
  const [query, setQuery] = useState("");
  const pending = parcels.filter((p) => p.status === "in");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const source = q ? parcels : pending;
    if (!q) return source;
    return parcels.filter(
      (p) => p.code.toLowerCase().includes(q) || p.name.toLowerCase().includes(q) || p.room.toLowerCase().includes(q)
    );
  }, [query, parcels]);

  return (
    <div>
      <div className="flex items-start justify-between gap-4 flex-wrap mb-6">
        <div className="flex items-center gap-3">
          <button onClick={onOpenCheckIn} className="flex items-center gap-2.5 px-7 py-4 rounded-2xl text-lg font-bold" style={{ ...bodyFont, background: C.successLight, color: C.success }}>
            <PackagePlus size={24} />
            เข้า
          </button>
          <button onClick={onOpenCheckOut} className="flex items-center gap-2.5 px-7 py-4 rounded-2xl text-lg font-bold text-white" style={{ ...bodyFont, background: C.primary }}>
            <ScanLine size={24} />
            ออก
          </button>
        </div>
      </div>

      <div className="rounded-2xl border p-5 md:p-6" style={{ background: C.card, borderColor: C.border }}>
        <p className="text-xl font-bold mb-4" style={{ ...displayFont, color: C.text }}>ค้นหาเลขห้อง</p>
        <div className="flex flex-col md:flex-row gap-4 items-stretch mb-1">
          <div className="flex-1 flex items-center gap-3 px-5 py-4 rounded-2xl border-2" style={{ borderColor: query.trim() ? C.primary : C.border, background: query.trim() ? C.primaryLight : C.card }}>
            <Search size={26} strokeWidth={2.5} style={{ color: C.primaryDark }} />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="กรอกเลขห้อง เช่น 101/2" className="w-full outline-none bg-transparent text-2xl font-bold" style={{ ...bodyFont, color: C.text }} />
          </div>
          <SearchStatusBadge hasQuery={!!query.trim()} matchCount={filtered.length} pendingCount={filtered.filter((p) => p.status === "in").length} />
        </div>
        <p className="text-xs mb-1" style={{ ...bodyFont, color: C.textMuted }}>ค้นหาได้ด้วยเลขห้อง ชื่อผู้รับ หรือรหัสพัสดุ</p>
        <div className="mt-4">
          <ParcelTable parcels={filtered} emptyLabel={query.trim() ? "ไม่พบพัสดุที่ตรงกับคำค้นหา" : "ยังไม่มีพัสดุที่รอรับในขณะนี้"} />
        </div>
      </div>
    </div>
  );
}

function StatusFilterTabs({ value, onChange, counts }) {
  const options = [
    { id: "all", label: "ทั้งหมด" },
    { id: "in", label: "พัสดุเข้า (รอรับ)" },
    { id: "out", label: "พัสดุออก (รับแล้ว)" },
    { id: "damaged", label: "ชำรุด", warn: true },
  ];

  return (
    <div className="flex items-center gap-2 flex-wrap mb-4">
      {options.map((opt) => {
        const active = value === opt.id;
        const activeStyle = opt.warn ? { background: C.warning, color: "#fff", ...bodyFont } : { background: C.primary, color: "#fff", ...bodyFont };
        return (
          <button key={opt.id} onClick={() => onChange(opt.id)} className="px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors" style={active ? activeStyle : { background: C.bg, color: C.textMuted, ...bodyFont }}>
            {opt.label} ({counts[opt.id]})
          </button>
        );
      })}
    </div>
  );
}

function ArchivePage({ parcels }) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const counts = useMemo(
    () => ({
      all: parcels.length,
      in: parcels.filter((p) => p.status === "in").length,
      out: parcels.filter((p) => p.status === "out").length,
      damaged: parcels.filter((p) => p.damaged).length,
    }),
    [parcels]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return parcels.filter((p) => {
      const matchesQuery = !q || p.code.toLowerCase().includes(q) || p.name.toLowerCase().includes(q) || p.room.toLowerCase().includes(q);
      const matchesStatus = statusFilter === "all" || (statusFilter === "damaged" ? p.damaged : p.status === statusFilter);
      return matchesQuery && matchesStatus;
    });
  }, [query, parcels, statusFilter]);

  return (
    <div className="rounded-2xl border p-5" style={{ background: C.card, borderColor: C.border }}>
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <p className="text-base font-semibold" style={{ ...bodyFont, color: C.text }}>ประวัติพัสดุทั้งหมด</p>
        <span className="text-xs font-medium px-2.5 py-1 rounded-full" style={{ background: C.bg, color: C.textMuted, ...bodyFont }}>{filtered.length} รายการ</span>
      </div>
      <StatusFilterTabs value={statusFilter} onChange={setStatusFilter} counts={counts} />
      <SearchBar value={query} onChange={setQuery} placeholder="ค้นหาด้วยชื่อ เลขพัสดุ หรือเลขห้อง" />
      <div className="mt-4">
        <ParcelTable parcels={filtered} emptyLabel="ไม่พบรายการที่ตรงกับคำค้นหา" />
      </div>
    </div>
  );
}

export default function ParcelHubApp() {
  useFonts();
  const [authed, setAuthed] = useState(false);
  const [page, setPage] = useState("dashboard");
  const [parcels, setParcels] = useState(INITIAL_PARCELS);
  const [modal, setModal] = useState(null);
  const [banner, setBanner] = useState(null);

  const showBanner = (message, tone = "success") => {
    setBanner({ message, tone });
    setTimeout(() => setBanner(null), 2600);
  };

  const handleCheckOutConfirm = (selectedParcels) => {
    const ids = selectedParcels.map((p) => p.id);
    const exitedAt = new Date().toISOString();
    setParcels((ps) => ps.map((p) => (ids.includes(p.id) ? { ...p, status: "out", exitedAt } : p)));
    setModal(null);
    if (selectedParcels.length === 1) {
      showBanner(`นำพัสดุของ ${roomLabel(selectedParcels[0])} ออกแล้ว`);
    } else {
      showBanner(`นำพัสดุออกแล้ว ${selectedParcels.length} ชิ้น`);
    }
  };

  const handleCheckInSave = (batch) => {
    const receivedAt = new Date().toISOString();
    const newParcels = batch.map((item) => ({
      id: String(idCounter++),
      code: item.code.trim(),
      room: item.room.trim(),
      name: "-",
      line: "-",
      qty: 1,
      damaged: !!item.damaged,
      damageReason: item.damaged ? item.damageReason.trim() : "",
      receivedAt,
      status: "in",
    }));
    setParcels((ps) => [...newParcels, ...ps]);
    setModal(null);
    showBanner(newParcels.length === 1 ? "บันทึกพัสดุเข้าเรียบร้อยแล้ว" : `บันทึกพัสดุเข้าเรียบร้อยแล้ว ${newParcels.length} ชิ้น`);
  };

  const handleConfirmParcelInfo = (id, { room, line }) => {
    setParcels((ps) => ps.map((p) => (p.id === id ? { ...p, room, line, damaged: false, damageReason: "" } : p)));
    showBanner("ยืนยันข้อมูลพัสดุเรียบร้อยแล้ว");
  };

  if (!authed) {
    return <LoginPage onLogin={() => setAuthed(true)} />;
  }

  return (
    <div className="min-h-screen" style={{ background: C.bg, ...bodyFont }}>
      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fade { animation: fadeIn 0.2s ease-out; }
        @media (prefers-reduced-motion: reduce) { .animate-fade { animation: none; } }
      `}</style>

      <TopNav page={page} setPage={setPage} onLogout={() => setAuthed(false)} parcels={parcels} onConfirmParcel={handleConfirmParcelInfo} />

      <main className="max-w-6xl mx-auto px-5 md:px-8 py-6 md:py-8">
        {page === "dashboard" ? (
          <>
            <PageHeader eyebrow="Parcel Management" title="Dashboard" />
            <DashboardPage parcels={parcels} onOpenCheckOut={() => setModal("checkout")} onOpenCheckIn={() => setModal("checkin")} />
          </>
        ) : (
          <>
            <PageHeader eyebrow="Parcel Management" title="Archive" />
            <ArchivePage parcels={parcels} />
          </>
        )}
      </main>

      {modal === "checkout" && <CheckOutModal parcels={parcels} onClose={() => setModal(null)} onConfirm={handleCheckOutConfirm} />}
      {modal === "checkin" && <CheckInModal parcels={parcels} onClose={() => setModal(null)} onSave={handleCheckInSave} />}

      <Banner message={banner?.message} tone={banner?.tone} onClose={() => setBanner(null)} />
    </div>
  );
}
