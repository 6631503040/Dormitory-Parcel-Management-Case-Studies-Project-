import React, { useEffect, useRef, useState } from "react";
import { BellRing } from "lucide-react";
import { ModalShell, InlineError } from "./Modals";
import RoomCombobox from "./RoomCombobox";
import { C, bodyFont } from "./shared";
import { api, ApiError } from "../api/client";
import { errorMessage } from "../api/errorMessages";

// Refetch while open, so a code the Resident requests moments after Staff picked the room still
// shows up without reselecting it.
const POLL_MS = 5000;

function secondsLeft(expiresAt) {
  if (!expiresAt) return 0;
  return Math.max(0, Math.round((new Date(expiresAt).getTime() - Date.now()) / 1000));
}

function formatCountdown(sec) {
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
}

// Staff side of US-24 (Web Push registration): the Resident asked for a code on their phone at
// /resident/; Staff pick that room here and read the code out loud. The code never reaches the
// Resident's phone any other way — this in-person hand-off is the identity check. Staff can also
// stop every device of a room from getting notifications (move-out, or the Resident asks).
export default function ResidentOtpModal({ onClose }) {
  const [room, setRoom] = useState(null);
  const [otp, setOtp] = useState(null); // {code, expiresAt, roomNumber, buildingCode}
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [remaining, setRemaining] = useState(0);
  const [devices, setDevices] = useState(null);
  const [confirmRevoke, setConfirmRevoke] = useState(false);
  const [revokeMessage, setRevokeMessage] = useState(null);
  const pollRef = useRef(null);
  const tickRef = useRef(null);

  useEffect(() => {
    clearInterval(pollRef.current);
    setOtp(null);
    setError(null);
    setLoading(false);
    setDevices(null);
    setConfirmRevoke(false);
    setRevokeMessage(null);
    if (!room) return;

    let cancelled = false;
    const load = () => {
      setLoading(true);
      api
        .residentOtp(room.id)
        .then((res) => {
          if (cancelled) return;
          setOtp(res);
          setError(null);
        })
        .catch((err) => {
          if (cancelled) return;
          setOtp(null);
          if (err instanceof ApiError) setError(errorMessage(err));
        })
        .finally(() => !cancelled && setLoading(false));
      api
        .roomPushSubscriptions(room.id)
        .then((res) => !cancelled && setDevices(res.activeCount))
        .catch(() => {});
    };
    load();
    pollRef.current = setInterval(load, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(pollRef.current);
    };
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

  const revoke = async () => {
    try {
      const res = await api.revokeRoomPushSubscriptions(room.id);
      setDevices(0);
      setConfirmRevoke(false);
      setRevokeMessage(`ยกเลิกการแจ้งเตือนแล้ว ${res.revokedCount} เครื่อง`);
    } catch (err) {
      setRevokeMessage(errorMessage(err));
    }
  };

  const expired = otp != null && remaining <= 0;

  return (
    <ModalShell title="รหัสลงทะเบียนรับแจ้งเตือน" icon={BellRing} onClose={onClose}>
      <p className="text-xs mb-4" style={{ ...bodyFont, color: C.textMuted }}>
        ผู้พักขอรหัสจากหน้า "แจ้งเตือนพัสดุ" บนมือถือแล้ว ให้เลือกห้องของผู้พัก แล้วอ่านรหัสนี้ให้ฟังที่เคาน์เตอร์ — ห้ามส่งรหัสผ่านช่องทางอื่น
      </p>

      <RoomCombobox label="เลขห้อง" value={room} onChange={setRoom} autoFocus />

      {room && (
        <div className="mt-2">
          <InlineError message={error} />
          {loading && !otp && !error && (
            <p className="text-sm py-6 text-center" style={{ ...bodyFont, color: C.textMuted }}>กำลังโหลด…</p>
          )}
          {otp && (
            <div className="rounded-xl p-5 text-center" style={{ background: expired ? C.warningLight : C.primaryLight }}>
              <p className="text-xs font-medium mb-1" style={{ ...bodyFont, color: C.textMuted }}>{otp.buildingCode}{otp.roomNumber}</p>
              <p className="text-4xl font-bold tracking-[0.2em] mb-2" style={{ ...bodyFont, color: expired ? C.warning : C.primaryDark }}>{otp.code}</p>
              <p className="text-xs" style={{ ...bodyFont, color: expired ? C.warning : C.textMuted }}>
                {expired ? "รหัสหมดอายุแล้ว — ให้ผู้พักกดขอรหัสใหม่" : `หมดอายุใน ${formatCountdown(remaining)} นาที`}
              </p>
            </div>
          )}

          {devices != null && (
            <div className="mt-4 text-xs" style={{ ...bodyFont, color: C.textMuted }}>
              <p>อุปกรณ์ที่รับแจ้งเตือนของห้องนี้: {devices} เครื่อง</p>
              {devices > 0 && !confirmRevoke && (
                <button type="button" className="text-button" onClick={() => setConfirmRevoke(true)}>ยกเลิกการแจ้งเตือนทั้งหมดของห้องนี้</button>
              )}
              {confirmRevoke && (
                <div className="desk-actions mt-2 flex gap-2">
                  <button type="button" className="desk-button desk-button-primary" onClick={revoke}>ยืนยันยกเลิก {devices} เครื่อง</button>
                  <button type="button" className="desk-button" onClick={() => setConfirmRevoke(false)}>ไม่ใช่ตอนนี้</button>
                </div>
              )}
              {revokeMessage && <p role="status" className="mt-2">{revokeMessage}</p>}
            </div>
          )}
        </div>
      )}
    </ModalShell>
  );
}
