import React, { useEffect, useId, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
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

function periodStart(value, period) {
  const d = parseDay(value);
  if (period === "month") d.setDate(1);
  if (period === "week") d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
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
  const shown = !loading && !error && summary && summary.period === period ? summary : null;
  const isCurrent = periodStart(date, period) === periodStart(today, period);

  const movements = [
    { key: "in", label: "รับเข้า", value: shown?.checkedIn },
    { key: "out", label: "นำออก", value: shown?.pickedUp },
  ];
  const periodCaption = period === "day" ? "รายการในวันที่เลือก" : period === "week" ? "รายการในสัปดาห์ที่เลือก" : "รายการในเดือนที่เลือก";

  return (
    <section className="summary-board" aria-labelledby={headingId} aria-busy={loading}>
      <div className="summary-board-header">
        <h2 id={headingId}>สรุปการรับ–จ่ายพัสดุ</h2>

        <div className="summary-range">
          <button type="button" className="icon-button" aria-label={`${meta.label}ก่อนหน้า`} onClick={() => setDate((d) => shiftDate(d, period, -1))}>
            <ChevronLeft size={18} aria-hidden="true" />
          </button>
          <p role="status">{shown ? rangeLabel(shown) : error ? "โหลดข้อมูลไม่สำเร็จ" : "กำลังโหลด…"}</p>
          <button type="button" className="icon-button" aria-label={`${meta.label}ถัดไป`} disabled={isCurrent} onClick={() => setDate((d) => shiftDate(d, period, 1))}>
            <ChevronRight size={18} aria-hidden="true" />
          </button>
          {!isCurrent && (
            <button type="button" className="text-button" onClick={() => setDate(today)}>กลับไป{meta.current}</button>
          )}
        </div>

        <div className="summary-periods" role="group" aria-label="ช่วงเวลา">
          {PERIODS.map((p) => (
            <button key={p.id} type="button" className="filter-button" aria-pressed={period === p.id} onClick={() => setPeriod(p.id)}>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <InlineError message={error} />
      <div className="summary-report">
        <div className="summary-movements">
          <p className="summary-period-caption">{periodCaption}</p>
          <dl className="summary-ledger">
            {movements.map(({ key, label, value }) => (
              <div key={key} className="summary-ledger-row" data-kind={key}>
                <dt>{label}</dt>
                <dd>{value == null ? "–" : value.toLocaleString()}<span className="summary-unit">ชิ้น</span></dd>
              </div>
            ))}
          </dl>
        </div>
        <div className="summary-balance" data-kind="pending">
          <dl>
            <dt>คงเหลือรอรับ{!isCurrent && <span className="sr-only"> ณ สิ้นสุดช่วงที่เลือก</span>}</dt>
            <dd>{shown?.pending == null ? "–" : shown.pending.toLocaleString()}<span className="summary-unit">ชิ้น</span></dd>
          </dl>
        </div>
      </div>
    </section>
  );
}
