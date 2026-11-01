import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { server } from "../test/server";
import ParcelHistoryModal from "./ParcelHistoryModal";
import { makeParcelDetail, makeRoomHit, apiError } from "../test/fixtures";

describe("ParcelHistoryModal", () => {
  it("fetches the parcel by its tracking code and renders its event timeline in order", async () => {
    let requestedPath;
    const detail = makeParcelDetail({
      trackingCode: "TH100",
      room: { id: 1, roomNumber: "101", buildingCode: "1" },
      status: "picked_up",
      events: [
        { id: 1, eventType: "checked_in", staff: { id: 2, fullName: "Somsri" }, occurredAt: "2026-09-20T01:00:00Z" },
        { id: 2, eventType: "checked_out", staff: { id: 3, fullName: "Prasert" }, occurredAt: "2026-09-21T01:00:00Z" },
      ],
    });
    server.use(
      http.get("/api/v1/parcels/TH100", ({ request }) => {
        requestedPath = new URL(request.url).pathname;
        return HttpResponse.json(detail);
      })
    );
    render(<ParcelHistoryModal trackingCode="TH100" onClose={vi.fn()} />);

    expect(screen.getByText("กำลังโหลด…")).toBeInTheDocument();

    await screen.findByText("TH100");
    expect(requestedPath).toBe("/api/v1/parcels/TH100");
    expect(screen.getByText("นำออกแล้ว")).toBeInTheDocument();

    const labels = screen.getAllByText(/^(รับเข้า|นำออก)$/).map((el) => el.textContent);
    expect(labels).toEqual(["รับเข้า", "นำออก"]);
    expect(screen.getByText(/โดย Somsri/)).toBeInTheDocument();
    expect(screen.getByText(/โดย Prasert/)).toBeInTheDocument();
  });

  it("shows the unmatched reason and note when the parcel has no room", async () => {
    server.use(
      http.get("/api/v1/parcels/R1", () =>
        HttpResponse.json(makeParcelDetail({ trackingCode: "R1", room: null, unmatchedReason: "ambiguous", note: "label says แนน", events: [] }))
      )
    );
    render(<ParcelHistoryModal trackingCode="R1" onClose={vi.fn()} />);
    expect(await screen.findByText(/ชื่อตรงกับหลายห้อง — label says แนน/)).toBeInTheDocument();
    expect(screen.getByText("มีปัญหา")).toBeInTheDocument();
    expect(screen.getByText("ไม่มีประวัติ")).toBeInTheDocument();
  });

  it("shows an error message when the parcel can't be found", async () => {
    server.use(http.get("/api/v1/parcels/GONE", () => HttpResponse.json({ code: "PARCEL_NOT_FOUND", params: { trackingCodes: ["GONE"] } }, { status: 404 })));
    render(<ParcelHistoryModal trackingCode="GONE" onClose={vi.fn()} />);
    expect(await screen.findByText(/ไม่พบพัสดุ: GONE/)).toBeInTheDocument();
  });

  it("re-fetches when the tracking code changes", async () => {
    server.use(
      http.get("/api/v1/parcels/A1", () => HttpResponse.json(makeParcelDetail({ trackingCode: "A1", events: [] }))),
      http.get("/api/v1/parcels/A2", () => HttpResponse.json(makeParcelDetail({ trackingCode: "A2", events: [] })))
    );
    const { rerender } = render(<ParcelHistoryModal trackingCode="A1" onClose={vi.fn()} />);
    await screen.findByText("A1");

    rerender(<ParcelHistoryModal trackingCode="A2" onClose={vi.fn()} />);
    await waitFor(() => expect(screen.queryByText("A1")).not.toBeInTheDocument());
    expect(await screen.findByText("A2")).toBeInTheDocument();
  });

  it("edits a Pending Parcel, sends only the changed fields, and shows the change in its history", async () => {
    let body;
    const before = makeParcelDetail({ trackingCode: "TYPO1", note: null });
    const after = makeParcelDetail({
      trackingCode: "FIXED1",
      room: { id: 2, roomNumber: "102", buildingCode: "1" },
      note: "ชำรุด: กล่องบุบ",
      events: [
        ...before.events,
        {
          id: 99, eventType: "edited", staff: { id: 3, fullName: "Prasert" }, occurredAt: "2026-09-22T03:00:00Z",
          detail: { changes: { trackingCode: { from: "TYPO1", to: "FIXED1" }, room: { from: { id: 1, label: "1101" }, to: { id: 2, label: "1102" } }, note: { from: null, to: "ชำรุด: กล่องบุบ" } } },
        },
      ],
    });
    server.use(
      http.get("/api/v1/parcels/TYPO1", () => HttpResponse.json(before)),
      http.get("/api/v1/parcels/FIXED1", () => HttpResponse.json(after)),
      http.get("/api/v1/rooms/search", () => HttpResponse.json({ items: [makeRoomHit({ id: 2, roomNumber: "102", buildingCode: "1" })] })),
      http.patch("/api/v1/parcels/TYPO1", async ({ request }) => {
        body = await request.json();
        return HttpResponse.json(after);
      })
    );
    const onChanged = vi.fn();
    const user = userEvent.setup();
    render(<ParcelHistoryModal trackingCode="TYPO1" onClose={vi.fn()} onChanged={onChanged} />);

    await user.click(await screen.findByRole("button", { name: /แก้ไข/ }));
    const save = screen.getByRole("button", { name: "บันทึกการแก้ไข" });
    expect(save).toBeDisabled(); // nothing changed yet

    const codeInput = screen.getByLabelText("เลขพัสดุ");
    await user.clear(codeInput);
    await user.type(codeInput, "fixed1");
    await user.click(screen.getByLabelText("เปลี่ยนห้อง"));
    await user.type(screen.getByRole("combobox"), "102");
    await user.click(await screen.findByRole("option", { name: /102/ }));
    await user.type(screen.getByLabelText(/หมายเหตุ/), "ชำรุด: กล่องบุบ");
    await user.click(save);

    expect(await screen.findByText("เลขพัสดุ: TYPO1 → FIXED1")).toBeInTheDocument();
    expect(body).toEqual({ trackingCode: "fixed1", roomId: 2, note: "ชำรุด: กล่องบุบ" });
    expect(screen.getByText("ห้อง: 1101 → 1102")).toBeInTheDocument();
    expect(screen.getByText("แก้ไขข้อมูล")).toBeInTheDocument();
    expect(onChanged).toHaveBeenCalledTimes(1);
  });

  it("keeps the form and shows the server's reason when an edit is rejected", async () => {
    server.use(
      http.get("/api/v1/parcels/TH1", () => HttpResponse.json(makeParcelDetail({ trackingCode: "TH1" }))),
      http.patch("/api/v1/parcels/TH1", () =>
        HttpResponse.json(apiError("DUPLICATE_TRACKING_CODE", { trackingCode: "TH2", roomNumber: "102", buildingCode: "1", checkedInAt: "2026-09-22T02:00:00Z" }), { status: 409 }))
    );
    const onChanged = vi.fn();
    const user = userEvent.setup();
    render(<ParcelHistoryModal trackingCode="TH1" onClose={vi.fn()} onChanged={onChanged} />);
    await user.click(await screen.findByRole("button", { name: /แก้ไข/ }));
    const codeInput = screen.getByLabelText("เลขพัสดุ");
    await user.clear(codeInput);
    await user.type(codeInput, "TH2");
    await user.click(screen.getByRole("button", { name: "บันทึกการแก้ไข" }));
    expect(await screen.findByText(/เลขพัสดุ TH2 ถูกบันทึกไว้แล้วที่ห้อง 1102/)).toBeInTheDocument();
    expect(screen.getByLabelText("เลขพัสดุ")).toHaveValue("TH2");
    expect(onChanged).not.toHaveBeenCalled();
  });

  it("offers no edit for Picked Up or unmatched Parcels", async () => {
    server.use(
      http.get("/api/v1/parcels/OUT1", () => HttpResponse.json(makeParcelDetail({ trackingCode: "OUT1", status: "picked_up" }))),
      http.get("/api/v1/parcels/R2", () => HttpResponse.json(makeParcelDetail({ trackingCode: "R2", room: null })))
    );
    const { rerender } = render(<ParcelHistoryModal trackingCode="OUT1" onClose={vi.fn()} />);
    await screen.findByText("OUT1");
    expect(screen.queryByRole("button", { name: /แก้ไข/ })).not.toBeInTheDocument();
    rerender(<ParcelHistoryModal trackingCode="R2" onClose={vi.fn()} />);
    await screen.findByText("R2");
    expect(screen.queryByRole("button", { name: /แก้ไข/ })).not.toBeInTheDocument();
  });

  it("closes via the close button", async () => {
    server.use(http.get("/api/v1/parcels/A1", () => HttpResponse.json(makeParcelDetail({ trackingCode: "A1", events: [] }))));
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<ParcelHistoryModal trackingCode="A1" onClose={onClose} />);
    await screen.findByText("A1");
    await user.click(screen.getByLabelText("ปิด"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
  it("paginates long audit histories without losing events and resets for a different parcel", async () => {
    const events = Array.from({length: 9}, (_, i) => ({id: i + 1, eventType: "note_added", staff: {id: i + 1, fullName: `เจ้าหน้าที่ ${i + 1}`}, occurredAt: "2026-09-20T01:00:00Z"}));
    server.use(
      http.get("/api/v1/parcels/H1", () => HttpResponse.json(makeParcelDetail({trackingCode: "H1", events}))),
      http.get("/api/v1/parcels/H2", () => HttpResponse.json(makeParcelDetail({trackingCode: "H2", events: []})))
    );
    const user = userEvent.setup();
    const {rerender} = render(<ParcelHistoryModal trackingCode="H1" onClose={vi.fn()} />);
    await screen.findByText("H1");
    expect(screen.getAllByText("บันทึกหมายเหตุ")).toHaveLength(8);
    expect(screen.getByText("โดย เจ้าหน้าที่ 1")).toBeInTheDocument();
    expect(screen.queryByText("โดย เจ้าหน้าที่ 9")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", {name: "ถัดไป"}));
    expect(screen.getByText("โดย เจ้าหน้าที่ 9")).toBeInTheDocument();
    expect(screen.queryByText("โดย เจ้าหน้าที่ 1")).not.toBeInTheDocument();
    expect(screen.getByRole("button", {name: "ถัดไป"})).toBeDisabled();
    rerender(<ParcelHistoryModal trackingCode="H2" onClose={vi.fn()} />);
    await screen.findByText("H2");
    expect(screen.getByText("ไม่มีประวัติ")).toBeInTheDocument();
    expect(screen.queryByRole("navigation", {name: "แบ่งหน้าประวัติพัสดุ"})).not.toBeInTheDocument();
  });

});
