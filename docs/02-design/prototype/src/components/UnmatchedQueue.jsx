import React, { useState } from "react";
import { HelpCircle } from "lucide-react";
import { C, bodyFont, formatThaiDateTime, PagePagination } from "./shared";
import RoomCombobox from "./RoomCombobox";
import { InlineError } from "./Modals";
import { api, ApiError } from "../api/client";
import { errorMessage } from "../api/errorMessages";
import useParcelPage, { PARCEL_PAGE_SIZE } from "./useParcelPage";
import { unmatchedReasonLabel } from "../constants/unmatchedReasons";

// Parcels that arrived with no usable room wait here, tagged with why, oldest first (matches
// product_backlog.md US-06). Staff resolve one by choosing a room from the directory — the same
// rule as Check-In: a room is never typed as free text.
export default function UnmatchedQueue({ refreshKey, onOpenHistory, onChange }) {
  const [version, setVersion] = useState(0);
  const { items, total, page, setPage, loading, error } = useParcelPage({ query: "", status: "pending", unmatched: true, refreshKey: `${refreshKey}:${version}` });

  const [resolvingCode, setResolvingCode] = useState(null);
  const [resolveRoom, setResolveRoom] = useState(null);
  const [resolveError, setResolveError] = useState(null);
  const [resolving, setResolving] = useState(false);

  const startResolving = (code) => {
    setResolvingCode(code);
    setResolveRoom(null);
    setResolveError(null);
  };

  const confirmAssign = async (parcel) => {
    if (!resolveRoom) return;
    setResolving(true);
    setResolveError(null);
    try {
      await api.assignRoom(parcel.trackingCode, resolveRoom.id);
      setResolvingCode(null);
      setResolveRoom(null);
      setVersion((v) => v + 1);
      onChange?.();
    } catch (err) {
      setResolveError(errorMessage(err));
    } finally {
      setResolving(false);
    }
  };

  return (
    <details className="damage-section">
      <summary><HelpCircle size={18} aria-hidden="true" /><span className="section-title">พัสดุไม่ทราบห้อง</span><span className="section-count">{total} รายการ</span><span className="section-action">ดูรายการ</span></summary>
      <div className="unmatched-content">

      <InlineError message={error} />

      {loading ? (
        <p className="text-sm py-6 text-center" style={{ ...bodyFont, color: C.textMuted }}>กำลังโหลด…</p>
      ) : items.length === 0 ? (
        <p className="text-sm py-6 text-center" style={{ ...bodyFont, color: C.textMuted }}>ไม่มีพัสดุที่มีปัญหา</p>
      ) : (
        <div>
          {items.map((p, i) => (
            <div key={p.trackingCode} className="py-3" style={{ borderBottom: i < items.length - 1 ? `1px solid ${C.border}` : "none" }}>
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <button onClick={() => onOpenHistory(p)} className="min-w-0 text-left" title="ดูประวัติพัสดุ">
                  <p className="text-sm font-semibold truncate" style={{ ...bodyFont, color: C.text }}>{p.trackingCode}</p>
                  <p className="text-xs" style={{ ...bodyFont, color: C.warning }}>
                    {unmatchedReasonLabel(p.unmatchedReason) || "ไม่ระบุเหตุผล"}
                    <span style={{ color: C.textMuted }}> · รับเข้า {formatThaiDateTime(p.checkedInAt)}</span>
                  </p>
                  {p.note && <p className="text-xs" style={{ ...bodyFont, color: C.textMuted }}>หมายเหตุ: {p.note}</p>}
                </button>
                {resolvingCode !== p.trackingCode && (
                  <button onClick={() => startResolving(p.trackingCode)} className="px-3.5 py-2 rounded-lg text-sm font-semibold border-2 flex-shrink-0" style={{ ...bodyFont, borderColor: C.primary, color: C.primaryDark }}>
                    ระบุห้อง
                  </button>
                )}
              </div>
              {resolvingCode === p.trackingCode && (
                <div className="mt-3">
                  <InlineError message={resolveError} />
                  <div className="flex items-start gap-2.5 flex-wrap">
                    <div className="flex-1 min-w-[220px]">
                      <RoomCombobox compact autoFocus value={resolveRoom} onChange={setResolveRoom} />
                    </div>
                    <button disabled={!resolveRoom || resolving} onClick={() => confirmAssign(p)} className="px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-40" style={{ ...bodyFont, background: C.primary }}>
                      {resolving ? "กำลังบันทึก…" : "ยืนยันระบุห้อง"}
                    </button>
                    <button onClick={() => setResolvingCode(null)} className="px-3 py-2 rounded-lg text-sm font-medium" style={{ ...bodyFont, color: C.textMuted }}>
                      ยกเลิก
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
          <PagePagination page={page} total={total} pageSize={PARCEL_PAGE_SIZE} onChange={setPage} loading={loading} label="พัสดุไม่ทราบห้อง" />
        </div>
      )}
      </div>
    </details>
  );
}
