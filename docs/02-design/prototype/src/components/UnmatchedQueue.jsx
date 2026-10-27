import React, { useEffect, useState } from "react";
import { HelpCircle } from "lucide-react";
import { C, bodyFont, formatThaiDateTime } from "./shared";
import RoomCombobox from "./RoomCombobox";
import { InlineError } from "./Modals";
import { api, ApiError } from "../api/client";
import { errorMessage } from "../api/errorMessages";
import { unmatchedReasonLabel } from "../constants/unmatchedReasons";

const PAGE_SIZE = 5;

// Parcels that arrived with no usable room wait here, tagged with why, oldest first (matches
// product_backlog.md US-06). Staff resolve one by choosing a room from the directory — the same
// rule as Check-In: a room is never typed as free text.
export default function UnmatchedQueue({ refreshKey, onOpenHistory, onChange }) {
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const [version, setVersion] = useState(0);

  const [resolvingCode, setResolvingCode] = useState(null);
  const [resolveRoom, setResolveRoom] = useState(null);
  const [resolveError, setResolveError] = useState(null);
  const [resolving, setResolving] = useState(false);

  useEffect(() => {
    setPage(1);
    setItems([]);
  }, [refreshKey, version]);

  useEffect(() => {
    const controller = new AbortController();
    (page === 1 ? setLoading : setLoadingMore)(true);
    setError(null);
    api
      .listParcels({ unmatched: true, status: "pending", page, pageSize: PAGE_SIZE }, controller.signal)
      .then((res) => {
        setItems((prev) => (page === 1 ? res.items : [...prev, ...res.items]));
        setTotal(res.total);
        setLoading(false);
        setLoadingMore(false);
      })
      .catch((err) => {
        if (err instanceof ApiError) {
          setError(errorMessage(err));
          setLoading(false);
          setLoadingMore(false);
        }
      });
    return () => controller.abort();
  }, [page, refreshKey, version]);

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
    <div className="rounded-2xl border p-5" style={{ background: C.card, borderColor: C.border }}>
      <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: C.warningLight }}>
            <HelpCircle size={17} style={{ color: C.warning }} />
          </div>
          <div>
            <p className="text-sm font-semibold" style={{ ...bodyFont, color: C.text }}>พัสดุมีปัญหา</p>
            <p className="text-xs" style={{ ...bodyFont, color: C.textMuted }}>รอเจ้าหน้าที่ตรวจสอบ เรียงจากเก่าสุด</p>
          </div>
        </div>
        {total > 0 && (
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full flex-shrink-0" style={{ background: C.warningLight, color: C.warning, ...bodyFont }}>
            มีปัญหา {total} รายการ
          </span>
        )}
      </div>

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
          {items.length < total && (
            <button disabled={loadingMore} onClick={() => setPage((p) => p + 1)} className="mt-2 text-sm font-semibold px-3 py-1.5 rounded-lg hover:bg-gray-50 disabled:opacity-50" style={{ ...bodyFont, color: C.primaryDark }}>
              {loadingMore ? "กำลังโหลด…" : `แสดงเพิ่ม (${total - items.length} รายการ)`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
