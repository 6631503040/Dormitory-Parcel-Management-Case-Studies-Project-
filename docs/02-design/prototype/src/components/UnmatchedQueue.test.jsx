import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { server } from "../test/server";
import UnmatchedQueue from "./UnmatchedQueue";
import { makeParcel, makeRoomHit } from "../test/fixtures";

// One handler that behaves like the real /parcels?unmatched=true&status=pending&page=&pageSize=
// endpoint for a fixed dataset — reused by every request the component makes (the main list and
// any refetch), exactly like the real backend would be.
function mockUnmatchedData(items) {
  server.use(
    http.get("/api/v1/parcels", ({ request }) => {
      const url = new URL(request.url);
      const page = Number(url.searchParams.get("page") || "1");
      const pageSize = Number(url.searchParams.get("pageSize") || "20");
      const start = (page - 1) * pageSize;
      return HttpResponse.json({ items: items.slice(start, start + pageSize), page, pageSize, total: items.length });
    })
  );
}

const r1 = makeParcel({ trackingCode: "R1", room: null, unmatchedReason: "no_match", checkedInAt: "2026-09-20T01:00:00Z" });
const r2 = makeParcel({ trackingCode: "R2", room: null, unmatchedReason: "no_match", checkedInAt: "2026-09-20T02:00:00Z" });
const r3 = makeParcel({ trackingCode: "R3", room: null, unmatchedReason: "ambiguous", checkedInAt: "2026-09-20T03:00:00Z" });

describe("UnmatchedQueue", () => {
  it("shows nothing extra when the queue is empty", async () => {
    mockUnmatchedData([]);
    render(<UnmatchedQueue onOpenHistory={vi.fn()} />);
    expect(await screen.findByText("ไม่มีพัสดุที่มีปัญหา")).toBeInTheDocument();
    expect(screen.queryByText(/มีปัญหา \d+ รายการ/)).not.toBeInTheDocument();
  });

  it("shows the total count badge and the full list, with each item's reason shown inline", async () => {
    mockUnmatchedData([r1, r2, r3]);
    render(<UnmatchedQueue onOpenHistory={vi.fn()} />);

    expect(await screen.findByText("มีปัญหา 3 รายการ")).toBeInTheDocument();
    expect(screen.getByText("R1")).toBeInTheDocument();
    expect(screen.getByText("R3")).toBeInTheDocument();
    expect(screen.getAllByText(/ไม่พบห้องที่ตรงกัน/).length).toBe(2); // r1, r2 — shown per row, no filter tabs
    expect(screen.getByText(/ชื่อตรงกับหลายห้อง/)).toBeInTheDocument(); // r3
  });

  it("resolves an item by choosing a room from the directory, then reports the change", async () => {
    mockUnmatchedData([r1]);
    server.use(http.get("/api/v1/rooms/search", () => HttpResponse.json({ items: [makeRoomHit({ id: 1, roomNumber: "101", buildingCode: "1" })] })));
    let sentRoomId;
    server.use(
      http.patch("/api/v1/parcels/R1/room", async ({ request }) => {
        sentRoomId = (await request.json()).roomId;
        return HttpResponse.json(makeParcel({ trackingCode: "R1", room: { id: 1, roomNumber: "101", buildingCode: "1" } }));
      })
    );
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<UnmatchedQueue onOpenHistory={vi.fn()} onChange={onChange} />);

    await screen.findByText("R1");
    await user.click(screen.getByRole("button", { name: "ระบุห้อง" }));
    await user.type(screen.getByRole("combobox"), "101");
    await user.click(await screen.findByRole("option", { name: /101/ }));
    await user.click(screen.getByRole("button", { name: "ยืนยันระบุห้อง" }));

    await waitFor(() => expect(sentRoomId).toBe(1));
    await waitFor(() => expect(onChange).toHaveBeenCalledTimes(1));
  });

  it("shows an inline error and keeps the form open when resolving fails", async () => {
    mockUnmatchedData([r1]);
    server.use(http.get("/api/v1/rooms/search", () => HttpResponse.json({ items: [makeRoomHit({ id: 1, roomNumber: "101", buildingCode: "1" })] })));
    server.use(http.patch("/api/v1/parcels/R1/room", () => HttpResponse.json({ code: "ROOM_NOT_IN_DIRECTORY", params: { roomId: 1 } }, { status: 422 })));
    const user = userEvent.setup();
    render(<UnmatchedQueue onOpenHistory={vi.fn()} />);

    await screen.findByText("R1");
    await user.click(screen.getByRole("button", { name: "ระบุห้อง" }));
    await user.type(screen.getByRole("combobox"), "101");
    await user.click(await screen.findByRole("option", { name: /101/ }));
    await user.click(screen.getByRole("button", { name: "ยืนยันระบุห้อง" }));

    expect(await screen.findByText("ไม่พบห้องนี้ในทะเบียนผู้พัก กรุณาเลือกห้องจากรายการ")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "ยืนยันระบุห้อง" })).toBeInTheDocument(); // still open, not lost
  });

  it("cancelling the resolve form closes it without calling the API", async () => {
    mockUnmatchedData([r1]);
    const user = userEvent.setup();
    render(<UnmatchedQueue onOpenHistory={vi.fn()} />);
    await screen.findByText("R1");
    await user.click(screen.getByRole("button", { name: "ระบุห้อง" }));
    await user.click(screen.getByRole("button", { name: "ยกเลิก" }));
    expect(screen.queryByRole("button", { name: "ยืนยันระบุห้อง" })).not.toBeInTheDocument();
  });

  it("paginates with load more, five at a time", async () => {
    const many = Array.from({ length: 6 }, (_, i) =>
      makeParcel({ trackingCode: `M${i}`, room: null, unmatchedReason: "other", checkedInAt: `2026-09-2${i}T01:00:00Z` })
    );
    mockUnmatchedData(many);
    const user = userEvent.setup();
    render(<UnmatchedQueue onOpenHistory={vi.fn()} />);

    await screen.findByText("M0");
    expect(screen.getByText("M4")).toBeInTheDocument();
    expect(screen.queryByText("M5")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /แสดงเพิ่ม/ }));
    expect(await screen.findByText("M5")).toBeInTheDocument();
  });

  it("opens a Parcel's history when its tracking code is clicked", async () => {
    mockUnmatchedData([r1]);
    const onOpenHistory = vi.fn();
    const user = userEvent.setup();
    render(<UnmatchedQueue onOpenHistory={onOpenHistory} />);
    await user.click(await screen.findByText("R1"));
    expect(onOpenHistory).toHaveBeenCalledWith(expect.objectContaining({ trackingCode: "R1" }));
  });
});
