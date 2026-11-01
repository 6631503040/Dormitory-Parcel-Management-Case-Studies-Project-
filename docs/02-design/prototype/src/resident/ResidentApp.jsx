import React, { useCallback, useEffect, useRef, useState } from "react";
import { Package, BellRing, BellOff, RefreshCw, Share, CheckCircle2, AlertTriangle, Check, Clock, Copy, X } from "lucide-react";
import { residentApi, ApiError } from "../api/client";
import { errorMessage } from "../api/errorMessages";
import { formatThaiDateTime, useFonts } from "../components/shared";
import { CONSENT_POINTS, CONSENT_VERSION } from "./consent";
import {
  PushPermissionError,
  currentSubscription,
  isIOS,
  isStandalone,
  notificationPermission,
  pushSupport,
  shareTokenWithWorker,
  showTestNotification,
  subscribe,
  unsubscribeBrowser,
} from "./pushSupport";

// Resident PWA (US-23/24/25). Three screens:
//   claim  -> type Room Number, accept consent, ask for a code (the code is NOT sent here)
//   verify -> Staff read the code out at the desk; type it, allow notifications
//   status -> registered: this room's Pending Parcels, turn notifications off
// The status view keeps itself current while it is open: it reloads when a push arrives (the
// service worker posts "parcel_arrived"), when the page comes back to the foreground, and every
// STATUS_POLL_MS while visible — the last one also catches Check-Out, which sends no push.
// Visual system: the Staff desk's (DESIGN.md), phone-first; one emphasised line per screen says what to do now.
const TOKEN_KEY = "dpms.residentDeviceToken";
// The last status this device loaded, shown (marked with its time) when a reload fails.
const STATUS_CACHE_KEY = "dpms.residentLastStatus";
// The pending claim survives a reload or a mobile tab discard while the Resident queues at the desk.
const CLAIM_KEY = "dpms.residentClaim";
const CLAIM_STALE_MS = 15 * 60_000; // forget a claim this long after its code expired
const STATUS_POLL_MS = 30_000;

const NOTICE_EXPIRED = "การลงทะเบียนบนอุปกรณ์นี้หมดอายุหรือถูกยกเลิกแล้ว ลงทะเบียนใหม่ได้ด้านล่าง";
const NOTICE_UNREGISTERED = "ยกเลิกการลงทะเบียนอุปกรณ์นี้แล้ว อุปกรณ์นี้จะไม่ได้รับแจ้งเตือนอีก ถ้าต้องการใช้อีกครั้ง ลงทะเบียนใหม่ได้ด้านล่าง";

function readJSON(storage, key) {
  try {
    return JSON.parse(storage.getItem(key));
  } catch {
    return null;
  }
}

function writeJSON(storage, key, value) {
  try {
    if (value) storage.setItem(key, JSON.stringify(value));
    else storage.removeItem(key);
  } catch {
    // private mode etc.: the value lives for this page only
  }
}

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

function loadCachedStatus() {
  const cached = readJSON(localStorage, STATUS_CACHE_KEY);
  return cached && cached.token === loadToken() ? cached : null;
}

function loadClaim() {
  const claim = readJSON(sessionStorage, CLAIM_KEY);
  return claim && Date.now() - new Date(claim.expiresAt).getTime() < CLAIM_STALE_MS ? claim : null;
}

function secondsLeft(expiresAt) {
  return Math.max(0, Math.round((new Date(expiresAt).getTime() - Date.now()) / 1000));
}

// Whole calendar days a parcel has waited, on the same local clock formatThaiDateTime shows.
function daysWaiting(iso) {
  const day = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  return Math.max(0, Math.round((day(new Date()) - day(new Date(iso))) / 86_400_000));
}

const THAI_DATE = new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "short", year: "numeric" });
const formatThaiDate = (iso) => THAI_DATE.format(new Date(iso));

// The two-tap path to re-allow notifications, for the platform the Resident is holding.
function blockedHowto() {
  if (isIOS()) return "เปิดแอปการตั้งค่า › การแจ้งเตือน › แจ้งเตือนพัสดุ แล้วเปิด \"อนุญาตการแจ้งเตือน\" จากนั้นกลับมาที่หน้านี้";
  const android = /Android/i.test(navigator.userAgent || "");
  if (android && isStandalone()) return "กดค้างที่ไอคอน \"แจ้งเตือนพัสดุ\" › ข้อมูลแอป › การแจ้งเตือน › เปิด จากนั้นกลับมาที่หน้านี้";
  if (android) return "แตะไอคอนทางซ้ายของแถบที่อยู่ › สิทธิ์ › การแจ้งเตือน › อนุญาต จากนั้นกลับมาที่หน้านี้";
  return "คลิกไอคอนทางซ้ายของแถบที่อยู่ › การแจ้งเตือน › อนุญาต จากนั้นกลับมาที่หน้านี้";
}

// errorMessages.js speaks to Staff; a few codes need the Resident's version.
function residentError(err, room) {
  if (err?.code === "ROOM_NOT_IN_DIRECTORY") {
    return `ไม่พบห้อง${room ? ` ${room}` : "นี้"} ในทะเบียนผู้พัก ตรวจเลขอาคารตามด้วยเลขห้องอีกครั้ง (เช่น 3101)`;
  }
  if (err?.code === "UNAUTHENTICATED") return "คำขอนี้หมดอายุแล้ว กรุณาขอรหัสใหม่";
  return errorMessage(err);
}

// "on" | "blocked" | "off", plus the live subscription when there is one.
async function readNotifyState() {
  const permission = notificationPermission();
  if (permission === "denied") return { state: "blocked", sub: null };
  if (permission !== "granted") return { state: "off", sub: null };
  try {
    const sub = await currentSubscription();
    return { state: sub ? "on" : "off", sub };
  } catch {
    return { state: "off", sub: null };
  }
}

// The browser's notification permission, re-read when the page returns from Settings, when the
// Permissions API reports a change, and on demand (the "ตรวจอีกครั้ง" action).
function useNotificationPermission() {
  const [permission, setPermission] = useState(() => notificationPermission());
  const recheck = useCallback(() => setPermission(notificationPermission()), []);
  useEffect(() => {
    let status;
    document.addEventListener("visibilitychange", recheck);
    navigator.permissions?.query({ name: "notifications" })
      .then((s) => { status = s; s.addEventListener("change", recheck); })
      .catch(() => {});
    return () => {
      document.removeEventListener("visibilitychange", recheck);
      status?.removeEventListener("change", recheck);
    };
  }, [recheck]);
  return [permission, recheck];
}

// The one thing to do now on each screen, set in the desk's primary blue (success green for "done").
function Emph({ children, tone = "now" }) {
  return <strong className={`resident-emph resident-emph-${tone}`}>{children}</strong>;
}

function Steps({ current }) {
  const steps = ["ขอรหัส", "รับรหัสที่เคาน์เตอร์", "เปิดแจ้งเตือน"];
  return (
    <ol className="resident-steps" aria-label="ขั้นตอนการลงทะเบียน">
      {steps.map((label, i) => {
        const state = i < current ? "done" : i === current ? "current" : "todo";
        return (
          <li key={label} data-state={state} aria-current={state === "current" ? "step" : undefined}>
            {state === "done" && <Check size={14} strokeWidth={3} aria-hidden="true" />}
            {label}
            {state === "done" && <span className="sr-only"> (เสร็จแล้ว)</span>}
          </li>
        );
      })}
    </ol>
  );
}

function CopyLink() {
  const [copied, setCopied] = useState(false);
  const url = window.location.href.split("?")[0];
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };
  return (
    <div className="resident-copy">
      <code>{url}</code>
      <button type="button" className="desk-button resident-secondary" onClick={copy}>
        <Copy size={16} aria-hidden="true" />{copied ? "คัดลอกแล้ว" : "คัดลอกลิงก์"}
      </button>
    </div>
  );
}

function Unsupported({ reason }) {
  if (reason === "ios_install") {
    return (
      <section className="resident-card">
        <h1>กรุณาเพิ่มหน้านี้ไว้ที่หน้าจอโฮม</h1>
        <p className="resident-lead">iPhone และ iPad รับการแจ้งเตือนจากเว็บได้เมื่อเพิ่มหน้านี้ไว้ที่หน้าจอโฮมแล้วเท่านั้น (iOS 16.4 ขึ้นไป)</p>
        <ol className="resident-howto">
          <li><Emph>เปิดหน้านี้ใน Safari</Emph> แล้วแตะปุ่มแชร์&nbsp;<Share size={16} role="img" aria-label="แชร์" className="resident-inline-icon" /></li>
          <li>เลือก "เพิ่มไปยังหน้าจอโฮม"</li>
          <li>เปิด "แจ้งเตือนพัสดุ" จากไอคอนบนหน้าจอโฮม แล้วลงทะเบียน</li>
        </ol>
        <p className="resident-hint">ถ้าเปิดอยู่ใน Chrome หรือแอปอื่น คัดลอกลิงก์ไปวางใน Safari</p>
        <CopyLink />
      </section>
    );
  }
  const inLine = /\bLine\//.test(navigator.userAgent || "");
  return (
    <section className="resident-card">
      <h1>{reason === "insecure" ? "หน้านี้ต้องเปิดผ่าน HTTPS" : "กรุณาเปิดหน้านี้ในเบราว์เซอร์"}</h1>
      <p className="resident-lead">
        {reason === "insecure"
          ? "เปิดผ่าน HTTPS เท่านั้นจึงจะรับการแจ้งเตือนได้ กรุณาแจ้งเจ้าหน้าที่"
          : inLine
            ? "หน้านี้เปิดอยู่ในแอป LINE ซึ่งรับการแจ้งเตือนจากเว็บไม่ได้ แตะเมนูมุมขวาบนแล้วเลือก \"เปิดในเบราว์เซอร์\""
            : "เบราว์เซอร์นี้รับการแจ้งเตือนจากเว็บไม่ได้ ถ้าเปิดลิงก์จาก LINE หรือ Facebook ให้แตะเมนูมุมขวาบนแล้วเลือก \"เปิดในเบราว์เซอร์\" หรือคัดลอกลิงก์ไปเปิดใน Chrome หรือ Safari"}
      </p>
      {reason !== "insecure" && <CopyLink />}
    </section>
  );
}

function BlockedNotice({ onRecheck, lead }) {
  return (
    <div className="resident-notice resident-notice-stack" role="alert">
      <span className="resident-notice-body"><b>{lead}</b> <Emph>{blockedHowto()}</Emph></span>
      <button type="button" className="desk-button resident-secondary" onClick={onRecheck}>
        <RefreshCw size={16} aria-hidden="true" />ตรวจอีกครั้ง
      </button>
    </div>
  );
}

function ClaimStep({ initialRoom, initialAgreed, onClaimed }) {
  const [permission, recheckPermission] = useNotificationPermission();
  const [room, setRoom] = useState(initialRoom);
  const [agreed, setAgreed] = useState(initialAgreed);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null); // { field: "room" | "consent", message }
  const roomRef = useRef(null);
  const consentRef = useRef(null);
  const blocked = permission === "denied";

  // After render, so a field that was disabled while busy can take focus.
  useEffect(() => {
    if (error) (error.field === "consent" ? consentRef : roomRef).current?.focus();
  }, [error]);

  const submit = async (event) => {
    event.preventDefault();
    const typed = room.trim();
    if (!typed) return setError({ field: "room", message: "กรุณากรอกเลขห้อง" });
    if (!agreed) return setError({ field: "consent", message: "กรุณายอมรับเงื่อนไขก่อนขอรหัส" });
    setBusy(true);
    setError(null);
    try {
      const claim = await residentApi.claimRoom(typed, CONSENT_VERSION);
      onClaimed({ ...claim, roomInput: typed });
    } catch (err) {
      setBusy(false);
      setError({ field: "room", message: residentError(err, typed) });
    }
  };

  const roomError = error?.field === "room" ? error.message : "";
  const consentError = error?.field === "consent" ? error.message : "";
  return (
    <section className="resident-card" aria-labelledby="claim-heading">
      <Steps current={0} />
      <h1 id="claim-heading">ลงทะเบียนรับการแจ้งเตือนพัสดุ</h1>
      <p className="resident-lead">รับการแจ้งเตือนทุกครั้งที่มีพัสดุของห้องคุณ</p>
      {blocked ? (
        <BlockedNotice lead="เบราว์เซอร์นี้บล็อกการแจ้งเตือนของเว็บนี้อยู่ จึงยังลงทะเบียนไม่ได้" onRecheck={recheckPermission} />
      ) : (
        <form onSubmit={submit} noValidate>
          <div className="form-field resident-field">
            <label htmlFor="room">เลขห้อง (อาคาร+ห้อง)</label>
            <input id="room" ref={roomRef} className="resident-room-input" inputMode="numeric" autoComplete="off" placeholder="เช่น 3101" value={room} disabled={busy}
              aria-invalid={roomError ? "true" : undefined} aria-describedby={roomError ? "room-hint room-error" : "room-hint"}
              onChange={(e) => { setRoom(e.target.value); setError(null); }} />
            <p id="room-hint" className="resident-hint">เลขอาคารตามด้วยเลขห้อง</p>
            {roomError && <p id="room-error" className="resident-error" role="alert">{roomError}</p>}
          </div>
          <div className="resident-consent">
            <h2>ข้อมูลที่ระบบเก็บ</h2>
            <ul>{CONSENT_POINTS.map((p) => <li key={p}>{p}</li>)}</ul>
            <label className="resident-check">
              <input type="checkbox" ref={consentRef} checked={agreed} disabled={busy}
                aria-invalid={consentError ? "true" : undefined} aria-describedby={consentError ? "consent-error" : undefined}
                onChange={(e) => { setAgreed(e.target.checked); setError(null); }} />
              <span>ฉันยอมรับเงื่อนไขข้างต้น</span>
            </label>
            {consentError && <p id="consent-error" className="resident-error" role="alert">{consentError}</p>}
          </div>
          <p className="resident-timing"><Clock size={18} aria-hidden="true" /><span><Emph>กรุณากดเมื่ออยู่ที่เคาน์เตอร์</Emph> รหัสมีอายุจำกัด</span></p>
          <div className="resident-dock">
            <button type="submit" disabled={busy} className="desk-button desk-button-primary resident-block">
              {busy ? "กำลังขอรหัส…" : "ขอรหัสยืนยัน"}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}

// Six boxes split 3+3 over one real input, so autofill, paste and screen readers see a plain
// text field while the eye sees the digits as they were read out.
function CodeBoxes({ value, inputRef, disabled, invalid, describedBy, onChange }) {
  return (
    <div className={`resident-codebox${invalid ? " is-invalid" : ""}`}>
      <input id="code" ref={inputRef} inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={value} disabled={disabled}
        aria-invalid={invalid ? "true" : undefined} aria-describedby={describedBy}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, ""))} />
      <div className="resident-codebox-cells" aria-hidden="true">
        {Array.from({ length: 6 }, (_, i) => (
          <span key={i} data-next={i === value.length || undefined} data-filled={i < value.length || undefined}>{value[i] || ""}</span>
        ))}
      </div>
    </div>
  );
}

function VerifyStep({ claim, vapidPublicKey, onRegistered, onReclaimed, onChangeRoom }) {
  const [permission] = useNotificationPermission();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null); // { field: "code" | "form", message }
  const [burned, setBurned] = useState(""); // the server ended this code early: "locked" | "expired"
  const [remaining, setRemaining] = useState(() => secondsLeft(claim.expiresAt));
  const codeRef = useRef(null);
  const room = `${claim.buildingCode}${claim.roomNumber}`;

  useEffect(() => {
    const t = setInterval(() => setRemaining(secondsLeft(claim.expiresAt)), 1000);
    return () => clearInterval(t);
  }, [claim.expiresAt]);

  useEffect(() => {
    if (error?.field === "code") codeRef.current?.focus();
  }, [error]);

  const submit = async (event) => {
    event.preventDefault();
    if (!/^\d{6}$/.test(code)) return setError({ field: "code", message: "กรุณากรอกรหัส 6 หลัก" });
    setBusy(true);
    setError(null);
    try {
      const subscription = await subscribe(vapidPublicKey); // permission prompt happens here
      onRegistered(await residentApi.verify(claim.claimToken, code, subscription));
    } catch (err) {
      setBusy(false);
      if (err instanceof PushPermissionError) {
        setError({ field: "form", message: err.state === "denied"
          ? `เบราว์เซอร์บล็อกการแจ้งเตือนของเว็บนี้ไว้ ${blockedHowto()} แล้วกดยืนยันอีกครั้ง`
          : "ต้องกด \"อนุญาต\" การแจ้งเตือน จึงจะลงทะเบียนได้ ลองกดยืนยันอีกครั้ง" });
      } else if (err instanceof ApiError && err.code === "OTP_EXPIRED") {
        setBurned(err.params?.reason === "locked" ? "locked" : "expired"); // this code can never pass now
      } else if (err instanceof ApiError && err.code === "OTP_INVALID") {
        setError({ field: "code", message: residentError(err) });
      } else if (err instanceof ApiError) {
        setError({ field: "form", message: residentError(err) });
      } else {
        setError({ field: "form", message: "เปิดการแจ้งเตือนบนอุปกรณ์นี้ไม่สำเร็จ กรุณาลองใหม่" });
      }
    }
  };

  // Same room, same consent: one tap for a fresh code instead of starting over.
  const reclaim = async () => {
    const typed = claim.roomInput || room;
    setBusy(true);
    setError(null);
    try {
      onReclaimed({ ...(await residentApi.claimRoom(typed, CONSENT_VERSION)), roomInput: typed });
    } catch (err) {
      setBusy(false);
      setError({ field: "form", message: residentError(err, typed) });
    }
  };

  const ended = burned || (remaining <= 0 ? "expired" : "");
  const codeError = error?.field === "code" ? error.message : "";
  const formError = error?.field === "form" ? error.message : "";
  // The highlighter moves to whatever is next: say the line, type (or fix) the code, then allow.
  const now = codeError ? "fix" : code.length === 0 ? "say" : code.length < 6 ? "code" : "allow";
  // Screen readers hear the clock only at the last minute and at expiry, not every second.
  const announcement = ended ? "รหัสใช้ไม่ได้แล้ว" : remaining <= 60 ? "เหลือเวลาไม่ถึง 1 นาที" : "";

  if (ended) {
    return (
      <section className="resident-card" aria-labelledby="verify-heading">
        <Steps current={1} />
        <h1 id="verify-heading">{ended === "locked" ? "ใส่รหัสผิดหลายครั้งเกินไป" : "รหัสหมดอายุแล้ว"}</h1>
        <p className="resident-lead">กรุณาขอรหัสใหม่และแจ้งเจ้าหน้าที่อีกครั้ง</p>
        <div className="resident-room-box"><span className="resident-room-label">ห้อง</span><p className="resident-room">{room}</p></div>
        <p className="sr-only" role="status">{announcement}</p>
        {formError && <p className="resident-error" role="alert">{formError}</p>}
        <div className="resident-dock">
          <button type="button" disabled={busy} className="desk-button desk-button-primary resident-block" onClick={reclaim}>
            <RefreshCw size={18} aria-hidden="true" />
            {busy ? "กำลังขอรหัส…" : `ขอรหัสใหม่สำหรับห้อง ${room}`}
          </button>
        </div>
        <button type="button" className="resident-link" onClick={onChangeRoom} disabled={busy}>เปลี่ยนเลขห้อง</button>
      </section>
    );
  }

  return (
    <section className="resident-card" aria-labelledby="verify-heading">
      <Steps current={busy ? 2 : 1} />
      <h1 id="verify-heading">กรอกรหัสยืนยัน</h1>
      <p className="resident-lead">{now === "say" ? <Emph>กรุณาขอรหัสจากเจ้าหน้าที่ที่เคาน์เตอร์</Emph> : "กรุณาขอรหัสจากเจ้าหน้าที่ที่เคาน์เตอร์"} (ไม่มีการส่ง SMS)</p>
      <div className="resident-room-box">
        <span className="resident-room-label">ห้อง</span>
        <p className="resident-room">{room}</p>
     </div>
      <p className="sr-only" role="status">{announcement}</p>
      <form onSubmit={submit} noValidate className={`resident-code-form${now === "code" ? " is-now" : ""}`}>
        <div className="resident-label-row">
          <label htmlFor="code">รหัส 6 หลักจากเจ้าหน้าที่</label>
          <span id="code-timer" className={remaining <= 60 ? "resident-timer is-urgent" : "resident-timer"}>
            <Clock size={16} aria-hidden="true" />เหลือเวลา {Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, "0")}
          </span>
        </div>
        <CodeBoxes value={code} inputRef={codeRef} disabled={busy} invalid={Boolean(codeError)}
          describedBy={codeError ? "code-timer code-error" : "code-timer"}
          onChange={(next) => { setCode(next); setError(null); }} />
        {codeError && <p id="code-error" className="resident-error" role="alert">{codeError}<span className="resident-error-fix"><Emph>กรุณาตรวจสอบและกรอกรหัสอีกครั้ง</Emph></span></p>}
        {permission !== "granted" && (
          <p className="resident-prompt-note"><BellRing size={18} aria-hidden="true" /><span>เบราว์เซอร์จะขอสิทธิ์ส่งการแจ้งเตือน กรุณากด {now === "allow" ? <Emph>"อนุญาต"</Emph> : <b>"อนุญาต"</b>}</span></p>
        )}
        {formError && <p className="resident-error" role="alert">{formError}</p>}
        <div className="resident-dock">
          <button type="submit" disabled={busy} className="desk-button desk-button-primary resident-block">
            <BellRing size={18} aria-hidden="true" />
            {busy ? "กำลังลงทะเบียน…" : "ยืนยันและเปิดการแจ้งเตือน"}
          </button>
        </div>
      </form>
      <button type="button" className="resident-link" onClick={onChangeRoom} disabled={busy}>เปลี่ยนเลขห้อง</button>
    </section>
  );
}

function StatusView({ status, updatedAt, stale, onRefresh, refreshing, notifyState, onReenable, onRecheck, onTest, onUnregister }) {
  const [confirm, setConfirm] = useState(false);
  const [unregistering, setUnregistering] = useState(false);
  const [reenabling, setReenabling] = useState(false);
  const [actionError, setActionError] = useState("");
  const triggerRef = useRef(null);
  const keepRef = useRef(null);
  const wasConfirming = useRef(false);
  const { device, pendingCount, pending } = status;

  // The safe choice takes focus when the confirm opens; the trigger gets it back when it closes.
  useEffect(() => {
    if (confirm) keepRef.current?.focus();
    else if (wasConfirming.current) triggerRef.current?.focus();
    wasConfirming.current = confirm;
  }, [confirm]);

  const unregister = async () => {
    setUnregistering(true);
    setActionError("");
    const failure = await onUnregister(); // unmounts this view on success
    if (failure) {
      setUnregistering(false);
      setActionError(failure);
    }
  };

  const reenable = async () => {
    setReenabling(true);
    setActionError("");
    const failure = await onReenable();
    setReenabling(false);
    if (failure) setActionError(failure);
  };

  return (
    <>
      <div className="page-heading resident-status-heading">
        <div>
          <h1 id="status-heading">ห้อง {device.buildingCode}{device.roomNumber}</h1>
          <p aria-live="polite">{pendingCount > 0 ? `มีพัสดุรอรับที่เคาน์เตอร์ ${pendingCount} ชิ้น` : "ไม่มีพัสดุรอรับที่เคาน์เตอร์"}</p>
        </div>
        <button type="button" className="desk-button resident-secondary" onClick={onRefresh} disabled={refreshing}>
          <RefreshCw size={16} aria-hidden="true" />{refreshing ? "กำลังโหลด…" : "รีเฟรช"}
        </button>
      </div>

      {notifyState === "off" && (
        <div className="resident-notice resident-notice-now">
          <span className="resident-notice-body"><Emph>อุปกรณ์นี้ยังไม่ได้รับการแจ้งเตือน</Emph> เปิดได้โดยไม่ต้องขอรหัสใหม่</span>
          <button type="button" className="desk-button desk-button-primary" onClick={reenable} disabled={reenabling || !onReenable}>
            <BellRing size={18} aria-hidden="true" />{reenabling ? "กำลังเปิดการแจ้งเตือน…" : "เปิดการแจ้งเตือนอีกครั้ง"}
          </button>
        </div>
      )}
      {notifyState === "blocked" && <BlockedNotice lead="เบราว์เซอร์บล็อกการแจ้งเตือน" onRecheck={onRecheck} />}
      {actionError && <p className="resident-error resident-action-error" role="alert">{actionError}</p>}

      <section className="parcel-register resident-register" aria-labelledby="status-heading">
        {pending.length > 0 ? (
          <table className="parcel-table resident-table">
            <caption className="sr-only">พัสดุที่รอรับ</caption>
            <thead>
              <tr><th scope="col">เลขพัสดุ</th><th scope="col">รับเข้าเมื่อ</th><th scope="col" className="resident-wait">ระยะเวลารอ</th></tr>
            </thead>
            <tbody>
              {pending.map((p) => {
                const days = daysWaiting(p.checkedInAt);
                const wait = days === 0 ? "วันนี้" : `${days} วัน`;
                return (
                  <tr key={p.trackingCode}>
                    <td className="resident-code-cell">{p.trackingCode}</td>
                    <td className="date-cell">
                      {formatThaiDateTime(p.checkedInAt)}
                      <span className="resident-wait-inline">{days === 0 ? "มาถึงวันนี้" : `รอ ${days} วัน`}</span>
                    </td>
                    <td className="resident-wait">{wait}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <p className="resident-empty">ยังไม่มีพัสดุรอรับ หากขนส่งแจ้งว่าส่งแล้ว เจ้าหน้าที่อาจยังไม่ได้บันทึก</p>
        )}
        <p className="resident-register-meta">
          {updatedAt && <>{stale ? "ข้อมูลเมื่อ" : "อัปเดตล่าสุด"} {formatThaiDateTime(updatedAt)}</>}
          {stale && " · ยังโหลดข้อมูลล่าสุดไม่ได้"}
        </p>
      </section>

      <section className="parcel-register resident-device" aria-labelledby="device-heading">
        <h2 id="device-heading">การลงทะเบียนอุปกรณ์นี้</h2>
        <dl>
          <div>
            <dt>การแจ้งเตือน</dt>
            <dd aria-live="polite">
              {notifyState === "on" && <span className="resident-on"><CheckCircle2 size={16} aria-hidden="true" />รับแจ้งเตือนอยู่</span>}
              {notifyState === "off" && "ยังไม่ได้เปิด"}
              {notifyState === "blocked" && "ถูกบล็อกในเบราว์เซอร์"}
            </dd>
          </div>
          <div>
            <dt>ใช้ได้ถึง</dt>
            <dd>{formatThaiDate(device.expiresAt)}</dd>
          </div>
        </dl>
       {!confirm ? (
          <div className="resident-device-actions">
            {notifyState === "on" && <button type="button" className="text-button resident-test" onClick={onTest}>ส่งการแจ้งเตือนทดสอบ</button>}
            <button type="button" ref={triggerRef} className="resident-danger" onClick={() => setConfirm(true)}>ยกเลิกการลงทะเบียนอุปกรณ์นี้</button>
          </div>
        ) : (
          <div className="resident-confirm" role="group" aria-labelledby="unregister-consequence">
            <p id="unregister-consequence">อุปกรณ์นี้จะไม่ได้รับแจ้งเตือนและไม่แสดงรายการพัสดุอีก หากต้องการใช้อีกครั้ง ต้องขอรหัสใหม่ที่เคาน์เตอร์</p>
            <div className="resident-confirm-actions">
              <button type="button" className="resident-danger-button" onClick={unregister} disabled={unregistering}>
                {unregistering ? "กำลังยกเลิก…" : "ยืนยันยกเลิกการลงทะเบียน"}
              </button>
              <button type="button" ref={keepRef} className="desk-button desk-button-primary" onClick={() => setConfirm(false)} disabled={unregistering}>เก็บการลงทะเบียนไว้</button>
            </div>
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
  const [claim, setClaimState] = useState(() => loadClaim());
  const [draft, setDraft] = useState(() => ({ room: claim?.roomInput || "", agreed: Boolean(claim) }));
  const [status, setStatus] = useState(() => loadCachedStatus()?.status ?? null);
  const [updatedAt, setUpdatedAt] = useState(() => loadCachedStatus()?.updatedAt ?? null);
  const [refreshing, setRefreshing] = useState(false);
  const [notifyState, setNotifyState] = useState(null);
  const [notice, setNotice] = useState(null); // { kind: "info" | "success", text, room? }
  // Kept apart so a late config response cannot clear a status failure, and vice versa.
  const [configError, setConfigError] = useState("");
  const [statusError, setStatusError] = useState("");
  const fatal = statusError || configError;

  const setClaim = useCallback((next) => {
    writeJSON(sessionStorage, CLAIM_KEY, next);
    setClaimState(next);
  }, []);

  const forget = useCallback((reason) => {
    saveToken(null);
    writeJSON(localStorage, STATUS_CACHE_KEY, null);
    setToken(null);
    setStatus(null);
    setUpdatedAt(null);
    setStatusError("");
    setNotifyState(null);
    setNotice(reason ? { kind: "info", text: reason } : null);
  }, []);

  // silent: a background reload (push, focus, poll) — no spinner on the refresh button.
  const loadStatus = useCallback(async (t, { silent = false } = {}) => {
    if (!silent) setRefreshing(true);
    try {
      const next = await residentApi.status(t);
      const at = new Date().toISOString();
      setStatus(next);
      setUpdatedAt(at);
      setStatusError("");
      writeJSON(localStorage, STATUS_CACHE_KEY, { token: t, status: next, updatedAt: at });
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) forget(NOTICE_EXPIRED); // revoked, expired or replaced
      else setStatusError(residentError(err));
    } finally {
      if (!silent) setRefreshing(false);
    }
  }, [forget]);

  const loadConfig = useCallback(() => {
    residentApi.pushConfig()
      .then((c) => {
        setConfig(c);
        setConfigError("");
      })
      .catch((err) => setConfigError(residentError(err)));
  }, []);

  useEffect(() => {
    if (support === "ok") loadConfig();
  }, [support, loadConfig]);

  // Registered: show the room's status and whether this browser can still be notified, and
  // re-send its current subscription in case the browser rotated it since last time.
  useEffect(() => {
    if (!token) return;
    loadStatus(token);
    shareTokenWithWorker(token);
    readNotifyState().then(({ state, sub }) => {
      setNotifyState(state);
      if (sub) residentApi.updateSubscription(token, sub).catch(() => {});
    });
  }, [token, loadStatus]);

  useEffect(() => {
    if (!token) return undefined;
    const reload = () => {
      if (document.visibilityState !== "visible") return;
      loadStatus(token, { silent: true });
      readNotifyState().then(({ state }) => setNotifyState(state));
    };
    const onWorkerMessage = (event) => {
      if (event.data?.type === "parcel_arrived") loadStatus(token, { silent: true });
    };
    const poll = setInterval(reload, STATUS_POLL_MS);
    document.addEventListener("visibilitychange", reload);
    navigator.serviceWorker?.addEventListener("message", onWorkerMessage);
    return () => {
      clearInterval(poll);
      document.removeEventListener("visibilitychange", reload);
      navigator.serviceWorker?.removeEventListener("message", onWorkerMessage);
    };
  }, [token, loadStatus]);

  // Buzz the phone once at the counter so the Resident (and Staff) see it works before leaving.
  const sendTest = useCallback(async (room) => {
    let sent = false;
    try {
      sent = await showTestNotification(`ทดสอบ: ห้อง ${room} พร้อมรับแจ้งเตือนพัสดุแล้ว`);
    } catch {
      sent = false;
    }
    setNotice({
      kind: "success",
      room,
      text: sent
        ? `ห้อง ${room} จะได้รับแจ้งเตือนบนอุปกรณ์นี้ ส่งแจ้งเตือนทดสอบไปแล้ว หากไม่ได้รับ กรุณาแจ้งเจ้าหน้าที่`
        : `ห้อง ${room} จะได้รับแจ้งเตือนบนอุปกรณ์นี้`,
    });
  }, []);

  // Returns an error message, or nothing on success.
  const unregister = async () => {
    try {
      await residentApi.unsubscribe(token);
    } catch (err) {
      if (!(err instanceof ApiError && err.status === 401)) return residentError(err);
    }
    await unsubscribeBrowser().catch(() => {});
    forget(NOTICE_UNREGISTERED);
    return "";
  };

  // The registration is still valid but this browser lost its subscription: subscribe again.
  const reenable = async () => {
    try {
      const sub = await subscribe(config.vapidPublicKey);
      await residentApi.updateSubscription(token, sub);
      setNotifyState("on");
      return "";
    } catch (err) {
      if (err instanceof PushPermissionError) {
        if (err.state === "denied") setNotifyState("blocked");
        return err.state === "denied" ? "" : "ต้องกด \"อนุญาต\" การแจ้งเตือน จึงจะเปิดได้";
      }
      if (err instanceof ApiError && err.status === 401) {
        forget(NOTICE_EXPIRED);
        return "";
      }
      return err instanceof ApiError ? residentError(err) : "เปิดการแจ้งเตือนบนอุปกรณ์นี้ไม่สำเร็จ กรุณาลองใหม่";
    }
  };

  const retry = () => {
    if (statusError && token) loadStatus(token);
    if (configError) loadConfig();
  };

  // A new screen starts at its top: the button that led here was pressed at the bottom of the last one.
  const screen = support !== "ok" ? "unsupported" : token && status ? "status" : claim ? `verify:${claim.claimToken}` : config ? "claim" : "loading";
  useEffect(() => {
    if (document.scrollingElement) document.scrollingElement.scrollTop = 0;
  }, [screen]);

  let body;
  if (support !== "ok") body = <Unsupported reason={support} />;
  else if (token && status)
    body = (
      <StatusView status={status} updatedAt={updatedAt} stale={Boolean(statusError)} refreshing={refreshing} notifyState={notifyState}
        onRefresh={() => loadStatus(token)} onReenable={config ? reenable : null} onUnregister={unregister}
        onRecheck={() => readNotifyState().then(({ state }) => setNotifyState(state))}
        onTest={() => sendTest(`${status.device.buildingCode}${status.device.roomNumber}`)} />
    );
  else if (token || !config)
    body = fatal
      ? <section className="resident-card"><h1>แจ้งเตือนพัสดุ</h1><p className="resident-lead">ขณะนี้ไม่สามารถเปิดหน้านี้ได้ กรุณากด "ลองใหม่" ด้านบน</p></section>
      : <p className="resident-loading" role="status">กำลังโหลด…</p>;
  else if (claim)
    body = (
      <VerifyStep
        key={claim.claimToken}
        claim={claim}
        vapidPublicKey={config.vapidPublicKey}
        onReclaimed={setClaim}
        onChangeRoom={() => {
          setDraft({ room: claim.roomInput || `${claim.buildingCode}${claim.roomNumber}`, agreed: true });
          setClaim(null);
        }}
        onRegistered={(reg) => {
          saveToken(reg.deviceToken);
          setClaim(null);
          setNotifyState("on");
          setToken(reg.deviceToken);
          const device = reg.device || claim;
          sendTest(`${device.buildingCode}${device.roomNumber}`);
        }}
      />
    );
  else
    body = (
      <ClaimStep
        initialRoom={draft.room}
        initialAgreed={draft.agreed}
        onClaimed={(next) => {
          setNotice(null);
          setClaim(next);
        }}
      />
    );

  return (
    <div className="resident-page" data-screen={screen === "status" ? "status" : "flow"}>
      <div className="resident-column">
      <header className="resident-bar">
        <span className="resident-brand"><Package size={22} aria-hidden="true" /><span>ParcelHub</span><small>แจ้งเตือนพัสดุ</small></span>
      </header>
      <main className="resident-shell">
        {fatal && (
          <div className="resident-notice resident-notice-error" role="alert">
            <AlertTriangle size={18} aria-hidden="true" />
            <span className="resident-notice-body">{fatal}</span>
            {/* With the last loaded parcels on screen, the card's "รีเฟรช" is the one retry. */}
            {!(token && status) && <button type="button" className="resident-notice-action" onClick={retry}>ลองใหม่</button>}
          </div>
        )}
        {notice?.kind === "info" && !fatal && (
          <div className="resident-notice" role="status"><span className="resident-notice-body">{notice.text}</span>
            <button type="button" className="resident-notice-close" aria-label="ปิดข้อความนี้" onClick={() => setNotice(null)}><X size={18} aria-hidden="true" /></button>
          </div>
        )}
        {body}
      </main>
      </div>
      {notice?.kind === "success" && !fatal && (
        <div className="desk-banner" data-visible="true" data-tone="success">
          <div role="status" aria-live="polite" aria-atomic="true" className="desk-banner-status">
            <span className="desk-banner-icon" aria-hidden="true"><Check size={18} strokeWidth={2.5} /></span>
            <p className="desk-banner-message"><strong>ลงทะเบียนแล้ว</strong> · {notice.text}</p>
          </div>
          <button type="button" onClick={() => setNotice(null)} className="icon-button desk-banner-close" aria-label="ปิดข้อความแจ้งผล"><X size={16} aria-hidden="true" /></button>
        </div>
      )}
      {screen !== "status" && (
        <div className="login-visual" aria-hidden="true">
          <img src={`${import.meta.env.BASE_URL}images/dormitory-login-campus.webp`} width="1122" height="1402" alt="" />
        </div>
      )}
    </div>
  );
}
