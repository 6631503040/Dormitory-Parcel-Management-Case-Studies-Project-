import React from "react";
import { Package, User, LogOut, KeyRound } from "lucide-react";

function NavItem({ id, label, page, setPage }) {
  return <button onClick={() => setPage(id)} className="nav-item" aria-current={page === id ? "page" : undefined}>{label}</button>;
}

export default function TopNav({ page, setPage, onLogout, onOpenLineOtp, staff }) {
  return (
    <header className="desk-header">
      <a href="#main-content" className="skip-link">ข้ามไปยังเนื้อหา</a>
      <div className="desk-header-inner">
        <div className="desk-brand"><Package size={23} aria-hidden="true" /><span>ParcelHub</span></div>
        <nav className="desk-navigation" aria-label="หน้าหลัก">
          <NavItem id="dashboard" label="หน้าหลัก" page={page} setPage={setPage} />
          <NavItem id="archive" label="ประวัติ" page={page} setPage={setPage} />
        </nav>
        <div className="desk-account">
          <button onClick={onOpenLineOtp} className="icon-button" title="ดูรหัสยืนยัน LINE" aria-label="ดูรหัสยืนยัน LINE">
            <KeyRound size={18} aria-hidden="true" />
          </button>
          <span className="account-name"><User size={17} aria-hidden="true" /><span>{staff.fullName}</span></span>
          <button onClick={onLogout} className="logout-button" aria-label="ออกจากระบบ"><LogOut size={18} aria-hidden="true" /><span>ออกจากระบบ</span></button>
        </div>
      </div>
    </header>
  );
}
