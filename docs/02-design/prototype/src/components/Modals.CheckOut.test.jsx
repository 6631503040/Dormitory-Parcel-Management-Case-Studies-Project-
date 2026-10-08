import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
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
    expect(url.searchParams.get("roomId")).toBe("1");
    expect(url.searchParams.get("status")).toBe("pending");
    expect(url.searchParams.get("pageSize")).toBe("8");
    return HttpResponse.json({items, total, page: Number(url.searchParams.get("page")), pageSize: 8});
  }));
  const onConfirm = vi.fn();
  render(<CheckOutModal onClose={vi.fn()} onConfirm={onConfirm} />);
  return { user: userEvent.setup(), lookup, onConfirm };
}
async function find(user) {
  await user.type(screen.getByLabelText("สแกนหรือกรอกเลขพัสดุ"), "th100{Enter}");
  await screen.findByRole("region", {name: "ข้อมูลพัสดุที่ค้นพบ"});
}

describe("scanner-first CheckOutModal", () => {
  it("does not search while typing and shows only lookup before a scan is submitted", async () => {
    const {user, lookup} = setup();
    expect(screen.queryByRole("button", {name: "ยืนยันนำพัสดุออก"})).not.toBeInTheDocument();
    await user.type(screen.getByLabelText("สแกนหรือกรอกเลขพัสดุ"), "TH100");
    await new Promise(resolve => setTimeout(resolve, 250));
    expect(lookup).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", {name: "ค้นหาพัสดุ"}));
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
    await user.click(screen.getByRole("button", {name: "ยืนยันนำพัสดุออก"}));
    await waitFor(() => expect(onConfirm).toHaveBeenCalled());
    expect(sent).toEqual({trackingCodes: ["TH100"]});
  });
  it("blocks confirmation after staff edit the verified code", async () => {
    const {user} = setup(); await find(user);
    await user.type(screen.getByLabelText("สแกนหรือกรอกเลขพัสดุ"), "X");
    expect(screen.getByRole("button", {name: "ยืนยันนำพัสดุออก"})).toBeDisabled();
  });
  it("focuses the tracking field using the icon-only scanner button", async () => {
    const {user} = setup(); await user.click(screen.getByRole("button", {name: "เตรียมสแกน"}));
    expect(screen.getByLabelText("สแกนหรือกรอกเลขพัสดุ")).toHaveFocus();
  });
  it("shows API not-found and picked-up errors without allowing checkout", async () => {
    const {user} = setup();
    server.use(http.get("/api/v1/parcels/:code", () => HttpResponse.json({code: "PARCEL_NOT_FOUND"}, {status: 404})));
    await user.type(screen.getByLabelText("สแกนหรือกรอกเลขพัสดุ"), "missing{Enter}");
    await screen.findByRole("alert");
    expect(screen.queryByRole("button", {name: "ยืนยันนำพัสดุออก"})).not.toBeInTheDocument();
    server.use(http.get("/api/v1/parcels/:code", () => HttpResponse.json({...parcel, status: "picked_up"})));
    await user.click(screen.getByRole("button", {name: "ค้นหาพัสดุ"}));
    await screen.findByText("พัสดุนี้นำออกแล้วหรือไม่อยู่ในสถานะรอรับ");
  });
  it("requires directory assignment before an unmatched parcel can be checked out", async () => {
    const {user} = setup();
    server.use(http.get("/api/v1/parcels/:code", () => HttpResponse.json({...parcel, room: null, residents: []})));
    await user.type(screen.getByLabelText("สแกนหรือกรอกเลขพัสดุ"), "TH100{Enter}");
    await screen.findByText("พัสดุนี้ยังไม่ระบุห้อง กรุณาจัดห้องก่อนนำออก");
    expect(screen.queryByRole("button", {name: "ยืนยันนำพัสดุออก"})).not.toBeInTheDocument();
  });
  it("keeps a failed selection for retry and does not report completion", async () => {
    const {user, onConfirm} = setup();
    server.use(http.post("/api/v1/parcels/check-out", () => HttpResponse.json({code: "INTERNAL_ERROR"}, {status: 500})));
    await find(user); await user.click(screen.getByRole("button", {name: "ยืนยันนำพัสดุออก"}));
    await screen.findByRole("alert");
    expect(screen.getByRole("button", {name: "ยืนยันนำพัสดุออก"})).toBeEnabled();
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
    await user.click(screen.getByRole("button", {name: "ยืนยันนำพัสดุออก (2)"}));
    await waitFor(() => expect(onConfirm).toHaveBeenCalled());
    expect(sent.trackingCodes).toEqual(["TH100", "TH101"]);
  });
  it("checks out the entire room with expectedCount even when its server list spans pages", async () => {
    const {user, onConfirm} = setup([parcel, makeParcel({trackingCode: "TH101", room})], 20); let sent;
    server.use(http.post("/api/v1/rooms/1/check-out-all", async ({request}) => {
      sent = await request.json(); return HttpResponse.json({parcels: [parcel]});
    }));
    await find(user); await user.click(screen.getByText(/พัสดุอื่นของห้องนี้/));
    await user.click(await screen.findByRole("checkbox", {name: "เลือกเพิ่มทั้งหมด"}));
    await user.click(screen.getByRole("button", {name: "ยืนยันนำพัสดุออก (20)"}));
    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.getByText("นำออกทั้งหมด 20 รายการของห้อง 1101?")).toBeInTheDocument();
    await user.click(screen.getByRole("button", {name: "ยืนยันนำออกทั้งหมด (20)"}));
    await waitFor(() => expect(onConfirm).toHaveBeenCalled());
    expect(sent).toEqual({expectedCount: 20});
  });
});
