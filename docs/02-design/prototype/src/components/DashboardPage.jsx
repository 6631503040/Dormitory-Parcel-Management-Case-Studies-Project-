import React, { useState } from "react";
import { PackagePlus, ScanLine } from "lucide-react";
import { SearchBar, ParcelTable, PageHeader, PagePagination } from "./shared";
import { InlineError } from "./Modals";
import UnmatchedQueue from "./UnmatchedQueue";
import SummaryBoard from "./SummaryBoard";
import useParcelPage, { PARCEL_PAGE_SIZE } from "./useParcelPage";

export default function DashboardPage({ onOpenCheckOut, onOpenCheckIn, onOpenHistory, refreshKey, onDataChanged }) {
  const [query, setQuery] = useState("");
  const { items, total, page, setPage, loading, error } = useParcelPage({ query, status: "pending", unmatched: false, refreshKey });
  return (
    <div>
      <div className="dashboard-heading">
        <PageHeader title="Dashboard" description="ค้นหาและจัดการพัสดุที่เคาน์เตอร์" />
        <div className="desk-actions">
          <button onClick={onOpenCheckIn} className="desk-button desk-button-in"><PackagePlus size={18} aria-hidden="true" />รับพัสดุเข้า</button>
          <button onClick={onOpenCheckOut} className="desk-button desk-button-primary"><ScanLine size={18} aria-hidden="true" />นำพัสดุออก</button>
        </div>
      </div>
      <SummaryBoard refreshKey={refreshKey} />
      <section className="parcel-register dashboard-register" aria-label="ค้นหาและจัดการพัสดุ">
        <div className="register-toolbar"><SearchBar label="ค้นหาพัสดุรอรับ" value={query} onChange={setQuery} placeholder="เลขห้อง ชื่อผู้รับ หรือเลขพัสดุ" /></div>
        <InlineError message={error} />
        <PagePagination page={page} total={total} pageSize={PARCEL_PAGE_SIZE} onChange={setPage} loading={loading} label="พัสดุรอรับ" />
        <div aria-busy={loading} className="parcel-page-content" data-reserve={total > PARCEL_PAGE_SIZE}>
          {loading ? <p className="table-empty" role="status">กำลังค้นหา…</p> : <ParcelTable parcels={items} onSelect={onOpenHistory} variant="dashboard" label="พัสดุรอรับ" emptyLabel={query.trim() ? "ไม่พบพัสดุที่ตรงกับคำค้นหา" : "ไม่มีพัสดุรอรับ"} />}
        </div>
      </section>
      <div className="mt-6"><UnmatchedQueue refreshKey={refreshKey} onOpenHistory={onOpenHistory} onChange={onDataChanged} /></div>
    </div>
  );
}
