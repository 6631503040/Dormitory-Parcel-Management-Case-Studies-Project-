import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { server } from "../test/server";
import { CheckInModal } from "./Modals";
import { makeParcel, makeRoomHit } from "../test/fixtures";

const room101 = makeRoomHit({ id: 1, roomNumber: "101", buildingCode: "1", residents: [{ id: 1, fullName: "สมชาย ใจดี", nickname: null }] });

function mockRoomSearch(entry = room101) {
  server.use(http.get("/api/v1/rooms/search", () => HttpResponse.json({ items: [entry] })));
}

async function pickRoom(user, query = "101") {
  await user.type(screen.getByRole("combobox"), query);
  await user.click(await screen.findByRole("option", { name: /101/ }));
}

describe("CheckInModal", () => {
  it("Enter on the tracking code moves to the room field instead of submitting anything", async () => {
    const user = userEvent.setup();
    render(<CheckInModal onClose={vi.fn()} />);
    await user.type(screen.getByLabelText(/เลขพัสดุ/), "TH100{Enter}");
    await waitFor(() => expect(screen.getByRole("combobox")).toHaveFocus());
    // no POST /parcels handler is registered — if one had been called, MSW's onUnhandledRequest
    // ("error") would have failed this test.
  });

  it("requires an explicit click on 'บันทึก' — choosing a room alone does not submit", async () => {
    mockRoomSearch();
    const user = userEvent.setup();
    render(<CheckInModal onClose={vi.fn()} />);

    await user.type(screen.getByLabelText(/เลขพัสดุ/), "TH8827301923");
    await pickRoom(user);
    // The room is chosen and shown, but nothing was posted yet — no POST handler is even
    // registered, so MSW's onUnhandledRequest ("error") would fail this test if one had fired.
    expect(await screen.findByText("1101 · สมชาย ใจดี")).toBeInTheDocument();
    expect(screen.queryByText(/บันทึกแล้วรอบนี้/)).not.toBeInTheDocument();
  });

  it("submits on 'บันทึก' once a tracking code and room are both set", async () => {
    mockRoomSearch();
    let body;
    server.use(
      http.post("/api/v1/parcels", async ({ request }) => {
        body = await request.json();
        return HttpResponse.json(makeParcel({ trackingCode: "TH8827301923", room: { id: 1, roomNumber: "101", buildingCode: "1" } }), { status: 201 });
      })
    );
    const user = userEvent.setup();
    render(<CheckInModal onClose={vi.fn()} />);

    await user.type(screen.getByLabelText(/เลขพัสดุ/), "TH8827301923");
    await pickRoom(user);
    await user.click(screen.getByRole("button", { name: "บันทึก" }));

    await screen.findByText("บันทึกแล้วรอบนี้ (1)");
    expect(body).toEqual({ trackingCode: "TH8827301923", roomId: 1 });
    expect(screen.getByText("TH8827301923")).toBeInTheDocument();
    // Fields reset and focus returns to the code field, ready for the next scan.
    expect(screen.getByLabelText(/เลขพัสดุ/)).toHaveValue("");
    await waitFor(() => expect(screen.getByLabelText(/เลขพัสดุ/)).toHaveFocus());
  });

  it("keeps 'บันทึก' disabled until both a tracking code and a room are set", async () => {
    mockRoomSearch();
    const user = userEvent.setup();
    render(<CheckInModal onClose={vi.fn()} />);
    const submit = screen.getByRole("button", { name: "บันทึก" });
    expect(submit).toBeDisabled();

    await user.type(screen.getByLabelText(/เลขพัสดุ/), "TH8827301923");
    expect(submit).toBeDisabled(); // no room yet

    await pickRoom(user);
    expect(submit).toBeEnabled();
  });

  it("shows the duplicate-tracking-code error inline and keeps the fields so staff can fix them", async () => {
    mockRoomSearch();
    server.use(
      http.post("/api/v1/parcels", () =>
        HttpResponse.json(
          { code: "DUPLICATE_TRACKING_CODE", params: { trackingCode: "TH1", roomNumber: "101", buildingCode: "1", checkedInAt: "2026-09-20T01:00:00Z" } },
          { status: 409 }
        )
      )
    );
    const user = userEvent.setup();
    render(<CheckInModal onClose={vi.fn()} />);
    await user.type(screen.getByLabelText(/เลขพัสดุ/), "TH1");
    await pickRoom(user);
    await user.click(screen.getByRole("button", { name: "บันทึก" }));

    expect(await screen.findByText(/TH1.*1101/)).toBeInTheDocument();
    expect(screen.queryByText(/บันทึกแล้วรอบนี้/)).not.toBeInTheDocument();
    expect(screen.getByLabelText(/เลขพัสดุ/)).toHaveValue("TH1");
  });

  it("shows the room-not-in-directory error when the server rejects the room", async () => {
    mockRoomSearch();
    server.use(http.post("/api/v1/parcels", () => HttpResponse.json({ code: "ROOM_NOT_IN_DIRECTORY", params: { roomId: 1 } }, { status: 422 })));
    const user = userEvent.setup();
    render(<CheckInModal onClose={vi.fn()} />);
    await user.type(screen.getByLabelText(/เลขพัสดุ/), "TH2");
    await pickRoom(user);
    await user.click(screen.getByRole("button", { name: "บันทึก" }));
    expect(await screen.findByText("ไม่พบห้องนี้ในทะเบียนผู้พัก กรุณาเลือกห้องจากรายการ")).toBeInTheDocument();
  });

  it("submits a problem parcel with a fixed reason once staff tick the box and click บันทึก", async () => {
    let body;
    server.use(
      http.post("/api/v1/parcels", async ({ request }) => {
        body = await request.json();
        return HttpResponse.json(makeParcel({ trackingCode: "TH3", room: null, unmatchedReason: "other" }), { status: 201 });
      })
    );
    const user = userEvent.setup();
    render(<CheckInModal onClose={vi.fn()} />);

    await user.type(screen.getByLabelText(/เลขพัสดุ/), "TH3");
    const submit = screen.getByRole("button", { name: "บันทึก" });
    expect(submit).toBeDisabled(); // ticking "พัสดุมีปัญหา" is required, no reason picker needed

    await user.click(screen.getByText(/พัสดุมีปัญหา/));
    expect(submit).toBeEnabled();
    await user.type(screen.getByPlaceholderText(/หมายเหตุ/), "label says แนน");
    await user.click(submit);

    await screen.findByText("บันทึกแล้วรอบนี้ (1)");
    expect(body).toEqual({ trackingCode: "TH3", unmatchedReason: "other", note: "label says แนน" });
  });

  it("omits the note field entirely when left blank", async () => {
    let body;
    server.use(
      http.post("/api/v1/parcels", async ({ request }) => {
        body = await request.json();
        return HttpResponse.json(makeParcel({ trackingCode: "TH4", room: null, unmatchedReason: "other" }), { status: 201 });
      })
    );
    const user = userEvent.setup();
    render(<CheckInModal onClose={vi.fn()} />);
    await user.type(screen.getByLabelText(/เลขพัสดุ/), "TH4");
    await user.click(screen.getByText(/พัสดุมีปัญหา/));
    await user.click(screen.getByRole("button", { name: "บันทึก" }));

    await screen.findByText("บันทึกแล้วรอบนี้ (1)");
    expect(body).toEqual({ trackingCode: "TH4", unmatchedReason: "other" });
  });

  it("closes via the close button, calling onClose", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<CheckInModal onClose={onClose} />);
    await user.click(screen.getByLabelText("ปิด"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
