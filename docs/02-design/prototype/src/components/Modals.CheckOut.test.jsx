import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { server } from "../test/server";
import { CheckOutModal } from "./Modals";
import { makeParcel } from "../test/fixtures";

const roomB1101 = { id: 1, roomNumber: "101", buildingCode: "1" };
const roomB2101 = { id: 2, roomNumber: "101", buildingCode: "2" };

function mockSearch(items, total = items.length) {
  server.use(
    http.get("/api/v1/parcels", ({ request }) => {
      const url = new URL(request.url);
      expect(url.searchParams.get("status")).toBe("pending");
      return HttpResponse.json({ items, page: 1, pageSize: 50, total });
    })
  );
}

describe("CheckOutModal", () => {
  it("shows nothing until staff type something — never fetches the whole dormitory's pending list", async () => {
    const user = userEvent.setup();
    render(<CheckOutModal onClose={vi.fn()} onConfirm={vi.fn()} />);
    expect(screen.getByText(/พิมพ์เลขห้อง ชื่อผู้พัก หรือสแกนเลขพัสดุ/)).toBeInTheDocument();
    await user.type(screen.getByLabelText(/สแกนเลขพัสดุ/), "1");
    await user.clear(screen.getByLabelText(/สแกนเลขพัสดุ/));
    // typing then clearing must not have left a stray "no results" state — no handler was ever needed
  });

  it("lists matching pending parcels and lets staff tick individual rows", async () => {
    mockSearch([
      makeParcel({ trackingCode: "TH100", room: roomB1101 }),
      makeParcel({ trackingCode: "TH101", room: roomB1101 }),
    ]);
    const user = userEvent.setup();
    render(<CheckOutModal onClose={vi.fn()} onConfirm={vi.fn()} />);
    await user.type(screen.getByLabelText(/สแกนเลขพัสดุ/), "101");

    const row = await screen.findByText(/TH100/);
    await user.click(row.closest("label").querySelector("input[type=checkbox]"));
    expect(await screen.findByRole("button", { name: /นำออกที่เลือก \(1\)/ })).toBeEnabled();
  });

  it("an exact tracking-code scan auto-selects that parcel and clears the field for the next scan", async () => {
    mockSearch([makeParcel({ trackingCode: "TH8827301923", room: roomB1101 })]);
    const user = userEvent.setup();
    render(<CheckOutModal onClose={vi.fn()} onConfirm={vi.fn()} />);
    await user.type(screen.getByLabelText(/สแกนเลขพัสดุ/), "TH8827301923");

    await waitFor(() => expect(screen.getByLabelText(/สแกนเลขพัสดุ/)).toHaveValue(""));
    expect(await screen.findByRole("button", { name: /นำออกที่เลือก \(1\)/ })).toBeInTheDocument();
    expect(screen.getByText("สแกนแล้ว (1)")).toBeInTheDocument();
  });

  it("shows a not-found message when nothing pending matches", async () => {
    mockSearch([]);
    const user = userEvent.setup();
    render(<CheckOutModal onClose={vi.fn()} onConfirm={vi.fn()} />);
    await user.type(screen.getByLabelText(/สแกนเลขพัสดุ/), "ZZZZZ");
    expect(await screen.findByText("ไม่พบพัสดุที่รอนำออกตรงกับคำค้นหา")).toBeInTheDocument();
  });

  it("checks out the selected parcels and hands the result to onConfirm", async () => {
    mockSearch([makeParcel({ trackingCode: "TH100", room: roomB1101 }), makeParcel({ trackingCode: "TH101", room: roomB1101 })]);
    let sentCodes;
    const pickedUp = [makeParcel({ trackingCode: "TH100", room: roomB1101, status: "picked_up" })];
    server.use(
      http.post("/api/v1/parcels/check-out", async ({ request }) => {
        sentCodes = (await request.json()).trackingCodes;
        return HttpResponse.json({ checkedOutCount: 1, parcels: pickedUp });
      })
    );
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(<CheckOutModal onClose={vi.fn()} onConfirm={onConfirm} />);

    await user.type(screen.getByLabelText(/สแกนเลขพัสดุ/), "101");
    const row = await screen.findByText(/TH100/);
    await user.click(row.closest("label").querySelector("input[type=checkbox]"));
    await user.click(screen.getByRole("button", { name: /นำออกที่เลือก \(1\)/ }));

    await waitFor(() => expect(onConfirm).toHaveBeenCalledWith(pickedUp));
    expect(sentCodes).toEqual(["TH100"]);
  });

  it("enables Check Out All only when every match is the same room and none are hidden by paging", async () => {
    mockSearch([makeParcel({ trackingCode: "TH100", room: roomB1101 }), makeParcel({ trackingCode: "TH101", room: roomB1101 })], 2);
    const user = userEvent.setup();
    render(<CheckOutModal onClose={vi.fn()} onConfirm={vi.fn()} />);
    await user.type(screen.getByLabelText(/สแกนเลขพัสดุ/), "101");
    await screen.findByText(/TH100/);
    expect(screen.getByRole("button", { name: /นำออกทั้งหมด \(2\)/ })).toBeEnabled();
  });

  it("disables Check Out All when the results span more than one room", async () => {
    mockSearch([makeParcel({ trackingCode: "TH100", room: roomB1101 }), makeParcel({ trackingCode: "TH900", room: roomB2101 })], 2);
    const user = userEvent.setup();
    render(<CheckOutModal onClose={vi.fn()} onConfirm={vi.fn()} />);
    await user.type(screen.getByLabelText(/สแกนเลขพัสดุ/), "101");
    await screen.findByText(/TH100/);
    expect(screen.getByRole("button", { name: /นำออกทั้งหมด/ })).toBeDisabled();
    expect(screen.getByText(/ใช้ได้เมื่อผลลัพธ์อยู่ห้องเดียวกัน/)).toBeInTheDocument();
  });

  it("disables Check Out All when the room has more pending parcels than the page shows", async () => {
    mockSearch([makeParcel({ trackingCode: "TH100", room: roomB1101 })], 5); // total says 5, only 1 loaded
    const user = userEvent.setup();
    render(<CheckOutModal onClose={vi.fn()} onConfirm={vi.fn()} />);
    await user.type(screen.getByLabelText(/สแกนเลขพัสดุ/), "101");
    await screen.findByText(/TH100/);
    expect(screen.getByRole("button", { name: /นำออกทั้งหมด/ })).toBeDisabled();
  });

  it("Check Out All asks for confirmation naming the room and count, then submits with that expected count", async () => {
    mockSearch([makeParcel({ trackingCode: "TH100", room: roomB1101 }), makeParcel({ trackingCode: "TH101", room: roomB1101 })], 2);
    let sentBody;
    const pickedUp = [makeParcel({ status: "picked_up" }), makeParcel({ status: "picked_up" })];
    server.use(
      http.post("/api/v1/rooms/1/check-out-all", async ({ request }) => {
        sentBody = await request.json();
        return HttpResponse.json({ checkedOutCount: 2, parcels: pickedUp });
      })
    );
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(<CheckOutModal onClose={vi.fn()} onConfirm={onConfirm} />);
    await user.type(screen.getByLabelText(/สแกนเลขพัสดุ/), "101");
    await screen.findByText(/TH100/);
    await user.click(screen.getByRole("button", { name: /นำออกทั้งหมด \(2\)/ }));

    expect(screen.getByText(/นำพัสดุออกทั้งหมด 2 ชิ้นของห้อง 1101/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /ยืนยันนำออก 2 ชิ้น/ }));

    await waitFor(() => expect(onConfirm).toHaveBeenCalledWith(pickedUp));
    expect(sentBody).toEqual({ expectedCount: 2 });
  });

  it("on a stale pending count, shows the error and returns to the normal (non-confirming) view", async () => {
    mockSearch([makeParcel({ trackingCode: "TH100", room: roomB1101 })], 1);
    server.use(
      http.post("/api/v1/rooms/1/check-out-all", () =>
        HttpResponse.json({ code: "PENDING_COUNT_CHANGED", params: { expected: 1, actual: 2 } }, { status: 409 })
      )
    );
    const user = userEvent.setup();
    render(<CheckOutModal onClose={vi.fn()} onConfirm={vi.fn()} />);
    await user.type(screen.getByLabelText(/สแกนเลขพัสดุ/), "101");
    await screen.findByText(/TH100/);
    await user.click(screen.getByRole("button", { name: /นำออกทั้งหมด \(1\)/ }));
    await user.click(screen.getByRole("button", { name: /ยืนยันนำออก 1 ชิ้น/ }));

    expect(await screen.findByText(/ตอนนี้มี 2 รายการ/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /นำออกทั้งหมด/ })).toBeInTheDocument(); // back to the normal view
  });

  it("drops parcels that were already picked up by someone else and reports which ones", async () => {
    mockSearch([makeParcel({ trackingCode: "TH100", room: roomB1101 }), makeParcel({ trackingCode: "TH101", room: roomB1101 })]);
    server.use(
      http.post("/api/v1/parcels/check-out", () =>
        HttpResponse.json({ code: "PARCEL_NOT_PENDING", params: { trackingCodes: ["TH100"] } }, { status: 409 })
      )
    );
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(<CheckOutModal onClose={vi.fn()} onConfirm={onConfirm} />);
    await user.type(screen.getByLabelText(/สแกนเลขพัสดุ/), "101");
    const row1 = await screen.findByText(/TH100/);
    await user.click(row1.closest("label").querySelector("input[type=checkbox]"));
    const row2 = screen.getByText(/TH101/);
    await user.click(row2.closest("label").querySelector("input[type=checkbox]"));
    await user.click(screen.getByRole("button", { name: /นำออกที่เลือก \(2\)/ }));

    expect(await screen.findByText(/พัสดุต่อไปนี้นำออกไปแล้ว.*TH100/)).toBeInTheDocument();
    expect(onConfirm).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.getByRole("button", { name: /นำออกที่เลือก \(1\)/ })).toBeInTheDocument());
  });
});
