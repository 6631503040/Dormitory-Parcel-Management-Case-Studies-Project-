import React, { useEffect, useState } from "react";
import LoginPage from "./LoginPage";
import DashboardPage from "./DashboardPage";
import ArchivePage from "./ArchivePage";
import TopNav from "./TopNav";
import { Banner, PageHeader, C, bodyFont, INITIAL_PARCELS, roomLabel, useFonts } from "./shared";
import { CheckOutModal, CheckInModal } from "./Modals";

const AUTH_STORAGE_KEY = "parcelhub-authenticated";
const PARCELS_STORAGE_KEY = "parcelhub-parcels";
const DEMO_NOTIFICATION_SEEDED_KEY = "parcelhub-demo-notification-seeded";

function readStoredParcels() {
  try {
    const stored = localStorage.getItem(PARCELS_STORAGE_KEY);
    if (!stored) return INITIAL_PARCELS;
    const parcels = JSON.parse(stored);
    if (!Array.isArray(parcels)) return INITIAL_PARCELS;
    if (localStorage.getItem(DEMO_NOTIFICATION_SEEDED_KEY) === "true") return parcels;

    const demoParcel = parcels.find((parcel) => parcel.id === "1");
    localStorage.setItem(DEMO_NOTIFICATION_SEEDED_KEY, "true");
    return demoParcel
      ? parcels.map((parcel) => (
          parcel.id === "1"
            ? { ...parcel, damaged: true, damageReason: "ตัวอย่าง: กรุณาตรวจสอบว่า LINE ID ตรงกับห้อง 090" }
            : parcel
        ))
      : parcels;
  } catch {
    return INITIAL_PARCELS;
  }
}

const storedParcels = readStoredParcels();
let idCounter = storedParcels.reduce((max, parcel) => Math.max(max, Number(parcel.id) || 0), 0) + 1;

export default function ParcelHubApp() {
  useFonts();
  const [authed, setAuthed] = useState(() => localStorage.getItem(AUTH_STORAGE_KEY) === "true");
  const [page, setPage] = useState("dashboard");
  const [parcels, setParcels] = useState(storedParcels);
  const [modal, setModal] = useState(null);
  const [banner, setBanner] = useState(null);

  useEffect(() => {
    localStorage.setItem(PARCELS_STORAGE_KEY, JSON.stringify(parcels));
  }, [parcels]);

  const handleLogin = () => {
    localStorage.setItem(AUTH_STORAGE_KEY, "true");
    setAuthed(true);
  };

  const handleLogout = () => {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    setAuthed(false);
  };

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
    showBanner(
      newParcels.length === 1
        ? "บันทึกพัสดุเข้าเรียบร้อยแล้ว"
        : `บันทึกพัสดุเข้าเรียบร้อยแล้ว ${newParcels.length} ชิ้น`
    );
  };

  const handleConfirmParcelInfo = (id, { room, line }) => {
    setParcels((ps) =>
      ps.map((p) =>
        p.id === id ? { ...p, room, line, damaged: false, damageReason: "" } : p
      )
    );
    showBanner("ยืนยันข้อมูลพัสดุเรียบร้อยแล้ว");
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

      <main className="max-w-6xl mx-auto px-5 md:px-8 py-6 md:py-8">
        {page === "dashboard" ? (
          <>
            <PageHeader eyebrow="Parcel Management" title="Dashboard" />
            <DashboardPage
              parcels={parcels}
              onOpenCheckOut={() => setModal("checkout")}
              onOpenCheckIn={() => setModal("checkin")}
            />
          </>
        ) : (
          <>
            <PageHeader eyebrow="Parcel Management" title="Archive" />
            <ArchivePage parcels={parcels} />
          </>
        )}
      </main>

      {modal === "checkout" && (
        <CheckOutModal
          parcels={parcels}
          onClose={() => setModal(null)}
          onConfirm={handleCheckOutConfirm}
        />
      )}
      {modal === "checkin" && (
        <CheckInModal parcels={parcels} onClose={() => setModal(null)} onSave={handleCheckInSave} />
      )}

      <Banner message={banner?.message} tone={banner?.tone} onClose={() => setBanner(null)} />
    </div>
  );
}
