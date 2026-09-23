import React, { useEffect, useRef, useState } from "react";
import { Search, PackagePlus, PackageCheck, Inbox, Clock } from "lucide-react";
import { C, bodyFont, displayFont, ParcelTable, LoadMoreFooter, toDateInputValue } from "./shared";
import { InlineError } from "./Modals";
import UnmatchedQueue from "./UnmatchedQueue";
import { api, ApiError } from "../api/client";
import { errorMessage } from "../api/errorMessages";

function StatCard({ icon: Icon, label, value, fg, bg, loading }) {
  return (
    <div className="rounded-2xl border p-5 flex items-center gap-4" style={{ background: C.card, borderColor: C.border }}>
      <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: bg }}>
        <Icon size={22} style={{ color: fg }} />
      </div>
      <div>
        <p className="text-sm font-medium" style={{ ...bodyFont, color: C.textMuted }}>{label}</p>
        <p className="text-3xl font-bold" style={{ ...displayFont, color: C.text }}>{loading ? "–" : value.toLocaleString()}</p>
      </div>
    </div>
  );
}

const SEARCH_PAGE_SIZE = 20;

export default function DashboardPage({ onOpenCheckOut, onOpenCheckIn, onOpenHistory, refreshKey, onDataChanged }) {
  const [date, setDate] = useState(() => toDateInputValue());
  const today = toDateInputValue();

  const [dashboard, setDashboard] = useState(null);
  const [dashboardError, setDashboardError] = useState(null);

  const [query, setQuery] = useState("");
  const [results, setResults] = useState(null); // null = not searching (show recentCheckIns instead)
  const [resultsTotal, setResultsTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState(null);
  const debounceRef = useRef(null);
  const abortRef = useRef(null);

  useEffect(() => {
    const controller = new AbortController();
    setDashboardError(null);
    api
      .dashboard(date, controller.signal)
      .then(setDashboard)
      .catch((err) => {
        if (err instanceof ApiError) setDashboardError(errorMessage(err));
      });
    return () => controller.abort();
  }, [date, refreshKey]);

  const runSearch = (q, nextPage) => {
    clearTimeout(debounceRef.current);
    abortRef.current?.abort();
    const trimmed = q.trim();
    if (!trimmed) {
      setResults(null);
      setSearchLoading(false);
      return;
    }
    setSearchLoading(true);
    setSearchError(null);
    const controller = new AbortController();
    abortRef.current = controller;
    api
      .listParcels({ q: trimmed, page: nextPage, pageSize: SEARCH_PAGE_SIZE }, controller.signal)
      .then((res) => {
        setResults((prev) => (nextPage === 1 ? res.items : [...(prev || []), ...res.items]));
        setResultsTotal(res.total);
        setSearchLoading(false);
      })
      .catch((err) => {
        if (err instanceof ApiError) {
          setSearchError(errorMessage(err));
          setSearchLoading(false);
        }
      });
  };

  const handleQueryChange = (next) => {
    setQuery(next);
    setPage(1);
    clearTimeout(debounceRef.current);
    if (!next.trim()) {
      abortRef.current?.abort();
      setResults(null);
      return;
    }
    debounceRef.current = setTimeout(() => runSearch(next, 1), 250);
  };

  useEffect(() => () => {
    clearTimeout(debounceRef.current);
    abortRef.current?.abort();
  }, []);

  const showingSearch = query.trim() !== "";
  const listed = showingSearch ? results || [] : dashboard?.recentCheckIns || [];

  return (
    <div>
      <div className="mb-4">
        <label htmlFor="dashboard-date" className="block text-xs font-medium mb-1.5" style={{ ...bodyFont, color: C.textMuted }}>สรุปประจำวันที่</label>
        <input id="dashboard-date" type="date" value={date} max={today} onChange={(e) => setDate(e.target.value)} className="px-3.5 py-2.5 rounded-xl border text-sm outline-none focus:ring-2 focus:ring-blue-300" style={{ ...bodyFont, borderColor: C.border, color: C.text, background: C.card }} />
      </div>

      <InlineError message={dashboardError} />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-2">
        <StatCard icon={Inbox} label="รับเข้า" value={dashboard?.checkedIn ?? 0} loading={!dashboard} fg={C.primaryDark} bg={C.primaryLight} />
        <StatCard icon={PackageCheck} label="นำออกแล้ว" value={dashboard?.pickedUp ?? 0} loading={!dashboard} fg={C.success} bg={C.successLight} />
        <StatCard icon={Clock} label="พัสดุค้าง" value={dashboard?.pending ?? 0} loading={!dashboard} fg={C.warning} bg={C.warningLight} />
      </div>
      <p className="text-xs mb-6" style={{ ...bodyFont, color: C.textMuted }}>
        รอรับ = พัสดุที่ยังไม่ถูกนำออก ณ สิ้นวันที่เลือก{dashboard ? ` (รวมพัสดุมีปัญหา ${dashboard.unmatchedPending.toLocaleString()} รายการ)` : ""}
      </p>

      <div className="rounded-2xl border p-5 md:p-6 mb-6" style={{ background: C.card, borderColor: C.border }}>
        <p className="text-xl font-bold mb-4" style={{ ...displayFont, color: C.text }}>{showingSearch ? "ผลการค้นหา" : "รับเข้าล่าสุด"}</p>
        <div className="flex flex-col md:flex-row gap-4 items-stretch mb-1">
          <div className="flex-1 flex items-center gap-3 px-5 py-4 rounded-2xl border-2 focus-within:ring-2 focus-within:ring-blue-300" style={{ borderColor: showingSearch ? C.primary : C.border, background: showingSearch ? C.primaryLight : C.card }}>
            <Search size={26} strokeWidth={2.5} style={{ color: C.primaryDark }} />
            <input value={query} onChange={(e) => handleQueryChange(e.target.value)} aria-label="ค้นหาพัสดุ" placeholder="ค้นหาด้วยเลขห้อง เลขพัสดุ หรือชื่อผู้พัก" className="w-full outline-none bg-transparent text-2xl font-bold" style={{ ...bodyFont, color: C.text }} />
          </div>
          <div className="flex items-center gap-3">
            <button onClick={onOpenCheckIn} className="flex items-center gap-2.5 px-7 py-4 rounded-2xl text-lg font-bold" style={{ ...bodyFont, background: C.successLight, color: C.success }}>
              <PackagePlus size={24} />
              เข้า
            </button>
            <button onClick={onOpenCheckOut} className="flex items-center gap-2.5 px-7 py-4 rounded-2xl text-lg font-bold text-white" style={{ ...bodyFont, background: C.primary }}>
              <PackageCheck size={24} />
              ออก
            </button>
          </div>
        </div>
        <p className="text-xs mb-1" style={{ ...bodyFont, color: C.textMuted }}>ค้นหาได้ด้วยเลขห้อง ชื่อผู้พัก หรือเลขพัสดุ · คลิกแถวเพื่อดูประวัติพัสดุ</p>
        <InlineError message={searchError} />
        <div className="mt-4">
          {searchLoading && page === 1 ? (
            <p className="text-sm py-10 text-center" style={{ ...bodyFont, color: C.textMuted }}>กำลังค้นหา…</p>
          ) : (
            <>
              <ParcelTable parcels={listed} onSelect={onOpenHistory} emptyLabel={showingSearch ? "ไม่พบพัสดุที่ตรงกับคำค้นหา" : "ยังไม่มีพัสดุที่รับเข้าวันนี้"} />
              {showingSearch && listed.length > 0 && (
                <LoadMoreFooter
                  shown={listed.length}
                  total={resultsTotal}
                  loading={searchLoading}
                  onLoadMore={() => {
                    const next = page + 1;
                    setPage(next);
                    runSearch(query, next);
                  }}
                />
              )}
            </>
          )}
        </div>
      </div>

      <UnmatchedQueue refreshKey={refreshKey} onOpenHistory={onOpenHistory} onChange={onDataChanged} />
    </div>
  );
}
