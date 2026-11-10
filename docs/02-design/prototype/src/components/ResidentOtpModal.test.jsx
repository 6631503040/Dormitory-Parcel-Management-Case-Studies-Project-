import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { server } from "../test/server";
import ResidentOtpModal from "./ResidentOtpModal";
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

describe("ResidentOtpModal", () => {
  it("shows the room's pending registration code and device count", async () => {
    const room = makeRoomHit({ id: 101, roomNumber: "101", buildingCode: "3", residents: [] });
    server.use(
      http.get("/api/v1/rooms/101/resident-otp", () =>
        HttpResponse.json({ code: "265074", expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(), roomId: 101, roomNumber: "101", buildingCode: "3" })),
      http.get("/api/v1/rooms/101/push-subscriptions", () => HttpResponse.json({ activeCount: 2 }))
    );
    const user = userEvent.setup();
    render(<ResidentOtpModal onClose={vi.fn()} />);
    await selectRoom(user, "101", room);

    expect(await screen.findByText("265074")).toBeInTheDocument();
    expect(screen.getByText(/หมดอายุใน 5:00/)).toBeInTheDocument();
    expect(await screen.findByText(/อุปกรณ์ที่รับแจ้งเตือนของห้องนี้: 2 เครื่อง/)).toBeInTheDocument();
  });

  it("says so when the room has no pending request", async () => {
    const room = makeRoomHit({ id: 202, roomNumber: "202", buildingCode: "4", residents: [] });
    server.use(
      http.get("/api/v1/rooms/202/resident-otp", () => HttpResponse.json(apiError("NO_PENDING_RESIDENT_OTP"), { status: 404 })),
      http.get("/api/v1/rooms/202/push-subscriptions", () => HttpResponse.json({ activeCount: 0 }))
    );
    const user = userEvent.setup();
    render(<ResidentOtpModal onClose={vi.fn()} />);
    await selectRoom(user, "202", room);
    expect(await screen.findByText("ห้องนี้ไม่มีคำขอลงทะเบียนรับแจ้งเตือนที่รอดำเนินการอยู่ในขณะนี้")).toBeInTheDocument();
  });

  it("revokes every device of the room after an inline confirm", async () => {
    const room = makeRoomHit({ id: 7, roomNumber: "105", buildingCode: "1", residents: [] });
    let revoked = false;
    server.use(
      http.get("/api/v1/rooms/7/resident-otp", () => HttpResponse.json(apiError("NO_PENDING_RESIDENT_OTP"), { status: 404 })),
      http.get("/api/v1/rooms/7/push-subscriptions", () => HttpResponse.json({ activeCount: revoked ? 0 : 1 })),
      http.delete("/api/v1/rooms/7/push-subscriptions", () => {
        revoked = true;
        return HttpResponse.json({ revokedCount: 1 });
      })
    );
    const user = userEvent.setup();
    render(<ResidentOtpModal onClose={vi.fn()} />);
    await selectRoom(user, "105", room);
    await user.click(await screen.findByRole("button", { name: "ยกเลิกการแจ้งเตือนทั้งหมดของห้องนี้" }));
    await user.click(screen.getByRole("button", { name: "ยืนยันยกเลิก 1 เครื่อง" }));
    expect(await screen.findByText("ยกเลิกการแจ้งเตือนแล้ว 1 เครื่อง")).toBeInTheDocument();
    expect(revoked).toBe(true);
  });
});
