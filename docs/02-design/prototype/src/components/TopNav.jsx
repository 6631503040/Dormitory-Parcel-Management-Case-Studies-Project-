import React, { useEffect, useRef, useState } from "react";
import { Package, User, LogOut, Bell, X } from "lucide-react";

function NavItem({ id, label, page, setPage }) {
  return <button onClick={() => setPage(id)} className="nav-item" aria-current={page === id ? "page" : undefined}>{label}</button>;
}

function NotificationItem({ parcel, onConfirm }) {
  const [error, setError] = useState("");
  return (
    <section className="notification-item">
      <h3>LINE ID นี้ตรงกับห้องนี้หรือไม่?</h3>
      <p className="notification-hint">กรุณาตรวจสอบข้อมูลก่อนยืนยัน</p>
      <dl className="notification-facts">
        <div><dt>ห้อง</dt><dd>{parcel.room || "–"}</dd></div>
        <div><dt>LINE ID</dt><dd>{parcel.line || "–"}</dd></div>
        <div><dt>เลขพัสดุ</dt><dd>{parcel.code}</dd></div>
      </dl>
      <button onClick={() => { const result = onConfirm(parcel.id, { room: parcel.room, line: parcel.line || "-" }); if (!result?.ok) setError(result?.error || "ยืนยันไม่สำเร็จ กรุณาลองใหม่"); }} className="desk-button desk-button-primary">ยืนยันว่า LINE ID ตรงกัน</button>
      <p className="search-feedback">การยืนยันนี้ไม่ลบหมายเหตุชำรุด</p>
      {error && <p role="alert" className="field-error">{error}</p>}
    </section>
  );
}

function NotificationBell({ parcels, onConfirm }) {
  const [open, setOpen] = useState(false);
  const trigger = useRef(null);
  const panel = useRef(null);
  const flagged = parcels.filter((p) => p.damaged && !p.identityConfirmed && p.line && p.line !== "-");
  const close = () => {
    setOpen(false);
    trigger.current?.focus();
  };
  useEffect(() => {
    if (!open) return;
    panel.current?.querySelector("button")?.focus();
    const onKeyDown = (event) => {
      if (event.key === "Escape") { setOpen(false); trigger.current?.focus(); }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <div className="notification-anchor">
      <button ref={trigger} onClick={() => setOpen((o) => !o)} className="icon-button notification-trigger" aria-label={`การแจ้งเตือน ${flagged.length} รายการ`} aria-expanded={open} aria-controls={open ? "notification-panel" : undefined}>
        <Bell size={19} aria-hidden="true" />
        {flagged.length > 0 && <span className="notification-count">{flagged.length}</span>}
      </button>
      {open && <>
        <div className="notification-backdrop" onClick={close} aria-hidden="true" />
        <div id="notification-panel" ref={panel} className="notification-panel" role="region" aria-label="การแจ้งเตือน">
          <div className="notification-header"><h2>การแจ้งเตือน</h2><button onClick={close} className="icon-button" aria-label="ปิดการแจ้งเตือน"><X size={18} aria-hidden="true" /></button></div>
          {flagged.length === 0 ? <p className="notification-empty">ไม่มีรายการที่ต้องยืนยัน</p> : flagged.map((p) => <NotificationItem key={p.id} parcel={p} onConfirm={onConfirm} />)}
        </div>
      </>}
    </div>
  );
}

export default function TopNav({ page, setPage, onLogout, parcels, onConfirmParcel }) {
  return (
    <header className="desk-header">
      <a href="#main-content" className="skip-link">ข้ามไปยังเนื้อหา</a>
      <div className="desk-header-inner">
        <div className="desk-brand"><Package size={23} aria-hidden="true" /><span>ParcelHub</span></div>
        <nav className="desk-navigation" aria-label="หน้าหลัก"><NavItem id="dashboard" label="Dashboard" page={page} setPage={setPage} /><NavItem id="archive" label="Archive" page={page} setPage={setPage} /></nav>
        <div className="desk-account">
          <NotificationBell parcels={parcels} onConfirm={onConfirmParcel} />
          <span className="account-name"><User size={17} aria-hidden="true" /><span>Administrator</span></span>
          <button onClick={onLogout} className="logout-button" aria-label="ออกจากระบบ"><LogOut size={18} aria-hidden="true" /><span>ออกจากระบบ</span></button>
        </div>
      </div>
    </header>
  );
}
