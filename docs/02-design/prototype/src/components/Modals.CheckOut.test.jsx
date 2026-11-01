import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor, within, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { server } from "../test/server";
import { CheckOutModal } from "./Modals";
import { makeParcel, makeParcelDetail } from "../test/fixtures";

const room = { id: 1, roomNumber: "101", buildingCode: "1" };
const parcel = makeParcelDetail({ trackingCode: "TH100", room });
function setup(items = [parcel], total = items.length) {
  const lookup = vi.fn();
  server.use(http.get("/api/v1/parcels/:code", ({params}) => {
    lookup(params.code); return HttpResponse.json(parcel);
  }), http.get("/api/v1/parcels", ({request}) => {
    const url = new URL(request.url);
    expect(["1", "2"]).toContain(url.searchParams.get("roomId"));
    expect(url.searchParams.get("status")).toBe("pending");
    expect(url.searchParams.get("pageSize")).toBe("8");
    return HttpResponse.json({items, total, page: Number(url.searchParams.get("page")), pageSize: 8});
  }));
  const onConfirm = vi.fn();
  render(<CheckOutModal onClose={vi.fn()} onConfirm={onConfirm} />);
  return { user: userEvent.setup(), lookup, onConfirm };
}
async function find(user) {
  await user.type(screen.getByLabelText("เลขพัสดุ"), "th100{Enter}");
  await screen.findByRole("region", {name: "ข้อมูลพัสดุที่ค้นพบ"});
}

describe("scanner-first CheckOutModal", () => {
  it("waits for the scanner burst to finish and supports immediate Enter submission", async () => {
    const {user, lookup} = setup();
    expect(screen.queryByRole("button", {name: "ยืนยันนำออก"})).not.toBeInTheDocument();
    await user.type(screen.getByLabelText("เลขพัสดุ"), "TH100");
    await new Promise(resolve => setTimeout(resolve, 250));
    expect(lookup).not.toHaveBeenCalled();
    await user.keyboard("{Enter}");
    await screen.findByRole("region", {name: "ข้อมูลพัสดุที่ค้นพบ"});
    expect(lookup).toHaveBeenCalledWith("TH100");
  });
  it("Enter only finds parcel details; checkout needs explicit confirmation", async () => {
    const {user, onConfirm} = setup();
    let sent;
    server.use(http.post("/api/v1/parcels/check-out", async ({request}) => {
      sent = await request.json(); return HttpResponse.json({parcels: [{...parcel, status: "picked_up"}]});
    }));
    await find(user);
    expect(onConfirm).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", {name: "ยืนยันนำออก"}));
    await waitFor(() => expect(onConfirm).toHaveBeenCalled());
    expect(sent).toEqual({trackingCodes: ["TH100"]});
  });
  it("blocks confirmation after staff edit the verified code", async () => {
    const {user} = setup(); await find(user);
    await user.type(screen.getByLabelText("เลขพัสดุ"), "X");
    expect(screen.getByRole("button", {name: "ยืนยันนำออก"})).toBeDisabled();
  });
  it("has no separate scanner button — the scanner types straight into the tracking field", () => {
    setup();
    expect(screen.queryByRole("button", {name: "เตรียมสแกน"})).not.toBeInTheDocument();
    expect(screen.getByLabelText("เลขพัสดุ")).toHaveFocus();
  });
  it("shows API not-found and picked-up errors without allowing checkout", async () => {
    const {user} = setup();
    server.use(http.get("/api/v1/parcels/:code", () => HttpResponse.json({code: "PARCEL_NOT_FOUND"}, {status: 404})));
    await user.type(screen.getByLabelText("เลขพัสดุ"), "missing{Enter}");
    await screen.findByRole("alert");
    expect(screen.queryByRole("button", {name: "ยืนยันนำออก"})).not.toBeInTheDocument();
    server.use(http.get("/api/v1/parcels/:code", () => HttpResponse.json({...parcel, status: "picked_up"})));
    await user.type(screen.getByLabelText("เลขพัสดุ"), "TH100{Enter}");
    await screen.findByText("พัสดุนี้นำออกแล้วหรือไม่อยู่ในสถานะรอรับ");
  });
  it("checks out a parcel that has no room, without asking for one", async () => {
    const {user, onConfirm} = setup();
    const roomless = {...parcel, room: null, residents: [], unmatchedReason: "other"};
    let sent;
    server.use(
      http.get("/api/v1/parcels/:code", () => HttpResponse.json(roomless)),
      http.post("/api/v1/parcels/check-out", async ({request}) => {
        sent = await request.json(); return HttpResponse.json({parcels: [{...roomless, status: "picked_up"}]});
      })
    );
    await user.type(screen.getByLabelText("เลขพัสดุ"), "TH100{Enter}");
    await screen.findByRole("region", {name: "ข้อมูลพัสดุที่ค้นพบ"});
    expect(screen.getByText("ยังไม่ระบุห้อง")).toBeInTheDocument();
    expect(screen.getByText("ตรวจสอบชื่อผู้รับกับฉลากพัสดุก่อนส่งมอบ")).toBeInTheDocument();
    expect(screen.queryByText(/พัสดุอื่นของห้องนี้/)).not.toBeInTheDocument(); // no room, no room list
    await user.click(screen.getByRole("button", {name: "ยืนยันนำออก"}));
    await waitFor(() => expect(onConfirm).toHaveBeenCalled());
    expect(sent).toEqual({trackingCodes: ["TH100"]});
  });
  it("keeps a failed selection for retry and does not report completion", async () => {
    const {user, onConfirm} = setup();
    server.use(http.post("/api/v1/parcels/check-out", () => HttpResponse.json({code: "INTERNAL_ERROR"}, {status: 500})));
    await find(user); await user.click(screen.getByRole("button", {name: "ยืนยันนำออก"}));
    await screen.findByRole("alert");
    expect(screen.getByRole("button", {name: "ยืนยันนำออก"})).toBeEnabled();
    expect(onConfirm).not.toHaveBeenCalled();
  });
  it("selects additional parcels with native checkboxes and uses selected-code endpoint", async () => {
    const other = makeParcel({trackingCode: "TH101", room});
    const {user, onConfirm} = setup([parcel, other]); let sent;
    server.use(http.post("/api/v1/parcels/check-out", async ({request}) => {
      sent = await request.json(); return HttpResponse.json({parcels: [parcel, other]});
    }));
    await find(user); await user.click(screen.getByText(/พัสดุอื่นของห้องนี้/));
    await user.click(await screen.findByText("TH101"));
    await user.click(screen.getByRole("button", {name: "ยืนยันนำออก"}));
    await waitFor(() => expect(onConfirm).toHaveBeenCalled());
    expect(sent.trackingCodes).toEqual(["TH100", "TH101"]);
  });
  it("checks out the entire room with expectedCount even when its server list spans pages", async () => {
    const {user, onConfirm} = setup([parcel, makeParcel({trackingCode: "TH101", room})], 20); let sent;
    server.use(http.post("/api/v1/rooms/1/check-out-all", async ({request}) => {
      sent = await request.json(); return HttpResponse.json({parcels: [parcel]});
    }));
    await find(user); await user.click(screen.getByText(/พัสดุอื่นของห้องนี้/));
    await user.click(await screen.findByRole("checkbox", {name: "เลือกทั้งหมดของห้อง"}));
    await user.click(screen.getByRole("button", {name: "ยืนยันนำออก"}));
    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.getByText("นำออกทั้งหมด 20 รายการของห้อง 1101?")).toBeInTheDocument();
    await user.click(screen.getByRole("button", {name: "ยืนยันนำออกทั้งหมด (20)"}));
    await waitFor(() => expect(onConfirm).toHaveBeenCalled());
    expect(sent).toEqual({expectedCount: 20});
  });
  it("accumulates scans in the same room, resets focus, and submits once", async () => {
    const {user, onConfirm} = setup(); const calls = [];
    server.use(http.get("/api/v1/parcels/:code", ({params}) => HttpResponse.json({...parcel, trackingCode: params.code})),
      http.post("/api/v1/parcels/check-out", async ({request}) => {
        calls.push(await request.json()); return HttpResponse.json({parcels: [parcel]});
      }));
    await find(user);
    const input = screen.getByLabelText("เลขพัสดุ");
    await waitFor(() => expect(input).toHaveFocus()); expect(input).toHaveValue("");
    await user.type(input, "TH101{Enter}");
    await screen.findByRole("button", {name: "ลบ TH101"});
    expect(screen.getByRole("button", {name: "ลบ TH100"})).toBeInTheDocument();
    expect(calls).toHaveLength(0);
    await user.click(screen.getByRole("button", {name: "ยืนยันนำออก"}));
    await waitFor(() => expect(onConfirm).toHaveBeenCalledTimes(1));
    expect(calls).toEqual([{trackingCodes: ["TH100", "TH101"]}]);
  });

  it("rejects duplicate, other-room and picked-up scans without losing the existing selection", async () => {
    const {user, lookup} = setup(); await find(user);
    const input = screen.getByLabelText("เลขพัสดุ");
    await user.type(input, "TH100{Enter}");
    await screen.findByText("เลขพัสดุนี้อยู่ในรายการรอนำออกแล้ว");
    expect(lookup).toHaveBeenCalledTimes(1);
    server.use(http.get("/api/v1/parcels/:code", ({params}) => HttpResponse.json({...parcel, trackingCode: params.code, room: {...room, id: 2}})));
    await user.type(input, "TH200{Enter}");
    await screen.findByText(/พัสดุนี้ไม่ใช่ห้องเดียว/);
    expect(screen.getByRole("button", {name: "ลบ TH100"})).toBeInTheDocument();
    expect(screen.queryByRole("button", {name: "ลบ TH200"})).not.toBeInTheDocument();
    server.use(http.get("/api/v1/parcels/:code", () => HttpResponse.json({...parcel, trackingCode: "TH300", status: "picked_up"})));
    await user.clear(input); await user.type(input, "TH300{Enter}");
    await screen.findByText("พัสดุนี้นำออกแล้วหรือไม่อยู่ในสถานะรอรับ");
    expect(screen.getByRole("button", {name: "ลบ TH100"})).toBeInTheDocument();
    expect(screen.getByRole("button", {name: "ยืนยันนำออก"})).toBeEnabled(); // only the valid queued item can be handed over
  });

  it("removes the last selected parcel and allows starting a new recipient room", async () => {
    const {user} = setup(); await find(user);
    await user.click(screen.getByRole("button", {name: "ลบ TH100"}));
    expect(screen.queryByRole("region", {name: "ข้อมูลพัสดุที่ค้นพบ"})).not.toBeInTheDocument();
    server.use(http.get("/api/v1/parcels/:code", () => HttpResponse.json({...parcel, trackingCode: "TH200", room: {...room, id: 2}})));
    await user.type(screen.getByLabelText("เลขพัสดุ"), "TH200{Enter}");
    await screen.findByRole("button", {name: "ลบ TH200"});
  });

  it("shows eight scanned parcels per page and submits all pages together", async () => {
    const {user, onConfirm} = setup(); let sent;
    server.use(http.get("/api/v1/parcels/:code", ({params}) => HttpResponse.json({...parcel, trackingCode: params.code})),
      http.post("/api/v1/parcels/check-out", async ({request}) => {
        sent = await request.json(); return HttpResponse.json({parcels: [parcel]});
      }));
    for (let index = 1; index <= 9; index += 1) {
      await user.type(screen.getByLabelText("เลขพัสดุ"), `TH${index}{Enter}`);
      await screen.findByRole("button", {name: `ลบ TH${index}`, exact: true});
    }
    const table = screen.getByRole("table", {name: "พัสดุรอนำออก"});
    expect(within(table).queryByText("TH1")).not.toBeInTheDocument();
    expect(within(table).getByText("TH9")).toBeInTheDocument();
    await user.click(within(screen.getByRole("navigation", {name: "แบ่งหน้าพัสดุรอนำออก"})).getByRole("button", {name: "ก่อนหน้า"}));
    expect(within(table).getAllByRole("row")).toHaveLength(9);
    await user.click(screen.getByRole("button", {name: "ยืนยันนำออก"}));
    await waitFor(() => expect(onConfirm).toHaveBeenCalled());
    expect(sent.trackingCodes).toHaveLength(9);
  });

  it("automatically adds consecutive scanner bursts without Enter or clicking Add", async () => {
    const {user, onConfirm} = setup();
    server.use(http.get("/api/v1/parcels/:code", ({params}) => HttpResponse.json({...parcel, trackingCode: params.code})));
    const input = screen.getByLabelText("เลขพัสดุ");
    await user.type(input, "TH100");
    await screen.findByRole("button", {name: "ลบ TH100"});
    expect(input).toHaveValue(""); expect(input).toHaveFocus();
    await user.type(input, "TH101");
    await screen.findByRole("button", {name: "ลบ TH101"});
    expect(screen.getByRole("button", {name: "ลบ TH100"})).toBeInTheDocument();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("buffers a second complete scan while the first lookup is still running", async () => {
    const {user} = setup(); let release;
    const gate = new Promise((resolve) => { release = resolve; });
    const codes = [];
    server.use(http.get("/api/v1/parcels/:code", async ({params}) => {
      codes.push(params.code); if (params.code === "TH100") await gate;
      return HttpResponse.json({...parcel, trackingCode: params.code});
    }));
    const input = screen.getByLabelText("เลขพัสดุ");
    await user.type(input, "TH100");
    await waitFor(() => expect(codes).toEqual(["TH100"]));
    expect(input).toBeEnabled();
    await user.type(input, "TH101");
    await waitFor(() => expect(input).toHaveValue(""));
    release();
    await screen.findByRole("button", {name: "ลบ TH101"});
    expect(screen.getByRole("button", {name: "ลบ TH100"})).toBeInTheDocument();
    expect(codes).toEqual(["TH100", "TH101"]);
  });

  it("keeps slowly hand-typed text until Enter instead of looking up each character (QA-05)", async () => {
    const {lookup} = setup();
    const slow = userEvent.setup({delay: 450});
    const input = screen.getByLabelText("เลขพัสดุ");
    await slow.type(input, "TH1");
    await new Promise((resolve) => setTimeout(resolve, 500));
    expect(lookup).not.toHaveBeenCalled();
    expect(input).toHaveValue("TH1");
    expect(screen.getByText("พิมพ์ครบแล้วกด Enter เพื่อค้นหา")).toBeInTheDocument();
    await slow.type(input, "00{Enter}");
    await screen.findByRole("region", {name: "ข้อมูลพัสดุที่ค้นพบ"});
    expect(lookup).toHaveBeenCalledTimes(1);
    expect(lookup).toHaveBeenCalledWith("TH100");
  }, 10000);

  it("looks up a pasted code without Enter, like a scanner burst", async () => {
    const {user, lookup} = setup();
    await user.click(screen.getByLabelText("เลขพัสดุ"));
    await user.paste("TH100");
    await screen.findByRole("region", {name: "ข้อมูลพัสดุที่ค้นพบ"});
    expect(lookup).toHaveBeenCalledWith("TH100");
  });

  it("waits for IME composition to finish before automatic lookup", async () => {
    const {lookup} = setup(); const input = screen.getByLabelText("เลขพัสดุ");
    fireEvent.compositionStart(input); fireEvent.change(input, {target: {value: "TH100"}});
    await new Promise((resolve) => setTimeout(resolve, 450));
    expect(lookup).not.toHaveBeenCalled();
    fireEvent.compositionEnd(input);
    await screen.findByRole("button", {name: "ลบ TH100"});
    expect(lookup).toHaveBeenCalledTimes(1);
  });

  it("keeps the scan surface minimal and hides unrelated room options for a single parcel", async () => {
    const {user} = setup();
    expect(screen.queryByRole("button", {name: "เพิ่ม", exact: true})).not.toBeInTheDocument();
    await find(user);
    expect(screen.queryByText("ปกติ")).not.toBeInTheDocument();
    expect(screen.queryByText("พัสดุอื่นของห้องนี้")).not.toBeInTheDocument();
    expect(screen.getByRole("button", {name: "ลบ TH100"})).toHaveTextContent("ลบ");
  });

  it("keeps damage notes readable without a separate repeated condition column", async () => {
    const {user} = setup();
    server.use(http.get("/api/v1/parcels/:code", () => HttpResponse.json({...parcel, note: "ชำรุด: กล่องเปียก"})));
    await find(user);
    const table = screen.getByRole("table", {name: "พัสดุรอนำออก"});
    expect(within(table).getByText("ชำรุด: กล่องเปียก")).toBeInTheDocument();
    expect(within(table).getAllByRole("columnheader")).toHaveLength(2);
  });

  it("shows the actual room-wide handover items across pages when selecting the entire room", async () => {
    const items = Array.from({length: 9}, (_, i) => makeParcel({trackingCode: `TH${100 + i}`, room}));
    const {user} = setup(items.slice(0, 8), 9);
    server.use(http.get("/api/v1/parcels", ({request}) => {
      const page = Number(new URL(request.url).searchParams.get("page"));
      return HttpResponse.json({items: items.slice((page - 1) * 8, page * 8), total: 9, page, pageSize: 8});
    }));
    await find(user);
    await user.click(screen.getByText("พัสดุอื่นของห้องนี้"));
    await user.click(await screen.findByRole("checkbox", {name: "เลือกทั้งหมดของห้อง"}));
    const table = screen.getByRole("table", {name: "พัสดุรอนำออก"});
    await waitFor(() => expect(within(table).getAllByRole("row")).toHaveLength(9));
    expect(within(table).getByText("TH107")).toBeInTheDocument();
    const pager = screen.getByRole("navigation", {name: "แบ่งหน้าพัสดุรอนำออก"});
    await user.click(within(pager).getByRole("button", {name: "ถัดไป"}));
    await waitFor(() => expect(within(table).getByText("TH108")).toBeInTheDocument());
    expect(within(table).queryByText("TH100")).not.toBeInTheDocument();
    expect(screen.getAllByRole("status").some((node) => node.textContent === "รอนำออก 9 รายการ")).toBe(true);
    await user.click(screen.getByRole("checkbox", {name: "เลือกทั้งหมดของห้อง"}));
    expect(within(table).getByText("TH100")).toBeInTheDocument();
    expect(within(table).queryByText("TH108")).not.toBeInTheDocument();
  });

});
