import React, { useCallback, useEffect, useRef, useState } from "react";
import { History, PackagePlus, PackageCheck, MapPin, Pencil } from "lucide-react";
import { C, bodyFont, roomLabel, formatThaiDateTime, StatusChip } from "./shared";
import { ModalShell, InlineError, LabeledInput } from "./Modals";
import RoomCombobox from "./RoomCombobox";
import { api } from "../api/client";
import { errorMessage } from "../api/errorMessages";
import { unmatchedReasonLabel } from "../constants/unmatchedReasons";

const EVENT_META = {
  checked_in: { label: "รับเข้า", icon: PackagePlus, color: C.primary },
  room_assigned: { label: "ระบุห้อง", icon: MapPin, color: C.primary },
  edited: { label: "แก้ไขข้อมูล", icon: Pencil, color: C.primary },
  checked_out: { label: "นำออก", icon: PackageCheck, color: C.success },
  checked_out_bulk: { label: "นำออก (ทั้งหมดของห้อง)", icon: PackageCheck, color: C.success },
  note_added: { label: "บันทึกหมายเหตุ", icon: History, color: C.textMuted },
};

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

  const editable = detail && detail.status === "pending" && detail.room;

  const handleSaved = (parcel) => {
    setEditing(false);
    onChanged?.();
    if (parcel.trackingCode !== code) setCode(parcel.trackingCode);
    else load(code);
  };

  return (
    <ModalShell title={editing ? "แก้ไขพัสดุ" : "ประวัติพัสดุ"} icon={editing ? Pencil : History} onClose={onClose}>
      <InlineError message={error} />
      {!detail && !error && <p className="text-sm py-6 text-center" style={{ ...bodyFont, color: C.textMuted }}>กำลังโหลด…</p>}
      {detail && editing && <EditParcelForm detail={detail} onSaved={handleSaved} onCancel={() => setEditing(false)} />}
      {detail && !editing && (
        <>
          <div className="rounded-xl p-4 mb-5" style={{ background: C.bg }}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-base font-bold truncate" style={{ ...bodyFont, color: C.text }}>{detail.trackingCode}</p>
                <p className="text-sm mt-0.5" style={{ ...bodyFont, color: detail.room ? C.textMuted : C.warning }}>{roomLabel(detail)}</p>
                {!detail.room && detail.unmatchedReason && (
                  <p className="text-xs mt-1" style={{ ...bodyFont, color: C.warning }}>
                    {unmatchedReasonLabel(detail.unmatchedReason)}{detail.note ? ` — ${detail.note}` : ""}
                  </p>
                )}
              </div>
              <div className="flex flex-col items-end gap-2">
                <StatusChip parcel={detail} />
                {editable && (
                  <button type="button" className="desk-button" onClick={() => setEditing(true)}>
                    <Pencil size={15} aria-hidden="true" />แก้ไข
                  </button>
                )}
              </div>
            </div>
          </div>

          {detail.room && detail.note && <p className="condition-note mb-4">{detail.note}</p>}
          {detail.events.length === 0 ? (
            <p className="text-sm py-6 text-center" style={{ ...bodyFont, color: C.textMuted }}>ไม่มีประวัติ</p>
          ) : (
            <ol className="relative">
              {detail.events.map((event, i) => {
                const meta = EVENT_META[event.eventType] || { label: event.eventType, icon: History, color: C.textMuted };
                const Icon = meta.icon;
                const isLast = i === detail.events.length - 1;
                return (
                  <li key={event.id} className="flex gap-3.5">
                    <div className="flex flex-col items-center">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: C.primaryLight }}>
                        <Icon size={15} style={{ color: meta.color }} />
                      </div>
                      {!isLast && <div className="w-px flex-1 my-1" style={{ background: C.border }} />}
                    </div>
                    <div className={isLast ? "pb-0" : "pb-5"}>
                      <p className="text-sm font-semibold" style={{ ...bodyFont, color: C.text }}>{meta.label}</p>
                      <p className="text-xs mt-0.5" style={{ ...bodyFont, color: C.textMuted }}>
                        โดย {event.staff.fullName} · {formatThaiDateTime(event.occurredAt)}
                      </p>
                      {event.eventType === "edited" && editLines(event.detail).map((line) => (
                        <p key={line} className="text-xs mt-0.5" style={{ ...bodyFont, color: C.text }}>{line}</p>
                      ))}
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </>
      )}
    </ModalShell>
  );
}
