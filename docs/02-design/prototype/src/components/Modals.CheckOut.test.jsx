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
  }), http.get("/api/v1/rooms/search", () => HttpResponse.json({items: []})));
  const onConfirm = vi.fn();
  render(<CheckOutModal onClose={vi.fn()} onConfirm={onConfirm} />);
  return { user: userEvent.setup(), lookup, onConfirm };
}
async function find(user) {
  await user.type(screen.getByLabelText("เลขพัสดุ / เลขห้อง"), "th100{Enter}");
  await screen.findByRole("region", {name: "ข้อมูลพัสดุที่ค้นพบ"});
}

describe("scanner-first CheckOutModal", () => {
  it("waits for the scanner burst to finish and supports immediate Enter submission", async () => {
    const {user, lookup} = setup();
    expect(screen.queryByRole("button", {name: "ยืนยันนำออก"})).not.toBeInTheDocument();
    await user.type(screen.getByLabelText("เลขพัสดุ / เลขห้อง"), "TH100");
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
    await user.type(screen.getByLabelText("เลขพัสดุ / เลขห้อง"), "X");
    expect(screen.getByRole("button", {name: "ยืนยันนำออก"})).toBeDisabled();
  });
  it("has no separate scanner button — the scanner types straight into the tracking field", () => {
    setup();
    expect(screen.queryByRole("button", {name: "เตรียมสแกน"})).not.toBeInTheDocument();
    expect(screen.getByLabelText("เลขพัสดุ / เลขห้อง")).toHaveFocus();
  });
  it("shows API not-found and picked-up errors without allowing checkout", async () => {
    const {user} = setup();
    server.use(http.get("/api/v1/parcels/:code", () => HttpResponse.json({code: "PARCEL_NOT_FOUND"}, {status: 404})));
    await user.type(screen.getByLabelText("เลขพัสดุ / เลขห้อง"), "missing{Enter}");
    await screen.findByRole("alert");
    expect(screen.queryByRole("button", {name: "ยืนยันนำออก"})).not.toBeInTheDocument();
    server.use(http.get("/api/v1/parcels/:code", () => HttpResponse.json({...parcel, status: "picked_up"})));
    await user.type(screen.getByLabelText("เลขพัสดุ / เลขห้อง"), "TH100{Enter}");
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
    await user.type(screen.getByLabelText("เลขพัสดุ / เลขห้อง"), "TH100{Enter}");
    await screen.findByRole("region", {name: "ข้อมูลพัสดุที่ค้นพบ"});
    expect(screen.getByText("ยังไม่ระบุห้อง")).toBeInTheDocument();
    expect(screen.getByText("ตรวจสอบชื่อผู้รับกับฉลากพัสดุก่อนส่งมอบ")).toBeInTheDocument();
    expect(screen.getByRole("checkbox", {name: /TH100/})).toBeChecked();
    expect(screen.queryByRole("checkbox", {name: "เลือกทั้งหมดของห้อง"})).not.toBeInTheDocument(); // no room, no room list
    expect(screen.getByRole("button", {name: "ล้างรายการ"})).toBeInTheDocument();
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
    await find(user);
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
    await find(user);
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
    const input = screen.getByLabelText("เลขพัสดุ / เลขห้อง");
    await waitFor(() => expect(input).toHaveFocus()); expect(input).toHaveValue("");
    await user.type(input, "TH101{Enter}");
    await screen.findByRole("checkbox", {name: /TH101/});
    expect(screen.getByRole("checkbox", {name: /TH100/})).toBeInTheDocument();
    expect(calls).toHaveLength(0);
    await user.click(screen.getByRole("button", {name: "ยืนยันนำออก"}));
    await waitFor(() => expect(onConfirm).toHaveBeenCalledTimes(1));
    expect(calls).toEqual([{trackingCodes: ["TH100", "TH101"]}]);
  });

  it("rejects duplicate, other-room and picked-up scans without losing the existing selection", async () => {
    const {user, lookup} = setup(); await find(user);
    const input = screen.getByLabelText("เลขพัสดุ / เลขห้อง");
    await user.type(input, "TH100{Enter}");
    await screen.findByText("เลขพัสดุนี้อยู่ในรายการรอนำออกแล้ว");
    expect(lookup).toHaveBeenCalledTimes(1);
    server.use(http.get("/api/v1/parcels/:code", ({params}) => HttpResponse.json({...parcel, trackingCode: params.code, room: {...room, id: 2}})));
    await user.type(input, "TH200{Enter}");
    await screen.findByText(/พัสดุนี้ไม่ใช่ห้องเดียว/);
    expect(screen.getByRole("checkbox", {name: /TH100/})).toBeInTheDocument();
    expect(screen.queryByRole("checkbox", {name: /TH200/})).not.toBeInTheDocument();
    server.use(http.get("/api/v1/parcels/:code", () => HttpResponse.json({...parcel, trackingCode: "TH300", status: "picked_up"})));
    await user.clear(input); await user.type(input, "TH300{Enter}");
    await screen.findByText("พัสดุนี้นำออกแล้วหรือไม่อยู่ในสถานะรอรับ");
    expect(screen.getByRole("checkbox", {name: /TH100/})).toBeInTheDocument();
    expect(screen.getByRole("button", {name: "ยืนยันนำออก"})).toBeEnabled(); // only the valid queued item can be handed over
  });

  it("keeps the room open when the last Parcel is unticked, and changes room on request", async () => {
    const {user} = setup(); await find(user);
    await user.click(screen.getByRole("checkbox", {name: /TH100/}));
    expect(screen.getByRole("region", {name: "ข้อมูลพัสดุที่ค้นพบ"})).toBeInTheDocument();
    expect(screen.getByRole("button", {name: "ยืนยันนำออก"})).toBeDisabled();
    await user.click(screen.getByRole("button", {name: "เปลี่ยนห้อง"}));
    expect(screen.queryByRole("region", {name: "ข้อมูลพัสดุที่ค้นพบ"})).not.toBeInTheDocument();
    server.use(http.get("/api/v1/parcels/:code", () => HttpResponse.json({...parcel, trackingCode: "TH200", room: {...room, id: 2}})));
    await user.type(screen.getByLabelText("เลขพัสดุ / เลขห้อง"), "TH200{Enter}");
    expect(await screen.findByRole("checkbox", {name: /TH200/})).toBeChecked();
  });

  it("lists every scanned parcel and submits them together", async () => {
    const {user, onConfirm} = setup(); let sent;
    server.use(http.get("/api/v1/parcels/:code", ({params}) => HttpResponse.json({...parcel, trackingCode: params.code})),
      http.post("/api/v1/parcels/check-out", async ({request}) => {
        sent = await request.json(); return HttpResponse.json({parcels: [parcel]});
      }));
    for (let index = 1; index <= 9; index += 1) {
      await user.type(screen.getByLabelText("เลขพัสดุ / เลขห้อง"), `TH${index}{Enter}`);
      expect(await screen.findByRole("checkbox", {name: new RegExp(`^TH${index}\\b`)})).toBeChecked();
    }
    await user.click(screen.getByRole("button", {name: "ยืนยันนำออก"}));
    await waitFor(() => expect(onConfirm).toHaveBeenCalled());
    expect(sent.trackingCodes).toHaveLength(9);
  });

  it("automatically adds consecutive scanner bursts without Enter or clicking Add", async () => {
    const {user, onConfirm} = setup();
    server.use(http.get("/api/v1/parcels/:code", ({params}) => HttpResponse.json({...parcel, trackingCode: params.code})));
    const input = screen.getByLabelText("เลขพัสดุ / เลขห้อง");
    await user.type(input, "TH100");
    await screen.findByRole("checkbox", {name: /TH100/});
    expect(input).toHaveValue(""); expect(input).toHaveFocus();
    await user.type(input, "TH101");
    await screen.findByRole("checkbox", {name: /TH101/});
    expect(screen.getByRole("checkbox", {name: /TH100/})).toBeInTheDocument();
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
    const input = screen.getByLabelText("เลขพัสดุ / เลขห้อง");
    await user.type(input, "TH100");
    await waitFor(() => expect(codes).toEqual(["TH100"]));
    expect(input).toBeEnabled();
    await user.type(input, "TH101");
    await waitFor(() => expect(input).toHaveValue(""));
    release();
    await screen.findByRole("checkbox", {name: /TH101/});
    expect(screen.getByRole("checkbox", {name: /TH100/})).toBeInTheDocument();
    expect(codes).toEqual(["TH100", "TH101"]);
  });

  it("keeps slowly hand-typed text until Enter instead of looking up each character (QA-05)", async () => {
    const {lookup} = setup();
    const slow = userEvent.setup({delay: 450});
    const input = screen.getByLabelText("เลขพัสดุ / เลขห้อง");
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
    await user.click(screen.getByLabelText("เลขพัสดุ / เลขห้อง"));
    await user.paste("TH100");
    await screen.findByRole("region", {name: "ข้อมูลพัสดุที่ค้นพบ"});
    expect(lookup).toHaveBeenCalledWith("TH100");
  });

  it("waits for IME composition to finish before automatic lookup", async () => {
    const {lookup} = setup(); const input = screen.getByLabelText("เลขพัสดุ / เลขห้อง");
    fireEvent.compositionStart(input); fireEvent.change(input, {target: {value: "TH100"}});
    await new Promise((resolve) => setTimeout(resolve, 450));
    expect(lookup).not.toHaveBeenCalled();
    fireEvent.compositionEnd(input);
    await screen.findByRole("checkbox", {name: /TH100/});
    expect(lookup).toHaveBeenCalledTimes(1);
  });

  it("shows a scanned Parcel the same way as a room: ticked in the room's list", async () => {
    const other = makeParcel({trackingCode: "TH101", room});
    const {user} = setup([parcel, other]);
    await find(user);
    expect(await screen.findByRole("checkbox", {name: /TH101/})).not.toBeChecked();
    expect(screen.getByRole("checkbox", {name: /TH100/})).toBeChecked();
    expect(screen.getByRole("checkbox", {name: "เลือกทั้งหมดของห้อง"})).not.toBeChecked();
    expect(screen.getByRole("button", {name: "เปลี่ยนห้อง"})).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("keeps a scanned Parcel listed when it sits on another page of the room", async () => {
    const others = Array.from({length: 8}, (_, i) => makeParcel({trackingCode: `TH2${i}`, room}));
    const {user} = setup(others, 9);
    await find(user);
    await screen.findByRole("checkbox", {name: /TH20/});
    expect(screen.getByRole("checkbox", {name: /TH100/})).toBeChecked();
    expect(screen.getAllByRole("status").some((node) => node.textContent === "รอนำออก 1 รายการ")).toBe(true);
  });

  it("shows damage notes under the Tracking Code", async () => {
    const noted = {...parcel, note: "ชำรุด: กล่องเปียก"};
    const {user} = setup([noted]);
    server.use(http.get("/api/v1/parcels/:code", () => HttpResponse.json(noted)));
    await find(user);
    expect(await screen.findByText("ชำรุด: กล่องเปียก")).toBeInTheDocument();
  });

  it("pages through the room while the whole room is selected", async () => {
    const items = Array.from({length: 9}, (_, i) => makeParcel({trackingCode: `TH${100 + i}`, room}));
    const {user} = setup(items.slice(0, 8), 9);
    server.use(http.get("/api/v1/parcels", ({request}) => {
      const page = Number(new URL(request.url).searchParams.get("page"));
      return HttpResponse.json({items: items.slice((page - 1) * 8, page * 8), total: 9, page, pageSize: 8});
    }));
    await find(user);
    await user.click(await screen.findByRole("checkbox", {name: "เลือกทั้งหมดของห้อง"}));
    expect(screen.getByRole("checkbox", {name: /TH107/})).toBeChecked();
    await user.click(within(screen.getByRole("navigation", {name: "แบ่งหน้าพัสดุรอนำออก"})).getByRole("button", {name: "ถัดไป"}));
    expect(await screen.findByRole("checkbox", {name: /TH108/})).toBeChecked();
    expect(screen.queryByRole("checkbox", {name: /TH100/})).not.toBeInTheDocument();
    expect(screen.getAllByRole("status").some((node) => node.textContent === "รอนำออก 9 รายการ")).toBe(true);
  });

  describe("searching one field by room", () => {
    const field = () => screen.getByLabelText("เลขพัสดุ / เลขห้อง");
    const hit = {id: 1, roomNumber: "101", buildingCode: "1", residents: [{id: 1, fullName: "สมชาย ใจดี"}]};
    const items = [parcel, makeParcel({trackingCode: "TH101", room})];
    const result = {name: "ข้อมูลพัสดุที่ค้นพบ"};
    function setupRoom(list = items, hits = [hit]) {
      const ui = setup(list);
      server.use(
        http.get("/api/v1/parcels/:code", () => HttpResponse.json({code: "PARCEL_NOT_FOUND"}, {status: 404})),
        http.get("/api/v1/rooms/search", () => HttpResponse.json({items: hits}))
      );
      return ui;
    }

    it("lists every Pending Parcel of a typed room and checks them all out in one action", async () => {
      const {user, onConfirm} = setupRoom(); let sent;
      server.use(http.post("/api/v1/rooms/1/check-out-all", async ({request}) => {
        sent = await request.json(); return HttpResponse.json({parcels: items});
      }));
      await user.type(field(), "1101{Enter}");
      expect(await screen.findByRole("checkbox", {name: /TH100/})).toBeChecked();
      expect(screen.getByRole("checkbox", {name: /TH101/})).toBeChecked();
      expect(screen.getByRole("checkbox", {name: "เลือกทั้งหมดของห้อง"})).toBeChecked();
      expect(screen.getByText("สมชาย ใจดี")).toBeInTheDocument();
      expect(screen.queryByRole("table", {name: "พัสดุรอนำออก"})).not.toBeInTheDocument();

      await user.click(screen.getByRole("button", {name: "ยืนยันนำออก"}));
      expect(onConfirm).not.toHaveBeenCalled();
      await user.click(screen.getByRole("button", {name: "ยืนยันนำออกทั้งหมด (2)"}));
      await waitFor(() => expect(onConfirm).toHaveBeenCalled());
      expect(sent).toEqual({expectedCount: 2});
    });

    it("unticks one Parcel out of the whole room", async () => {
      const {user, onConfirm} = setupRoom(); let sent;
      server.use(http.post("/api/v1/parcels/check-out", async ({request}) => {
        sent = await request.json(); return HttpResponse.json({parcels: [items[1]]});
      }));
      await user.type(field(), "1101{Enter}");
      await user.click(await screen.findByRole("checkbox", {name: /TH100/}));
      expect(screen.getByRole("checkbox", {name: "เลือกทั้งหมดของห้อง"})).not.toBeChecked();
      expect(screen.getByRole("checkbox", {name: /TH101/})).toBeChecked();
      await user.click(screen.getByRole("button", {name: "ยืนยันนำออก"}));
      await waitFor(() => expect(onConfirm).toHaveBeenCalled());
      expect(sent).toEqual({trackingCodes: ["TH101"]});
    });

    it("goes back to select-all once every Parcel is ticked", async () => {
      const {user} = setupRoom();
      await user.type(field(), "1101{Enter}");
      await user.click(await screen.findByRole("checkbox", {name: /TH100/}));
      await user.click(screen.getByRole("checkbox", {name: /TH100/}));
      expect(screen.getByRole("checkbox", {name: "เลือกทั้งหมดของห้อง"})).toBeChecked();
    });

    it("keeps Parcels on other pages selected, so rows lock while the whole room is chosen", async () => {
      const {user} = setupRoom(items, [hit]);
      server.use(http.get("/api/v1/parcels", () => HttpResponse.json({items, total: 20, page: 1, pageSize: 8})));
      await user.type(field(), "1101{Enter}");
      expect(await screen.findByRole("checkbox", {name: /TH100/})).toBeDisabled();
      await user.click(screen.getByRole("checkbox", {name: "เลือกทั้งหมดของห้อง"}));
      expect(screen.getByRole("checkbox", {name: /TH100/})).toBeEnabled();
      expect(screen.getByRole("checkbox", {name: /TH100/})).not.toBeChecked();
    });

    it("still allows checking out individual Parcels", async () => {
      const {user, onConfirm} = setupRoom(); let sent;
      server.use(http.post("/api/v1/parcels/check-out", async ({request}) => {
        sent = await request.json(); return HttpResponse.json({parcels: [items[1]]});
      }));
      await user.type(field(), "1101{Enter}");
      await screen.findByText("TH101");
      await user.click(screen.getByRole("checkbox", {name: "เลือกทั้งหมดของห้อง"}));
      await user.click(await screen.findByRole("checkbox", {name: /TH101/}));
      await user.click(screen.getByRole("button", {name: "ยืนยันนำออก"}));
      await waitFor(() => expect(onConfirm).toHaveBeenCalled());
      expect(sent).toEqual({trackingCodes: ["TH101"]});
    });

    it("says so when the room has nothing waiting", async () => {
      const {user} = setupRoom([]);
      await user.type(field(), "1101{Enter}");
      expect(await screen.findByText("ห้องนี้ไม่มีพัสดุรอรับ")).toBeInTheDocument();
      expect(screen.getByRole("button", {name: "ยืนยันนำออก"})).toBeDisabled();
    });

    it("rejects text that is neither a Parcel nor a directory room", async () => {
      const {user} = setupRoom(items, []);
      await user.type(field(), "9999{Enter}");
      expect(await screen.findByText("ไม่พบเลขพัสดุ เลขห้อง หรือชื่อผู้พักนี้")).toBeInTheDocument();
      expect(screen.queryByRole("region", result)).not.toBeInTheDocument();
    });

    it("asks instead of guessing when the text is both a Tracking Code and a Room Number", async () => {
      const {user} = setup();
      server.use(
        http.get("/api/v1/parcels/:code", () => HttpResponse.json({...parcel, trackingCode: "1101"})),
        http.get("/api/v1/rooms/search", () => HttpResponse.json({items: [hit]}))
      );
      await user.type(field(), "1101{Enter}");
      await screen.findByRole("region", {name: "เลือกผลการค้นหา"});
      expect(screen.queryByRole("region", result)).not.toBeInTheDocument();

      await user.click(screen.getByRole("button", {name: /ห้อง 1101/}));
      await screen.findByRole("region", result);
      expect(screen.queryByRole("region", {name: "เลือกผลการค้นหา"})).not.toBeInTheDocument();
    });

    it("finds a room from a resident's name, which the parcel lookup rejects as a malformed code", async () => {
      const {user} = setupRoom();
      server.use(http.get("/api/v1/parcels/:code", () => HttpResponse.json({code: "VALIDATION_ERROR"}, {status: 400})));
      await user.type(field(), "สมชาย{Enter}");
      await user.click(await screen.findByRole("button", {name: /ห้อง 1101/}));
      await screen.findByRole("region", result);
    });

    it("rejects a scanned Parcel from another room while a room is open", async () => {
      const {user} = setupRoom();
      await user.type(field(), "1101{Enter}");
      await screen.findByText("TH101");
      server.use(http.get("/api/v1/parcels/:code", () => HttpResponse.json(makeParcelDetail({trackingCode: "TH900", room: {...room, id: 2}}))));
      await user.click(screen.getByRole("checkbox", {name: "เลือกทั้งหมดของห้อง"}));
      await user.type(field(), "TH900{Enter}");
      expect(await screen.findByText("พัสดุนี้ไม่ใช่ห้องเดียวกับรายการรอนำออก กรุณาแยกนำออกคนละรอบ")).toBeInTheDocument();
    });

    it("can leave the room and search again", async () => {
      const {user} = setupRoom();
      await user.type(field(), "1101{Enter}");
      await user.click(await screen.findByRole("button", {name: "เปลี่ยนห้อง"}));
      expect(screen.queryByRole("region", result)).not.toBeInTheDocument();
      expect(field()).toBeEnabled();
    });
  });
});
