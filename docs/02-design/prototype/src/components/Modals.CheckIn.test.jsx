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

  it("choosing a room alone does not stage or submit a parcel", async () => {
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

  it("submits a staged parcel only on the final batch save", async () => {
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
    await user.click(screen.getByRole("button", { name: "เพิ่มรายการ" }));
    await user.click(screen.getByRole("button", { name: "บันทึกทั้งหมด (1)" }));

    await screen.findByText("บันทึกเข้าสู่ระบบสำเร็จ 1 รายการ");
    expect(body).toEqual({ trackingCode: "TH8827301923", roomId: 1 });
    expect(screen.queryByText("TH8827301923")).not.toBeInTheDocument();
    // Fields reset and focus returns to the code field, ready for the next scan.
    expect(screen.getByLabelText(/เลขพัสดุ/)).toHaveValue("");
    await waitFor(() => expect(screen.getByLabelText(/เลขพัสดุ/)).toHaveFocus());
  });

  it("records a damaged matched parcel through the existing note field", async () => {
    mockRoomSearch(); let body;
    server.use(http.post("/api/v1/parcels", async ({request}) => { body = await request.json(); return HttpResponse.json(makeParcel({trackingCode: "TH100", note: body.note}), {status: 201}); }));
    const user = userEvent.setup();
    render(<CheckInModal onClose={vi.fn()} />);
    await user.type(screen.getByLabelText(/เลขพัสดุ/), "TH100"); await pickRoom(user);
    await user.click(screen.getByRole("checkbox", {name: "พัสดุมีปัญหา"}));
    expect(screen.getAllByRole("checkbox")).toHaveLength(1);
    expect(screen.getByText("1101 · สมชาย ใจดี")).toBeInTheDocument();
    await user.type(screen.getByLabelText("รายละเอียดปัญหา (ไม่บังคับ)"), "กล่องเปียก");
    await user.click(screen.getByRole("button", {name: "เพิ่มรายการ"}));
    await user.click(screen.getByRole("button", {name: "บันทึกทั้งหมด (1)"}));
    await screen.findByText("บันทึกเข้าสู่ระบบสำเร็จ 1 รายการ");
    expect(body).toEqual({trackingCode: "TH100", roomId: 1, note: "ชำรุด: กล่องเปียก"});
  });

  it("keeps add disabled until both a tracking code and a room are set", async () => {
    mockRoomSearch();
    const user = userEvent.setup();
    render(<CheckInModal onClose={vi.fn()} />);
    const submit = screen.getByRole("button", { name: "เพิ่มรายการ" });
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
    await user.click(screen.getByRole("button", { name: "เพิ่มรายการ" }));
    await user.click(screen.getByRole("button", { name: "บันทึกทั้งหมด (1)" }));

    expect(await screen.findByText(/TH1.*1101/)).toBeInTheDocument();
    expect(screen.queryByText(/บันทึกแล้วรอบนี้/)).not.toBeInTheDocument();
    expect(screen.getByText("TH1")).toBeInTheDocument();
    await user.click(screen.getByRole("button", {name: "แก้ไข TH1"}));
    expect(screen.getByLabelText(/เลขพัสดุ/)).toHaveValue("TH1");
  });

  it("shows the room-not-in-directory error when the server rejects the room", async () => {
    mockRoomSearch();
    server.use(http.post("/api/v1/parcels", () => HttpResponse.json({ code: "ROOM_NOT_IN_DIRECTORY", params: { roomId: 1 } }, { status: 422 })));
    const user = userEvent.setup();
    render(<CheckInModal onClose={vi.fn()} />);
    await user.type(screen.getByLabelText(/เลขพัสดุ/), "TH2");
    await pickRoom(user);
    await user.click(screen.getByRole("button", { name: "เพิ่มรายการ" }));
    await user.click(screen.getByRole("button", { name: "บันทึกทั้งหมด (1)" }));
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
    const submit = screen.getByRole("button", { name: "เพิ่มรายการ" });
    expect(submit).toBeDisabled(); // ticking "พัสดุมีปัญหา" is required, no reason picker needed

    await user.click(screen.getByText(/พัสดุมีปัญหา/));
    expect(submit).toBeEnabled();
    await user.type(screen.getByPlaceholderText(/หมายเหตุ/), "label says แนน");
    await user.click(submit);
    await user.click(screen.getByRole("button", {name: "บันทึกทั้งหมด (1)"}));

    await screen.findByText("บันทึกเข้าสู่ระบบสำเร็จ 1 รายการ");
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
    await user.click(screen.getByRole("button", { name: "เพิ่มรายการ" }));
    await user.click(screen.getByRole("button", { name: "บันทึกทั้งหมด (1)" }));

    await screen.findByText("บันทึกเข้าสู่ระบบสำเร็จ 1 รายการ");
    expect(body).toEqual({ trackingCode: "TH4", unmatchedReason: "other" });
  });

  it("closes via the close button, calling onClose", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<CheckInModal onClose={onClose} />);
    await user.click(screen.getByLabelText("ปิด"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
  it("stages multiple parcels without any POST, then saves them only on the final action", async () => {
    mockRoomSearch(); const bodies = [];
    server.use(http.post("/api/v1/parcels", async ({request}) => {
      const body = await request.json(); bodies.push(body);
      return HttpResponse.json(makeParcel({trackingCode: body.trackingCode}), {status: 201});
    }));
    const user = userEvent.setup(); render(<CheckInModal onClose={vi.fn()} />);
    for (const code of ["TH10", "TH11"]) {
      await user.type(screen.getByLabelText("เลขพัสดุ"), code); await pickRoom(user);
      await user.click(screen.getByRole("button", {name: "เพิ่มรายการ"}));
    }
    expect(bodies).toHaveLength(0);
    expect(screen.getByText("รอบันทึก (2)")).toBeInTheDocument();
    await user.click(screen.getByRole("button", {name: "บันทึกทั้งหมด (2)"}));
    await screen.findByText("บันทึกเข้าสู่ระบบสำเร็จ 2 รายการ");
    expect(bodies.map((body) => body.trackingCode)).toEqual(["TH10", "TH11"]);
    expect(screen.queryByRole("region", {name: "รายการรอบันทึก"})).not.toBeInTheDocument();
  });

  it("rejects local duplicate codes regardless of case and can remove a draft", async () => {
    const user = userEvent.setup(); render(<CheckInModal onClose={vi.fn()} />);
    for (const code of ["TH10", "th10"]) {
      await user.type(screen.getByLabelText("เลขพัสดุ"), code);
      await user.click(screen.getByRole("checkbox", {name: "พัสดุมีปัญหา"}));
      await user.click(screen.getByRole("button", {name: "เพิ่มรายการ"}));
    }
    expect(screen.getByText("เลขพัสดุนี้อยู่ในรายการรอบันทึกแล้ว")).toBeInTheDocument();
    expect(screen.getByText("รอบันทึก (1)")).toBeInTheDocument();
    await user.click(screen.getByRole("button", {name: "ลบ TH10"}));
    expect(screen.getByRole("button", {name: "บันทึกทั้งหมด (0)"})).toBeDisabled();
  });

  it("retains only failed drafts and retries without resending successful parcels", async () => {
    let fail = true; const calls = [];
    server.use(http.post("/api/v1/parcels", async ({request}) => {
      const body = await request.json(); calls.push(body.trackingCode);
      if (body.trackingCode === "TH11" && fail) return HttpResponse.json({code: "ROOM_NOT_IN_DIRECTORY"}, {status: 422});
      return HttpResponse.json(makeParcel({trackingCode: body.trackingCode}), {status: 201});
    }));
    const user = userEvent.setup(); render(<CheckInModal onClose={vi.fn()} />);
    for (const code of ["TH10", "TH11"]) {
      await user.type(screen.getByLabelText("เลขพัสดุ"), code);
      await user.click(screen.getByRole("checkbox", {name: "พัสดุมีปัญหา"}));
      await user.click(screen.getByRole("button", {name: "เพิ่มรายการ"}));
    }
    await user.click(screen.getByRole("button", {name: "บันทึกทั้งหมด (2)"}));
    await screen.findByText(/บันทึกสำเร็จ 1 จาก 2/);
    expect(screen.queryByText("TH10")).not.toBeInTheDocument();
    expect(screen.getByText("TH11")).toBeInTheDocument();
    fail = false;
    await user.click(screen.getByRole("button", {name: "บันทึกทั้งหมด (1)"}));
    await screen.findByText("บันทึกเข้าสู่ระบบสำเร็จ 2 รายการ");
    expect(calls).toEqual(["TH10", "TH11", "TH11"]);
  });

  it("protects drafts from accidental close and does not post on closing", async () => {
    const close = vi.fn(); const user = userEvent.setup(); render(<CheckInModal onClose={close} />);
    await user.type(screen.getByLabelText("เลขพัสดุ"), "TH10");
    await user.click(screen.getByRole("checkbox", {name: "พัสดุมีปัญหา"}));
    await user.click(screen.getByRole("button", {name: "เพิ่มรายการ"}));
    await user.click(screen.getByLabelText("ปิด")); expect(close).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", {name: "กลับไปทำต่อ"}));
    expect(screen.getByText("รอบันทึก (1)")).toBeInTheDocument();
    await user.click(screen.getByLabelText("ปิด"));
    await user.click(screen.getByRole("button", {name: "ทิ้งรายการและปิด"}));
    expect(close).toHaveBeenCalledTimes(1);
  });

  it("does not silently ignore a partially entered parcel when saving the queue", async () => {
    const user = userEvent.setup(); render(<CheckInModal onClose={vi.fn()} />);
    await user.type(screen.getByLabelText("เลขพัสดุ"), "TH10");
    await user.click(screen.getByRole("checkbox", {name: "พัสดุมีปัญหา"}));
    await user.click(screen.getByRole("button", {name: "เพิ่มรายการ"}));
    await user.type(screen.getByLabelText("เลขพัสดุ"), "TH11");
    await user.click(screen.getByRole("button", {name: "บันทึกทั้งหมด (1)"}));
    expect(screen.getByText("กดเพิ่มรายการก่อนบันทึกทั้งหมด หรือเคลียร์ช่องกรอก")).toBeInTheDocument();
  });

  it("stops on a network error and retains every unconfirmed draft", async () => {
    const calls = [];
    server.use(http.post("/api/v1/parcels", async ({request}) => {
      calls.push((await request.json()).trackingCode); return HttpResponse.error();
    }));
    const user = userEvent.setup(); render(<CheckInModal onClose={vi.fn()} />);
    for (const code of ["TH10", "TH11"]) {
      await user.type(screen.getByLabelText("เลขพัสดุ"), code);
      await user.click(screen.getByRole("checkbox", {name: "พัสดุมีปัญหา"}));
      await user.click(screen.getByRole("button", {name: "เพิ่มรายการ"}));
    }
    await user.click(screen.getByRole("button", {name: "บันทึกทั้งหมด (2)"}));
    await screen.findByText(/บันทึกสำเร็จ 0 จาก 2/);
    expect(calls).toEqual(["TH10"]);
    expect(screen.getByText("TH10")).toBeInTheDocument();
    expect(screen.getByText("TH11")).toBeInTheDocument();
  });

  it("paginates drafts in groups of eight and clamps the page after removing the last item", async () => {
    const user = userEvent.setup(); render(<CheckInModal onClose={vi.fn()} />);
    for (let index = 1; index <= 9; index += 1) {
      await user.type(screen.getByLabelText("เลขพัสดุ"), `TH${index}`);
      await user.click(screen.getByRole("checkbox", {name: "พัสดุมีปัญหา"}));
      await user.click(screen.getByRole("button", {name: "เพิ่มรายการ"}));
    }
    expect(screen.getByText("หน้า 2 / 2")).toBeInTheDocument();
    expect(screen.queryByText("TH1")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", {name: "ก่อนหน้า"}));
    expect(screen.getByText("TH1")).toBeInTheDocument();
    expect(screen.queryByText("TH9")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", {name: "ถัดไป"}));
    await user.click(screen.getByRole("button", {name: "ลบ TH9"}));
    expect(screen.getByText("TH1")).toBeInTheDocument();
    expect(screen.queryByRole("navigation", {name: "หน้ารายการรอบันทึก"})).not.toBeInTheDocument();
  });

});
