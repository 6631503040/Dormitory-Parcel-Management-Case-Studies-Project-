import React from "react";
import { Package, User, LogOut, KeyRound } from "lucide-react";
import { C, bodyFont, displayFont } from "./shared";

function NavItem({ id, label, page, setPage }) {
  return (
    <button onClick={() => setPage(id)} aria-current={page === id ? "page" : undefined} className="px-4 py-2.5 rounded-full text-sm font-bold transition-colors" style={page === id ? { background: C.primary, color: "#fff", ...bodyFont } : { color: C.textMuted, ...bodyFont }}>
      {label}
    </button>
  );
}

export default function TopNav({ page, setPage, onLogout, onOpenLineOtp, staff }) {
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
            <NavItem id="dashboard" label="หน้าหลัก" page={page} setPage={setPage} />
            <NavItem id="archive" label="ประวัติ" page={page} setPage={setPage} />
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <button onClick={onOpenLineOtp} title="ดูรหัสยืนยัน LINE" aria-label="ดูรหัสยืนยัน LINE" className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-sm font-semibold hover:bg-gray-50 transition-colors" style={{ color: C.textMuted, ...bodyFont }}>
            <KeyRound size={18} />
            <span className="hidden lg:inline">LINE OTP</span>
          </button>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: C.navyChip }}>
              <User size={16} style={{ color: C.navy }} />
            </div>
            <span className="text-base font-semibold hidden sm:inline" style={{ ...bodyFont, color: C.text }}>{staff.fullName}</span>
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
