import React, { useCallback, useEffect, useRef, useState } from "react";
import { History, Pencil } from "lucide-react";
import { C, bodyFont, roomLabel, formatThaiDateTime, StatusChip } from "./shared";
import { ModalShell, InlineError, LabeledInput } from "./Modals";
import RoomCombobox from "./RoomCombobox";
import { api } from "../api/client";
import { errorMessage } from "../api/errorMessages";
import { unmatchedReasonLabel } from "../constants/unmatchedReasons";

const EVENT_LABELS = {
  checked_in: "รับเข้า",
  room_assigned: "ระบุห้อง",
  edited: "แก้ไขข้อมูล",
  checked_out: "นำออก",
  checked_out_bulk: "นำออก (ทั้งหมดของห้อง)",
  note_added: "บันทึกหมายเหตุ",
};
const HISTORY_PAGE_SIZE = 8;

const MAX_NOTE = 500;

// Each change of an `edited` event, as "field: before → after" (the audit detail keeps both values).
function editLines(detail) {
  const changes = detail?.changes || {};
  const lines = [];
  if (changes.trackingCode) lines.push(`เลขพัสดุ: ${changes.trackingCode.from} → ${changes.trackingCode.to}`);
  if (changes.room) lines.push(`ห้อง: ${changes.room.from?.label} → ${changes.room.to?.label}`);
  if (changes.note) lines.push(`หมายเหตุ: ${changes.note.from || "—"} → ${changes.note.to || "—"}`);
  return lines;
}

// Correct a Pending Parcel after Check-In (US-26). The room is still chosen from the directory,
// never typed; only the fields that actually changed are sent.
function EditParcelForm({ detail, onSaved, onCancel }) {
  const [code, setCode] = useState(detail.trackingCode);
  const [room, setRoom] = useState({ ...detail.room, residents: detail.residents });
  const [note, setNote] = useState(detail.note || "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const submittingRef = useRef(false);

  const changes = {};
  const trimmedCode = code.trim();
  if (trimmedCode && trimmedCode.toUpperCase() !== detail.trackingCode) changes.trackingCode = trimmedCode;
  if (room && room.id !== detail.room.id) changes.roomId = room.id;
  if (note.trim() !== (detail.note || "")) changes.note = note.trim();
  const canSave = !submitting && trimmedCode !== "" && room != null && Object.keys(changes).length > 0;

  const save = async (event) => {
    event?.preventDefault();
    if (!canSave || submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    setError(null);
    try {
      onSaved(await api.updateParcel(detail.trackingCode, changes));
    } catch (err) {
      setError(errorMessage(err));
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={save} aria-label="แก้ไขพัสดุ">
      <InlineError message={error} />
      <LabeledInput label="เลขพัสดุ" value={code} disabled={submitting} onChange={(e) => { setCode(e.target.value); setError(null); }} />
      <fieldset disabled={submitting} className="checkout-room-fields">
        <RoomCombobox label="เลขห้อง (เลือกจากรายชื่อผู้พัก)" value={room} onChange={(r) => { setRoom(r); setError(null); }} />
      </fieldset>
      <div className="form-field">
        <label htmlFor="edit-parcel-note">หมายเหตุ / รายละเอียดปัญหา (ไม่บังคับ)</label>
        <textarea id="edit-parcel-note" maxLength={MAX_NOTE} className="desk-textarea" rows={2} value={note} disabled={submitting}
          onChange={(e) => { setNote(e.target.value); setError(null); }} placeholder="เช่น ชำรุด: กล่องบุบ" />
      </div>
      <p className="text-xs mb-3" style={{ ...bodyFont, color: C.textMuted }}>การแก้ไขจะถูกบันทึกในประวัติพัสดุ พร้อมค่าเดิมและชื่อผู้แก้ไข</p>
      <div className="desk-actions">
        <button type="submit" disabled={!canSave} className="desk-button desk-button-primary">{submitting ? "กำลังบันทึก…" : "บันทึกการแก้ไข"}</button>
        <button type="button" disabled={submitting} onClick={onCancel} className="desk-button">ยกเลิก</button>
      </div>
    </form>
  );
}

// Chain of custody: who did what to this Parcel, and when (audit trail, append-only).
// Fetched fresh every time it opens — a Parcel's history can change between list refreshes.
// A Pending Parcel with a room can be edited here; Picked Up Parcels are handover evidence.
export default function ParcelHistoryModal({ trackingCode, onClose, onChanged }) {
  const [code, setCode] = useState(trackingCode);
  const [detail, setDetail] = useState(null);
  const [error, setError] = useState(null);
  const [editing, setEditing] = useState(false);
  const [page, setPage] = useState(1);

  // Follow the caller when it opens another Parcel; an edit that renames the code only changes `code`.
  useEffect(() => {
    setCode(trackingCode);
    setEditing(false);
  }, [trackingCode]);

  const load = useCallback((c, isCancelled = () => false) => {
    setError(null);
    api
      .getParcel(c)
      .then((d) => {
        if (!isCancelled()) setDetail(d);
      })
      .catch((err) => {
        if (!isCancelled()) setError(errorMessage(err));
      });
  }, []);

  useEffect(() => {
    let cancelled = false;
    setDetail(null);
    load(code, () => cancelled);
    return () => {
      cancelled = true;
    };
  }, [code, load]);

  useEffect(() => { setPage(1); }, [detail]);
  const pages = Math.max(1, Math.ceil((detail?.events.length || 0) / HISTORY_PAGE_SIZE));
  const currentPage = Math.min(page, pages);
  const editable = detail && detail.status === "pending" && detail.room;

  const handleSaved = (parcel) => {
    setEditing(false);
    onChanged?.();
    if (parcel.trackingCode !== code) setCode(parcel.trackingCode);
    else load(code);
  };

  return (
    <ModalShell title={editing ? "แก้ไขพัสดุ" : "ประวัติพัสดุ"} icon={editing ? Pencil : History} onClose={onClose} className="parcel-history-dialog">
      <InlineError message={error} />
      {!detail && !error && <p role="status" className="history-empty">กำลังโหลด…</p>}
      {detail && editing && <EditParcelForm detail={detail} onSaved={handleSaved} onCancel={() => setEditing(false)} />}
      {detail && !editing && (
        <>
          <section className="history-record" aria-label="ข้อมูลพัสดุ">
            <div className="history-record-heading">
              <h3>{detail.trackingCode}</h3>
              <StatusChip parcel={detail} />
            </div>
            <div className="history-record-recipient">
              <p className={!detail.room ? "history-problem" : undefined}>{roomLabel(detail)}</p>
              {editable && <button type="button" className="desk-button history-edit" onClick={() => setEditing(true)}><Pencil size={14} aria-hidden="true" />แก้ไข</button>}
            </div>
            {!detail.room && detail.unmatchedReason && <p className="history-problem">
              {unmatchedReasonLabel(detail.unmatchedReason)}{detail.note ? ` — ${detail.note}` : ""}
            </p>}
            {detail.room && detail.note && <dl className="history-note"><dt>หมายเหตุ</dt><dd data-damaged={detail.note.startsWith("ชำรุด:")}>{detail.note}</dd></dl>}
          </section>
          <section className="history-events" aria-label="ประวัติการดำเนินการ">
            <h3>ประวัติการดำเนินการ</h3>
            {detail.events.length === 0 ? <p className="history-empty">ไม่มีประวัติ</p> : <ol>
              {detail.events.slice((currentPage - 1) * HISTORY_PAGE_SIZE, currentPage * HISTORY_PAGE_SIZE).map((event) => <li key={event.id}>
                <div className="history-event-heading">
                  <p>{EVENT_LABELS[event.eventType] || event.eventType}</p>
                  <time dateTime={event.occurredAt}>{formatThaiDateTime(event.occurredAt)}</time>
                </div>
                <p className="history-event-staff">โดย {event.staff.fullName}</p>
                {event.eventType === "edited" && editLines(event.detail).map((line) => <p key={line} className="history-event-change">{line}</p>)}
              </li>)}
            </ol>}
            {pages > 1 && <nav className="history-pagination" aria-label="แบ่งหน้าประวัติพัสดุ">
              <button type="button" className="text-button" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>ก่อนหน้า</button>
              <span role="status">หน้า {currentPage} / {pages}</span>
              <button type="button" className="text-button" disabled={currentPage === pages} onClick={() => setPage(currentPage + 1)}>ถัดไป</button>
            </nav>}
          </section>
        </>
      )}
    </ModalShell>
  );
}
