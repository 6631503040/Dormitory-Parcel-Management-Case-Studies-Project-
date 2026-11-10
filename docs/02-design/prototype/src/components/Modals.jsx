import React, { useEffect, useId, useRef, useState } from "react";
import { X, ScanLine, PackagePlus, Plus } from "lucide-react";
import { C, DAMAGE_NOTE_PREFIX, damageDetail, roomLabel } from "./shared";
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

function LabeledInput({ label, value, onChange, onKeyDown, placeholder, type = "text", autoFocus, error, inputRef, list, disabled = false, reserveMessage = false, feedback = "", labelAction, onCompositionStart, onCompositionEnd }) {
  const id = useId();
  return (
    <div className="form-field">
      {labelAction ? <div className="form-label-row"><label htmlFor={id}>{label}</label>{labelAction}</div> : <label htmlFor={id}>{label}</label>}
      <input onCompositionStart={onCompositionStart} onCompositionEnd={onCompositionEnd} id={id} ref={inputRef} disabled={disabled} type={type} value={value} onChange={onChange} onKeyDown={onKeyDown} placeholder={placeholder} autoFocus={autoFocus} list={list} aria-invalid={!!error} aria-describedby={error ? `${id}-error` : undefined} />
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
// A keyboard-emulating scanner sends a code's characters a few milliseconds apart; people type
// 100 ms+ apart. Only a burst this fast (or a paste) is sent automatically after a quiet period.
const SCANNER_KEY_GAP_MS = 50;
const SCAN_QUIET_MS = 400;
const LOOKUP_ROOM_LIMIT = 20;
// What GET /parcels/:code answers when the text simply isn't a Tracking Code (a resident's name is
// rejected as a malformed code), as opposed to a real failure worth showing.
const NOT_A_PARCEL = ["PARCEL_NOT_FOUND", "VALIDATION_ERROR"];

function CheckOutModal({ onClose, onConfirm }) {
  const [scan, setScan] = useState("");
  const [parcel, setParcel] = useState(null);
  const [room, setRoom] = useState(null); // a directory room found instead of a Parcel
  const [choices, setChoices] = useState(null); // {parcel, rooms} when the text matched several things
  const [pendingCodes, setPendingCodes] = useState([]);
  const [composing, setComposing] = useState(false);
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
  // burst: null until a second character shows how fast this entry is arriving.
  const entryRef = useRef({ last: 0, burst: null });
  const [typedByHand, setTypedByHand] = useState(false);
  const verified = (parcel || room) && !scan.trim() && !pendingCodes.length;
  const activeRoom = room || parcel?.room; // the room whose Pending Parcels are listed
  const activeRoomId = activeRoom?.id;
  const disabled = submitting || searching;
  useEffect(() => () => { requestId.current += 1; }, []);
  useEffect(() => { if (!searching && !submitting) scanRef.current?.focus(); }, [searching, submitting, room, parcel]);

  useEffect(() => {
    if (!activeRoomId) return;
    let active = true;
    setRoomLoading(true); setRoomError("");
    api.listParcels({ roomId: activeRoomId, status: "pending", page: roomPage, pageSize: ROOM_PAGE_SIZE })
      .then((result) => {
        if (!active) return;
        setRoomItems(result.items); setRoomTotal(result.total); setRoomLoading(false);
      }).catch((err) => {
        if (!active || err.name === "AbortError") return;
        setRoomLoading(false); setRoomError(errorMessage(err));
      });
    return () => { active = false; };
  }, [activeRoomId, roomPage, roomRefresh]);

  const enqueueScan = (event) => {
    event?.preventDefault();
    if (busyRef.current || composing || event?.nativeEvent?.isComposing) return;
    const code = scan.trim().toUpperCase();
    if (!code) return;
    setPendingCodes((codes) => [...codes, code]); setScan("");
  };
  // Keyboard scanners send a burst of characters, often without an Enter suffix: once the burst
  // has finished, look it up without Enter. Hand-typed text is never sent or cleared on a pause
  // (QA-05) — Staff press Enter when the code is complete.
  const changeScan = (event) => {
    const value = event.target.value;
    const now = performance.now();
    const entry = entryRef.current;
    if (!scan) entry.burst = value.length > 1 ? true : null; // new entry: a paste is complete at once
    else if (now - entry.last > SCANNER_KEY_GAP_MS) entry.burst = false;
    else if (entry.burst === null) entry.burst = true;
    entry.last = now;
    setTypedByHand(!!value.trim() && entry.burst === false);
    setScan(value); setError("");
  };
  useEffect(() => {
    if (!scan.trim() || entryRef.current.burst !== true || composing || submitting || all || confirmAll) return;
    const timer = setTimeout(() => enqueueScan(), SCAN_QUIET_MS);
    return () => clearTimeout(timer);
  }, [scan, composing, submitting, all, confirmAll]);

  const showRoom = (entry) => {
    setChoices(null); setSelected(new Map()); setRoomPage(1); setConfirmAll(false);
    setRoom(entry); setAll(true); setRoomLoading(true);
  };
  const clearResult = () => {
    setRoom(null); setParcel(null); setAll(false); setConfirmAll(false); setSelected(new Map()); setRoomPage(1);
    setRoomItems([]); setRoomTotal(0); setRoomLoading(false); setRoomError("");
  };
  // Only "select all" uses Check Out All and its confirmation; ticked rows go out by Tracking Code.
  const toggleRoomItem = (item) => {
    const next = new Map(all ? roomItems.map((entry) => [entry.trackingCode, entry]) : selected);
    if (next.has(item.trackingCode)) next.delete(item.trackingCode); else next.set(item.trackingCode, item);
    setAll(false); setSelected(next); setConfirmAll(false);
  };
  const addParcel = (result) => {
    setChoices(null);
    // Keep one recipient room per handover. Roomless parcels remain a single-item handover.
    if ((parcel || room) && (!activeRoom || !result.room || activeRoom.id !== result.room.id)) {
      setError("พัสดุนี้ไม่ใช่ห้องเดียวกับรายการรอนำออก กรุณาแยกนำออกคนละรอบ"); return;
    }
    if (!parcel && !room) { setParcel(result); setRoomPage(1); }
    setSelected((previous) => new Map([...previous, [result.trackingCode, result]]));
  };

  // The first entry may be a Tracking Code, a Room Number or a resident's name. The room always comes
  // from the directory, and when the text fits more than one thing Staff pick — it is never guessed.
  const lookup = async (code) => {
    if (busyRef.current || searchingRef.current) return;
    if (!code) { setError("กรอกเลขพัสดุหรือสแกนบาร์โค้ด"); scanRef.current?.focus(); return; }
    if (selected.has(code)) { setError("เลขพัสดุนี้อยู่ในรายการรอนำออกแล้ว"); scanRef.current?.focus(); return; }
    if (selected.size >= 100) { setError("นำออกได้สูงสุด 100 รายการต่อรอบ"); return; }
    const id = ++requestId.current;
    searchingRef.current = true;
    setSearching(true); setError(""); setChoices(null);
    const firstEntry = !parcel && !room;
    const [parcelResult, roomResult] = await Promise.allSettled([
      api.getParcel(code),
      firstEntry ? api.searchRooms(code, LOOKUP_ROOM_LIMIT) : null,
    ]);
    if (id !== requestId.current) return;
    searchingRef.current = false;
    setSearching(false);
    const found = parcelResult.value;
    const pending = found?.status === "pending" ? found : null;
    const hits = roomResult.value?.items || [];
    const exact = hits.filter((hit) => `${hit.buildingCode}${hit.roomNumber}`.toUpperCase() === code);
    if (pending && exact.length) { setChoices({ parcel: pending, rooms: exact }); return; }
    if (pending) { addParcel(pending); return; }
    if (exact.length === 1) { showRoom(exact[0]); return; }
    if (found) { setError("พัสดุนี้นำออกแล้วหรือไม่อยู่ในสถานะรอรับ"); return; }
    if (hits.length) { setChoices({ parcel: null, rooms: exact.length ? exact : hits }); return; }
    const failure = [parcelResult, roomResult].find((r) => r.status === "rejected" && (!firstEntry || !NOT_A_PARCEL.includes(r.reason.code)));
    setError(failure ? errorMessage(failure.reason) : "ไม่พบเลขพัสดุ เลขห้อง หรือชื่อผู้พักนี้");
  };
  // Serialise lookups, while keeping the input available for the next scanner burst.
  useEffect(() => {
    if (!pendingCodes.length || searching || searchingRef.current || busyRef.current) return;
    const code = pendingCodes[0];
    setPendingCodes((codes) => codes.slice(1));
    lookup(code);
  }, [pendingCodes, searching]);
  const submit = async () => {
    if (busyRef.current || searchingRef.current || !verified || (!all && !selected.size) || (all && (roomLoading || roomError))) return;
    if (all && !confirmAll) { setConfirmAll(true); return; }
    busyRef.current = true; setSubmitting(true); setError("");
    try {
      const result = all
        ? await api.checkOutAll(activeRoom.id, roomTotal)
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
  const tablePages = Math.max(1, Math.ceil(roomTotal / ROOM_PAGE_SIZE));
  const place = activeRoom ? `${activeRoom.buildingCode}${activeRoom.roomNumber}` : "";
  const recipients = (room || parcel)?.residents?.map((resident) => resident.fullName).join(" / ");
  const emptyRoom = room && !roomLoading && !roomError && roomTotal === 0;
  const everyParcelTicked = all || (!roomLoading && roomTotal > 0 && selected.size >= roomTotal);
  // A scanned Parcel may sit on another page of its room, so it stays listed while it is selected.
  const listedCodes = new Set(roomItems.map((item) => item.trackingCode));
  const pinned = activeRoom ? (all ? [] : [...selected.values()].filter((item) => !listedCodes.has(item.trackingCode))) : parcel ? [parcel] : [];
  const listRows = [...pinned, ...(roomLoading ? [] : roomItems)];
  const parcelRow = (item, ticked, rowDisabled, onChange) => <label key={item.trackingCode} className="checkout-selection-row">
    <input type="checkbox" disabled={rowDisabled} checked={ticked} onChange={onChange} />
    <span><strong>{item.trackingCode}</strong>{item.note && <span className="checkout-row-qty" data-damaged={item.note.startsWith(DAMAGE_NOTE_PREFIX)}>{item.note}</span>}</span>
  </label>;
  const footer = (parcel || room) && <fieldset disabled={disabled} className="checkout-footer-fields">
    {confirmAll && <div className="checkout-confirmation" role="group" aria-label="ยืนยันนำออกทั้งหมด"><p>นำออกทั้งหมด {roomTotal} รายการของห้อง {place}?</p><button type="button" className="text-button" onClick={() => setConfirmAll(false)}>กลับไปตรวจสอบ</button></div>}
    <div className="checkout-submit-row">
      <p role="status">รอนำออก <strong>{count}</strong> รายการ</p>
      <button type="button" className="desk-button desk-button-primary checkout-submit" disabled={disabled || !verified || !count || (all && (roomLoading || !!roomError))} onClick={submit}>{submitting ? "กำลังนำออก…" : confirmAll ? `ยืนยันนำออกทั้งหมด (${count})` : "ยืนยันนำออก"}</button>
    </div>
  </fieldset>;
  return <ModalShell title="นำพัสดุออก" icon={ScanLine} onClose={() => { if (!busyRef.current) onClose(); }} className="checkout-dialog checkout-scan-dialog" footer={footer}>
    <form onSubmit={enqueueScan} className="checkout-lookup">
      <LabeledInput label="เลขพัสดุ / เลขห้อง" value={scan} inputRef={scanRef} disabled={submitting || all || confirmAll} error={error} reserveMessage
        feedback={searching || pendingCodes.length ? "กำลังตรวจสอบพัสดุ…" : typedByHand && scan.trim() ? "พิมพ์ครบแล้วกด Enter เพื่อค้นหา" : ""}
        onChange={changeScan}
        onCompositionStart={() => setComposing(true)} onCompositionEnd={() => setComposing(false)}
        onKeyDown={(event) => { if (event.key === "Enter" && event.nativeEvent.isComposing) event.preventDefault(); }} placeholder="สแกนหรือพิมพ์ แล้วกด Enter" />
    </form>
    {choices && <section className="checkout-parcel-detail" aria-label="เลือกผลการค้นหา">
      <p className="checkout-choice-prompt" role="status">พบหลายรายการ เลือกรายการที่ต้องการ</p>
      <div className="checkout-checklist checkout-parcel-list">
        {choices.parcel && <button type="button" className="checkout-selection-row checkout-choice" onClick={() => addParcel(choices.parcel)}><span><strong>พัสดุ {choices.parcel.trackingCode}</strong><span className="checkout-row-qty">{roomLabel(choices.parcel)}</span></span></button>}
        {choices.rooms.map((hit) => <button key={hit.id} type="button" className="checkout-selection-row checkout-choice" onClick={() => showRoom(hit)}><span><strong>ห้อง {hit.buildingCode}{hit.roomNumber}</strong>{hit.residents?.length > 0 && <span className="checkout-row-qty">{hit.residents.map((resident) => resident.fullName).join(" / ")}</span>}</span></button>)}
      </div>
    </section>}
    {(parcel || room) && <section className="checkout-parcel-detail" aria-label="ข้อมูลพัสดุที่ค้นพบ">
      <div className="checkout-recipient">
        <div className="checkout-recipient-name"><strong>{place ? `ห้อง ${place}` : "ยังไม่ระบุห้อง"}</strong>{activeRoom && <span>{recipients || (parcel && roomLabel(parcel))}</span>}</div>
        <button type="button" className="text-button" disabled={disabled || confirmAll} onClick={clearResult}>{activeRoom ? "เปลี่ยนห้อง" : "ล้างรายการ"}</button>
      </div>
      {!activeRoom && <p className="checkout-roomless-note">ตรวจสอบชื่อผู้รับกับฉลากพัสดุก่อนส่งมอบ</p>}
      {emptyRoom && <p className="search-feedback" role="status">ห้องนี้ไม่มีพัสดุรอรับ</p>}
      {!emptyRoom && <fieldset disabled={disabled || confirmAll || !verified} className="checkout-room-fields" aria-busy={roomLoading}>
        <div className="checkout-checklist">
          {activeRoom && <label className="checkout-select-all"><input type="checkbox" ref={(node) => { if (node) node.indeterminate = !everyParcelTicked && selected.size > 0; }} checked={everyParcelTicked} disabled={roomLoading || !!roomError} onChange={(event) => { setAll(event.target.checked); setSelected(new Map()); setConfirmAll(false); }} /><span>เลือกทั้งหมดของห้อง</span></label>}
          {listRows.length > 0 && <div className="checkout-parcel-list">{listRows.map((item) => {
            const ticked = all || selected.has(item.trackingCode);
            return parcelRow(item, ticked, all ? roomTotal > ROOM_PAGE_SIZE : !ticked && selected.size >= 100, () => toggleRoomItem(item));
          })}</div>}
          {roomLoading && <p role="status">กำลังโหลดรายการ…</p>}
        </div>
        {roomError && <div><InlineError message={roomError} /><button type="button" className="text-button" onClick={() => setRoomRefresh((value) => value + 1)}>ลองโหลดใหม่</button></div>}
      </fieldset>}
      {tablePages > 1 && <nav className="checkout-pagination" aria-label="แบ่งหน้าพัสดุรอนำออก">
        <button type="button" className="text-button" disabled={disabled || roomLoading || roomPage === 1} onClick={() => setRoomPage(roomPage - 1)}>ก่อนหน้า</button>
        <span>หน้า {roomPage} / {tablePages}</span>
        <button type="button" className="text-button" disabled={disabled || roomLoading || roomPage === tablePages} onClick={() => setRoomPage(roomPage + 1)}>ถัดไป</button>
      </nav>}
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
    const detail = damageReason.trim();
    const input = !room
      ? { trackingCode, unmatchedReason: UNMATCHED_REASON_DEFAULT, note: detail ? `${DAMAGE_NOTE_PREFIX} ${detail}` : undefined }
      : { trackingCode, roomId: room.id, ...(damaged ? { note: `${DAMAGE_NOTE_PREFIX} ${detail || "ไม่ได้ระบุเหตุผล"}` } : {}) };
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
    onClose();
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
  const footer = savedCount > 0 && !drafts.length && !hasFields && !submitting ? (
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
        <p>รอบันทึก {drafts.length} รายการ</p>
        <ul className="checkin-drafts">
          {drafts.slice((currentPage - 1) * 8, currentPage * 8).map((draft) => <li key={draft.input.trackingCode}>
            <div className="checkin-draft-details"><strong>{draft.input.trackingCode}</strong>
              <span>{draft.room ? `${draft.room.buildingCode}${draft.room.roomNumber} · ${(draft.room.residents || []).map((r) => r.fullName).join(" / ")}` : "ไม่ทราบห้อง"}</span>
              {draft.damaged && <span>ชำรุด: {damageDetail({ room: draft.room, note: draft.input.note })}</span>}
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
