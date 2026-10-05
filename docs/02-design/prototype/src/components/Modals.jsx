import React, { useEffect, useId, useRef, useState } from "react";
import { X, Check, ScanLine, PackagePlus, ChevronLeft, ChevronRight, Search } from "lucide-react";
import { C, bodyFont, roomLabel } from "./shared";
import { ROOM_DIRECTORY, residentsFor, parcelMatches, emptyDraft, hasCurrentEntry, entryErrors, validateBatch, scanResult } from "../lib/parcelRules";

function ModalShell({ title, icon: Icon, onClose, children, className = '', style, footer }) {
  const dialog = useRef(null);
  const titleId = useId();
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const opener = document.activeElement;
    const node = dialog.current;
    node.showModal();
    node.querySelector("input")?.focus();
    return () => { node.close(); opener?.focus(); };
  }, []);
  return (
    <dialog ref={dialog} className={`desk-dialog ${className}`} style={style} aria-labelledby={titleId} onCancel={(event) => { event.preventDefault(); closeRef.current(); }} onClick={(event) => {
      if (event.target !== event.currentTarget) return;
      const bounds = event.currentTarget.getBoundingClientRect();
      if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) closeRef.current();
    }}>
        <div className="dialog-header">
          <div className="flex items-center gap-2.5">
            <Icon size={18} aria-hidden="true" />
            <h2 id={titleId}>{title}</h2>
          </div>
          <button onClick={onClose} className="icon-button" aria-label="ปิดหน้าต่าง">
            <X size={18} style={{ color: C.textMuted }} />
          </button>
        </div>
        <div className="dialog-content">{children}</div>
        {footer && <div className="dialog-footer">{footer}</div>}
    </dialog>
  );
}

function LabeledInput({ label, value, onChange, onKeyDown, placeholder, type = 'text', autoFocus, error, inputRef, list, disabled = false, onPrepareScan, reserveMessage = false, feedback = '' }) {
  const id = useId();
  return <div className="form-field">
    <label htmlFor={id}>{label}</label>
    <div className={onPrepareScan ? "scan-input-row" : undefined}>
    <input id={id} ref={inputRef} disabled={disabled} type={type} value={value} onChange={onChange} onKeyDown={onKeyDown} placeholder={placeholder} autoFocus={autoFocus} list={list} aria-invalid={!!error} aria-describedby={[error && `${id}-error`, onPrepareScan && `${id}-scan-help`].filter(Boolean).join(" ") || undefined} />
    {onPrepareScan && <button type="button" disabled={disabled} onClick={onPrepareScan} aria-label="เตรียมสแกน" title="เตรียมสแกน" className="desk-button scan-prepare-button"><ScanLine size={20} aria-hidden="true" /></button>}
    </div>
    {onPrepareScan && <span id={`${id}-scan-help`} className="sr-only">กด Enter เพื่อยืนยันรหัส</span>}
    {reserveMessage ? <div className="field-message">
      {error ? <p id={`${id}-error`} className="field-error" role="alert">{error}</p> : <p className="search-feedback" role="status">{feedback}</p>}
    </div> : error && <p id={`${id}-error`} className="field-error" role="alert">{error}</p>}
  </div>;
}

function RoomPicker({ parcels, value, initialQuery, disabled, onChange, onEditingChange }) {
  const id = useId();
  const [term, setTerm] = useState(initialQuery);
  const [editing, setEditing] = useState(false);
  const [active, setActive] = useState(-1);
  const input = useRef(null);
  const changeButton = useRef(null);
  const list = useRef(null);
  const wasDisabled = useRef(disabled);
  const picking = !value || editing;
  const pending = parcels.filter((p) => p.status === 'in');
  const hasQuery = !!term.trim();
  const roomInfo = new Map();
  pending.forEach((p) => { const item = roomInfo.get(p.room); if (item) item.count++; else roomInfo.set(p.room, { parcel: p, count: 1 }); });
  const rooms = hasQuery ? [...new Set(pending.filter((p) => parcelMatches(p, term)).map((p) => p.room))] : [];
  const roomText = (room) => roomLabel(roomInfo.get(room)?.parcel || parcels.find((p) => p.room === room) || { room });
  const index = active < rooms.length ? active : -1;
  useEffect(() => { onEditingChange(picking); if (picking) input.current?.focus(); }, [picking, onEditingChange]);
  useEffect(() => { if (index >= 0) list.current?.children[index]?.scrollIntoView({ block: 'nearest' }); }, [index]);
  useEffect(() => { if (wasDisabled.current && !disabled) (input.current || changeButton.current)?.focus(); wasDisabled.current = disabled; }, [disabled]);
  const choose = (room) => { if (disabled) return; onChange(room); setEditing(false); setTerm(''); setActive(-1); };
  if (!picking) return <div className="checkout-room-identity">
    <div><strong>ห้อง {value}</strong><p>{roomText(value).replace(`${value} · `, '')}</p></div>
    <button ref={changeButton} type="button" disabled={disabled} className="text-button" onClick={() => { setTerm(''); setActive(-1); setEditing(true); }}>เปลี่ยนห้อง</button>
  </div>;
  return <div className="form-field room-picker">
    <div className="room-picker-heading">
      <label htmlFor={id}>ค้นหาห้องหรือชื่อผู้รับ</label>
      {editing && <button type="button" disabled={disabled} className="text-button" onClick={() => setEditing(false)}>ใช้ห้องเดิม</button>}
    </div>
    <div className="room-picker-anchor">
    <div className="search-control room-picker-control">
      <Search size={18} aria-hidden="true" />
      <input ref={input} id={id} disabled={disabled} role="combobox" aria-autocomplete="list" aria-expanded={hasQuery && rooms.length > 0} aria-controls={hasQuery && rooms.length > 0 ? `${id}-list` : undefined} aria-activedescendant={index >= 0 ? `${id}-option-${index}` : undefined}
        value={term} placeholder="เลขห้อง ชื่อผู้รับ หรือเลขพัสดุ"
        onChange={(e) => { setTerm(e.target.value); setActive(-1); }}
        onKeyDown={(e) => {
          if (e.nativeEvent.isComposing) return;
          if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); setActive((n) => rooms.length ? Math.max(0, Math.min(rooms.length - 1, n < 0 ? (e.key === 'ArrowDown' ? 0 : rooms.length - 1) : n + (e.key === 'ArrowDown' ? 1 : -1))) : -1); }
          else if (e.key === 'Enter') { e.preventDefault(); if (index >= 0) choose(rooms[index]); else if (rooms.length === 1) choose(rooms[0]); else if (rooms.length) setActive(0); }
          else if (e.key === 'Escape' && (editing || term || index >= 0)) { e.preventDefault(); e.stopPropagation(); setTerm(''); setActive(-1); if (editing) { setEditing(false); } }
        }} />
      {term && <button type="button" className="icon-button" disabled={disabled} aria-label="ล้างคำค้นหาห้อง" onClick={() => { setTerm(''); setActive(-1); input.current?.focus(); }}><X size={16} aria-hidden="true" /></button>}
    </div>
    {hasQuery && <div className="room-picker-results">
    {hasQuery && rooms.length > 0 && <><p className="sr-only" role="status">พบ {rooms.length} ห้องที่มีพัสดุรอรับ</p><div ref={list} id={`${id}-list`} role="listbox" aria-label="เลือกห้องที่จะนำพัสดุออก" className="room-picker-list">{rooms.map((room, i) => <button type="button" disabled={disabled} tabIndex={0} id={`${id}-option-${i}`} key={room} role="option" aria-selected={i === index} className="room-picker-option" onPointerDown={(e) => e.preventDefault()} onFocus={() => setActive(i)} onClick={() => choose(room)}>
      <span className="room-picker-person"><strong>ห้อง {room}</strong><span>{roomText(room).replace(`${room} · `, '')}</span></span>
      <span className="room-picker-count">{roomInfo.get(room).count} รายการ</span><ChevronRight size={16} aria-hidden="true" />
    </button>)}</div></>}
    {hasQuery && !rooms.length && <p className="room-picker-empty" role="status">ไม่พบห้องที่มีพัสดุรอรับ ลองเปลี่ยนคำค้นหา</p>}
    </div>}
    </div>
  </div>;
}

function checkoutPageSize() {
  if (window.matchMedia('(min-width: 641px) and (min-height: 1100px)').matches) return 8;
  if (window.matchMedia('(min-height: 820px)').matches) return 4;
  return window.matchMedia('(min-height: 700px)').matches ? 3 : 2;
}

function CheckOutModal({ parcels, onClose, onConfirm, initialQuery = '' }) {
  const [room, setRoom] = useState('');
  const [roomEditing, setRoomEditing] = useState(false);
  const [scan, setScan] = useState('');
  const [selectedIds, setSelectedIds] = useState([]);
  const [feedback, setFeedback] = useState('');
  const [scanError, setScanError] = useState('');
  const [saveError, setSaveError] = useState('');
  const [confirmAll, setConfirmAll] = useState(false);
  const [nextRoom, setNextRoom] = useState(null);
  const [busy, setBusy] = useState(false);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(checkoutPageSize);
  const pageSizeRef = useRef(pageSize);
  const submitting = useRef(false);
  const scanner = useRef(null);
  const selectAllInput = useRef(null);
  const submitButton = useRef(null);
  const cancelAllButton = useRef(null);
  const wasConfirmingAll = useRef(false);
  const wasBusy = useRef(false);
  const confirmRoomButton = useRef(null);
  const confirmationId = useId();
  const saveErrorId = useId();
  const pending = parcels.filter((p) => p.status === 'in');
  const roomParcels = pending.filter((p) => p.room === room);
  const selected = roomParcels.filter((p) => selectedIds.includes(p.id));
  const allSelected = roomParcels.length > 0 && selected.length === roomParcels.length;
  const pageCount = Math.max(1, Math.ceil(roomParcels.length / pageSize));
  const currentPage = Math.min(page, pageCount - 1);
  const showingRoom = !!room && !roomEditing;
  const controlsDisabled = busy || nextRoom !== null || confirmAll;

  useEffect(() => {
    const adapt = () => {
      const next = checkoutPageSize();
      if (next !== pageSizeRef.current) { pageSizeRef.current = next; setPageSize(next); setPage(0); }
    };
    window.addEventListener('resize', adapt);
    return () => window.removeEventListener('resize', adapt);
  }, []);
  useEffect(() => { if (nextRoom !== null) confirmRoomButton.current?.focus(); }, [nextRoom]);
  useEffect(() => { if (room && !roomEditing && nextRoom === null) scanner.current?.focus(); }, [room, roomEditing, nextRoom]);
  useEffect(() => {
    if (selectAllInput.current) selectAllInput.current.indeterminate = selected.length > 0 && !allSelected;
  }, [selected.length, allSelected, showingRoom]);
  useEffect(() => {
    if (confirmAll) cancelAllButton.current?.focus();
    else if (wasConfirmingAll.current) submitButton.current?.focus();
    wasConfirmingAll.current = confirmAll;
  }, [confirmAll]);
  useEffect(() => {
    if (wasBusy.current && !busy) submitButton.current?.focus();
    wasBusy.current = busy;
  }, [busy]);

  const applyRoom = (value) => {
    setRoom(value); setSelectedIds([]); setScan(''); setScanError(''); setSaveError(''); setFeedback(''); setConfirmAll(false); setNextRoom(null); setPage(0);
  };
  const changeRoom = (value) => {
    if (value === room) return;
    if (selectedIds.length) setNextRoom(value);
    else applyRoom(value);
  };
  const submit = async () => {
    if (submitting.current || !selected.length) return;
    submitting.current = true; setBusy(true); setSaveError('');
    try {
      const result = await onConfirm(selected, room);
      if (!result?.ok) { setSaveError(result?.error || 'นำออกไม่สำเร็จ รายการที่เลือกยังคงอยู่ กรุณาลองใหม่'); setConfirmAll(false); }
    } catch { setSaveError('นำออกไม่สำเร็จ รายการที่เลือกยังคงอยู่ กรุณาลองใหม่'); setConfirmAll(false); }
    finally { submitting.current = false; setBusy(false); }
  };
  const acceptScan = (event) => {
    if (event.key !== 'Enter' || event.nativeEvent.isComposing || controlsDisabled) return;
    event.preventDefault();
    if (!scan.trim()) return;
    const result = scanResult(parcels, room, scan, selectedIds);
    setScanError(result.error || ''); setFeedback(result.message || ''); setSaveError('');
    if (result.parcel) {
      if (!result.repeated) setSelectedIds((ids) => ids.includes(result.parcel.id) ? ids : [...ids, result.parcel.id]);
      setPage(Math.floor(roomParcels.findIndex((p) => p.id === result.parcel.id) / pageSize));
      setScan('');
    }
  };
  const toggle = (id) => {
    if (controlsDisabled) return;
    setSaveError(''); setFeedback('');
    setSelectedIds((ids) => ids.includes(id) ? ids.filter((v) => v !== id) : [...ids, id]);
  };
  const footer = showingRoom && <fieldset disabled={busy || nextRoom !== null} className="checkout-footer-fields">
    <div className="checkout-footer-heading"><p role="status">เลือกแล้ว {selected.length} รายการ</p></div>
    <div className="checkout-confirmation-slot">
      {confirmAll && <div role="group" aria-labelledby={confirmationId} className="checkout-confirmation">
        <p id={confirmationId}>นำออกทั้งหมด {selected.length} รายการของห้อง {room}?</p>
        <button ref={cancelAllButton} type="button" disabled={busy} className="text-button" onClick={() => setConfirmAll(false)}>กลับไปเลือก</button>
      </div>}
      {saveError && <p id={saveErrorId} className="field-error" role="alert">{saveError}</p>}
    </div>
    <button ref={submitButton} disabled={busy || !selected.length} className="desk-button desk-button-primary checkout-submit"
      aria-describedby={saveError ? saveErrorId : confirmAll ? confirmationId : undefined}
      onClick={() => { if (allSelected && !confirmAll) { setSaveError(''); setConfirmAll(true); } else submit(); }}>
      {busy ? 'กำลังบันทึก…' : confirmAll ? `ยืนยันนำออกทั้งหมด (${selected.length})` : `นำออกที่เลือก (${selected.length})`}
    </button>
  </fieldset>;

  return <ModalShell title="นำพัสดุออกตามห้อง" icon={ScanLine} onClose={() => { if (!submitting.current) onClose(); }}
    className={`checkout-dialog${showingRoom ? ' checkout-dialog-selected' : ' checkout-dialog-picker'}`}
    style={{ '--checkout-row-count': Math.max(1, Math.min(pageSize, roomParcels.length)), '--checkout-page-space': pageCount > 1 ? '112px' : '0px' }} footer={footer}>
    <RoomPicker parcels={parcels} value={room} initialQuery={initialQuery} disabled={controlsDisabled} onChange={changeRoom} onEditingChange={setRoomEditing} />
    {nextRoom !== null && <div className="dialog-confirm" role="group" aria-label="ยืนยันเปลี่ยนห้อง">
      <p>เปลี่ยนเป็นห้อง {nextRoom} และยกเลิกพัสดุที่เลือกไว้ {selectedIds.length} รายการ?</p>
      <div className="desk-actions"><button className="desk-button" onClick={() => setNextRoom(null)}>ใช้ห้องเดิม</button><button ref={confirmRoomButton} className="desk-button desk-button-primary" onClick={() => applyRoom(nextRoom)}>ยืนยันเปลี่ยนห้อง</button></div>
    </div>}
    {showingRoom && <fieldset disabled={controlsDisabled} className="checkout-room-fields">
      <LabeledInput disabled={controlsDisabled} label="เลขพัสดุ" value={scan} error={scanError} feedback={feedback} reserveMessage inputRef={scanner}
        onPrepareScan={() => { scanner.current?.focus(); setFeedback('พร้อมรับรหัส'); }}
        onChange={(e) => { setScan(e.target.value); setScanError(''); setFeedback(''); }} onKeyDown={acceptScan} placeholder="สแกนหรือพิมพ์ แล้วกด Enter" />
      <div className="checkout-list-tools"><span>พัสดุรอรับ ({roomParcels.length})</span>
        <label className="checkout-select-all"><input ref={selectAllInput} type="checkbox" checked={allSelected} disabled={controlsDisabled || !roomParcels.length}
          onChange={(e) => { setSelectedIds(e.target.checked ? roomParcels.map((p) => p.id) : []); setSaveError(''); setFeedback(''); }} /><span>เลือกทั้งหมด</span></label>
      </div>
      {pageCount > 1 && <div className="checkout-pagination"><span>{currentPage * pageSize + 1}–{Math.min((currentPage + 1) * pageSize, roomParcels.length)} จาก {roomParcels.length}</span>
        <nav aria-label="หน้าพัสดุของห้อง"><button type="button" className="icon-button" disabled={controlsDisabled || currentPage === 0} aria-label="หน้าพัสดุก่อนหน้า" onClick={() => setPage(currentPage - 1)}><ChevronLeft size={18} aria-hidden="true" /></button>
          <span role="status">หน้า {currentPage + 1} / {pageCount}</span><button type="button" className="icon-button" disabled={controlsDisabled || currentPage === pageCount - 1} aria-label="หน้าพัสดุถัดไป" onClick={() => setPage(currentPage + 1)}><ChevronRight size={18} aria-hidden="true" /></button></nav>
      </div>}
      <div className="checkout-parcel-list">
        {!roomParcels.length && <p className="search-feedback" role="status">ห้อง {room} ไม่มีพัสดุรอรับ</p>}
        {roomParcels.slice(currentPage * pageSize, (currentPage + 1) * pageSize).map((p) => <label key={p.id} className="checkout-selection-row" data-selected={selectedIds.includes(p.id)}>
          <input type="checkbox" disabled={controlsDisabled} checked={selectedIds.includes(p.id)} onChange={() => toggle(p.id)} />
          <span><strong>{p.code}</strong>{p.damaged && <span className="condition-note">ชำรุด: {p.damageReason || 'ไม่ได้ระบุเหตุผล'}</span>}</span>
        </label>)}
      </div>
      {pageCount > 1 && <details className="checkout-selected-details"><summary>ดูรายการที่เลือก ({selected.length})</summary>
        {selected.length ? <ul>{selected.map((p) => <li key={p.id}><span>{p.code}</span><button disabled={controlsDisabled} type="button" className="icon-button" aria-label={`ยกเลิกเลือก ${p.code}`} onClick={() => toggle(p.id)}><X size={16} aria-hidden="true" /></button></li>)}</ul> : <p className="search-feedback">ยังไม่ได้เลือกพัสดุ</p>}
      </details>}
    </fieldset>}
  </ModalShell>;
}

function CheckInModal({ parcels, onClose, onSave, draft, onDraftChange }) {
  const { batch, form } = draft;
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState('');
  const [saveError, setSaveError] = useState('');
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);
  const codeField = useRef(null);
  const roomField = useRef(null);
  const reasonField = useRef(null);
  const listId = useId();
  const updateForm = (field, value) => {
    onDraftChange((d) => ({ ...d, form: { ...d.form, [field]: value } }));
    setErrors((e) => ({ ...e, [field]: '' })); setSaveError('');
  };
  const validate = () => {
    const next = entryErrors(form, parcels, batch); setErrors(next);
    if (next.room) roomField.current?.focus(); else if (next.code) codeField.current?.focus(); else if (next.damageReason) reasonField.current?.focus();
    return Object.keys(next).length === 0;
  };
  const entry = () => ({ code: form.code.trim(), room: form.room.trim(), damaged: form.damaged, damageReason: form.damaged ? form.damageReason.trim() : '' });
  const add = () => {
    if (busy || !validate()) return;
    const item = entry();
    onDraftChange((d) => ({ batch: [...d.batch, item], form: { ...emptyDraft().form, room: d.form.room } }));
    setMessage(`เพิ่ม ${item.code} ลงร่างแล้ว`);
    codeField.current?.focus();
  };
  const save = async () => {
    if (submitting.current) return;
    const hasCurrent = hasCurrentEntry(form);
    if (hasCurrent && !validate()) return;
    const all = hasCurrent ? [...batch, entry()] : batch;
    const error = validateBatch(all, parcels);
    if (error) { setSaveError(error); return; }
    submitting.current = true; setBusy(true); setSaveError('');
    try {
      const result = await onSave(all);
      if (!result?.ok) setSaveError(result?.error || 'บันทึกไม่สำเร็จ ร่างยังอยู่ กรุณาลองใหม่');
    } catch { setSaveError('บันทึกไม่สำเร็จ ร่างยังอยู่ กรุณาลองใหม่'); }
    finally { submitting.current = false; setBusy(false); }
  };
  return <ModalShell title="บันทึกพัสดุเข้า" icon={PackagePlus} onClose={() => { if (!submitting.current) onClose(); }}>
    <LabeledInput disabled={busy} label="เลขห้องจากทะเบียน" value={form.room} inputRef={roomField} onChange={(e) => updateForm('room', e.target.value)} placeholder="เลือกเลขห้องจากรายการ" list={listId} error={errors.room} autoFocus />
    <datalist id={listId}>{Object.entries(ROOM_DIRECTORY).map(([room, names]) => <option key={room} value={room}>{names.join(' / ')}</option>)}</datalist>
    {residentsFor(form.room.trim()).length > 0 && <div className="room-context"><strong>ห้อง {form.room.trim()}</strong><p>{residentsFor(form.room.trim()).join(' / ')}</p></div>}
    <LabeledInput disabled={busy} label="เลขพัสดุ" value={form.code} inputRef={codeField} onPrepareScan={() => {
      if (!residentsFor(form.room.trim()).length) { setErrors((e) => ({ ...e, room: "เลือกเลขห้องจากทะเบียนก่อนเตรียมสแกน" })); roomField.current?.focus(); return; }
      codeField.current?.focus(); setMessage("พร้อมรับรหัส");
    }} error={errors.code} onChange={(e) => updateForm('code', e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) { e.preventDefault(); add(); } }} placeholder="สแกนหรือพิมพ์ แล้วกด Enter" />
    <p className="search-feedback" role="status" aria-live="polite">{message}</p>
    <button disabled={busy} aria-pressed={form.damaged} onClick={() => updateForm('damaged', !form.damaged)} className="selection-row mb-3"><Check size={18} aria-hidden="true" style={{ visibility: form.damaged ? 'visible' : 'hidden' }} /><span>พัสดุชำรุด</span></button>
    {form.damaged && <div className="form-field"><label htmlFor="damage-reason">เหตุผลที่ชำรุด</label><textarea ref={reasonField} id="damage-reason" disabled={busy} value={form.damageReason} onChange={(e) => updateForm('damageReason', e.target.value)} rows={3} className="desk-textarea" aria-invalid={!!errors.damageReason} aria-describedby={errors.damageReason ? 'damage-reason-error' : undefined} />{errors.damageReason && <p id="damage-reason-error" role="alert" className="field-error">{errors.damageReason}</p>}</div>}
    <button disabled={busy} className="text-button" onClick={add}>เพิ่มลงร่าง</button>
    {batch.length > 0 && <div className="selected-summary"><p>ร่างที่ยังไม่บันทึก ({batch.length} รายการ)</p><ul>{batch.map((item, i) => <li key={item.code}><span>ห้อง {item.room} · {item.code}{item.damaged && <span className="condition-note">ชำรุด: {item.damageReason}</span>}</span><button disabled={busy} className="icon-button" aria-label={`ลบ ${item.code} จากร่าง`} onClick={() => onDraftChange((d) => ({ ...d, batch: d.batch.filter((_, index) => index !== i) }))}><X size={16} aria-hidden="true" /></button></li>)}</ul></div>}
    {saveError && <p className="field-error" role="alert">{saveError}</p>}
    <button disabled={busy || (!batch.length && !hasCurrentEntry(form))} onClick={save} className="desk-button desk-button-primary dialog-submit">{busy ? 'กำลังบันทึก…' : `บันทึกพัสดุเข้าทั้งหมด (${batch.length + (hasCurrentEntry(form) ? 1 : 0)} รายการ)`}</button>
  </ModalShell>;
}
export { ModalShell, CheckOutModal, CheckInModal, LabeledInput };
