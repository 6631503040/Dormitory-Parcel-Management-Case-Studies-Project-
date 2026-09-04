import React, { useMemo, useState } from "react";
import { C, bodyFont, SearchBar, ParcelTable } from "./shared";

function StatusFilterTabs({ value, onChange, counts }) {
  const options = [
    { id: "all", label: "ทั้งหมด" },
    { id: "in", label: "พัสดุเข้า (รอรับ)" },
    { id: "out", label: "พัสดุออก (รับแล้ว)" },
    { id: "damaged", label: "ชำรุด", warn: true },
  ];

  return (
    <div className="flex items-center gap-2 flex-wrap mb-4">
      {options.map((opt) => {
        const active = value === opt.id;
        const activeStyle = opt.warn ? { background: C.warning, color: "#fff", ...bodyFont } : { background: C.primary, color: "#fff", ...bodyFont };
        return (
          <button key={opt.id} onClick={() => onChange(opt.id)} className="px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors" style={active ? activeStyle : { background: C.bg, color: C.textMuted, ...bodyFont }}>
            {opt.label} ({counts[opt.id]})
          </button>
        );
      })}
    </div>
  );
}

export default function ArchivePage({ parcels }) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const counts = useMemo(
    () => ({
      all: parcels.length,
      in: parcels.filter((p) => p.status === "in").length,
      out: parcels.filter((p) => p.status === "out").length,
      damaged: parcels.filter((p) => p.damaged).length,
    }),
    [parcels]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return parcels.filter((p) => {
      const matchesQuery = !q || p.code.toLowerCase().includes(q) || p.name.toLowerCase().includes(q) || p.room.toLowerCase().includes(q);
      const matchesStatus = statusFilter === "all" || (statusFilter === "damaged" ? p.damaged : p.status === statusFilter);
      return matchesQuery && matchesStatus;
    });
  }, [query, parcels, statusFilter]);

  return (
    <div className="rounded-2xl border p-5" style={{ background: C.card, borderColor: C.border }}>
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <p className="text-base font-semibold" style={{ ...bodyFont, color: C.text }}>ประวัติพัสดุทั้งหมด</p>
        <span className="text-xs font-medium px-2.5 py-1 rounded-full" style={{ background: C.bg, color: C.textMuted, ...bodyFont }}>{filtered.length} รายการ</span>
      </div>
      <StatusFilterTabs value={statusFilter} onChange={setStatusFilter} counts={counts} />
      <SearchBar value={query} onChange={setQuery} placeholder="ค้นหาด้วยชื่อ เลขพัสดุ หรือเลขห้อง" />
      <div className="mt-4">
        <ParcelTable parcels={filtered} emptyLabel="ไม่พบรายการที่ตรงกับคำค้นหา" />
      </div>
    </div>
  );
}
