import React, { useCallback, useEffect, useState } from "react";
import { Package, BellRing, BellOff, RefreshCw, Share, Info, CheckCircle2 } from "lucide-react";
import { residentApi, ApiError } from "../api/client";
import { errorMessage } from "../api/errorMessages";
import { formatThaiDateTime, useFonts } from "../components/shared";
import { CONSENT_POINTS, CONSENT_VERSION } from "./consent";
import {
  PushPermissionError,
  currentSubscription,
  pushSupport,
  shareTokenWithWorker,
  subscribe,
  unsubscribeBrowser,
} from "./pushSupport";

// Resident PWA (US-23/24/25). Three screens:
//   claim  -> type Room Number, accept consent, ask for a code (the code is NOT sent here)
//   verify -> Staff read the code out at the desk; type it, allow notifications
//   status -> registered: this room's Pending Parcels, turn notifications off
const TOKEN_KEY = "dpms.residentDeviceToken";

function loadToken() {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

function saveToken(token) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // private mode etc.: registration still works for this visit
  }
  shareTokenWithWorker(token);
}

function secondsLeft(expiresAt) {
  return Math.max(0, Math.round((new Date(expiresAt).getTime() - Date.now()) / 1000));
}

function Steps({ current }) {
  const steps = ["ขอรหัสยืนยัน", "รับรหัสจากเจ้าหน้าที่ที่เคาน์เตอร์", "เปิดรับการแจ้งเตือน"];
  return (
    <ol className="resident-steps">
      {steps.map((label, i) => (
        <li key={label} aria-current={i === current ? "step" : undefined}>
          <b>{i + 1}</b>
          <span>{label}</span>
        </li>
      ))}
    </ol>
  );
}

function Unsupported({ reason }) {
  if (reason === "ios_install") {
    return (
      <section className="resident-card">
        <h1>เพิ่มไว้ที่หน้าจอโฮมก่อน</h1>
        <p className="resident-muted">iPhone และ iPad รับการแจ้งเตือนจากเว็บได้เมื่อเพิ่มหน้านี้ไว้ที่หน้าจอโฮมแล้วเท่านั้น (iOS 16.4 ขึ้นไป)</p>
        <ol className="resident-steps">
          <li><b>1</b><span>เปิดหน้านี้ใน Safari แล้วแตะปุ่มแชร์ <Share size={14} aria-label="แชร์" /></span></li>
          <li><b>2</b><span>เลือก "เพิ่มไปยังหน้าจอโฮม"</span></li>
          <li><b>3</b><span>เปิด "แจ้งเตือนพัสดุ" จากไอคอนบนหน้าจอโฮม แล้วลงทะเบียนอีกครั้ง</span></li>
        </ol>
      </section>
    );
  }
  return (
    <section className="resident-card">
      <h1>เบราว์เซอร์นี้รับการแจ้งเตือนไม่ได้</h1>
      <p className="resident-muted">
        {reason === "insecure"
          ? "หน้านี้ต้องเปิดผ่าน HTTPS จึงจะรับการแจ้งเตือนได้ กรุณาแจ้งเจ้าหน้าที่"
          : "กรุณาเปิดหน้านี้ด้วย Chrome, Edge, Firefox หรือ Safari เวอร์ชันล่าสุด"}
      </p>
    </section>
  );
}

function ClaimStep({ onClaimed }) {
  const [room, setRoom] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (event) => {
    event.preventDefault();
    if (!room.trim()) {
      setError("กรุณากรอกเลขห้อง");
      return;
    }
    if (!agreed) {
      setError("กรุณายอมรับเงื่อนไขก่อนขอรหัส");
      return;
    }
    setBusy(true);
    setError("");
    try {
      onClaimed(await residentApi.claimRoom(room.trim(), CONSENT_VERSION));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="resident-card" aria-labelledby="claim-heading">
      <h1 id="claim-heading">รับแจ้งเตือนเมื่อพัสดุมาถึง</h1>
      <p className="resident-muted">ลงทะเบียนครั้งเดียว แล้วโทรศัพท์จะเด้งแจ้งเตือนทุกครั้งที่เจ้าหน้าที่รับพัสดุของห้องคุณเข้าระบบ</p>
      <Steps current={0} />
      <form onSubmit={submit} className="mt-5">
        <div className="form-field">
          <label htmlFor="room">เลขห้อง (อาคาร+ห้อง)</label>
          <input id="room" inputMode="numeric" autoComplete="off" placeholder="เช่น 3101" value={room} disabled={busy}
            onChange={(e) => { setRoom(e.target.value); setError(""); }} />
        </div>
        <div className="resident-consent">
          <ul>{CONSENT_POINTS.map((p) => <li key={p}>{p}</li>)}</ul>
          <label className="resident-check">
            <input type="checkbox" checked={agreed} disabled={busy} onChange={(e) => { setAgreed(e.target.checked); setError(""); }} />
            <span>ฉันยอมรับเงื่อนไขข้างต้น</span>
          </label>
        </div>
        {error && <p className="field-error mb-3" role="alert">{error}</p>}
        <button type="submit" disabled={busy} className="desk-button desk-button-primary resident-block">
          {busy ? "กำลังขอรหัส…" : "ขอรหัสยืนยัน"}
        </button>
      </form>
    </section>
  );
}

function VerifyStep({ claim, vapidPublicKey, onRegistered, onRestart }) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [remaining, setRemaining] = useState(() => secondsLeft(claim.expiresAt));

  useEffect(() => {
    const t = setInterval(() => setRemaining(secondsLeft(claim.expiresAt)), 1000);
    return () => clearInterval(t);
  }, [claim.expiresAt]);

  const submit = async (event) => {
    event.preventDefault();
    if (!/^\d{6}$/.test(code)) {
      setError("กรุณากรอกรหัส 6 หลัก");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const subscription = await subscribe(vapidPublicKey); // permission prompt happens here
      onRegistered(await residentApi.verify(claim.claimToken, code, subscription));
    } catch (err) {
      if (err instanceof PushPermissionError) {
        setError(err.state === "denied"
          ? "เบราว์เซอร์บล็อกการแจ้งเตือนของเว็บนี้ไว้ กรุณาเปิดการแจ้งเตือนในการตั้งค่าเบราว์เซอร์ แล้วลองอีกครั้ง"
          : "ต้องกด \"อนุญาต\" การแจ้งเตือน จึงจะลงทะเบียนได้");
      } else if (err instanceof ApiError) {
        setError(errorMessage(err));
      } else {
        setError("เปิดการแจ้งเตือนบนอุปกรณ์นี้ไม่สำเร็จ กรุณาลองใหม่");
      }
    } finally {
      setBusy(false);
    }
  };

  const expired = remaining <= 0;
  return (
    <section className="resident-card" aria-labelledby="verify-heading">
      <h1 id="verify-heading">ไปรับรหัสที่เคาน์เตอร์</h1>
      <p className="resident-muted">แจ้งเจ้าหน้าที่ว่าขอรหัสลงทะเบียนแจ้งเตือนของห้อง</p>
      <p className="resident-room">{claim.buildingCode}{claim.roomNumber}</p>
      <p className="resident-muted">เจ้าหน้าที่จะอ่านรหัส 6 หลักให้ฟัง แล้วกรอกรหัสด้านล่าง</p>
      <Steps current={expired ? 0 : 1} />
      <form onSubmit={submit} className="mt-5">
        <div className="form-field resident-code">
          <label htmlFor="code">รหัส 6 หลักจากเจ้าหน้าที่</label>
          <input id="code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} disabled={busy || expired}
            onChange={(e) => { setCode(e.target.value.replace(/\D/g, "")); setError(""); }} />
        </div>
        <p className="resident-muted mb-3" role="status">
          {expired ? "รหัสหมดอายุแล้ว กรุณาขอรหัสใหม่" : `รหัสหมดอายุใน ${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, "0")} นาที`}
        </p>
        {error && <p className="field-error mb-3" role="alert">{error}</p>}
        <button type="submit" disabled={busy || expired} className="desk-button desk-button-primary resident-block">
          <BellRing size={18} aria-hidden="true" />
          {busy ? "กำลังลงทะเบียน…" : "ยืนยันและเปิดการแจ้งเตือน"}
        </button>
      </form>
      <button type="button" className="resident-link mt-2" onClick={onRestart}>ขอรหัสใหม่ / เปลี่ยนเลขห้อง</button>
    </section>
  );
}

function StatusView({ status, onRefresh, refreshing, onTurnOff }) {
  const [confirm, setConfirm] = useState(false);
  const { device, pendingCount, pending } = status;
  return (
    <>
      <section className="resident-card" aria-labelledby="status-heading">
        <div className="resident-row">
          <h1 id="status-heading" className="resident-room">{device.buildingCode}{device.roomNumber}</h1>
          <span className="resident-badge"><CheckCircle2 size={14} aria-hidden="true" />รับแจ้งเตือนอยู่</span>
        </div>
        <div className="resident-count">
          <strong>{pendingCount}</strong>
          <span className="resident-muted">ชิ้น รอรับที่เคาน์เตอร์</span>
        </div>
        {pending.length > 0 ? (
          <ul className="resident-list" aria-label="พัสดุที่รอรับ">
            {pending.map((p) => (
              <li key={p.trackingCode}>
                <code>{p.trackingCode}</code>
                <span className="resident-muted">{formatThaiDateTime(p.checkedInAt)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="resident-muted">ยังไม่มีพัสดุรอรับ — ถ้าแอปขนส่งแจ้งว่าส่งแล้ว อาจเป็นช่วงที่เจ้าหน้าที่ยังไม่ได้บันทึกเข้าระบบ</p>
        )}
        <button type="button" className="desk-button resident-secondary resident-block mt-4" onClick={onRefresh} disabled={refreshing}>
          <RefreshCw size={16} aria-hidden="true" />{refreshing ? "กำลังโหลด…" : "รีเฟรช"}
        </button>
      </section>

      <section className="resident-card">
        <p className="resident-muted">การลงทะเบียนนี้ใช้ได้ถึง {formatThaiDateTime(device.expiresAt)}</p>
        {!confirm ? (
          <button type="button" className="resident-danger" onClick={() => setConfirm(true)}>
            <BellOff size={14} aria-hidden="true" style={{ display: "inline", marginRight: 6 }} />ปิดการแจ้งเตือนบนอุปกรณ์นี้
          </button>
        ) : (
          <div className="desk-actions mt-3">
            <button type="button" className="desk-button desk-button-primary" onClick={onTurnOff}>ยืนยันปิดการแจ้งเตือน</button>
            <button type="button" className="desk-button" onClick={() => setConfirm(false)}>ยกเลิก</button>
          </div>
        )}
      </section>
    </>
  );
}

export default function ResidentApp() {
  useFonts();
  const [support] = useState(() => pushSupport());
  const [token, setToken] = useState(() => loadToken());
  const [config, setConfig] = useState(null);
  const [claim, setClaim] = useState(null);
  const [status, setStatus] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [fatal, setFatal] = useState("");

  const forget = useCallback(() => {
    saveToken(null);
    setToken(null);
    setStatus(null);
  }, []);

  const loadStatus = useCallback(async (t) => {
    setRefreshing(true);
    try {
      setStatus(await residentApi.status(t));
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) forget(); // revoked, expired or replaced
      else setFatal(errorMessage(err));
    } finally {
      setRefreshing(false);
    }
  }, [forget]);

  useEffect(() => {
    if (support !== "ok") return;
    residentApi.pushConfig().then(setConfig).catch((err) => setFatal(errorMessage(err)));
  }, [support]);

  // Registered: show the room's status, and re-send this browser's current subscription in case
  // the browser rotated it since last time.
  useEffect(() => {
    if (!token) return;
    loadStatus(token);
    shareTokenWithWorker(token);
    currentSubscription()
      .then((sub) => sub && residentApi.updateSubscription(token, sub))
      .catch(() => {});
  }, [token, loadStatus]);

  const turnOff = async () => {
    try {
      await residentApi.unsubscribe(token);
    } catch (err) {
      if (!(err instanceof ApiError && err.status === 401)) {
        setFatal(errorMessage(err));
        return;
      }
    }
    await unsubscribeBrowser().catch(() => {});
    forget();
  };

  let body;
  if (support !== "ok") body = <Unsupported reason={support} />;
  else if (token && status) body = <StatusView status={status} refreshing={refreshing} onRefresh={() => loadStatus(token)} onTurnOff={turnOff} />;
  else if (token) body = <p className="resident-muted">กำลังโหลด…</p>;
  else if (!config) body = fatal ? null : <p className="resident-muted">กำลังโหลด…</p>;
  else if (claim)
    body = (
      <VerifyStep
        claim={claim}
        vapidPublicKey={config.vapidPublicKey}
        onRestart={() => setClaim(null)}
        onRegistered={(reg) => {
          saveToken(reg.deviceToken);
          setClaim(null);
          setToken(reg.deviceToken);
        }}
      />
    );
  else body = <ClaimStep onClaimed={setClaim} />;

  return (
    <main className="resident-page">
      <div className="resident-shell">
        <div className="resident-brand"><Package size={24} aria-hidden="true" /><span>ParcelHub · แจ้งเตือนพัสดุ</span></div>
        {fatal && (
          <div className="resident-notice resident-notice-warning" role="alert"><Info size={16} aria-hidden="true" /><span>{fatal}</span></div>
        )}
        {body}
      </div>
    </main>
  );
}
