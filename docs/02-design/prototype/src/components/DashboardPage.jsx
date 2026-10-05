import { dashboardResults, pendingDamagedParcels } from "../lib/parcelRules";
import React, { useMemo, useState } from "react";
import { Search, PackagePlus, ScanLine, AlertTriangle, ChevronDown, X } from "lucide-react";
import { PageHeader, ParcelTable } from "./shared";

function BottleneckPanel({ parcels }) {
  const damaged = useMemo(() => pendingDamagedParcels(parcels), [parcels]);
  return (
    <details className="damage-section">
      <summary>
        <span className="damage-heading"><AlertTriangle size={18} aria-hidden="true" />พัสดุชำรุด <span className="section-count">{damaged.length} รายการ</span></span>
        <span className="disclosure-action">ดูรายการ <ChevronDown size={16} aria-hidden="true" /></span>
      </summary>
      <div className="damage-content">
        <ParcelTable pageSize={8} numberedPages variant="dashboard" resetKey="pending-damage" parcels={damaged} showLine={false} emptyLabel="ไม่มีพัสดุชำรุดที่รอรับ" label="พัสดุชำรุด" />
      </div>
    </details>
  );
}

export default function DashboardPage({ parcels, onOpenCheckOut, onOpenCheckIn }) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => dashboardResults(parcels, query), [query, parcels]);
  return (
    <div className="dashboard-page">
      <div className="dashboard-heading">
        <PageHeader title="Dashboard" description="ค้นหาและจัดการพัสดุที่เคาน์เตอร์" />
        <div className="desk-actions">
          <button onClick={onOpenCheckIn} className="desk-button desk-button-in"><PackagePlus size={18} aria-hidden="true" />รับพัสดุเข้า</button>
          <button onClick={() => onOpenCheckOut(query)} className="desk-button desk-button-primary"><ScanLine size={18} aria-hidden="true" />นำพัสดุออก</button>
        </div>
      </div>
      <section className="parcel-register dashboard-register" aria-labelledby="search-heading">
        <div className="register-toolbar">
          <div className="register-search">
            <label id="search-heading" htmlFor="dashboard-search">ค้นหาพัสดุรอรับ</label>
            <div className="search-control">
              <Search size={19} aria-hidden="true" />
              <input id="dashboard-search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="เลขห้อง ชื่อผู้รับ หรือเลขพัสดุ" />
              {query && <button type="button" className="icon-button" aria-label="ล้างคำค้นหา" onClick={() => setQuery("")}><X size={17} aria-hidden="true" /></button>}
            </div>
          </div>
        </div>
        <ParcelTable pageSize={8} numberedPages variant="dashboard" resetKey={query} parcels={filtered} showLine={false} label="ผลการค้นหาพัสดุ" emptyLabel={query.trim() ? "ไม่พบพัสดุรอรับ ลองเปลี่ยนคำค้นหาหรือดูประวัติที่ Archive" : "ไม่มีพัสดุรอรับในขณะนี้"} />
      </section>
      <BottleneckPanel parcels={parcels} />
    </div>
  );
}
