import React, { useEffect, useId, useRef, useState } from "react";
import { X, ScanLine, PackagePlus, ChevronLeft, ChevronRight } from "lucide-react";
import { C, roomLabel, formatThaiDateTime } from "./shared";
import { ROOM_DIRECTORY, residentsFor, key, checkoutLookup, validateCheckOut, emptyDraft, hasCurrentEntry, entryErrors, validateBatch } from "../lib/parcelRules";

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

function checkoutPageSize() {
  if (window.matchMedia('(min-width: 641px) and (min-height: 1100px)').matches) return 8;
  if (window.matchMedia('(min-height: 820px)').matches) return 4;
  return window.matchMedia('(min-height: 700px)').matches ? 3 : 2;
}

function CheckOutModal({ parcels, onClose, onConfirm }) {
  const [scan, setScan] = useState('');
  const [parcelId, setParcelId] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);
  const [scanError, setScanError] = useState('');
  const [feedback, setFeedback] = useState('');
  const [saveError, setSaveError] = useState('');
  const [confirmAll, setConfirmAll] = useState(false);
  const [busy, setBusy] = useState(false);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(checkoutPageSize);
  const submitting = useRef(false);
  const scanner = useRef(null);
  const selectAllInput = useRef(null);
  const submitButton = useRef(null);
  const cancelAllButton = useRef(null);
  const wasConfirmingAll = useRef(false);
  const wasBusy = useRef(false);
  const confirmationId = useId();
  const saveErrorId = useId();
  const parcel = parcels.find((p) => p.id === parcelId);
  const roomParcels = parcel ? parcels.filter((p) => p.status === 'in' && p.room === parcel.room) : [];
  const others = roomParcels.filter((p) => p.id !== parcelId);
  const selected = roomParcels.filter((p) => selectedIds.includes(p.id));
  const allSelected = others.length > 0 && selected.length === roomParcels.length;
  const verified = !!parcel && parcel.status === 'in' && key(scan) === key(parcel.code) && !scanError;
  const disabled = busy || confirmAll || !verified;
  const pageCount = Math.max(1, Math.ceil(others.length / pageSize));
  const currentPage = Math.min(page, pageCount - 1);

  useEffect(() => {
    const adapt = () => setPageSize(checkoutPageSize());
    window.addEventListener('resize', adapt);
    return () => window.removeEventListener('resize', adapt);
  }, []);
  useEffect(() => {
    if (selectAllInput.current) selectAllInput.current.indeterminate = selected.length > 1 && !allSelected;
  }, [selected.length, allSelected]);
  useEffect(() => {
    if (confirmAll) cancelAllButton.current?.focus();
    else if (wasConfirmingAll.current) submitButton.current?.focus();
    wasConfirmingAll.current = confirmAll;
  }, [confirmAll]);
  useEffect(() => {
    if (wasBusy.current && !busy) submitButton.current?.focus();
    wasBusy.current = busy;
  }, [busy]);

  const lookup = (event) => {
    event.preventDefault();
    if (submitting.current || confirmAll || event.nativeEvent?.isComposing) return;
    const result = checkoutLookup(parcels, scan);
    setScanError(result.error || ''); setSaveError(''); setFeedback('');
    setParcelId(result.parcel?.id ?? null);
    setSelectedIds(result.parcel ? [result.parcel.id] : []);
    setPage(0); setConfirmAll(false);
    if (result.parcel) {
      setScan(result.parcel.code);
      setFeedback(`พบพัสดุ ห้อง ${result.parcel.room}`);
    }
    scanner.current?.focus(); scanner.current?.select();
  };
  const submit = async () => {
    if (submitting.current || !verified || !selected.length) return;
    const error = validateCheckOut(parcels, selectedIds, parcel.room);
    if (error) { setSaveError(error); setConfirmAll(false); return; }
    submitting.current = true; setBusy(true); setSaveError('');
    try {
      const result = await onConfirm(selected, parcel.room);
      if (!result?.ok) { setSaveError(result?.error || 'นำออกไม่สำเร็จ รายการยังคงอยู่ กรุณาลองใหม่'); setConfirmAll(false); }
    } catch { setSaveError('นำออกไม่สำเร็จ รายการยังคงอยู่ กรุณาลองใหม่'); setConfirmAll(false); }
    finally { submitting.current = false; setBusy(false); }
  };
  const footer = parcel && <fieldset disabled={busy} className="checkout-footer-fields">
    <div className="checkout-footer-heading"><p role="status">นำออก {selected.length} รายการ · ห้อง {parcel.room}</p></div>
    <div className="checkout-confirmation-slot">
      {confirmAll && <div role="group" aria-labelledby={confirmationId} className="checkout-confirmation">
        <p id={confirmationId}>นำออกทั้งหมด {selected.length} รายการของห้อง {parcel.room}?</p>
        <button ref={cancelAllButton} type="button" className="text-button" onClick={() => setConfirmAll(false)}>กลับไปตรวจสอบ</button>
      </div>}
      {saveError && <p id={saveErrorId} className="field-error" role="alert">{saveError}</p>}
    </div>
    <button ref={submitButton} type="button" disabled={busy || !verified || !selected.length} className="desk-button desk-button-primary checkout-submit"
      aria-describedby={saveError ? saveErrorId : confirmAll ? confirmationId : undefined}
      onClick={() => { if (allSelected && !confirmAll) { setSaveError(''); setConfirmAll(true); } else submit(); }}>
      {busy ? 'กำลังบันทึก…' : confirmAll ? `ยืนยันนำออกทั้งหมด (${selected.length})` : selected.length > 1 ? `ยืนยันนำพัสดุออก (${selected.length})` : 'ยืนยันนำพัสดุออก'}
    </button>
  </fieldset>;

  return <ModalShell title="นำพัสดุออก" icon={ScanLine} onClose={() => { if (!submitting.current) onClose(); }} className="checkout-dialog checkout-scan-dialog" footer={footer}>
    <form onSubmit={lookup} className="checkout-lookup" aria-busy={busy}>
      <LabeledInput label="สแกนหรือกรอกเลขพัสดุ" value={scan} error={scanError} feedback={feedback} reserveMessage inputRef={scanner} disabled={busy || confirmAll}
        onPrepareScan={() => { scanner.current?.focus(); scanner.current?.select(); setFeedback('พร้อมรับรหัส'); }}
        onChange={(event) => { setScan(event.target.value); setScanError(''); setSaveError(''); setFeedback(parcel ? 'กดค้นหาเพื่อตรวจรหัสใหม่' : ''); }}
        onKeyDown={(event) => { if (event.key === 'Enter' && event.nativeEvent.isComposing) event.preventDefault(); }} placeholder="สแกนหรือพิมพ์ แล้วกด Enter" />
      <button type="submit" disabled={busy || confirmAll} className="desk-button checkout-lookup-button">ค้นหาพัสดุ</button>
    </form>
    {parcel && <section className="checkout-parcel-detail" aria-label="ข้อมูลพัสดุที่ค้นพบ" aria-busy={busy}>
      <div className="checkout-detail-heading"><h3>{parcel.code}</h3><span className="parcel-status parcel-status-pending"><span className="pending-dot" aria-hidden="true" />{parcel.status === 'in' ? 'รอรับ' : 'นำออกแล้ว'}</span></div>
      <div className="checkout-recipient"><strong>ห้อง {parcel.room}</strong><p>{roomLabel(parcel).replace(`${parcel.room} · `, '')}</p></div>
      <dl className="checkout-detail-meta"><div><dt>จำนวน</dt><dd>{parcel.qty} ชิ้น</dd></div><div><dt>วันที่รับเข้า</dt><dd>{formatThaiDateTime(parcel.receivedAt)}</dd></div></dl>
      {parcel.damaged && <div className="checkout-condition"><strong>พัสดุชำรุด</strong><p>{parcel.damageReason || 'ไม่ได้ระบุเหตุผล'}</p></div>}
      {!!others.length && <details key={parcel.id} className="checkout-other-parcels">
        <summary>พัสดุอื่นของห้องนี้ ({others.length})</summary>
        <fieldset disabled={disabled} className="checkout-room-fields">
          <div className="checkout-list-tools"><span>เลือกเพิ่ม</span><label className="checkout-select-all"><input ref={selectAllInput} type="checkbox" checked={allSelected} onChange={(event) => { setSelectedIds(event.target.checked ? roomParcels.map((p) => p.id) : [parcel.id]); setSaveError(''); }} /><span>เลือกเพิ่มทั้งหมด</span></label></div>
          {pageCount > 1 && <div className="checkout-pagination"><span>{currentPage * pageSize + 1}–{Math.min((currentPage + 1) * pageSize, others.length)} จาก {others.length}</span><nav aria-label="หน้าพัสดุอื่นของห้อง"><button type="button" className="icon-button" disabled={disabled || currentPage === 0} aria-label="หน้าพัสดุก่อนหน้า" onClick={() => setPage(currentPage - 1)}><ChevronLeft size={18} aria-hidden="true" /></button><span role="status">หน้า {currentPage + 1} / {pageCount}</span><button type="button" className="icon-button" disabled={disabled || currentPage === pageCount - 1} aria-label="หน้าพัสดุถัดไป" onClick={() => setPage(currentPage + 1)}><ChevronRight size={18} aria-hidden="true" /></button></nav></div>}
          <div className="checkout-parcel-list" style={{ '--checkout-row-count': Math.min(pageSize, others.length) }}>
            {others.slice(currentPage * pageSize, (currentPage + 1) * pageSize).map((p) => <label key={p.id} className="checkout-selection-row" data-selected={selectedIds.includes(p.id)}><input type="checkbox" checked={selectedIds.includes(p.id)} onChange={() => { setSelectedIds((ids) => ids.includes(p.id) ? ids.filter((id) => id !== p.id) : [...ids, p.id]); setSaveError(''); }} /><span><strong>{p.code}</strong><span className="checkout-row-qty">{p.qty} ชิ้น</span>{p.damaged && <span className="condition-note">ชำรุด: {p.damageReason || 'ไม่ได้ระบุเหตุผล'}</span>}</span></label>)}
          </div>
        </fieldset>
      </details>}
    </section>}
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
    <label className="intake-condition"><input type="checkbox" disabled={busy} checked={form.damaged} onChange={(event) => updateForm('damaged', event.target.checked)} /><span>พัสดุชำรุด</span></label>
    {form.damaged && <div className="form-field"><label htmlFor="damage-reason">เหตุผลที่ชำรุด</label><textarea ref={reasonField} id="damage-reason" disabled={busy} value={form.damageReason} onChange={(e) => updateForm('damageReason', e.target.value)} rows={3} className="desk-textarea" aria-invalid={!!errors.damageReason} aria-describedby={errors.damageReason ? 'damage-reason-error' : undefined} />{errors.damageReason && <p id="damage-reason-error" role="alert" className="field-error">{errors.damageReason}</p>}</div>}
    <button disabled={busy} className="text-button" onClick={add}>เพิ่มลงร่าง</button>
    {batch.length > 0 && <div className="selected-summary"><p>ร่างที่ยังไม่บันทึก ({batch.length} รายการ)</p><ul>{batch.map((item, i) => <li key={item.code}><span>ห้อง {item.room} · {item.code}{item.damaged && <span className="condition-note">ชำรุด: {item.damageReason}</span>}</span><button disabled={busy} className="icon-button" aria-label={`ลบ ${item.code} จากร่าง`} onClick={() => onDraftChange((d) => ({ ...d, batch: d.batch.filter((_, index) => index !== i) }))}><X size={16} aria-hidden="true" /></button></li>)}</ul></div>}
    {saveError && <p className="field-error" role="alert">{saveError}</p>}
    <button disabled={busy || (!batch.length && !hasCurrentEntry(form))} onClick={save} className="desk-button desk-button-primary dialog-submit">{busy ? 'กำลังบันทึก…' : `บันทึกพัสดุเข้าทั้งหมด (${batch.length + (hasCurrentEntry(form) ? 1 : 0)} รายการ)`}</button>
  </ModalShell>;
}
export { ModalShell, CheckOutModal, CheckInModal, LabeledInput };
