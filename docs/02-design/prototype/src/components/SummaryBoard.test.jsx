import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { server } from "../test/server";
import SummaryBoard, { rangeLabel } from "./SummaryBoard";
import { makeDashboard } from "../test/fixtures";
import { toDateInputValue } from "./shared";

// The server decides the period's range; this fake mirrors it closely enough for the UI: a day is
// itself, a week starts on Monday, a month on the 1st.
function rangeFor(date, period) {
  const [y, m, d] = date.split("-").map(Number);
  const day = new Date(y, m - 1, d);
  if (period === "day") return { from: date, to: date };
  if (period === "week") {
    const start = new Date(day);
    start.setDate(day.getDate() - ((day.getDay() + 6) % 7));
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    return { from: toDateInputValue(start), to: toDateInputValue(end) };
  }
  return { from: toDateInputValue(new Date(y, m - 1, 1)), to: toDateInputValue(new Date(y, m, 0)) };
}

function mockDashboard(counts = {}) {
  const requests = [];
  server.use(
    http.get("/api/v1/dashboard", ({ request }) => {
      const url = new URL(request.url);
      const date = url.searchParams.get("date");
      const period = url.searchParams.get("period");
      requests.push({ date, period });
      return HttpResponse.json(makeDashboard({ date, period, ...rangeFor(date, period), ...(counts[period] || {}) }));
    })
  );
  return requests;
}

const card = (label) => screen.getByText(label).closest(".summary-card");
// Wait for real numbers, not the loading state (whose notes already read "…ตอนนี้").
const loaded = () => waitFor(() => expect(within(card("พัสดุเข้า")).queryByText("–")).not.toBeInTheDocument());

describe("SummaryBoard", () => {
  it("shows today's received, picked up and still-waiting counts", async () => {
    const requests = mockDashboard({ day: { checkedIn: 12, pickedUp: 7, pending: 1234, unmatchedPending: 26 } });
    render(<SummaryBoard refreshKey={0} />);
    await waitFor(() => expect(within(card("พัสดุเข้า")).getByText("12")).toBeInTheDocument());
    expect(within(card("พัสดุออก")).getByText("7")).toBeInTheDocument();
    expect(within(card("รอรับในระบบ")).getByText("1,234")).toBeInTheDocument();
    // The waiting total includes unmatched Parcels, which the list below doesn't show — say so.
    expect(screen.getByText("ค้างอยู่ตอนนี้ · รวมพัสดุมีปัญหา 26 ชิ้น")).toBeInTheDocument();
    expect(requests[0]).toEqual({ date: toDateInputValue(), period: "day" });
    // Can't step into the future from the current period.
    expect(screen.getByRole("button", { name: "วันถัดไป" })).toBeDisabled();
  });

  it("switches between day, week and month", async () => {
    const requests = mockDashboard({ week: { checkedIn: 80 }, month: { checkedIn: 300 } });
    const user = userEvent.setup();
    render(<SummaryBoard refreshKey={0} />);
    await loaded();

    await user.click(screen.getByRole("button", { name: "สัปดาห์" }));
    await waitFor(() => expect(within(card("พัสดุเข้า")).getByText("80")).toBeInTheDocument());
    expect(screen.getByRole("button", { name: "สัปดาห์" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("รับเข้าในสัปดาห์นี้")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "เดือน" }));
    await waitFor(() => expect(within(card("พัสดุเข้า")).getByText("300")).toBeInTheDocument());
    expect(requests.map((r) => r.period)).toEqual(["day", "week", "month"]);
  });

  it("steps back to an earlier period and returns to the current one", async () => {
    const requests = mockDashboard();
    const user = userEvent.setup();
    render(<SummaryBoard refreshKey={0} />);
    await loaded();
    await user.click(screen.getByRole("button", { name: "เดือน" }));
    await loaded();
    expect(screen.getByText("รับเข้าในเดือนนี้")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "เดือนก่อนหน้า" }));
    expect(await screen.findByText("ค้างอยู่ ณ สิ้นสุดช่วง")).toBeInTheDocument();
    const prev = new Date();
    prev.setDate(1);
    prev.setMonth(prev.getMonth() - 1);
    expect(requests.at(-1)).toEqual({ date: toDateInputValue(prev), period: "month" });
    expect(screen.getByRole("button", { name: "เดือนถัดไป" })).toBeEnabled();

    await user.click(screen.getByRole("button", { name: "กลับไปเดือนนี้" }));
    expect(await screen.findByText("รับเข้าในเดือนนี้")).toBeInTheDocument();
    expect(requests.at(-1).date).toBe(toDateInputValue());
  });

  it("shows the server's error instead of numbers", async () => {
    server.use(http.get("/api/v1/dashboard", () => HttpResponse.json({ code: "INTERNAL_ERROR", params: {} }, { status: 500 })));
    render(<SummaryBoard refreshKey={0} />);
    expect(await screen.findByText(/เกิดข้อผิดพลาด/)).toBeInTheDocument();
    expect(within(card("พัสดุเข้า")).getByText("–")).toBeInTheDocument();
  });

  it("labels each period in Thai with Buddhist-era years", () => {
    expect(rangeLabel({ period: "day", from: "2026-10-27", to: "2026-10-27" })).toBe("27 ต.ค. 2569");
    expect(rangeLabel({ period: "week", from: "2026-10-26", to: "2026-11-01" })).toBe("26 ต.ค. – 1 พ.ย. 2569");
    expect(rangeLabel({ period: "week", from: "2026-12-28", to: "2027-01-03" })).toBe("28 ธ.ค. 2569 – 3 ม.ค. 2570");
    expect(rangeLabel({ period: "month", from: "2026-10-01", to: "2026-10-31" })).toBe("ต.ค. 2569");
  });
});
