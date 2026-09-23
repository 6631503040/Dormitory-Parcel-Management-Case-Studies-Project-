import React, { useEffect, useId, useRef, useState } from "react";
import { X, ScanLine, PackagePlus, PackageCheck, AlertTriangle } from "lucide-react";
import { C, bodyFont, displayFont, roomLabel, formatThaiDateTime } from "./shared";
import RoomCombobox from "./RoomCombobox";
import { api, ApiError } from "../api/client";
import { errorMessage } from "../api/errorMessages";

function ModalShell({ title, icon: Icon, onClose, children }) {
  const titleId = useId();

  useEffect(() => {
    const onKey = (e) => {
      // A child (e.g. the room dropdown) that already handled Escape calls preventDefault.
      if (e.key === "Escape" && !e.defaultPrevented) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div role="dialog" aria-modal="true" aria-labelledby={titleId} className="relative w-full max-w-lg rounded-2xl shadow-2xl" style={{ background: C.card }}>
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: C.border }}>
          <div className="flex items-center gap-2.5">
            <Icon size={18} style={{ color: C.primary }} />
            <h3 id={titleId} className="font-semibold" style={{ ...displayFont, color: C.text }}>{title}</h3>
          </div>
          <button onClick={onClose} aria-label="ปิด" className="p-1 rounded-lg hover:bg-gray-100">
            <X size={18} style={{ color: C.textMuted }} />
          </button>
        </div>
        <div className="p-5 max-h-[80vh] overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

function InlineError({ message }) {
  if (!message) return null;
  return (
    <p className="text-xs mb-3 flex items-start gap-1.5" style={{ ...bodyFont, color: C.warning }}>
      <AlertTriangle size={13} className="flex-shrink-0 mt-0.5" />
      <span>{message}</span>
    </p>
  );
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

  return (
    <ModalShell title="นำพัสดุออก" icon={PackageCheck} onClose={onClose}>
      <label htmlFor="checkout-search" className="block text-xs font-medium mb-2" style={{ ...bodyFont, color: C.textMuted }}>สแกนเลขพัสดุ หรือพิมพ์เลขห้อง / ชื่อผู้พัก</label>
      <div className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border mb-1 focus-within:ring-2 focus-within:ring-blue-300" style={{ borderColor: notFound ? C.warning : C.border }}>
        <ScanLine size={16} style={{ color: C.textMuted }} />
        <input id="checkout-search" autoFocus value={scan} onChange={handleScanChange} onKeyDown={handleScanKeyDown} placeholder="เช่น 101 หรือ TH8827301923" className="w-full outline-none text-sm bg-transparent" style={bodyFont} />
      </div>
      {notFound ? (
        <p className="text-xs mb-3" style={{ ...bodyFont, color: C.warning }}>ไม่พบพัสดุที่รอนำออกตรงกับคำค้นหา</p>
      ) : (
        <p className="text-xs mb-3" style={{ ...bodyFont, color: C.textMuted }}>สแกนต่อเนื่องได้หลายชิ้น หรือพิมพ์เลขห้องเพื่อดูพัสดุที่ค้างของห้องนั้นทั้งหมด</p>
      )}

      <InlineError message={error} />

      <p className="text-xs font-medium mb-2" style={{ ...bodyFont, color: C.textMuted }}>
        {scan.trim() ? `พัสดุที่รอนำออกของ "${scan.trim()}" (${matches.length}${hasFullRoomList ? "" : `+ จาก ${matchesTotal}`})` : `สแกนแล้ว (${selectedParcels.length})`}
      </p>

      <div className="max-h-56 overflow-y-auto -mx-1 px-1 space-y-1.5 mb-4">
        {searching && <p className="text-sm py-6 text-center" style={{ ...bodyFont, color: C.textMuted }}>กำลังค้นหา…</p>}
        {!searching && visible.length === 0 && (
          <p className="text-sm py-6 text-center" style={{ ...bodyFont, color: C.textMuted }}>
            {scan.trim() ? "ไม่พบพัสดุที่ตรงกับคำค้นหา" : "พิมพ์เลขห้อง ชื่อผู้พัก หรือสแกนเลขพัสดุ เพื่อแสดงรายการที่รอรับ"}
          </p>
        )}
        {!searching && visible.map((p) => {
          const checked = selected.has(p.trackingCode);
          return (
            <label key={p.trackingCode} className="flex items-center gap-3 px-3.5 py-3 rounded-xl border cursor-pointer transition-colors" style={{ borderColor: checked ? C.primary : C.border, background: checked ? C.primaryLight : "transparent" }}>
              <input type="checkbox" checked={checked} onChange={() => toggleSelect(p)} className="w-5 h-5 accent-blue-600 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-semibold truncate" style={{ ...bodyFont, color: C.text }}>{roomLabel(p)}</p>
                <p className="text-xs mt-0.5 truncate" style={{ ...bodyFont, color: C.textMuted }}>{p.trackingCode} · รับเข้า {formatThaiDateTime(p.checkedInAt)}</p>
              </div>
            </label>
          );
        })}
        {hiddenCount > 0 && (
          <p className="text-xs py-2 text-center" style={{ ...bodyFont, color: C.textMuted }}>แสดง {MATCH_PAGE_SIZE} รายการแรก — พิมพ์เพิ่มเพื่อกรอง</p>
        )}
      </div>

      {confirmAll ? (
        <div className="rounded-xl p-3.5" style={{ background: C.primaryLight }}>
          <p className="text-sm font-semibold mb-3" style={{ ...bodyFont, color: C.text }}>นำพัสดุออกทั้งหมด {matches.length} ชิ้นของห้อง {matches[0]?.room?.buildingCode}{matches[0]?.room?.roomNumber} ใช่หรือไม่?</p>
          <div className="flex gap-2.5">
            <button disabled={submitting} onClick={() => setConfirmAll(false)} className="flex-1 py-2.5 rounded-xl text-sm font-medium border bg-white disabled:opacity-50" style={{ ...bodyFont, borderColor: C.border, color: C.text }}>ยกเลิก</button>
            <button autoFocus disabled={submitting} onClick={submitAll} className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50" style={{ ...bodyFont, background: C.primary }}>
              {submitting ? "กำลังนำออก…" : `ยืนยันนำออก ${matches.length} ชิ้น`}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          <div className="flex gap-2.5">
            <button disabled={!canCheckOutAll || submitting} onClick={() => setConfirmAll(true)} className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-40" style={{ ...bodyFont, background: C.primary }}>
              นำออกทั้งหมด{matches.length > 0 ? ` (${matches.length})` : ""}
            </button>
            <button disabled={selectedParcels.length === 0 || submitting} onClick={submitSelected} className="flex-1 py-2.5 rounded-xl text-sm font-semibold border-2 disabled:opacity-40" style={{ ...bodyFont, borderColor: C.primary, color: C.primaryDark }}>
              {submitting ? "กำลังนำออก…" : `นำออกที่เลือก${selectedParcels.length > 0 ? ` (${selectedParcels.length})` : ""}`}
            </button>
          </div>
          {matches.length > 0 && !canCheckOutAll && (
            <p className="text-xs" style={{ ...bodyFont, color: C.textMuted }}>
              "นำออกทั้งหมด" ใช้ได้เมื่อผลลัพธ์อยู่ห้องเดียวกันและแสดงครบทุกรายการเท่านั้น — ใช้ "นำออกที่เลือก" แทน
            </p>
          )}
        </div>
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

  return (
    <ModalShell title="บันทึกพัสดุเข้า" icon={PackagePlus} onClose={onClose}>
      <label htmlFor="checkin-code" className="block text-sm font-semibold mb-2" style={{ ...bodyFont, color: C.textMuted }}>เลขพัสดุ (สแกนแล้วกด Enter)</label>
      <input
        id="checkin-code"
        ref={codeRef}
        autoFocus
        value={code}
        onChange={(e) => {
          setCode(e.target.value);
          setError(null);
        }}
        onKeyDown={handleCodeKeyDown}
        placeholder="เช่น TH8827301923"
        className="w-full px-4 py-3.5 rounded-xl border-2 text-lg outline-none focus:ring-2 focus:ring-blue-300 mb-4"
        style={{ ...bodyFont, borderColor: C.border, color: C.text }}
      />

      <InlineError message={error} />

      {!unmatched && (
        <RoomCombobox ref={roomRef} label="เลขห้อง (เลือกจากรายชื่อผู้พัก)" value={room} onChange={setRoom} />
      )}

      <label className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl border-2 mb-3 cursor-pointer" style={{ borderColor: unmatched ? C.warning : C.border, background: unmatched ? C.warningLight : "transparent" }}>
        <input type="checkbox" checked={unmatched} onChange={toggleUnmatched} disabled={submitting} className="w-5 h-5 accent-red-600 flex-shrink-0" />
        <span className="text-sm font-semibold" style={{ ...bodyFont, color: unmatched ? C.warning : C.text }}>พัสดุมีปัญหา (เช่น ไม่มีเลขห้อง ลายมืออ่านไม่ออก ชื่อเล่นไม่ตรงกับทะเบียน)</span>
      </label>

      {unmatched && (
        <textarea value={note} onChange={(e) => setNote(e.target.value)} aria-label="หมายเหตุ (ไม่บังคับ)" placeholder="หมายเหตุ (ไม่บังคับ) เช่น ชื่อบนกล่อง 'แนน'" rows={2} className="w-full px-3 py-2.5 rounded-lg border text-sm outline-none resize-none focus:ring-2 focus:ring-red-300 mb-4" style={{ ...bodyFont, borderColor: C.border, color: C.text }} />
      )}

      <button disabled={!canSubmit} onClick={submit} className="w-full py-3 rounded-xl text-sm font-semibold text-white disabled:opacity-40 mb-2" style={{ ...bodyFont, background: unmatched ? C.warning : C.primary }}>
        {submitting ? "กำลังบันทึก…" : "บันทึก"}
      </button>

      {checkedIn.length > 0 && (
        <div className="mt-2">
          <p className="text-sm font-semibold mb-2" style={{ ...bodyFont, color: C.textMuted }}>บันทึกแล้วรอบนี้ ({checkedIn.length})</p>
          <div className="max-h-40 overflow-y-auto -mx-1 px-1 space-y-1.5">
            {checkedIn.map((p) => (
              <div key={p.trackingCode} className="flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl" style={{ background: p.room ? C.successLight : C.warningLight }}>
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate" style={{ ...bodyFont, color: p.room ? C.success : C.warning }}>{roomLabel(p)}</p>
                  <p className="text-xs truncate" style={{ ...bodyFont, color: C.textMuted }}>{p.trackingCode}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </ModalShell>
  );
}

export { ModalShell, CheckOutModal, CheckInModal, InlineError };
