import React, { useEffect, useState } from "react";
import { C, bodyFont, SearchBar, ParcelTable, LoadMoreFooter } from "./shared";
import { InlineError } from "./Modals";
import { api, ApiError } from "../api/client";
import { errorMessage } from "../api/errorMessages";

const PAGE_SIZE = 20;

const TABS = [
  { id: "all", label: "ทั้งหมด", params: {} },
  { id: "in", label: "รอรับ", params: { status: "pending", unmatched: false } },
  { id: "out", label: "นำออกแล้ว", params: { status: "picked_up" } },
  { id: "unmatched", label: "มีปัญหา", params: { status: "pending", unmatched: true }, warn: true },
];

export default function ArchivePage({ onOpenHistory }) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
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

  useEffect(() => {
    setPage(1);
    setItems([]);
  }, [query, statusFilter]);

  useEffect(() => {
    const tab = TABS.find((t) => t.id === statusFilter);
    const controller = new AbortController();
    (page === 1 ? setLoading : setLoadingMore)(true);
    setError(null);
    api
      .listParcels({ ...tab.params, q: query.trim() || undefined, page, pageSize: PAGE_SIZE }, controller.signal)
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
  }, [query, statusFilter, page]);

  return (
    <section className="parcel-register" aria-label="ประวัติพัสดุทั้งหมด">
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
      {loading ? (
        <p className="search-feedback" role="status" style={{ padding: "0 24px 20px" }}>กำลังโหลด…</p>
      ) : (
        <>
          <ParcelTable parcels={items} onSelect={onOpenHistory} label="ประวัติพัสดุ" emptyLabel="ไม่พบรายการที่ตรงกับคำค้นหา" />
          {items.length > 0 && (
            <div style={{ padding: "0 24px 20px" }}>
              <LoadMoreFooter shown={items.length} total={total} loading={loadingMore} onLoadMore={() => setPage((p) => p + 1)} />
            </div>
          )}
        </>
      )}
    </section>
  );
}
