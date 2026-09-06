import React, { useMemo, useState } from "react";
import { Search, PackagePlus, ScanLine, AlertTriangle } from "lucide-react";
import { C, bodyFont, displayFont, ParcelTable } from "./shared";

function SearchStatusBadge({ hasQuery, matchCount, pendingCount }) {
  let label = "รอค้นหา";
  let color = C.textMuted;
  let bg = C.bg;

  if (hasQuery) {
    if (matchCount === 0) {
      label = "ไม่พบพัสดุ";
    } else if (pendingCount > 0) {
      label = `มีพัสดุรอรับ ${pendingCount} ชิ้น`;
      color = C.warning;
      bg = C.warningLight;
    } else {
      label = "รับพัสดุครบแล้ว";
      color = C.success;
      bg = C.successLight;
    }
  }

  return (
    <div className="flex flex-col items-center justify-center gap-1 px-6 py-4 rounded-2xl md:min-w-[200px]" style={{ background: bg }}>
      <span className="text-xs font-semibold uppercase tracking-wide" style={{ ...bodyFont, color, opacity: 0.75 }}>สถานะ</span>
      <span className="text-xl font-bold text-center" style={{ ...displayFont, color }}>{label}</span>
    </div>
  );
}

function BottleneckPanel({ parcels }) {
  const damaged = parcels
    .filter((p) => p.status === "in" && p.damaged)
    .sort((a, b) => new Date(a.receivedAt) - new Date(b.receivedAt));

  return (
    <div className="rounded-2xl border p-5 mb-6" style={{ background: C.card, borderColor: C.border }}>
      <div className="flex items-center justify-between gap-3 flex-wrap mb-1">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: C.warningLight }}>
            <AlertTriangle size={17} style={{ color: C.warning }} />
          </div>
          <div>
            <p className="text-sm font-semibold" style={{ ...bodyFont, color: C.text }}>พัสดุชำรุด</p>
            <p className="text-xs" style={{ ...bodyFont, color: C.textMuted }}>รายการพัสดุชำรุดที่ต้องนำออก</p>
          </div>
        </div>
        {damaged.length > 0 && (
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full flex-shrink-0" style={{ background: C.warningLight, color: C.warning, ...bodyFont }}>
            ต้องนำออก {damaged.length} รายการ
          </span>
        )}
      </div>

      <div className="mt-3">
        <ParcelTable parcels={damaged} showLine={false} emptyLabel="ไม่มีพัสดุชำรุด" />
      </div>
    </div>
  );
}

export default function DashboardPage({ parcels, onOpenCheckOut, onOpenCheckIn }) {
  const [query, setQuery] = useState("");
  const pending = parcels.filter((p) => p.status === "in");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const source = q ? parcels : pending;
    if (!q) return source;
    return parcels.filter(
      (p) => p.code.toLowerCase().includes(q) || p.name.toLowerCase().includes(q) || p.room.toLowerCase().includes(q)
    );
  }, [query, parcels]);

  return (
    <div>
      <div className="flex items-start justify-between gap-4 flex-wrap mb-6">
        <div className="flex items-center gap-3">
          <button onClick={onOpenCheckIn} className="flex items-center gap-2.5 px-7 py-4 rounded-2xl text-lg font-bold" style={{ ...bodyFont, background: C.successLight, color: C.success }}>
            <PackagePlus size={24} />
            เข้า
          </button>
          <button onClick={onOpenCheckOut} className="flex items-center gap-2.5 px-7 py-4 rounded-2xl text-lg font-bold text-white" style={{ ...bodyFont, background: C.primary }}>
            <ScanLine size={24} />
            ออก
          </button>
        </div>
      </div>

      <div className="rounded-2xl border p-5 md:p-6" style={{ background: C.card, borderColor: C.border }}>
        <p className="text-xl font-bold mb-4" style={{ ...displayFont, color: C.text }}>ค้นหาเลขห้อง</p>
        <div className="flex flex-col md:flex-row gap-4 items-stretch mb-1">
          <div className="flex-1 flex items-center gap-3 px-5 py-4 rounded-2xl border-2" style={{ borderColor: query.trim() ? C.primary : C.border, background: query.trim() ? C.primaryLight : C.card }}>
            <Search size={26} strokeWidth={2.5} style={{ color: C.primaryDark }} />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="กรอกเลขห้อง เช่น 101/2" className="w-full outline-none bg-transparent text-2xl font-bold" style={{ ...bodyFont, color: C.text }} />
          </div>
          <SearchStatusBadge hasQuery={!!query.trim()} matchCount={filtered.length} pendingCount={filtered.filter((p) => p.status === "in").length} />
        </div>
        <p className="text-xs mb-1" style={{ ...bodyFont, color: C.textMuted }}>ค้นหาได้ด้วยเลขห้อง ชื่อผู้รับ หรือรหัสพัสดุ</p>
        <div className="mt-4">
          <ParcelTable parcels={filtered} showLine={false} emptyLabel={query.trim() ? "ไม่พบพัสดุที่ตรงกับคำค้นหา" : "ยังไม่มีพัสดุที่รอรับในขณะนี้"} />
        </div>
      </div>

      <div className="mt-6">
        <BottleneckPanel parcels={parcels} />
      </div>
    </div>
  );
}

export { SearchStatusBadge };
