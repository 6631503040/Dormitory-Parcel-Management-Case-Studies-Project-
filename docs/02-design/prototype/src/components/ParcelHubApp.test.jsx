import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { server } from "../test/server";
import ParcelHubApp from "./ParcelHubApp";
import { makeStaff, makeDashboard } from "../test/fixtures";

// A quiet, empty backend: every screen ParcelHubApp mounts (Dashboard + its UnmatchedQueue,
// Archive) can load without crashing or leaving an unhandled MSW request. Individual tests
// override only the handler(s) they care about.
function mockQuietBackend() {
  server.use(
    http.get("/api/v1/dashboard", () => HttpResponse.json(makeDashboard({ recentCheckIns: [] }))),
    http.get("/api/v1/parcels", () => HttpResponse.json({ items: [], page: 1, pageSize: 20, total: 0 }))
  );
}

describe("ParcelHubApp", () => {
  it("shows the login page when there is no existing session — quietly, not as a session-expired error", async () => {
    mockQuietBackend();
    server.use(http.get("/api/v1/auth/me", () => HttpResponse.json({ code: "UNAUTHENTICATED" }, { status: 401 })));
    render(<ParcelHubApp />);
    expect(screen.getByText("กำลังโหลด…")).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "เข้าสู่ระบบ" })).toBeInTheDocument();
    // The very first /auth/me check 401s for anyone who was never logged in — that must never be
    // shown as "your session expired", which would confuse a Staff member opening the app fresh.
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("goes straight to the Dashboard when a session cookie is already valid", async () => {
    mockQuietBackend();
    server.use(http.get("/api/v1/auth/me", () => HttpResponse.json({ staff: makeStaff({ fullName: "Somsri Rattanakul" }) })));
    render(<ParcelHubApp />);
    expect(await screen.findByText("รับเข้าล่าสุด")).toBeInTheDocument();
    expect(screen.getByText("Somsri Rattanakul")).toBeInTheDocument();
  });

  it("logs in and reaches the Dashboard", async () => {
    mockQuietBackend();
    server.use(
      http.get("/api/v1/auth/me", () => HttpResponse.json({ code: "UNAUTHENTICATED" }, { status: 401 })),
      http.post("/api/v1/auth/login", () => HttpResponse.json({ staff: makeStaff({ fullName: "Prasert Boonmee" }) }))
    );
    const user = userEvent.setup();
    render(<ParcelHubApp />);
    await screen.findByRole("button", { name: "เข้าสู่ระบบ" });

    await user.type(screen.getByLabelText("ชื่อผู้ใช้"), "prasert");
    await user.type(screen.getByLabelText("รหัสผ่าน"), "parcel1234");
    await user.click(screen.getByRole("button", { name: "เข้าสู่ระบบ" }));

    expect(await screen.findByText("รับเข้าล่าสุด")).toBeInTheDocument();
    expect(screen.getByText("Prasert Boonmee")).toBeInTheDocument();
  });

  it("logs out back to the login page", async () => {
    mockQuietBackend();
    server.use(
      http.get("/api/v1/auth/me", () => HttpResponse.json({ staff: makeStaff() })),
      http.post("/api/v1/auth/logout", () => new HttpResponse(null, { status: 204 }))
    );
    const user = userEvent.setup();
    render(<ParcelHubApp />);
    await screen.findByText("รับเข้าล่าสุด");

    await user.click(screen.getByRole("button", { name: /ออกจากระบบ/ }));

    expect(await screen.findByRole("button", { name: "เข้าสู่ระบบ" })).toBeInTheDocument();
  });

  it("switches to the ประวัติ (Archive) tab and back", async () => {
    mockQuietBackend();
    server.use(http.get("/api/v1/auth/me", () => HttpResponse.json({ staff: makeStaff() })));
    const user = userEvent.setup();
    render(<ParcelHubApp />);
    await screen.findByText("รับเข้าล่าสุด");

    await user.click(screen.getByRole("button", { name: "ประวัติ" }));
    expect(await screen.findByText("ประวัติพัสดุทั้งหมด")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "หน้าหลัก" }));
    expect(await screen.findByText("รับเข้าล่าสุด")).toBeInTheDocument();
  });

  it("opens and closes the Check-In modal, refreshing the dashboard behind it", async () => {
    mockQuietBackend();
    server.use(http.get("/api/v1/auth/me", () => HttpResponse.json({ staff: makeStaff() })));
    let dashboardCalls = 0;
    server.use(
      http.get("/api/v1/dashboard", () => {
        dashboardCalls++;
        return HttpResponse.json(makeDashboard({ recentCheckIns: [] }));
      })
    );
    const user = userEvent.setup();
    render(<ParcelHubApp />);
    await screen.findByText("รับเข้าล่าสุด");
    await waitFor(() => expect(dashboardCalls).toBe(1));

    await user.click(screen.getByRole("button", { name: /เข้า/ }));
    expect(screen.getByRole("dialog", { name: "บันทึกพัสดุเข้า" })).toBeInTheDocument();
    await user.click(screen.getByLabelText("ปิด"));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await waitFor(() => expect(dashboardCalls).toBe(2));
  });

  it("checking out end-to-end (scan, select, confirm) shows a success banner and closes the modal", async () => {
    mockQuietBackend();
    server.use(
      http.get("/api/v1/auth/me", () => HttpResponse.json({ staff: makeStaff() })),
      http.get("/api/v1/parcels", ({ request }) => {
        const q = new URL(request.url).searchParams.get("q");
        if (q === "TH1") {
          return HttpResponse.json({
            items: [{ trackingCode: "TH1", status: "pending", room: { id: 1, roomNumber: "101", buildingCode: "1" }, residents: [], checkedInAt: "2026-09-20T01:00:00Z" }],
            page: 1,
            pageSize: 50,
            total: 1,
          });
        }
        return HttpResponse.json({ items: [], page: 1, pageSize: 20, total: 0 });
      }),
      http.post("/api/v1/parcels/check-out", () =>
        HttpResponse.json({ checkedOutCount: 1, parcels: [{ trackingCode: "TH1", status: "picked_up" }] })
      )
    );
    const user = userEvent.setup();
    render(<ParcelHubApp />);
    await screen.findByText("รับเข้าล่าสุด");

    await user.click(screen.getByRole("button", { name: "ออก" }));
    await user.type(screen.getByLabelText(/สแกนเลขพัสดุ/), "TH1");
    // an exact tracking-code match auto-selects and clears the field, ready for the next scan
    await waitFor(() => expect(screen.getByLabelText(/สแกนเลขพัสดุ/)).toHaveValue(""));
    await user.click(screen.getByRole("button", { name: /นำออกที่เลือก \(1\)/ }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(await screen.findByRole("status")).toHaveTextContent("นำพัสดุออกแล้ว 1 ชิ้น");
  });

  it("drops back to the login page and shows a banner when the session expires mid-use", async () => {
    mockQuietBackend();
    let dashboardCalls = 0;
    server.use(
      http.get("/api/v1/auth/me", () => HttpResponse.json({ staff: makeStaff() })),
      http.get("/api/v1/dashboard", () => {
        dashboardCalls++;
        if (dashboardCalls > 1) return HttpResponse.json({ code: "UNAUTHENTICATED" }, { status: 401 });
        return HttpResponse.json(makeDashboard({ recentCheckIns: [] }));
      })
    );
    const user = userEvent.setup();
    render(<ParcelHubApp />);
    await screen.findByText("รับเข้าล่าสุด");

    // Opening and closing Check-In bumps refreshKey, triggering the dashboard's second fetch,
    // which this time comes back 401 (e.g. the session expired or was revoked meanwhile).
    await user.click(screen.getByRole("button", { name: /เข้า/ }));
    await user.click(screen.getByLabelText("ปิด"));

    expect(await screen.findByRole("button", { name: "เข้าสู่ระบบ" })).toBeInTheDocument();
    expect(await screen.findByRole("status")).toHaveTextContent("เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่");
  });
});
