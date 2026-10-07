import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { server } from "../test/server";
import ParcelHistoryModal from "./ParcelHistoryModal";
import { makeParcelDetail } from "../test/fixtures";

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

  it("closes via the close button", async () => {
    server.use(http.get("/api/v1/parcels/A1", () => HttpResponse.json(makeParcelDetail({ trackingCode: "A1", events: [] }))));
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<ParcelHistoryModal trackingCode="A1" onClose={onClose} />);
    await screen.findByText("A1");
    await user.click(screen.getByLabelText("ปิด"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
