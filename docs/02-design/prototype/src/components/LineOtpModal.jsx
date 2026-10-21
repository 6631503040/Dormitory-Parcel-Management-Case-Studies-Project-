import React, { useEffect, useRef, useState } from "react";
import { KeyRound } from "lucide-react";
import { ModalShell, InlineError } from "./Modals";
import RoomCombobox from "./RoomCombobox";
import { C, bodyFont } from "./shared";
import { api, ApiError } from "../api/client";
import { errorMessage } from "../api/errorMessages";

// Refetch while the modal is open so a code the resident requests moments after staff opened this
// stays visible without staff having to reselect the room.
const POLL_MS = 10000;

function secondsLeft(expiresAt) {
  if (!expiresAt) return 0;
  return Math.max(0, Math.round((new Date(expiresAt).getTime() - Date.now()) / 1000));
}

function formatCountdown(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

// Staff-facing lookup for US-11 step 3: find the room a resident claimed over LINE, read the code
// out to them in person. The code is never sent over LINE itself — only shown here, to a signed-in
// Staff member.
export default function LineOtpModal({ onClose }) {
  const [room, setRoom] = useState(null);
  const [otp, setOtp] = useState(null); // {code, expiresAt, roomNumber, buildingCode}
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [remaining, setRemaining] = useState(0);
  const pollRef = useRef(null);
  const tickRef = useRef(null);

  useEffect(() => {
    clearInterval(pollRef.current);
    setOtp(null);
    setError(null);
    setLoading(false);
    if (!room) return;

    const load = () => {
      setLoading(true);
      api
        .lineOtp(room.id)
        .then((res) => {
          setOtp(res);
          setError(null);
          setLoading(false);
        })
        .catch((err) => {
          setLoading(false);
          setOtp(null);
          if (err instanceof ApiError) setError(errorMessage(err));
        });
    };
    load();
    pollRef.current = setInterval(load, POLL_MS);
    return () => clearInterval(pollRef.current);
  }, [room]);

  useEffect(() => {
    clearInterval(tickRef.current);
    if (!otp) {
      setRemaining(0);
      return;
    }
    setRemaining(secondsLeft(otp.expiresAt));
    tickRef.current = setInterval(() => setRemaining(secondsLeft(otp.expiresAt)), 1000);
    return () => clearInterval(tickRef.current);
  }, [otp]);

  const expired = otp != null && remaining <= 0;

  return (
    <ModalShell title="รหัสยืนยัน LINE" icon={KeyRound} onClose={onClose}>
      <p className="text-xs mb-4" style={{ ...bodyFont, color: C.textMuted }}>
        ค้นหาห้องที่ผู้พักแจ้งขอยืนยันตัวตนผ่าน LINE ที่เคาน์เตอร์ แล้วอ่านรหัสนี้ให้ผู้พักฟังโดยตรง — ห้ามส่งรหัสนี้ผ่าน LINE เด็ดขาด
      </p>

      <RoomCombobox label="เลขห้อง" value={room} onChange={setRoom} autoFocus />

      {room && (
        <div className="mt-2">
          <InlineError message={error} />
          {loading && !otp && (
            <p className="text-sm py-6 text-center" style={{ ...bodyFont, color: C.textMuted }}>กำลังโหลด…</p>
          )}
          {otp && (
            <div className="rounded-xl p-5 text-center" style={{ background: expired ? C.warningLight : C.primaryLight }}>
              <p className="text-xs font-medium mb-1" style={{ ...bodyFont, color: C.textMuted }}>{otp.buildingCode}{otp.roomNumber}</p>
              <p className="text-4xl font-bold tracking-[0.2em] mb-2" style={{ ...bodyFont, color: expired ? C.warning : C.primaryDark }}>{otp.code}</p>
              <p className="text-xs" style={{ ...bodyFont, color: expired ? C.warning : C.textMuted }}>
                {expired ? "รหัสหมดอายุแล้ว — รอผู้พักขอรหัสใหม่" : `หมดอายุใน ${formatCountdown(remaining)} นาที`}
              </p>
            </div>
          )}
        </div>
      )}
    </ModalShell>
  );
}
