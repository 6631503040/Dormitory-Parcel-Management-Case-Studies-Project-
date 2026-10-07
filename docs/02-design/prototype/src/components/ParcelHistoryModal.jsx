import React, { useEffect, useState } from "react";
import { History, PackagePlus, PackageCheck, MapPin } from "lucide-react";
import { C, bodyFont, roomLabel, formatThaiDateTime, StatusChip } from "./shared";
import { ModalShell, InlineError } from "./Modals";
import { api } from "../api/client";
import { errorMessage } from "../api/errorMessages";
import { unmatchedReasonLabel } from "../constants/unmatchedReasons";

const EVENT_META = {
  checked_in: { label: "รับเข้า", icon: PackagePlus, color: C.primary },
  room_assigned: { label: "ระบุห้อง", icon: MapPin, color: C.primary },
  checked_out: { label: "นำออก", icon: PackageCheck, color: C.success },
  checked_out_bulk: { label: "นำออก (ทั้งหมดของห้อง)", icon: PackageCheck, color: C.success },
  note_added: { label: "บันทึกหมายเหตุ", icon: History, color: C.textMuted },
};

// Chain of custody: who did what to this Parcel, and when (audit trail, append-only).
// Fetched fresh every time it opens — a Parcel's history can change between list refreshes.
export default function ParcelHistoryModal({ trackingCode, onClose }) {
  const [detail, setDetail] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setDetail(null);
    setError(null);
    api
      .getParcel(trackingCode)
      .then((d) => {
        if (!cancelled) setDetail(d);
      })
      .catch((err) => {
        if (!cancelled) setError(errorMessage(err));
      });
    return () => {
      cancelled = true;
    };
  }, [trackingCode]);

  return (
    <ModalShell title="ประวัติพัสดุ" icon={History} onClose={onClose}>
      <InlineError message={error} />
      {!detail && !error && <p className="text-sm py-6 text-center" style={{ ...bodyFont, color: C.textMuted }}>กำลังโหลด…</p>}
      {detail && (
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
              <StatusChip parcel={detail} />
            </div>
          </div>

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
