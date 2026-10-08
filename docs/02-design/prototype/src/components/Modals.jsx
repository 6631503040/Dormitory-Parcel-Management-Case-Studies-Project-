import React, { useEffect, useId, useRef, useState } from "react";
import { X, ScanLine, PackagePlus } from "lucide-react";
import { C, roomLabel, formatThaiDateTime } from "./shared";
import RoomCombobox from "./RoomCombobox";
import { api, ApiError } from "../api/client";
import { errorMessage } from "../api/errorMessages";

function ModalShell({ title, icon: Icon, onClose, children, className = "", footer }) {
  const titleId = useId();
  const dialogRef = useRef(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const opener = document.activeElement;
    const node = dialogRef.current;
    node.showModal();
    node.querySelector("input")?.focus();
    return () => { node.close(); opener?.focus(); };
  }, []);
  return (
    <dialog ref={dialogRef} aria-labelledby={titleId} className={`desk-dialog ${className}`}
      onCancel={(event) => { event.preventDefault(); closeRef.current(); }}
      onClick={(event) => {
        if (event.target !== event.currentTarget) return;
        const bounds = event.currentTarget.getBoundingClientRect();
        if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) closeRef.current();
      }}>
      <div className="dialog-header">
        <div className="flex items-center gap-2.5"><Icon size={18} aria-hidden="true" /><h2 id={titleId}>{title}</h2></div>
        <button type="button" onClick={onClose} className="icon-button" aria-label="ปิด"><X size={18} style={{ color: C.textMuted }} /></button>
      </div>
      <div className="dialog-content">{children}</div>
      {footer && <div className="dialog-footer">{footer}</div>}
    </dialog>
  );
}

function LabeledInput({ label, value, onChange, onKeyDown, placeholder, type = "text", autoFocus, error, inputRef, list, disabled = false, onPrepareScan, reserveMessage = false, feedback = "" }) {
  const id = useId();
  return (
    <div className="form-field">
      <label htmlFor={id}>{label}</label>
      <div className={onPrepareScan ? "scan-input-row" : undefined}>
        <input id={id} ref={inputRef} disabled={disabled} type={type} value={value} onChange={onChange} onKeyDown={onKeyDown} placeholder={placeholder} autoFocus={autoFocus} list={list} aria-invalid={!!error} aria-describedby={[error && `${id}-error`, onPrepareScan && `${id}-scan-help`].filter(Boolean).join(" ") || undefined} />
        {onPrepareScan && <button type="button" disabled={disabled} onClick={onPrepareScan} aria-label="เตรียมสแกน" title="เตรียมสแกน" className="desk-button scan-prepare-button"><ScanLine size={20} aria-hidden="true" /></button>}
      </div>
      {onPrepareScan && <span id={`${id}-scan-help`} className="sr-only">กด Enter เพื่อยืนยันรหัส</span>}
      {reserveMessage ? (
        <div className="field-message">
          {error ? <p id={`${id}-error`} className="field-error" role="alert">{error}</p> : <p className="search-feedback" role="status">{feedback}</p>}
        </div>
      ) : (error && <p id={`${id}-error`} className="field-error" role="alert">{error}</p>)}
    </div>
  );
}

function InlineError({ message }) {
  if (!message) return null;
  return <p className="field-error" role="alert">{message}</p>;
}

// --- Check-Out ------------------------------------------------------------------------------

const ROOM_PAGE_SIZE = 8;

function CheckOutModal({ onClose, onConfirm }) {
  const [scan, setScan] = useState("");
  const [parcel, setParcel] = useState(null);
  const [selected, setSelected] = useState(new Map());
  const [roomPage, setRoomPage] = useState(1);
  const [roomItems, setRoomItems] = useState([]);
  const [roomTotal, setRoomTotal] = useState(0);
  const [roomLoading, setRoomLoading] = useState(false);
  const [roomRefresh, setRoomRefresh] = useState(0);
  const [all, setAll] = useState(false);
  const [confirmAll, setConfirmAll] = useState(false);
  const [searching, setSearching] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [roomError, setRoomError] = useState("");
  const scanRef = useRef(null);
  const requestId = useRef(0);
  const busyRef = useRef(false);
  const searchingRef = useRef(false);
  const verified = parcel && scan.trim().toUpperCase() === parcel.trackingCode;
  const disabled = submitting || searching;
  useEffect(() => () => { requestId.current += 1; }, []);

  useEffect(() => {
    if (!parcel?.room) return;
    let active = true;
    setRoomLoading(true); setRoomError("");
    api.listParcels({ roomId: parcel.room.id, status: "pending", page: roomPage, pageSize: ROOM_PAGE_SIZE })
      .then((result) => {
        if (!active) return;
        setRoomItems(result.items); setRoomTotal(result.total); setRoomLoading(false);
      }).catch((err) => {
        if (!active || err.name === "AbortError") return;
        setRoomLoading(false); setRoomError(errorMessage(err));
      });
    return () => { active = false; };
  }, [parcel, roomPage, roomRefresh]);

  const lookup = async (event) => {
    event.preventDefault();
    if (busyRef.current || searchingRef.current || event.nativeEvent?.isComposing) return;
    const code = scan.trim().toUpperCase();
    if (!code) { setError("กรอกเลขพัสดุหรือสแกนบาร์โค้ด"); scanRef.current?.focus(); return; }
    const id = ++requestId.current;
    searchingRef.current = true;
    setSearching(true); setError(""); setParcel(null); setSelected(new Map());
    setAll(false); setConfirmAll(false); setRoomItems([]); setRoomTotal(0); setRoomPage(1);
    try {
      const result = await api.getParcel(code);
      if (id !== requestId.current) return;
      if (result.status !== "pending") { setError("พัสดุนี้นำออกแล้วหรือไม่อยู่ในสถานะรอรับ"); return; }
      if (!result.room) { setError("พัสดุนี้ยังไม่ระบุห้อง กรุณาจัดห้องก่อนนำออก"); return; }
      setParcel(result); setScan(result.trackingCode);
      setSelected(new Map([[result.trackingCode, result]]));
    } catch (err) {
      if (id === requestId.current) setError(errorMessage(err));
    } finally {
      if (id === requestId.current) { searchingRef.current = false; setSearching(false); }
    }
  };
  const submit = async () => {
    if (busyRef.current || !verified || (!all && !selected.size)) return;
    if (all && !confirmAll) { setConfirmAll(true); return; }
    busyRef.current = true; setSubmitting(true); setError("");
    try {
      const result = all
        ? await api.checkOutAll(parcel.room.id, roomTotal)
        : await api.checkOut(Array.from(selected.keys()));
      onConfirm(result.parcels);
    } catch (err) {
      setError(errorMessage(err)); setConfirmAll(false);
      if (err instanceof ApiError && ["PENDING_COUNT_CHANGED", "NO_PENDING_PARCELS"].includes(err.code)) {
        setAll(false); setRoomRefresh((value) => value + 1);
      }
      if (err instanceof ApiError && (err.code === "PARCEL_NOT_PENDING" || err.code === "PARCEL_NOT_FOUND")) {
        const stale = new Set(err.params?.trackingCodes || []);
        setSelected((previous) => new Map([...previous].filter(([code]) => !stale.has(code))));
      }
    } finally { busyRef.current = false; setSubmitting(false); }
  };
  const count = all ? roomTotal : selected.size;
  const footer = parcel && <fieldset disabled={disabled} className="checkout-footer-fields">
    <div className="checkout-footer-heading"><p role="status">นำออก {count} รายการ{parcel.room ? ` · ห้อง ${parcel.room.buildingCode}${parcel.room.roomNumber}` : ""}</p></div>
    {confirmAll && <div className="checkout-confirmation" role="group" aria-label="ยืนยันนำออกทั้งหมด"><p>นำออกทั้งหมด {roomTotal} รายการของห้อง {parcel.room.buildingCode}{parcel.room.roomNumber}?</p><button type="button" className="text-button" onClick={() => setConfirmAll(false)}>กลับไปตรวจสอบ</button></div>}
    <button type="button" className="desk-button desk-button-primary checkout-submit" disabled={disabled || !verified || !count} onClick={submit}>{submitting ? "กำลังนำออก…" : confirmAll ? `ยืนยันนำออกทั้งหมด (${count})` : count > 1 ? `ยืนยันนำพัสดุออก (${count})` : "ยืนยันนำพัสดุออก"}</button>
  </fieldset>;
  return <ModalShell title="นำพัสดุออก" icon={ScanLine} onClose={() => { if (!busyRef.current) onClose(); }} className="checkout-dialog checkout-scan-dialog" footer={footer}>
    <form onSubmit={lookup} className="checkout-lookup">
      <LabeledInput label="สแกนหรือกรอกเลขพัสดุ" value={scan} inputRef={scanRef} disabled={disabled || confirmAll} error={error} reserveMessage
        onChange={(event) => { setScan(event.target.value); setError(""); }}
        onPrepareScan={() => { scanRef.current?.focus(); scanRef.current?.select(); }}
        onKeyDown={(event) => { if (event.key === "Enter" && event.nativeEvent.isComposing) event.preventDefault(); }} placeholder="สแกนหรือพิมพ์ แล้วกด Enter" />
      <button type="submit" disabled={disabled || confirmAll} className="desk-button checkout-lookup-button">{searching ? "กำลังค้นหา…" : "ค้นหาพัสดุ"}</button>
    </form>
    {parcel && <section className="checkout-parcel-detail" aria-label="ข้อมูลพัสดุที่ค้นพบ">
      <div className="checkout-detail-heading"><h3>{parcel.trackingCode}</h3><span className="parcel-status parcel-status-pending"><span className="pending-dot" aria-hidden="true" />รอรับ</span></div>
      <div className="checkout-recipient"><strong>{parcel.room ? `ห้อง ${parcel.room.buildingCode}${parcel.room.roomNumber}` : "ยังไม่ระบุห้อง"}</strong><p>{parcel.residents?.map((resident) => resident.fullName).join(" / ") || roomLabel(parcel)}</p></div>
      <dl className="checkout-detail-meta"><div><dt>วันที่รับเข้า</dt><dd>{formatThaiDateTime(parcel.checkedInAt)}</dd></div></dl>
      {parcel.note && <div className="checkout-condition"><strong>หมายเหตุ</strong><p>{parcel.note}</p></div>}
      {parcel.room && <details className="checkout-other-parcels"><summary>พัสดุอื่นของห้องนี้{roomTotal > 0 ? ` (${Math.max(0, roomTotal - 1)})` : ""}</summary>
        <fieldset disabled={disabled || confirmAll || !verified} className="checkout-room-fields">
          <div className="checkout-list-tools"><span>เลือกเพิ่ม</span><label className="checkout-select-all"><input type="checkbox" checked={all} disabled={roomLoading || !!roomError || roomTotal < 2} onChange={(event) => { setAll(event.target.checked); setConfirmAll(false); }} /><span>เลือกเพิ่มทั้งหมด</span></label></div>
          {roomError && <InlineError message={roomError} />}
          {roomLoading ? <p role="status">กำลังค้นหา…</p> : <div className="checkout-parcel-list">{roomItems.filter((item) => item.trackingCode !== parcel.trackingCode).map((item) => <label key={item.trackingCode} className="checkout-selection-row" data-selected={all || selected.has(item.trackingCode)}><input type="checkbox" disabled={all || (!selected.has(item.trackingCode) && selected.size >= 100)} checked={all || selected.has(item.trackingCode)} onChange={() => setSelected((previous) => { const next = new Map(previous); if (next.has(item.trackingCode)) next.delete(item.trackingCode); else next.set(item.trackingCode, item); return next; })} /><span><strong>{item.trackingCode}</strong><span className="checkout-row-qty">{formatThaiDateTime(item.checkedInAt)}</span></span></label>)}</div>}
          {roomTotal > ROOM_PAGE_SIZE && <div className="checkout-pagination"><button type="button" className="text-button" disabled={roomLoading || roomPage === 1} onClick={() => setRoomPage((page) => page - 1)}>ก่อนหน้า</button><span role="status">หน้า {roomPage} / {Math.ceil(roomTotal / ROOM_PAGE_SIZE)}</span><button type="button" className="text-button" disabled={roomLoading || roomPage >= Math.ceil(roomTotal / ROOM_PAGE_SIZE)} onClick={() => setRoomPage((page) => page + 1)}>ถัดไป</button></div>}
        </fieldset>
      </details>}
    </section>}
  </ModalShell>;
}

// --- Check-In --------------------------------------------------------------------------------

// A problem parcel (no usable room) is still recorded with a reason internally — the backend
// requires one of the four enum values — but staff no longer pick which one; a plain tick is
// enough, so every one of these is filed as "other" and left for a supervisor to re-classify if
// ever needed (matches the removal of the reason-based filter tabs on the dashboard).
const UNMATCHED_REASON_DEFAULT = "other";

function CheckInModal({ onClose }) {
  const [code, setCode] = useState("");
  const [room, setRoom] = useState(null);
  const [unmatched, setUnmatched] = useState(false);
  const [note, setNote] = useState("");
  const [damaged, setDamaged] = useState(false);
  const [damageReason, setDamageReason] = useState("");
  const submittingRef = useRef(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [checkedIn, setCheckedIn] = useState([]); // this session's running list, newest first
  const codeRef = useRef(null);
  const roomRef = useRef(null);
  const focusAfterSave = useRef(false);
  useEffect(() => {
    if (!submitting && focusAfterSave.current) { focusAfterSave.current = false; codeRef.current?.focus(); }
  }, [submitting]);

  const resetFields = () => {
    setCode("");
    setRoom(null);
    setUnmatched(false);
    setNote("");
    setDamaged(false); setDamageReason("");
  };

  const canSubmit = code.trim() !== "" && (unmatched || room) && !submitting;

  const submit = async () => {
    if (!canSubmit || submittingRef.current) return;
    const trimmed = code.trim();
    const input = unmatched
      ? { trackingCode: trimmed, unmatchedReason: UNMATCHED_REASON_DEFAULT, note: note.trim() || undefined }
      : { trackingCode: trimmed, roomId: room.id, ...(damaged ? { note: `ชำรุด: ${damageReason.trim() || "ไม่ได้ระบุเหตุผล"}` } : {}) };
    submittingRef.current = true;
    setSubmitting(true);
    setError(null);
    try {
      const parcel = await api.checkIn(input);
      setCheckedIn((list) => [parcel, ...list]);
      resetFields();
      submittingRef.current = false;
      setSubmitting(false);
      focusAfterSave.current = true;
      return;
    } catch (err) {
      setError(errorMessage(err));
    }
    submittingRef.current = false;
    setSubmitting(false);
  };

  const handleCodeKeyDown = (e) => {
    if (e.key !== "Enter" || e.nativeEvent?.isComposing || submittingRef.current) return;
    e.preventDefault();
    if (!code.trim()) return;
    if (unmatched) {
      submit();
      return;
    }
    roomRef.current?.focus();
  };

  const toggleUnmatched = () => {
    setUnmatched((u) => !u);
    setRoom(null);
    setNote("");
    setError(null);
  };

  const footer = (
    <button type="button" disabled={!canSubmit} onClick={submit} className="desk-button desk-button-primary dialog-submit">
      {submitting ? "กำลังบันทึก…" : "บันทึก"}
    </button>
  );

  return (
    <ModalShell title="บันทึกพัสดุเข้า" icon={PackagePlus} onClose={() => { if (!submittingRef.current) onClose(); }} footer={footer}>
      <LabeledInput
        label="เลขพัสดุ"
        value={code}
        inputRef={codeRef}
        disabled={submitting}
        autoFocus
        onChange={(e) => { setCode(e.target.value); setError(null); }}
        onKeyDown={handleCodeKeyDown}
        placeholder="สแกนหรือพิมพ์ แล้วกด Enter"
        onPrepareScan={() => { codeRef.current?.focus(); codeRef.current?.select(); }}
      />

      <InlineError message={error} />

      {!unmatched && (
        <fieldset disabled={submitting} className="checkout-room-fields"><RoomCombobox ref={roomRef} label="เลขห้อง (เลือกจากรายชื่อผู้พัก)" value={room} onChange={setRoom} /></fieldset>
      )}

      {!unmatched && <>
        <label className="intake-condition"><input type="checkbox" checked={damaged} disabled={submitting} onChange={(event) => setDamaged(event.target.checked)} /><span>พัสดุชำรุด</span></label>
        {damaged && <div className="form-field"><label htmlFor="checkin-damage">เหตุผลที่ชำรุด</label><textarea maxLength={490} id="checkin-damage" className="desk-textarea" rows={2} value={damageReason} disabled={submitting} onChange={(event) => setDamageReason(event.target.value)} /></div>}
      </>}
      <label className="intake-condition">
        <input type="checkbox" checked={unmatched} onChange={toggleUnmatched} disabled={submitting} />
        <span>พัสดุมีปัญหา / ไม่ทราบห้อง</span>
      </label>

      {unmatched && (
        <div className="form-field">
          <label htmlFor="checkin-note">หมายเหตุ (ไม่บังคับ)</label>
          <textarea id="checkin-note" maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} placeholder="หมายเหตุ (ไม่บังคับ) เช่น ชื่อบนกล่อง 'แนน'" rows={2} className="desk-textarea" disabled={submitting} />
        </div>
      )}

      {checkedIn.length > 0 && (
        <div className="selected-summary">
          <p>บันทึกแล้วรอบนี้ ({checkedIn.length})</p>
          <ul>
            {checkedIn.map((p) => (
              <li key={p.trackingCode}>
                <span className={p.room ? undefined : "condition-note"}>{roomLabel(p)}</span>
                <span className="checkout-row-qty">{p.trackingCode}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </ModalShell>
  );
}

export { ModalShell, CheckOutModal, CheckInModal, InlineError, LabeledInput };
