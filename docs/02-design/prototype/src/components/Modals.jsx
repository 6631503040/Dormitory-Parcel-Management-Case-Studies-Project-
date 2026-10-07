import React, { useEffect, useId, useRef, useState } from "react";
import { X, ScanLine, PackagePlus, PackageCheck } from "lucide-react";
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
    dialogRef.current?.querySelector("input")?.focus();
    const onKey = (e) => {
      // A child (e.g. the room dropdown) that already handled Escape calls preventDefault.
      if (e.key === "Escape" && !e.defaultPrevented) closeRef.current();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      opener?.focus();
    };
  }, []);
  return (
    <div className="dialog-overlay">
      <div className="dialog-backdrop" onClick={() => closeRef.current()} aria-hidden="true" />
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby={titleId} className={`desk-dialog ${className}`}>
        <div className="dialog-header">
          <div className="flex items-center gap-2.5">
            <Icon size={18} aria-hidden="true" />
            <h2 id={titleId}>{title}</h2>
          </div>
          <button onClick={onClose} className="icon-button" aria-label="ปิด">
            <X size={18} style={{ color: C.textMuted }} />
          </button>
        </div>
        <div className="dialog-content">{children}</div>
        {footer && <div className="dialog-footer">{footer}</div>}
      </div>
    </div>
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

const MATCH_PAGE_SIZE = 50;

function CheckOutModal({ onClose, onConfirm }) {
  const [scan, setScan] = useState("");
  const [selected, setSelected] = useState(new Map()); // trackingCode -> Parcel
  const [matches, setMatches] = useState([]);
  const [matchesTotal, setMatchesTotal] = useState(0);
  const [searching, setSearching] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [confirmAll, setConfirmAll] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const scanRef = useRef(null);
  const debounceRef = useRef(null);
  const abortRef = useRef(null);

  const runSearch = (query) => {
    clearTimeout(debounceRef.current);
    abortRef.current?.abort();
    const q = query.trim();
    if (!q) {
      setMatches([]);
      setMatchesTotal(0);
      setSearching(false);
      setNotFound(false);
      return;
    }
    setSearching(true);
    const controller = new AbortController();
    abortRef.current = controller;
    api
      .listParcels({ q, status: "pending", pageSize: MATCH_PAGE_SIZE }, controller.signal)
      .then((res) => {
        setSearching(false);
        setNotFound(res.items.length === 0);
        const exact = res.items.find((p) => p.trackingCode === q.toUpperCase());
        if (exact) {
          setSelected((prev) => new Map(prev).set(exact.trackingCode, exact));
          setScan("");
          setMatches([]);
          setMatchesTotal(0);
          setNotFound(false);
          return;
        }
        setMatches(res.items);
        setMatchesTotal(res.total);
      })
      .catch((err) => {
        if (err instanceof ApiError) {
          setSearching(false);
          setError(errorMessage(err));
        }
      });
  };

  const handleScanChange = (e) => {
    const next = e.target.value;
    setScan(next);
    setConfirmAll(false);
    setError(null);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => runSearch(next), 200);
  };

  const handleScanKeyDown = (e) => {
    if (e.key === "Enter") runSearch(scan);
  };

  useEffect(() => () => {
    clearTimeout(debounceRef.current);
    abortRef.current?.abort();
  }, []);

  const toggleSelect = (parcel) => {
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(parcel.trackingCode)) next.delete(parcel.trackingCode);
      else next.set(parcel.trackingCode, parcel);
      return next;
    });
  };

  const selectedParcels = Array.from(selected.values());
  const visibleMatches = matches.filter((p) => !selected.has(p.trackingCode));
  const visible = [...selectedParcels, ...visibleMatches].slice(0, MATCH_PAGE_SIZE);
  const hiddenCount = selectedParcels.length + visibleMatches.length - visible.length;

  // "Check Out All" needs one unambiguous room and the *complete* pending list for it — otherwise
  // expectedCount would be wrong and the confirm dialog would promise a number that isn't real.
  const singleRoomId = matches.length > 0 && matches.every((p) => p.room?.id === matches[0].room?.id) ? matches[0].room.id : null;
  const hasFullRoomList = matches.length === matchesTotal;
  const canCheckOutAll = singleRoomId != null && hasFullRoomList && matches.length > 0;

  const finish = (parcels) => {
    setSubmitting(false);
    onConfirm(parcels);
  };

  const submitSelected = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const res = await api.checkOut(selectedParcels.map((p) => p.trackingCode));
      finish(res.parcels);
    } catch (err) {
      setSubmitting(false);
      setError(errorMessage(err));
      if (err instanceof ApiError && (err.code === "PARCEL_NOT_PENDING" || err.code === "PARCEL_NOT_FOUND")) {
        // Someone else already acted on some of these — drop them and let staff try what's left.
        const stale = new Set(err.params?.trackingCodes || []);
        setSelected((prev) => {
          const next = new Map(prev);
          stale.forEach((code) => next.delete(code));
          return next;
        });
        if (scan.trim()) runSearch(scan);
      }
    }
  };

  const submitAll = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const res = await api.checkOutAll(singleRoomId, matches.length);
      setConfirmAll(false);
      finish(res.parcels);
    } catch (err) {
      setSubmitting(false);
      setConfirmAll(false);
      setError(errorMessage(err));
      runSearch(scan);
    }
  };

  const footer = (
    <fieldset disabled={submitting} className="checkout-footer-fields">
      <div className="checkout-footer-heading">
        <p role="status">
          {scan.trim() ? `พัสดุที่รอนำออกของ "${scan.trim()}" (${matches.length}${hasFullRoomList ? "" : `+ จาก ${matchesTotal}`})` : `สแกนแล้ว (${selectedParcels.length})`}
        </p>
      </div>
      <div className="checkout-confirmation-slot">
        {confirmAll && (
          <div className="checkout-confirmation">
            <p>นำพัสดุออกทั้งหมด {matches.length} ชิ้นของห้อง {matches[0]?.room?.buildingCode}{matches[0]?.room?.roomNumber} ใช่หรือไม่?</p>
            <button type="button" className="text-button" onClick={() => setConfirmAll(false)}>กลับไปตรวจสอบ</button>
          </div>
        )}
        <InlineError message={error} />
      </div>
      <div className="desk-actions">
        <button type="button" className="desk-button desk-button-in" disabled={!canCheckOutAll || submitting} onClick={() => setConfirmAll(true)}>
          นำออกทั้งหมด{matches.length > 0 ? ` (${matches.length})` : ""}
        </button>
        <button type="button" className="desk-button desk-button-primary checkout-submit" disabled={submitting || (confirmAll ? false : selectedParcels.length === 0)}
          onClick={() => (confirmAll ? submitAll() : submitSelected())}>
          {submitting ? "กำลังนำออก…" : confirmAll ? `ยืนยันนำออก ${matches.length} ชิ้น` : `นำออกที่เลือก${selectedParcels.length > 0 ? ` (${selectedParcels.length})` : ""}`}
        </button>
      </div>
    </fieldset>
  );

  return (
    <ModalShell title="นำพัสดุออก" icon={PackageCheck} onClose={() => { if (!submitting) onClose(); }} className="checkout-dialog" footer={footer}>
      <LabeledInput
        label="สแกนเลขพัสดุ หรือพิมพ์เลขห้อง / ชื่อผู้พัก"
        value={scan}
        inputRef={scanRef}
        autoFocus
        disabled={submitting || confirmAll}
        error={notFound ? "ไม่พบพัสดุที่รอนำออกตรงกับคำค้นหา" : ""}
        feedback="สแกนต่อเนื่องได้หลายชิ้น หรือพิมพ์เลขห้องเพื่อดูพัสดุที่ค้างของห้องนั้นทั้งหมด"
        reserveMessage
        onChange={handleScanChange}
        onKeyDown={handleScanKeyDown}
        placeholder="เช่น 101 หรือ TH8827301923"
      />

      <div className="checkout-parcel-list" style={{ maxHeight: 260, overflowY: "auto" }}>
        {searching && <p className="search-feedback" role="status">กำลังค้นหา…</p>}
        {!searching && visible.length === 0 && (
          <p className="search-feedback" role="status">
            {scan.trim() ? "ไม่พบพัสดุที่ตรงกับคำค้นหา" : "พิมพ์เลขห้อง ชื่อผู้พัก หรือสแกนเลขพัสดุ เพื่อแสดงรายการที่รอรับ"}
          </p>
        )}
        {!searching && visible.map((p) => {
          const checked = selected.has(p.trackingCode);
          return (
            <label key={p.trackingCode} className="checkout-selection-row" data-selected={checked}>
              <input type="checkbox" checked={checked} disabled={confirmAll || submitting} onChange={() => toggleSelect(p)} />
              <span>
                <strong>{roomLabel(p)}</strong>
                <span className="checkout-row-qty">{p.trackingCode} · รับเข้า {formatThaiDateTime(p.checkedInAt)}</span>
              </span>
            </label>
          );
        })}
      </div>
      {hiddenCount > 0 && <p className="search-feedback" role="status">แสดง {MATCH_PAGE_SIZE} รายการแรก — พิมพ์เพิ่มเพื่อกรอง</p>}
      {matches.length > 0 && !canCheckOutAll && !confirmAll && (
        <p className="search-feedback" role="status">&quot;นำออกทั้งหมด&quot; ใช้ได้เมื่อผลลัพธ์อยู่ห้องเดียวกันและแสดงครบทุกรายการเท่านั้น — ใช้ &quot;นำออกที่เลือก&quot; แทน</p>
      )}
    </ModalShell>
  );
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
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [checkedIn, setCheckedIn] = useState([]); // this session's running list, newest first
  const codeRef = useRef(null);
  const roomRef = useRef(null);

  const resetFields = () => {
    setCode("");
    setRoom(null);
    setUnmatched(false);
    setNote("");
  };

  const canSubmit = code.trim() !== "" && (unmatched || room) && !submitting;

  const submit = async () => {
    if (!canSubmit) return;
    const trimmed = code.trim();
    const input = unmatched
      ? { trackingCode: trimmed, unmatchedReason: UNMATCHED_REASON_DEFAULT, note: note.trim() || undefined }
      : { trackingCode: trimmed, roomId: room.id };
    setSubmitting(true);
    setError(null);
    try {
      const parcel = await api.checkIn(input);
      setCheckedIn((list) => [parcel, ...list]);
      resetFields();
      setSubmitting(false);
      // The code field must not be `disabled` (from `submitting`) when this runs, or the browser
      // silently ignores the focus call.
      codeRef.current?.focus();
      return;
    } catch (err) {
      setError(errorMessage(err));
    }
    setSubmitting(false);
  };

  const handleCodeKeyDown = (e) => {
    if (e.key !== "Enter") return;
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
    <ModalShell title="บันทึกพัสดุเข้า" icon={PackagePlus} onClose={() => { if (!submitting) onClose(); }} footer={footer}>
      <LabeledInput
        label="เลขพัสดุ (สแกนแล้วกด Enter)"
        value={code}
        inputRef={codeRef}
        autoFocus
        onChange={(e) => { setCode(e.target.value); setError(null); }}
        onKeyDown={handleCodeKeyDown}
        placeholder="เช่น TH8827301923"
      />

      <InlineError message={error} />

      {!unmatched && (
        <RoomCombobox ref={roomRef} label="เลขห้อง (เลือกจากรายชื่อผู้พัก)" value={room} onChange={setRoom} />
      )}

      <label className="intake-condition">
        <input type="checkbox" checked={unmatched} onChange={toggleUnmatched} disabled={submitting} />
        <span>พัสดุมีปัญหา (เช่น ไม่มีเลขห้อง ลายมืออ่านไม่ออก ชื่อเล่นไม่ตรงกับทะเบียน)</span>
      </label>

      {unmatched && (
        <div className="form-field">
          <label htmlFor="checkin-note">หมายเหตุ (ไม่บังคับ)</label>
          <textarea id="checkin-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="หมายเหตุ (ไม่บังคับ) เช่น ชื่อบนกล่อง 'แนน'" rows={2} className="desk-textarea" disabled={submitting} />
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
