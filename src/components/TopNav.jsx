import React, { useState } from "react";
import { Package, User, LogOut, Bell, X } from "lucide-react";
import { C, bodyFont, displayFont } from "./shared";

function NavItem({ id, label, page, setPage }) {
  return (
    <button onClick={() => setPage(id)} className="px-4 py-2.5 rounded-full text-sm font-bold transition-colors" style={page === id ? { background: C.primary, color: "#fff", ...bodyFont } : { color: C.textMuted, ...bodyFont }}>
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

export default function TopNav({ page, setPage, onLogout, parcels, onConfirmParcel }) {
  return (
    <header className="border-b" style={{ background: C.sidebar, borderColor: C.border }}>
      <div className="max-w-6xl mx-auto px-5 md:px-8 py-5 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-6 flex-wrap">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: C.primary }}>
              <Package size={20} color="#fff" strokeWidth={2.5} />
            </div>
            <span className="text-xl font-bold tracking-tight" style={{ ...displayFont, color: C.text }}>ParcelHub</span>
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
