import React, { useEffect, useRef, useState } from "react";
import { Search, PackagePlus, PackageCheck } from "lucide-react";
import { C, bodyFont, ParcelTable, LoadMoreFooter, toDateInputValue } from "./shared";
import { InlineError } from "./Modals";
import UnmatchedQueue from "./UnmatchedQueue";
import { api, ApiError } from "../api/client";
import { errorMessage } from "../api/errorMessages";

const SEARCH_PAGE_SIZE = 20;

export default function DashboardPage({ onOpenCheckOut, onOpenCheckIn, onOpenHistory, refreshKey, onDataChanged }) {
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
      .dashboard(toDateInputValue(), controller.signal)
      .then(setDashboard)
      .catch((err) => {
        if (err instanceof ApiError) setDashboardError(errorMessage(err));
      });
    return () => controller.abort();
  }, [refreshKey]);

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
      <InlineError message={dashboardError} />

      <section className="parcel-register dashboard-register" aria-label="ค้นหาและจัดการพัสดุ">
        <p className="text-base font-semibold" style={{ ...bodyFont, color: C.text, padding: "20px 24px 0" }}>{showingSearch ? "ผลการค้นหา" : "รับเข้าล่าสุด"}</p>
        <div className="register-toolbar">
          <div className="register-search">
            <label htmlFor="dashboard-search">ค้นหาพัสดุ</label>
            <div className="search-control">
              <Search size={19} aria-hidden="true" />
              <input id="dashboard-search" value={query} onChange={(e) => handleQueryChange(e.target.value)} placeholder="ค้นหาด้วยเลขห้อง เลขพัสดุ หรือชื่อผู้พัก" />
            </div>
          </div>
          <div className="desk-actions">
            <button onClick={onOpenCheckIn} className="desk-button desk-button-in"><PackagePlus size={18} aria-hidden="true" />เข้า</button>
            <button onClick={onOpenCheckOut} className="desk-button desk-button-primary"><PackageCheck size={18} aria-hidden="true" />ออก</button>
          </div>
        </div>
        <InlineError message={searchError} />
        {searchLoading && page === 1 ? (
          <p className="search-feedback" role="status" style={{ padding: "0 24px 20px" }}>กำลังค้นหา…</p>
        ) : (
          <>
            <ParcelTable parcels={listed} onSelect={onOpenHistory} label={showingSearch ? "ผลการค้นหาพัสดุ" : "รับเข้าล่าสุด"} emptyLabel={showingSearch ? "ไม่พบพัสดุที่ตรงกับคำค้นหา" : "ยังไม่มีพัสดุที่รับเข้าวันนี้"} />
            {showingSearch && listed.length > 0 && (
              <div style={{ padding: "0 24px 20px" }}>
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
              </div>
            )}
          </>
        )}
      </section>

      <div className="mt-6">
        <UnmatchedQueue refreshKey={refreshKey} onOpenHistory={onOpenHistory} onChange={onDataChanged} />
      </div>
    </div>
  );
}
