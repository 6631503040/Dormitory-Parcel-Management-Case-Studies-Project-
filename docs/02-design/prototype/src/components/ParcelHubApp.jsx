import React, { useEffect, useRef, useState } from "react";
import LoginPage from "./LoginPage";
import DashboardPage from "./DashboardPage";
import ArchivePage from "./ArchivePage";
import TopNav from "./TopNav";
import ParcelHistoryModal from "./ParcelHistoryModal";
import { Banner, C, bodyFont, useFonts } from "./shared";
import { CheckOutModal, CheckInModal } from "./Modals";
import LineOtpModal from "./LineOtpModal";
import { api, setUnauthenticatedHandler } from "../api/client";
import { errorMessage } from "../api/errorMessages";

export default function ParcelHubApp() {
  useFonts();
  const [staff, setStaff] = useState(null);
  const [booting, setBooting] = useState(true);
  const [page, setPage] = useState("dashboard");
  const [modal, setModal] = useState(null);
  const [historyCode, setHistoryCode] = useState(null);
  const [banner, setBanner] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const bannerTimer = useRef(null);

  // A 401 from anywhere (session expired, disabled account) drops straight back to the login
  // screen instead of every call site checking for it. The handler is only wired up *after* the
  // initial /auth/me check settles — that first call is expected to 401 for anyone who was never
  // logged in, and that is not a "your session expired" event worth a banner.
  useEffect(() => {
    let cancelled = false;
    api
      .me()
      .then((res) => {
        if (!cancelled) setStaff(res.staff);
      })
      .catch(() => {})
      .finally(() => {
        if (cancelled) return;
        setBooting(false);
        setUnauthenticatedHandler(() => {
          setStaff(null);
          showBanner(errorMessage({ code: "UNAUTHENTICATED" }), "error");
        });
      });
    return () => {
      cancelled = true;
      setUnauthenticatedHandler(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => () => clearTimeout(bannerTimer.current), []);

  const showBanner = (message, tone = "success") => {
    clearTimeout(bannerTimer.current);
    setBanner({ message, tone });
    bannerTimer.current = setTimeout(() => setBanner(null), 3200);
  };

  const refresh = () => setRefreshKey((k) => k + 1);

  const handleLogout = async () => {
    try {
      await api.logout();
    } catch {
      // logging out client-side regardless keeps the UI consistent even if the request failed
    }
    setStaff(null);
    setModal(null);
    setHistoryCode(null);
  };

  const handleCheckOutConfirm = (parcels) => {
    setModal(null);
    refresh();
    showBanner(parcels.length === 1 ? `นำพัสดุออกแล้ว 1 ชิ้น` : `นำพัสดุออกแล้ว ${parcels.length} ชิ้น`);
  };

  const closeCheckIn = () => {
    setModal(null);
    refresh();
  };

  if (booting) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: C.bg, ...bodyFont }}>
        <p style={{ color: C.textMuted }}>กำลังโหลด…</p>
      </div>
    );
  }

  // The Banner renders on both the login and the signed-in view — a session-expired message
  // (which lands right as `staff` flips to null) must still reach the screen it drops back to.
  if (!staff) {
    return (
      <>
        <LoginPage onLogin={setStaff} />
        <Banner message={banner?.message} tone={banner?.tone} onClose={() => setBanner(null)} />
      </>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: C.bg, ...bodyFont }}>
      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fade { animation: fadeIn 0.2s ease-out; }
        @media (prefers-reduced-motion: reduce) { .animate-fade { animation: none; } }
      `}</style>

      <TopNav page={page} setPage={setPage} onLogout={handleLogout} onOpenLineOtp={() => setModal("lineOtp")} staff={staff} />

      <main className="max-w-6xl mx-auto px-5 md:px-8 py-6 md:py-8">
        {page === "dashboard" ? (
          <DashboardPage
            refreshKey={refreshKey}
            onDataChanged={refresh}
            onOpenCheckOut={() => setModal("checkout")}
            onOpenCheckIn={() => setModal("checkin")}
            onOpenHistory={(p) => setHistoryCode(p.trackingCode)}
          />
        ) : (
          <ArchivePage key={refreshKey} onOpenHistory={(p) => setHistoryCode(p.trackingCode)} />
        )}
      </main>

      {modal === "checkout" && <CheckOutModal onClose={() => setModal(null)} onConfirm={handleCheckOutConfirm} />}
      {modal === "checkin" && <CheckInModal onClose={closeCheckIn} />}
      {modal === "lineOtp" && <LineOtpModal onClose={() => setModal(null)} />}
      {historyCode && <ParcelHistoryModal trackingCode={historyCode} onClose={() => setHistoryCode(null)} />}

      <Banner message={banner?.message} tone={banner?.tone} onClose={() => setBanner(null)} />
    </div>
  );
}
