import React, { useEffect, useId, useRef, useState } from "react";
import { X, ScanLine, PackagePlus, Plus } from "lucide-react";
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

function LabeledInput({ label, value, onChange, onKeyDown, placeholder, type = "text", autoFocus, error, inputRef, list, disabled = false, reserveMessage = false, feedback = "", labelAction }) {
  const id = useId();
  return (
    <div className="form-field">
      {labelAction ? <div className="form-label-row"><label htmlFor={id}>{label}</label>{labelAction}</div> : <label htmlFor={id}>{label}</label>}
      <input id={id} ref={inputRef} disabled={disabled} type={type} value={value} onChange={onChange} onKeyDown={onKeyDown} placeholder={placeholder} autoFocus={autoFocus} list={list} aria-invalid={!!error} aria-describedby={error ? `${id}-error` : undefined} />
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
      // A Parcel with no room can be handed over too (migration 0007) — it just has no room list.
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
        onKeyDown={(event) => { if (event.key === "Enter" && event.nativeEvent.isComposing) event.preventDefault(); }} placeholder="สแกนหรือพิมพ์ แล้วกด Enter" />
      <button type="submit" disabled={disabled || confirmAll} className="desk-button checkout-lookup-button">{searching ? "กำลังค้นหา…" : "ค้นหาพัสดุ"}</button>
    </form>
    {parcel && <section className="checkout-parcel-detail" aria-label="ข้อมูลพัสดุที่ค้นพบ">
      <div className="checkout-detail-heading"><h3>{parcel.trackingCode}</h3><span className="parcel-status parcel-status-pending"><span className="pending-dot" aria-hidden="true" />รอรับ</span></div>
      <div className="checkout-recipient"><strong>{parcel.room ? `ห้อง ${parcel.room.buildingCode}${parcel.room.roomNumber}` : "ยังไม่ระบุห้อง"}</strong>{parcel.room && <p>{parcel.residents?.map((resident) => resident.fullName).join(" / ") || roomLabel(parcel)}</p>}</div>
      <dl className="checkout-detail-meta"><div><dt>วันที่รับเข้า</dt><dd>{formatThaiDateTime(parcel.checkedInAt)}</dd></div></dl>
      {!parcel.room && <div className="checkout-condition" role="note"><strong>พัสดุไม่มีเลขห้อง</strong><p>ตรวจสอบชื่อผู้รับกับฉลากพัสดุก่อนส่งมอบ</p></div>}
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
  const [damaged, setDamaged] = useState(false);
  const [damageReason, setDamageReason] = useState("");
  const [drafts, setDrafts] = useState([]);
  const [page, setPage] = useState(1);
  const [savedCount, setSavedCount] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [batchTotal, setBatchTotal] = useState(0);
  const [error, setError] = useState(null);
  const [confirmClose, setConfirmClose] = useState(false);
  const busy = useRef(false);
  const codeRef = useRef(null);
  const roomRef = useRef(null);
  const hasFields = !!(code.trim() || room || damaged || damageReason.trim());
  const canAdd = !!(code.trim() && (room || damaged)) && !submitting;
  useEffect(() => {
    if (!submitting && savedCount > 0) codeRef.current?.focus();
  }, [submitting, savedCount]);
  useEffect(() => {
    if (!drafts.length && !hasFields && !submitting) return;
    const warn = (event) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [drafts.length, hasFields, submitting]);
  const lastPage = Math.max(1, Math.ceil(drafts.length / 8));
  const currentPage = Math.min(page, lastPage);

  const resetFields = () => {
    setCode(""); setRoom(null); setDamaged(false); setDamageReason("");
  };
  const currentDraft = () => {
    if (!canAdd) { setError("กรอกเลขพัสดุและเลือกห้องให้ครบ หรือระบุว่าพัสดุมีปัญหา"); return null; }
    const trackingCode = code.trim().toUpperCase();
    if (drafts.some((item) => item.input.trackingCode === trackingCode)) {
      setError("เลขพัสดุนี้อยู่ในรายการรอบันทึกแล้ว"); return;
    }
    if (drafts.length >= 100) { setError("เพิ่มได้สูงสุด 100 รายการต่อรอบ กรุณาบันทึกก่อนเพิ่มรายการใหม่"); return; }
    const input = !room
      ? { trackingCode, unmatchedReason: UNMATCHED_REASON_DEFAULT, note: damageReason.trim() || undefined }
      : { trackingCode, roomId: room.id, ...(damaged ? { note: `ชำรุด: ${damageReason.trim() || "ไม่ได้ระบุเหตุผล"}` } : {}) };
    return { input, room, damaged, damageReason, error: null };
  };
  const addDraft = () => {
    if (busy.current) return;
    const draft = currentDraft();
    if (!draft) return;
    setDrafts((list) => [...list, draft]);
    setPage(Math.ceil((drafts.length + 1) / 8));
    setError(null); resetFields(); codeRef.current?.focus();
  };
  const submitAll = async () => {
    if (busy.current) return;
    let batch = drafts;
    if (hasFields) {
      const draft = currentDraft();
      if (!draft) return;
      batch = [...drafts, draft];
    }
    if (!batch.length) return;
    busy.current = true;
    setDrafts(batch); resetFields();
    setSubmitting(true); setError(null); setProgress(0); setBatchTotal(batch.length);
    // The existing API saves one Parcel per request. Only confirmed successes leave the queue;
    // failed/uncertain requests remain visible and are never silently treated as saved.
    let successes = 0;
    for (let index = 0; index < batch.length; index += 1) {
      const draft = batch[index];
      try {
        await api.checkIn(draft.input);
        successes += 1;
        setSavedCount((count) => count + 1);
        setDrafts((list) => list.filter((item) => item.input.trackingCode !== draft.input.trackingCode));
      } catch (err) {
        setDrafts((list) => list.map((item) => item.input.trackingCode === draft.input.trackingCode ? { ...item, error: errorMessage(err) } : item));
        if (!(err instanceof ApiError) || err.status === 0 || err.status >= 500 || err.status === 401 || err.status === 429) break;
      }
      setProgress(index + 1);
    }
    if (successes < batch.length) setError(`บันทึกสำเร็จ ${successes} จาก ${batch.length} รายการ รายการที่เหลือยังไม่ได้ยืนยันการบันทึก`);
    setPage(1); busy.current = false; setSubmitting(false);
  };
  const requestClose = () => {
    if (busy.current) return;
    if (drafts.length || hasFields) setConfirmClose(true);
    else onClose();
  };
  const handleCodeKeyDown = (event) => {
    if (event.key !== "Enter" || event.nativeEvent?.isComposing || busy.current) return;
    event.preventDefault();
    if (code.trim() && (room || damaged)) addDraft();
    else if (code.trim()) roomRef.current?.focus();
  };
  const editDraft = (draft) => {
    if (hasFields) { setError("เพิ่มพัสดุที่กำลังกรอก หรือกดล้างข้อมูลที่กรอกก่อนแก้ไขรายการอื่น"); return; }
    setDrafts((list) => list.filter((item) => item !== draft));
    setCode(draft.input.trackingCode); setRoom(draft.room);
    setDamaged(draft.damaged); setDamageReason(draft.damageReason); setError(null);
    codeRef.current?.focus();
  };
  const footer = confirmClose ? (
    <div>
      <p role="alert">ยังมีข้อมูลที่ไม่ได้บันทึก ต้องการทิ้งรายการหรือไม่?</p>
      <div className="checkin-actions">
        <button type="button" className="desk-button" onClick={() => setConfirmClose(false)}>กลับไปทำต่อ</button>
        <button type="button" className="desk-button" onClick={onClose}>ทิ้งรายการและปิด</button>
      </div>
    </div>
  ) : savedCount > 0 && !drafts.length && !hasFields && !submitting ? (
    <button type="button" className="desk-button desk-button-primary dialog-submit" onClick={requestClose}>เสร็จสิ้น</button>
  ) : (
    <div className="checkin-footer-actions">
      <button type="button" className="desk-button checkin-add" disabled={!canAdd} onClick={addDraft}><Plus size={16} aria-hidden="true" />เพิ่มพัสดุอีกชิ้น</button>
      <button type="button" disabled={submitting || (!drafts.length && !canAdd)} onClick={submitAll} className="desk-button desk-button-primary dialog-submit">
        {submitting ? `กำลังบันทึก ${progress} / ${batchTotal}…` : "บันทึก"}
      </button>
    </div>
  );
  return (
    <ModalShell title="บันทึกพัสดุเข้า" icon={PackagePlus} onClose={requestClose} footer={footer}>
      <LabeledInput label="เลขพัสดุ" value={code} inputRef={codeRef} disabled={submitting} autoFocus
        labelAction={<button type="button" className="text-button checkin-clear" disabled={submitting || !hasFields} onClick={() => { resetFields(); setError(null); codeRef.current?.focus(); }}>ล้างข้อมูลที่กรอก</button>}
        onChange={(event) => { setCode(event.target.value); setError(null); }} onKeyDown={handleCodeKeyDown}
        placeholder="สแกนหรือพิมพ์ แล้วกด Enter" />
      <fieldset disabled={submitting} className="checkout-room-fields">
        <RoomCombobox ref={roomRef} label={damaged ? "เลขห้อง (ถ้าทราบ)" : "เลขห้อง (เลือกจากรายชื่อผู้พัก)"} value={room} onChange={setRoom} />
      </fieldset>
      <label className="intake-condition">
        <input type="checkbox" checked={damaged} disabled={submitting} onChange={(event) => { setDamaged(event.target.checked); setError(null); }} />
        <span>พัสดุมีปัญหา</span>
      </label>
      {damaged && <div className="form-field">
        <label htmlFor="checkin-damage">รายละเอียดปัญหา (ไม่บังคับ)</label>
        <textarea maxLength={490} id="checkin-damage" className="desk-textarea" rows={2} value={damageReason} disabled={submitting} onChange={(event) => setDamageReason(event.target.value)} placeholder="หมายเหตุ" />
      </div>}
      <InlineError message={error} />
      {savedCount > 0 && <p role="status">บันทึกเข้าสู่ระบบสำเร็จ {savedCount} รายการ</p>}
      {drafts.length > 0 && <section className="selected-summary" aria-label="รายการรอบันทึก">
        <p>รอบันทึก ({drafts.length})</p>
        <ul className="checkin-drafts">
          {drafts.slice((currentPage - 1) * 8, currentPage * 8).map((draft) => <li key={draft.input.trackingCode}>
            <div className="checkin-draft-details"><strong>{draft.input.trackingCode}</strong>
              <span>{draft.room ? `${draft.room.buildingCode}${draft.room.roomNumber} · ${(draft.room.residents || []).map((r) => r.fullName).join(" / ")}` : "ไม่ทราบห้อง"}{draft.damaged ? " · มีปัญหา" : ""}</span>
              {draft.input.note && <span>{draft.input.note}</span>}
              {draft.error && <InlineError message={draft.error} />}
            </div>
            <button type="button" className="text-button" disabled={submitting} aria-label={`แก้ไข ${draft.input.trackingCode}`} onClick={() => editDraft(draft)}>แก้ไข</button>
            <button type="button" className="icon-button" disabled={submitting} aria-label={`ลบ ${draft.input.trackingCode}`} onClick={() => setDrafts((list) => list.filter((item) => item !== draft))}><X size={16} aria-hidden="true" /></button>
          </li>)}
        </ul>
        {lastPage > 1 && <nav className="checkout-pagination" aria-label="หน้ารายการรอบันทึก">
          <button type="button" className="text-button" disabled={submitting || currentPage === 1} onClick={() => setPage(currentPage - 1)}>ก่อนหน้า</button>
          <span>หน้า {currentPage} / {lastPage}</span>
          <button type="button" className="text-button" disabled={submitting || currentPage === lastPage} onClick={() => setPage(currentPage + 1)}>ถัดไป</button>
        </nav>}
      </section>}
    </ModalShell>
  );
}

export { ModalShell, CheckOutModal, CheckInModal, InlineError, LabeledInput };
