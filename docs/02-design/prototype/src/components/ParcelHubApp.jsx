import React, { useEffect, useRef, useState } from "react";
import LoginPage from "./LoginPage";
import DashboardPage from "./DashboardPage";
import ArchivePage from "./ArchivePage";
import TopNav from "./TopNav";
import { Banner, PageHeader, C, bodyFont, INITIAL_PARCELS, roomLabel, useFonts } from "./shared";
import { CheckOutModal, CheckInModal } from "./Modals";
import { emptyDraft, hasDraft, residentsFor, loadParcelState, persistParcels, validateBatch, validateCheckOut } from "../lib/parcelRules";

const AUTH_STORAGE_KEY = "parcelhub-authenticated";

export default function ParcelHubApp() {
  useFonts();
  const [boot] = useState(() => {
    try { return loadParcelState(localStorage, INITIAL_PARCELS); }
    catch { return { parcels: [], raw: undefined, error: "พื้นที่จัดเก็บในเครื่องถูกปิดกั้น กรุณาตรวจการตั้งค่าเบราว์เซอร์แล้วโหลดใหม่" }; }
  });
  const [authed, setAuthed] = useState(() => { try { return localStorage.getItem(AUTH_STORAGE_KEY) === "true"; } catch { return false; } });
  const [page, setPage] = useState("dashboard");
  const [parcels, setParcels] = useState(boot.parcels);
  const [modal, setModal] = useState(null);
  const [banner, setBanner] = useState(null);
  const [storageError, setStorageError] = useState(boot.error);
  const [draft, setDraft] = useState(emptyDraft);
  const [checkoutQuery, setCheckoutQuery] = useState("");
  const current = useRef(boot.parcels);
  const raw = useRef(boot.raw);
  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);
  useEffect(() => {
    const changed = (event) => {
      if (event.key === "parcelhub-parcels" || event.key === null) setStorageError("ข้อมูลเปลี่ยนจากอีกหน้าต่าง กรุณาตรวจข้อมูลล่าสุดก่อนบันทึก ร่างที่กรอกยังคงอยู่");
    };
    window.addEventListener("storage", changed);
    return () => window.removeEventListener("storage", changed);
  }, []);
  useEffect(() => {
    if (!authed || !hasDraft(draft)) return;
    const warn = (event) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [draft, authed]);
  const commit = (next) => {
    let result;
    try { result = persistParcels(localStorage, next, raw.current); }
    catch { result = { ok: false, error: "พื้นที่จัดเก็บในเครื่องถูกปิดกั้น รายการยังไม่ได้บันทึกและร่างยังอยู่" }; }
    if (!result.ok) { setStorageError(result.error); return result; }
    current.current = next; raw.current = result.raw;
    setParcels(next); setStorageError("");
    return { ok: true };
  };
  const handleLogin = () => {
    try { localStorage.setItem(AUTH_STORAGE_KEY, "true"); setAuthed(true); return { ok: true }; }
    catch { return { ok: false, error: "เก็บสถานะเข้าสู่ระบบไม่ได้ กรุณาอนุญาตพื้นที่จัดเก็บของเบราว์เซอร์แล้วลองใหม่" }; }
  };
  const handleLogout = () => {
    if (hasDraft(draft) && !window.confirm("มีร่างพัสดุที่ยังไม่บันทึก ออกจากระบบและทิ้งร่างนี้หรือไม่?")) return;
    try { localStorage.removeItem(AUTH_STORAGE_KEY); }
    catch { setStorageError("ล้างสถานะเข้าสู่ระบบในเครื่องไม่ได้ กรุณาตรวจพื้นที่จัดเก็บแล้วลองใหม่"); return; }
    setDraft(emptyDraft()); setModal(null); setBanner(null); clearTimeout(timer.current); setAuthed(false);
  };
  const showBanner = (message, tone = "success") => {
    clearTimeout(timer.current); setBanner({ message, tone });
    timer.current = setTimeout(() => setBanner(null), 6000);
  };
  const handleCheckOutConfirm = (items, room) => {
    const ids = items.map((p) => p.id);
    const error = validateCheckOut(current.current, ids, room);
    if (error) return { ok: false, error };
    const exitedAt = new Date().toISOString();
    const result = commit(current.current.map((p) => ids.includes(p.id) ? { ...p, status: "out", exitedAt } : p));
    if (!result.ok) return result;
    setModal(null); showBanner(`นำออก ${items.length} รายการของห้อง ${room} แล้ว`);
    return result;
  };
  const handleCheckInSave = (batch) => {
    const error = validateBatch(batch, current.current);
    if (error) return { ok: false, error };
    const receivedAt = new Date().toISOString();
    const used = new Set(current.current.map((p) => p.id));
    let counter = 0;
    const newParcels = batch.map((item) => {
      let id; do { id = String(++counter); } while (used.has(id)); used.add(id);
      return { id, code: item.code.trim(), room: item.room.trim(), name: residentsFor(item.room.trim()).join(" / "), line: "-", qty: 1, damaged: !!item.damaged, damageReason: item.damaged ? item.damageReason.trim() : "", receivedAt, status: "in" };
    });
    const result = commit([...newParcels, ...current.current]);
    if (!result.ok) return result;
    setDraft(emptyDraft()); setModal(null); showBanner(`บันทึกพัสดุเข้า ${newParcels.length} รายการแล้ว`);
    return result;
  };
  const handleConfirmParcelInfo = (id, { room, line }) => {
    const found = current.current.find((p) => p.id === id);
    if (!found || found.room !== room) return { ok: false, error: "ข้อมูลห้องเปลี่ยนแล้ว กรุณาตรวจรายการอีกครั้ง" };
    const result = commit(current.current.map((p) => p.id === id ? { ...p, line, identityConfirmed: true } : p));
    if (result.ok) showBanner("ยืนยันข้อมูลแล้ว หมายเหตุสภาพพัสดุยังคงอยู่");
    return result;
  };
  if (!authed) {
    return <LoginPage onLogin={handleLogin} />;
  }

  return (
    <div className="min-h-screen" style={{ background: C.bg, ...bodyFont }}>
      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fade { animation: fadeIn 0.2s ease-out; }
        @media (prefers-reduced-motion: reduce) { .animate-fade { animation: none; } }
      `}</style>

      <TopNav
        page={page}
        setPage={setPage}
        onLogout={handleLogout}
        parcels={parcels}
        onConfirmParcel={handleConfirmParcelInfo}
      />

      <main className="desk-main" id="main-content">
        {storageError && <div className="storage-error" role="alert"><strong>กรุณาตรวจข้อมูลก่อนทำรายการ</strong><p>{storageError}</p></div>}
        {page === "dashboard" ? (
          <>
            <DashboardPage
              parcels={parcels}
              onOpenCheckOut={(query = "") => { setCheckoutQuery(query); setModal("checkout"); }}
              onOpenCheckIn={() => setModal("checkin")}
            />
          </>
        ) : (
          <>
            <PageHeader title="Archive" description="ค้นหาประวัติการรับเข้าและนำจ่ายพัสดุ" />
            <ArchivePage parcels={parcels} />
          </>
        )}
      </main>

      {modal === "checkout" && (
        <CheckOutModal
          parcels={parcels}
          onClose={() => setModal(null)}
          initialQuery={checkoutQuery}
          onConfirm={handleCheckOutConfirm}
        />
      )}
      {modal === "checkin" && (
        <CheckInModal parcels={parcels} draft={draft} onDraftChange={setDraft} onClose={() => setModal(null)} onSave={handleCheckInSave} />
      )}

      <Banner message={banner?.message} tone={banner?.tone} onClose={() => setBanner(null)} />
    </div>
  );
}
