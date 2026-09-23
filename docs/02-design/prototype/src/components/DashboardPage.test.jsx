import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { server } from "../test/server";
import DashboardPage from "./DashboardPage";
import { makeDashboard, makeParcel } from "../test/fixtures";

const noUnmatched = () => HttpResponse.json({ items: [], page: 1, pageSize: 1, total: 0 });

// UnmatchedQueue is a real child of DashboardPage and makes its own requests (counts + list) to
// the same /api/v1/parcels endpoint — give it an empty, harmless queue by default so these tests
// can focus on the Dashboard's own behaviour.
function mockEnv({ dashboard = makeDashboard(), search } = {}) {
  server.use(http.get("/api/v1/dashboard", () => HttpResponse.json(dashboard)));
  server.use(
    http.get("/api/v1/parcels", ({ request }) => {
      const url = new URL(request.url);
      if (url.searchParams.get("unmatched") === "true") return noUnmatched();
      return search ? search(url) : HttpResponse.json({ items: [], page: 1, pageSize: 20, total: 0 });
    })
  );
}

describe("DashboardPage", () => {
  it("loads today's counts and recent check-ins on mount", async () => {
    mockEnv({
      dashboard: makeDashboard({
        checkedIn: 4,
        pickedUp: 1,
        pending: 3,
        unmatchedPending: 1,
        recentCheckIns: [makeParcel({ trackingCode: "TH100" })],
      }),
    });
    render(<DashboardPage onOpenCheckOut={vi.fn()} onOpenCheckIn={vi.fn()} onOpenHistory={vi.fn()} refreshKey={0} />);

    expect(await screen.findByText("4")).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText(/รวมพัสดุมีปัญหา 1 รายการ/)).toBeInTheDocument();
    expect(screen.getByText("TH100")).toBeInTheDocument();
  });

  it("refetches the day's counts when the date changes", async () => {
    server.use(
      http.get("/api/v1/dashboard", ({ request }) => {
        const date = new URL(request.url).searchParams.get("date");
        return HttpResponse.json(makeDashboard({ checkedIn: date === "2026-09-20" ? 99 : 4 }));
      })
    );
    server.use(http.get("/api/v1/parcels", () => noUnmatched()));
    render(<DashboardPage onOpenCheckOut={vi.fn()} onOpenCheckIn={vi.fn()} onOpenHistory={vi.fn()} refreshKey={0} />);
    await screen.findByText("4");

    const user = userEvent.setup();
    const dateInput = screen.getByLabelText("สรุปประจำวันที่");
    await user.clear(dateInput);
    await user.type(dateInput, "2026-09-20");

    expect(await screen.findByText("99")).toBeInTheDocument();
  });

  it("searches across all parcels and shows results instead of recent check-ins", async () => {
    let seenQuery;
    mockEnv({
      dashboard: makeDashboard({ recentCheckIns: [makeParcel({ trackingCode: "RECENT1" })] }),
      search: (url) => {
        seenQuery = url.searchParams.get("q");
        return HttpResponse.json({ items: [makeParcel({ trackingCode: "FOUND1" })], page: 1, pageSize: 20, total: 1 });
      },
    });
    const user = userEvent.setup();
    render(<DashboardPage onOpenCheckOut={vi.fn()} onOpenCheckIn={vi.fn()} onOpenHistory={vi.fn()} refreshKey={0} />);
    await screen.findByText("RECENT1");

    await user.type(screen.getByLabelText("ค้นหาพัสดุ"), "101");

    expect(await screen.findByText("FOUND1")).toBeInTheDocument();
    expect(screen.queryByText("RECENT1")).not.toBeInTheDocument();
    expect(seenQuery).toBe("101");

    await user.clear(screen.getByLabelText("ค้นหาพัสดุ"));
    expect(await screen.findByText("RECENT1")).toBeInTheDocument();
  });

  it("loads more search results a page at a time", async () => {
    mockEnv({
      search: (url) => {
        const page = Number(url.searchParams.get("page"));
        if (page === 1) {
          return HttpResponse.json({ items: Array.from({ length: 20 }, (_, i) => makeParcel({ trackingCode: `P${i}` })), page: 1, pageSize: 20, total: 25 });
        }
        return HttpResponse.json({ items: Array.from({ length: 5 }, (_, i) => makeParcel({ trackingCode: `P${20 + i}` })), page: 2, pageSize: 20, total: 25 });
      },
    });
    const user = userEvent.setup();
    render(<DashboardPage onOpenCheckOut={vi.fn()} onOpenCheckIn={vi.fn()} onOpenHistory={vi.fn()} refreshKey={0} />);
    await user.type(screen.getByLabelText("ค้นหาพัสดุ"), "P");

    await screen.findByText("P0");
    expect(screen.getByText("แสดง 20 จาก 25 รายการ")).toBeInTheDocument();
    expect(screen.queryByText("P24")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "แสดงเพิ่ม" }));
    expect(await screen.findByText("P24")).toBeInTheDocument();
  });

  it("opens history when a row is clicked, whether it's a recent check-in or a search result", async () => {
    mockEnv({ dashboard: makeDashboard({ recentCheckIns: [makeParcel({ trackingCode: "TH100" })] }) });
    const onOpenHistory = vi.fn();
    const user = userEvent.setup();
    render(<DashboardPage onOpenCheckOut={vi.fn()} onOpenCheckIn={vi.fn()} onOpenHistory={onOpenHistory} refreshKey={0} />);
    await user.click(await screen.findByText("TH100"));
    expect(onOpenHistory).toHaveBeenCalledWith(expect.objectContaining({ trackingCode: "TH100" }));
  });

  it("shows an inline error if the dashboard summary fails to load", async () => {
    server.use(http.get("/api/v1/dashboard", () => HttpResponse.json({ code: "INTERNAL_ERROR" }, { status: 500 })));
    server.use(http.get("/api/v1/parcels", () => noUnmatched()));
    render(<DashboardPage onOpenCheckOut={vi.fn()} onOpenCheckIn={vi.fn()} onOpenHistory={vi.fn()} refreshKey={0} />);
    expect(await screen.findByText("เกิดข้อผิดพลาดบางอย่าง กรุณาลองใหม่อีกครั้ง")).toBeInTheDocument();
  });

  it("opens Check-In and Check-Out from their buttons", async () => {
    mockEnv();
    const onOpenCheckIn = vi.fn();
    const onOpenCheckOut = vi.fn();
    const user = userEvent.setup();
    render(<DashboardPage onOpenCheckOut={onOpenCheckOut} onOpenCheckIn={onOpenCheckIn} onOpenHistory={vi.fn()} refreshKey={0} />);
    await user.click(screen.getByRole("button", { name: /เข้า/ }));
    await user.click(screen.getByRole("button", { name: /ออก/ }));
    expect(onOpenCheckIn).toHaveBeenCalledTimes(1);
    expect(onOpenCheckOut).toHaveBeenCalledTimes(1);
  });
});
