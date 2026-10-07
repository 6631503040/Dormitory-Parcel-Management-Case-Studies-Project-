import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { server } from "../test/server";
import ArchivePage from "./ArchivePage";
import { makeParcel } from "../test/fixtures";

const room = { id: 1, roomNumber: "101", buildingCode: "1" };

// One handler that understands the four tab filters (status/unmatched combinations) plus the
// free-text query, over a fixed dataset — the same shape ArchivePage.jsx itself builds.
function mockArchiveData(items) {
  server.use(
    http.get("/api/v1/parcels", ({ request }) => {
      const p = new URL(request.url).searchParams;
      let filtered = items;
      if (p.get("status")) filtered = filtered.filter((x) => x.status === p.get("status"));
      if (p.get("unmatched") === "true") filtered = filtered.filter((x) => !x.room);
      if (p.get("unmatched") === "false") filtered = filtered.filter((x) => !!x.room);
      const q = p.get("q");
      if (q) filtered = filtered.filter((x) => x.trackingCode.includes(q.toUpperCase()));
      const page = Number(p.get("page") || "1");
      const pageSize = Number(p.get("pageSize") || "20");
      const start = (page - 1) * pageSize;
      return HttpResponse.json({ items: filtered.slice(start, start + pageSize), page, pageSize, total: filtered.length });
    })
  );
}

const pending = makeParcel({ trackingCode: "TH100", room, status: "pending" });
const pickedUp = makeParcel({ trackingCode: "TH101", room, status: "picked_up" });
const unmatched = makeParcel({ trackingCode: "TH102", room: null, status: "pending", unmatchedReason: "no_match" });

describe("ArchivePage", () => {
  it("shows all parcels with per-tab counts by default", async () => {
    mockArchiveData([pending, pickedUp, unmatched]);
    render(<ArchivePage onOpenHistory={vi.fn()} />);

    expect(await screen.findByText("3 รายการ")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "ทั้งหมด (3)" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "รอรับ (1)" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "นำออกแล้ว (1)" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "มีปัญหา (1)" })).toBeInTheDocument();
    expect(screen.getByText("TH100")).toBeInTheDocument();
    expect(screen.getByText("TH101")).toBeInTheDocument();
  });

  it("filters to only picked-up parcels on the 'นำออกแล้ว' tab", async () => {
    mockArchiveData([pending, pickedUp, unmatched]);
    const user = userEvent.setup();
    render(<ArchivePage onOpenHistory={vi.fn()} />);
    await screen.findByText("TH100");

    await user.click(screen.getByRole("button", { name: "นำออกแล้ว (1)" }));

    await waitFor(() => expect(screen.queryByText("TH100")).not.toBeInTheDocument());
    expect(screen.getByText("TH101")).toBeInTheDocument();
  });

  it("filters to the unmatched queue on the 'มีปัญหา' tab — distinct from ordinary pending", async () => {
    mockArchiveData([pending, pickedUp, unmatched]);
    const user = userEvent.setup();
    render(<ArchivePage onOpenHistory={vi.fn()} />);
    await screen.findByText("TH100");

    await user.click(screen.getByRole("button", { name: "มีปัญหา (1)" }));

    await waitFor(() => expect(screen.queryByText("TH100")).not.toBeInTheDocument());
    expect(screen.getByText("TH102")).toBeInTheDocument();
  });

  it("searches by tracking code / room / resident name", async () => {
    mockArchiveData([pending, pickedUp, unmatched]);
    const user = userEvent.setup();
    render(<ArchivePage onOpenHistory={vi.fn()} />);
    await screen.findByText("TH100");

    await user.type(screen.getByPlaceholderText(/ค้นหาด้วยชื่อผู้พัก/), "TH101");

    await waitFor(() => expect(screen.queryByText("TH100")).not.toBeInTheDocument());
    expect(screen.getByText("TH101")).toBeInTheDocument();
  });

  it("shows the empty-state message when nothing matches", async () => {
    mockArchiveData([]);
    render(<ArchivePage onOpenHistory={vi.fn()} />);
    expect(await screen.findByText("ไม่พบรายการที่ตรงกับคำค้นหา")).toBeInTheDocument();
  });

  it("loads more results a page at a time", async () => {
    const many = Array.from({ length: 25 }, (_, i) => makeParcel({ trackingCode: `TH${100 + i}`, room, status: "pending" }));
    mockArchiveData(many);
    const user = userEvent.setup();
    render(<ArchivePage onOpenHistory={vi.fn()} />);

    await screen.findByText("TH100");
    expect(screen.getByText("แสดง 20 จาก 25 รายการ")).toBeInTheDocument();
    expect(screen.queryByText("TH124")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "แสดงเพิ่ม" }));
    expect(await screen.findByText("TH124")).toBeInTheDocument();
  });

  it("opens a parcel's history when a row is clicked", async () => {
    mockArchiveData([pending]);
    const onOpenHistory = vi.fn();
    const user = userEvent.setup();
    render(<ArchivePage onOpenHistory={onOpenHistory} />);
    await user.click(await screen.findByText("TH100"));
    expect(onOpenHistory).toHaveBeenCalledWith(expect.objectContaining({ trackingCode: "TH100" }));
  });

  it("shows an inline error when the list fails to load", async () => {
    server.use(http.get("/api/v1/parcels", () => HttpResponse.json({ code: "INTERNAL_ERROR" }, { status: 500 })));
    render(<ArchivePage onOpenHistory={vi.fn()} />);
    expect(await screen.findByText("เกิดข้อผิดพลาดบางอย่าง กรุณาลองใหม่อีกครั้ง")).toBeInTheDocument();
  });
});
