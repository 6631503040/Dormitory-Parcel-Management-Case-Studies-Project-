import React, { useEffect, useId, useState } from "react";
import { PackagePlus, PackageCheck, Clock, ChevronLeft, ChevronRight } from "lucide-react";
import { THAI_MONTHS, toDateInputValue } from "./shared";
import { InlineError } from "./Modals";
import { api } from "../api/client";
import { errorMessage } from "../api/errorMessages";

// Daily Status Dashboard (CLAUDE.md feature 4): Parcels received, Parcels picked up, and Parcels still
// waiting — for the day, week (Mon–Sun) or month the Staff choose. Received / picked up are counts
// within the period; "waiting" is the outstanding balance at the end of it (now, for the current one).
const PERIODS = [
  { id: "day", label: "วัน", current: "วันนี้" },
  { id: "week", label: "สัปดาห์", current: "สัปดาห์นี้" },
  { id: "month", label: "เดือน", current: "เดือนนี้" },
];

function parseDay(value) {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function shiftDate(value, period, step) {
  const d = parseDay(value);
  if (period === "day") d.setDate(d.getDate() + step);
  else if (period === "week") d.setDate(d.getDate() + 7 * step);
  else {
    d.setDate(1);
    d.setMonth(d.getMonth() + step);
  }
  return toDateInputValue(d);
}

function dayLabel(value, withYear = true) {
  const d = parseDay(value);
  return `${d.getDate()} ${THAI_MONTHS[d.getMonth()]}${withYear ? ` ${d.getFullYear() + 543}` : ""}`;
}

export function rangeLabel({ period, from, to }) {
  if (period === "day") return dayLabel(from);
  if (period === "month") {
    const d = parseDay(from);
    return `${THAI_MONTHS[d.getMonth()]} ${d.getFullYear() + 543}`;
  }
  return `${dayLabel(from, from.slice(0, 4) !== to.slice(0, 4))} – ${dayLabel(to)}`;
}

export default function SummaryBoard({ refreshKey }) {
  const headingId = useId();
  const [period, setPeriod] = useState("day");
  const [date, setDate] = useState(() => toDateInputValue());
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    api
      .dashboard({ date, period }, controller.signal)
      .then((res) => {
        if (!controller.signal.aborted) setSummary(res);
      })
      .catch((err) => {
        if (!controller.signal.aborted) setError(errorMessage(err));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [date, period, refreshKey]);

  const today = toDateInputValue();
  const meta = PERIODS.find((p) => p.id === period);
  // The board shows the server's answer for the current request only — never a stale period's numbers
  // under a new label.
  const shown = summary && summary.period === period ? summary : null;
  const isCurrent = shown ? shown.from <= today && today <= shown.to : true;

  const cards = [
    { key: "in", label: "พัสดุเข้า", icon: PackagePlus, value: shown?.checkedIn, note: `รับเข้าใน${isCurrent ? meta.current : "ช่วงนี้"}` },
    { key: "out", label: "พัสดุออก", icon: PackageCheck, value: shown?.pickedUp, note: `นำออกใน${isCurrent ? meta.current : "ช่วงนี้"}` },
    {
      key: "pending", label: "รอรับในระบบ", icon: Clock, value: shown?.pending,
      // unmatchedPending is a count for right now, so it only explains the current period's total.
      note: isCurrent
        ? `ค้างอยู่ตอนนี้${shown?.unmatchedPending ? ` · รวมพัสดุมีปัญหา ${shown.unmatchedPending.toLocaleString()} ชิ้น` : ""}`
        : "ค้างอยู่ ณ สิ้นสุดช่วง",
    },
  ];

  return (
    <section className="summary-board" aria-labelledby={headingId} aria-busy={loading}>
      <div className="summary-board-header">
        <h2 id={headingId}>สรุปพัสดุ</h2>
        <div className="summary-periods" role="group" aria-label="ช่วงเวลา">
          {PERIODS.map((p) => (
            <button key={p.id} type="button" className="filter-button" aria-pressed={period === p.id} onClick={() => setPeriod(p.id)}>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="summary-range">
        <button type="button" className="icon-button" aria-label={`${meta.label}ก่อนหน้า`} onClick={() => setDate((d) => shiftDate(d, period, -1))}>
          <ChevronLeft size={18} aria-hidden="true" />
        </button>
        <p role="status">{shown ? rangeLabel(shown) : "กำลังโหลด…"}</p>
        <button type="button" className="icon-button" aria-label={`${meta.label}ถัดไป`} disabled={isCurrent} onClick={() => setDate((d) => shiftDate(d, period, 1))}>
          <ChevronRight size={18} aria-hidden="true" />
        </button>
        {!isCurrent && (
          <button type="button" className="text-button" onClick={() => setDate(today)}>กลับไป{meta.current}</button>
        )}
      </div>

      <InlineError message={error} />
      <dl className="summary-cards">
        {cards.map(({ key, label, icon: Icon, value, note }) => (
          <div key={key} className="summary-card" data-kind={key}>
            <dt><Icon size={18} aria-hidden="true" />{label}</dt>
            <dd>{value == null ? "–" : value.toLocaleString()}</dd>
            <p>{note}</p>
          </div>
        ))}
      </dl>
    </section>
  );
}
