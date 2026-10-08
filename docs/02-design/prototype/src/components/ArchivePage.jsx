import React, { useEffect, useState } from "react";
import { C, bodyFont, SearchBar, ParcelTable, PagePagination, PageHeader } from "./shared";
import { InlineError } from "./Modals";
import { api } from "../api/client";
import useParcelPage, { PARCEL_PAGE_SIZE } from "./useParcelPage";



const TABS = [
  { id: "all", label: "ทั้งหมด", params: {} },
  { id: "in", label: "รอรับ", params: { status: "pending", unmatched: false } },
  { id: "out", label: "นำออกแล้ว", params: { status: "picked_up" } },
  { id: "unmatched", label: "มีปัญหา", params: { status: "pending", unmatched: true }, warn: true },
];

export default function ArchivePage({ onOpenHistory }) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const tab = TABS.find((t) => t.id === statusFilter);
  const { items, total, page, setPage, loading, error } = useParcelPage({ query, ...tab.params });
  const [counts, setCounts] = useState(null);
  const tabCount = (id) => (counts && counts[id] !== undefined ? counts[id].toLocaleString() : "…");

  useEffect(() => {
    let cancelled = false;
    Promise.all(TABS.map((t) => api.listParcels({ ...t.params, q: query.trim() || undefined, pageSize: 1 })))
      .then((results) => {
        if (cancelled) return;
        const next = {};
        TABS.forEach((t, i) => {
          next[t.id] = results[i].total;
        });
        setCounts(next);
      })
      .catch(() => {
        if (!cancelled) setCounts(null);
      });
    return () => {
      cancelled = true;
    };
  }, [query, statusFilter]); // refetch counts too: they should reflect the query, same as the list

  return (
    <><PageHeader title="Archive" description="ค้นหาประวัติการรับเข้าและนำจ่ายพัสดุ" /><section className="parcel-register" aria-label="ประวัติพัสดุทั้งหมด">
      <div className="archive-toolbar">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <p className="text-base font-semibold" style={{ ...bodyFont, color: C.text }}>ประวัติพัสดุทั้งหมด</p>
          <span className="text-xs font-medium px-2.5 py-1 rounded-full" style={{ background: C.bg, color: C.textMuted, ...bodyFont }}>{total.toLocaleString()} รายการ</span>
        </div>
        <div className="archive-filters" role="group" aria-label="กรองตามสถานะพัสดุ">
          {TABS.map((t) => (
            <button key={t.id} aria-pressed={statusFilter === t.id} onClick={() => setStatusFilter(t.id)} className="filter-button">
              {t.label} ({tabCount(t.id)})
            </button>
          ))}
        </div>
        <SearchBar value={query} onChange={setQuery} placeholder="ค้นหาด้วยชื่อผู้พัก เลขพัสดุ หรือเลขห้อง" />
        <InlineError message={error} />
      </div>
      <PagePagination page={page} total={total} pageSize={PARCEL_PAGE_SIZE} onChange={setPage} loading={loading} label="ประวัติพัสดุ" />
      <div aria-busy={loading} className="parcel-page-content" data-reserve={total > PARCEL_PAGE_SIZE}>
        {loading ? <p className="table-empty" role="status">กำลังโหลด…</p> : <ParcelTable parcels={items} onSelect={onOpenHistory} label="ประวัติพัสดุ" emptyLabel="ไม่พบรายการที่ตรงกับคำค้นหา" />}
      </div>
    </section></>
  );
}
