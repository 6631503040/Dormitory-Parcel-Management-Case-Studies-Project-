import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { server } from "../test/server";
import LineOtpModal from "./LineOtpModal";
import { makeRoomHit, apiError } from "../test/fixtures";

function mockRoomSearch(byQuery) {
  server.use(
    http.get("/api/v1/rooms/search", ({ request }) => {
      const q = new URL(request.url).searchParams.get("q");
      return HttpResponse.json({ items: byQuery[q] ?? [] });
    })
  );
}

async function selectRoom(user, query, room) {
  mockRoomSearch({ [query]: [room] });
  await user.type(screen.getByRole("combobox"), query);
  await user.click(await screen.findByRole("option", { name: new RegExp(`${room.buildingCode}${room.roomNumber}`) }));
}

describe("LineOtpModal", () => {
  it("shows the pending code for the selected room, never over LINE", async () => {
    const room = makeRoomHit({ id: 101, roomNumber: "101", buildingCode: "3", residents: [] });
    server.use(
      http.get("/api/v1/rooms/101/line-otp", () =>
        HttpResponse.json({ code: "265074", expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(), roomId: 101, roomNumber: "101", buildingCode: "3" })
      )
    );
    const user = userEvent.setup();
    render(<LineOtpModal onClose={vi.fn()} />);

    await selectRoom(user, "101", room);

    expect(await screen.findByText("265074")).toBeInTheDocument();
    expect(screen.getByText(/หมดอายุใน 5:00/)).toBeInTheDocument();
    expect(screen.getByText(/ห้ามส่งรหัสนี้ผ่าน LINE/)).toBeInTheDocument();
  });

  it("shows a clear message when the room has no pending OTP", async () => {
    const room = makeRoomHit({ id: 202, roomNumber: "202", buildingCode: "4", residents: [] });
    server.use(http.get("/api/v1/rooms/202/line-otp", () => HttpResponse.json(apiError("NO_PENDING_LINE_OTP"), { status: 404 })));
    const user = userEvent.setup();
    render(<LineOtpModal onClose={vi.fn()} />);

    await selectRoom(user, "202", room);

    expect(await screen.findByText("ห้องนี้ไม่มีคำขอยืนยันตัวตนผ่าน LINE ที่รอดำเนินการอยู่ในขณะนี้")).toBeInTheDocument();
  });

  it("switching to a different room drops the previous room's code", async () => {
    const roomA = makeRoomHit({ id: 1, roomNumber: "101", buildingCode: "1", residents: [] });
    const roomB = makeRoomHit({ id: 2, roomNumber: "202", buildingCode: "2", residents: [] });
    server.use(
      http.get("/api/v1/rooms/1/line-otp", () =>
        HttpResponse.json({ code: "111111", expiresAt: new Date(Date.now() + 60000).toISOString(), roomId: 1, roomNumber: "101", buildingCode: "1" })
      ),
      http.get("/api/v1/rooms/2/line-otp", () => HttpResponse.json(apiError("NO_PENDING_LINE_OTP"), { status: 404 }))
    );
    const user = userEvent.setup();
    render(<LineOtpModal onClose={vi.fn()} />);

    await selectRoom(user, "101", roomA);
    expect(await screen.findByText("111111")).toBeInTheDocument();

    await user.click(screen.getByLabelText("เปลี่ยนห้อง"));
    await selectRoom(user, "202", roomB);

    expect(screen.queryByText("111111")).not.toBeInTheDocument();
    expect(await screen.findByText("ห้องนี้ไม่มีคำขอยืนยันตัวตนผ่าน LINE ที่รอดำเนินการอยู่ในขณะนี้")).toBeInTheDocument();
  });
});
