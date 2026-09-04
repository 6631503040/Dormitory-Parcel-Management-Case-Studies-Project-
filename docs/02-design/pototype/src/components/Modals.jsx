import React, { useEffect, useState } from "react";
import { X, Check, ScanLine, PackagePlus } from "lucide-react";
import { C, bodyFont, displayFont, roomLabel } from "./shared";

function ModalShell({ title, icon: Icon, onClose, children }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-2xl shadow-2xl overflow-hidden" style={{ background: C.card }}>
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: C.border }}>
          <div className="flex items-center gap-2.5">
            <Icon size={18} style={{ color: C.primary }} />
            <h3 className="font-semibold" style={{ ...displayFont, color: C.text }}>{title}</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100">
            <X size={18} style={{ color: C.textMuted }} />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

function LabeledInput({ label, value, onChange, onKeyDown, placeholder, type = "text", autoFocus }) {
  return (
    <div className="mb-4">
      <label className="block text-sm font-semibold mb-2" style={{ ...bodyFont, color: C.textMuted }}>{label}</label>
      <input type={type} value={value} onChange={onChange} onKeyDown={onKeyDown} placeholder={placeholder} autoFocus={autoFocus} className="w-full px-4 py-3.5 rounded-xl border-2 text-lg outline-none" style={{ ...bodyFont, borderColor: C.border, color: C.text }} />
    </div>
  );
}

function CheckOutModal({ parcels, onClose, onConfirm }) {
  const [scan, setScan] = useState("");
  const [selectedIds, setSelectedIds] = useState([]);
  const [notFound, setNotFound] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const pending = parcels.filter((p) => p.status === "in");
  const q = scan.trim().toLowerCase();
  const matches = q
    ? pending.filter(
        (p) => p.code.toLowerCase().includes(q) || p.name.toLowerCase().includes(q) || p.room.toLowerCase().includes(q)
      )
    : pending;

  const selectedParcels = pending.filter((p) => selectedIds.includes(p.id));
  const allMatchesSelected = matches.length > 0 && matches.every((p) => selectedIds.includes(p.id));

  const toggleSelect = (id) => {
    setSelectedIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));
  };

  const toggleSelectAllMatches = () => {
    if (allMatchesSelected) {
      const matchIds = matches.map((p) => p.id);
      setSelectedIds((ids) => ids.filter((id) => !matchIds.includes(id)));
    } else {
      setSelectedIds((ids) => Array.from(new Set([...ids, ...matches.map((p) => p.id)])));
    }
  };

  useEffect(() => {
    const code = scan.trim().toLowerCase();
    if (!code) {
      setNotFound(false);
      return;
    }
    const exact = pending.find((p) => p.code.toLowerCase() === code);
    if (exact) {
      setSelectedIds((ids) => (ids.includes(exact.id) ? ids : [...ids, exact.id]));
      setScan("");
      setNotFound(false);
    }
  }, [scan]);

  const handleScanKeyDown = (e) => {
    if (e.key !== "Enter") return;
    const code = scan.trim().toLowerCase();
    if (!code) return;
    const exact = pending.find((p) => p.code.toLowerCase() === code);
    setNotFound(!exact);
  };

  if (confirming) {
    return (
      <ModalShell title="ยืนยันนำพัสดุออก" icon={ScanLine} onClose={onClose}>
        <p className="text-xs font-medium mb-3 flex items-center gap-1.5" style={{ ...bodyFont, color: C.success }}>
          <Check size={13} strokeWidth={3} />
          กรุณายืนยันรายการก่อนนำพัสดุออก ({selectedParcels.length} ชิ้น)
        </p>
        <div className="max-h-64 overflow-y-auto -mx-1 px-1 space-y-2 mb-4">
          {selectedParcels.map((p) => (
            <div key={p.id} className="rounded-xl p-3.5" style={{ background: C.bg }}>
              <div className="flex justify-between text-sm mb-1">
                <span className="font-semibold" style={{ ...bodyFont, color: C.text }}>{roomLabel(p)}</span>
                <span style={{ ...bodyFont, color: C.textMuted }}>x{p.qty}</span>
              </div>
              <p className="text-xs" style={{ ...bodyFont, color: C.textMuted }}>{p.code}{p.line && p.line !== "-" ? ` · ${p.line}` : ""}</p>
            </div>
          ))}
        </div>
        <div className="flex gap-2.5">
          <button onClick={() => setConfirming(false)} className="flex-1 py-2.5 rounded-xl text-sm font-medium border" style={{ ...bodyFont, borderColor: C.border, color: C.text }}>ย้อนกลับ</button>
          <button onClick={() => onConfirm(selectedParcels)} className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white" style={{ ...bodyFont, background: C.primary }}>ยืนยันนำออก ({selectedParcels.length})</button>
        </div>
      </ModalShell>
    );
  }

  return (
    <ModalShell title="สแกนพัสดุออก" icon={ScanLine} onClose={onClose}>
      <label className="block text-xs font-medium mb-2" style={{ ...bodyFont, color: C.textMuted }}>สแกน หรือ พิมพ์เลขพัสดุ / ชื่อ / เลขห้อง</label>
      <div className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border mb-1" style={{ borderColor: notFound ? C.warning : C.border }}>
        <ScanLine size={16} style={{ color: C.textMuted }} />
        <input autoFocus value={scan} onChange={(e) => setScan(e.target.value)} onKeyDown={handleScanKeyDown} placeholder="เช่น TH8827301923 หรือเลขห้อง 101/2" className="w-full outline-none text-sm bg-transparent" style={bodyFont} />
      </div>
      {notFound ? (
        <p className="text-xs mb-3" style={{ ...bodyFont, color: C.warning }}>ไม่พบเลขพัสดุนี้ในรายการที่รอนำออก</p>
      ) : (
        <p className="text-xs mb-3" style={{ ...bodyFont, color: C.textMuted }}>สแกนได้ต่อเนื่องหลายชิ้น หรือพิมพ์เลขห้องเพื่อเลือกพัสดุของผู้รับคนเดียวกันทั้งหมด</p>
      )}

      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-medium" style={{ ...bodyFont, color: C.textMuted }}>รายการที่รอนำออก ({matches.length})</p>
        {matches.length > 1 && (
          <button onClick={toggleSelectAllMatches} className="text-xs font-semibold" style={{ ...bodyFont, color: C.primaryDark }}>
            {allMatchesSelected ? "ยกเลิกเลือกทั้งหมด" : `เลือกทั้งหมดที่พบ (${matches.length})`}
          </button>
        )}
      </div>

      <div className="max-h-56 overflow-y-auto -mx-1 px-1 space-y-1.5 mb-4">
        {matches.length === 0 && <p className="text-sm py-6 text-center" style={{ ...bodyFont, color: C.textMuted }}>ไม่พบพัสดุที่ตรงกับคำค้นหา</p>}
        {matches.map((p) => {
          const checked = selectedIds.includes(p.id);
          return (
            <button key={p.id} onClick={() => toggleSelect(p.id)} className="w-full flex items-center gap-3 text-left px-3.5 py-3 rounded-xl border transition-colors" style={{ borderColor: checked ? C.primary : C.border, background: checked ? C.primaryLight : "transparent" }}>
              <div className="w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0" style={{ borderColor: checked ? C.primary : C.border, background: checked ? C.primary : "transparent" }}>
                {checked && <Check size={12} color="#fff" strokeWidth={3} />}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold truncate" style={{ color: C.text }}>{roomLabel(p)}</p>
                <p className="text-xs mt-0.5 truncate" style={{ color: C.textMuted }}>{p.code}</p>
              </div>
            </button>
          );
        })}
      </div>

      <button disabled={selectedIds.length === 0} onClick={() => setConfirming(true)} className="w-full py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-40" style={{ ...bodyFont, background: C.primary }}>
        ดำเนินการต่อ{selectedIds.length > 0 ? ` (เลือกแล้ว ${selectedIds.length} ชิ้น)` : ""}
      </button>
    </ModalShell>
  );
}

function CheckInModal({ parcels, onClose, onSave }) {
  const [batch, setBatch] = useState([]);
  const [form, setForm] = useState({ code: "", room: "", damaged: false, damageReason: "" });
  const [duplicateWarning, setDuplicateWarning] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const canAdd = form.code.trim() && form.room.trim() && (!form.damaged || form.damageReason.trim());

  const isDuplicateCode = (code) => {
    const c = code.trim().toLowerCase();
    if (!c) return false;
    const inBatch = batch.some((item) => item.code.toLowerCase() === c);
    const inSystem = parcels.some((p) => p.code.toLowerCase() === c);
    return inBatch || inSystem;
  };

  const addToBatch = () => {
    if (!canAdd) return;
    if (isDuplicateCode(form.code)) {
      setDuplicateWarning(true);
      return;
    }
    setBatch((b) => [
      ...b,
      {
        code: form.code.trim(),
        room: form.room.trim(),
        damaged: form.damaged,
        damageReason: form.damaged ? form.damageReason.trim() : "",
      },
    ]);
    setForm((f) => ({ ...f, code: "", damaged: false, damageReason: "" }));
    setDuplicateWarning(false);
  };

  const removeFromBatch = (idx) => {
    setBatch((b) => b.filter((_, i) => i !== idx));
  };

  const handleCodeChange = (e) => {
    setForm((f) => ({ ...f, code: e.target.value }));
    setDuplicateWarning(false);
  };

  const handleCodeKeyDown = (e) => {
    if (e.key === "Enter") addToBatch();
  };

  const saveAll = () => {
    if (isDuplicateCode(form.code) && form.code.trim()) {
      setDuplicateWarning(true);
      return;
    }
    const all = canAdd
      ? [
          ...batch,
          {
            code: form.code.trim(),
            room: form.room.trim(),
            damaged: form.damaged,
            damageReason: form.damaged ? form.damageReason.trim() : "",
          },
        ]
      : batch;
    if (all.length === 0) return;
    onSave(all);
  };

  const totalCount = batch.length + (canAdd ? 1 : 0);

  return (
    <ModalShell title="บันทึกพัสดุเข้า" icon={PackagePlus} onClose={onClose}>
      <LabeledInput label="เลขห้อง" value={form.room} onChange={set("room")} placeholder="เช่น 101/2" autoFocus />
      <LabeledInput label="เลขพัสดุ (สแกนต่อเนื่องได้เลย)" value={form.code} onChange={handleCodeChange} onKeyDown={handleCodeKeyDown} placeholder="เช่น TH8827301923" />
      {duplicateWarning ? (
        <p className="text-xs -mt-2 mb-4 font-medium" style={{ ...bodyFont, color: C.warning }}>เลขพัสดุนี้ถูกสแกนไปแล้ว กรุณาตรวจสอบก่อนบันทึกซ้ำ</p>
      ) : (
        <p className="text-xs -mt-2 mb-4" style={{ ...bodyFont, color: C.textMuted }}>สแกนหรือพิมพ์แล้วกด Enter พัสดุจะถูกเพิ่มลงรายการทันที ไม่ต้องกดปุ่มเพิ่ม</p>
      )}

      <button onClick={() => setForm((f) => ({ ...f, damaged: !f.damaged, damageReason: f.damaged ? "" : f.damageReason }))} className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl border-2 mb-3 text-left" style={{ borderColor: form.damaged ? C.warning : C.border, background: form.damaged ? C.warningLight : "transparent" }}>
        <div className="w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0" style={{ borderColor: form.damaged ? C.warning : C.border, background: form.damaged ? C.warning : "transparent" }}>
          {form.damaged && <Check size={13} color="#fff" strokeWidth={3} />}
        </div>
        <span className="text-sm font-semibold" style={{ ...bodyFont, color: form.damaged ? C.warning : C.text }}>พัสดุมีปัญหา / ชำรุด (เช่น ไม่มีเลขห้อง กล่องเสียหาย ชื่อซ้ำ)</span>
      </button>

      {form.damaged && (
        <div className="mb-4">
          <textarea value={form.damageReason} onChange={set("damageReason")} placeholder="ระบุเหตุผล เช่น กล่องบุบ, ไม่มีเลขห้องนี้ในระบบ, ชื่อซ้ำกับห้องอื่น" rows={2} className="w-full px-4 py-3 rounded-xl border-2 text-sm outline-none resize-none" style={{ ...bodyFont, borderColor: C.warning, color: C.text }} />
        </div>
      )}

      {batch.length > 0 && (
        <div className="mb-4">
          <p className="text-sm font-semibold mb-2" style={{ ...bodyFont, color: C.textMuted }}>รายการที่กำลังจะบันทึก ({batch.length})</p>
          <div className="max-h-40 overflow-y-auto -mx-1 px-1 space-y-1.5">
            {batch.map((item, i) => (
              <div key={i} className="flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl" style={{ background: item.damaged ? C.warningLight : C.bg }}>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm font-semibold truncate" style={{ color: C.text }}>ห้อง {item.room}</p>
                    {item.damaged && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded flex-shrink-0" style={{ background: C.warning, color: "#fff" }}>ชำรุด</span>}
                  </div>
                  <p className="text-xs truncate" style={{ color: C.textMuted }}>{item.code}</p>
                </div>
                <button onClick={() => removeFromBatch(i)} className="p-1 rounded-lg hover:bg-gray-200 flex-shrink-0">
                  <X size={14} style={{ color: C.textMuted }} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <button disabled={totalCount === 0} onClick={saveAll} className="w-full mt-1 py-3.5 rounded-xl text-base font-semibold text-white disabled:opacity-40" style={{ ...bodyFont, background: C.primary }}>
        บันทึกพัสดุเข้าทั้งหมด{totalCount > 0 ? ` (${totalCount} ชิ้น)` : ""}
      </button>
    </ModalShell>
  );
}

export { ModalShell, CheckOutModal, CheckInModal, LabeledInput };
