import { parcelMatches } from "../lib/parcelRules";
import React, { useMemo, useState } from "react";
import { SearchBar, ParcelTable } from "./shared";

function StatusFilterTabs({ value, onChange, counts }) {
  const options = [
    { id: "all", label: "ทั้งหมด" },
    { id: "in", label: "รอรับ" },
    { id: "out", label: "นำออกแล้ว" },
    { id: "damaged", label: "ชำรุด" },
  ];
  return (
    <div className="archive-filters" role="group" aria-label="กรองตามสถานะพัสดุ">
      {options.map((opt) => (
        <button key={opt.id} onClick={() => onChange(opt.id)} aria-pressed={value === opt.id} className="filter-button">
          {opt.label}<span>{counts[opt.id]}</span>
        </button>
      ))}
    </div>
  );
}

export default function ArchivePage({ parcels }) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const counts = useMemo(() => ({
    all: parcels.length,
    in: parcels.filter((p) => p.status === "in").length,
    out: parcels.filter((p) => p.status === "out").length,
    damaged: parcels.filter((p) => p.damaged).length,
  }), [parcels]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return parcels.filter((p) => {
      const matchesQuery = !q || parcelMatches(p, q);
      const matchesStatus = statusFilter === "all" || (statusFilter === "damaged" ? p.damaged : p.status === statusFilter);
      return matchesQuery && matchesStatus;
    });
  }, [query, parcels, statusFilter]);
  return (
    <section className="parcel-register" aria-label="ประวัติพัสดุทั้งหมด">
      <div className="archive-toolbar">
        <StatusFilterTabs value={statusFilter} onChange={setStatusFilter} counts={counts} />
        <SearchBar value={query} onChange={setQuery} placeholder="เลขห้อง ชื่อผู้รับ หรือเลขพัสดุ" label="ค้นหาประวัติพัสดุ" />
        <p className="search-feedback" role="status">ทั้งหมด {filtered.length} รายการ</p>
      </div>
      <ParcelTable pageSize={8} numberedPages parcels={filtered} label="ประวัติพัสดุ" emptyLabel="ไม่พบรายการ ลองเปลี่ยนคำค้นหาหรือตัวกรองสถานะ" />
    </section>
  );
}
