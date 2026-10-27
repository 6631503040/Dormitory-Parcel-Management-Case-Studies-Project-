import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { server } from "../test/server";
import { apiError } from "../test/fixtures";
import ResidentApp from "./ResidentApp";
import * as pushSupport from "./pushSupport";

// Browser push APIs don't exist in jsdom; the wrapper module is replaced wholesale.
vi.mock("./pushSupport", async () => {
  class PushPermissionError extends Error {
    constructor(state) {
      super(state);
      this.state = state;
    }
  }
  return {
    PushPermissionError,
    pushSupport: vi.fn(() => "ok"),
    subscribe: vi.fn(),
    currentSubscription: vi.fn(async () => null),
    unsubscribeBrowser: vi.fn(async () => {}),
    shareTokenWithWorker: vi.fn(async () => {}),
  };
});

const SUB = { endpoint: "https://fcm.googleapis.com/fcm/send/abc", expirationTime: null, keys: { p256dh: "pk", auth: "au" } };
const DEVICE = { roomNumber: "101", buildingCode: "3", expiresAt: "2027-04-19T00:00:00Z" };
const TOKEN_KEY = "dpms.residentDeviceToken";

function mockConfig() {
  server.use(http.get("/api/v1/resident/push/config", () => HttpResponse.json({ vapidPublicKey: "BPUB", consentVersion: "push-v1" })));
}

function mockStatus(pending = []) {
  server.use(
    http.get("/api/v1/resident/me", ({ request }) => {
      if (request.headers.get("authorization") !== "Bearer dev-token") return HttpResponse.json(apiError("UNAUTHENTICATED"), { status: 401 });
      return HttpResponse.json({ device: DEVICE, pendingCount: pending.length, pending });
    })
  );
}

beforeEach(() => {
  localStorage.clear();
  vi.mocked(pushSupport.pushSupport).mockReturnValue("ok");
  vi.mocked(pushSupport.subscribe).mockReset();
  vi.mocked(pushSupport.currentSubscription).mockResolvedValue(null);
});

describe("ResidentApp", () => {
  it("registers with consent + the desk code, then shows the room's Pending Parcels", async () => {
    mockConfig();
    mockStatus([{ trackingCode: "TH123", checkedInAt: "2026-10-21T03:00:00Z" }]);
    let claimBody;
    let verifyBody;
    server.use(
      http.post("/api/v1/resident/otp", async ({ request }) => {
        claimBody = await request.json();
        return HttpResponse.json({ claimToken: "claim-1", expiresAt: new Date(Date.now() + 300000).toISOString(), roomNumber: "101", buildingCode: "3" }, { status: 201 });
      }),
      http.post("/api/v1/resident/otp/verify", async ({ request }) => {
        verifyBody = await request.json();
        return HttpResponse.json({ deviceToken: "dev-token", device: DEVICE }, { status: 201 });
      })
    );
    vi.mocked(pushSupport.subscribe).mockResolvedValue(SUB);
    const user = userEvent.setup();
    render(<ResidentApp />);

    await user.type(await screen.findByLabelText(/เลขห้อง/), "3101");
    await user.click(screen.getByRole("button", { name: "ขอรหัสยืนยัน" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("กรุณายอมรับเงื่อนไข");

    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: "ขอรหัสยืนยัน" }));
    expect(await screen.findByText("3101")).toBeInTheDocument();
    expect(claimBody).toEqual({ roomNumber: "3101", consentVersion: "push-v1", consentAccepted: true });

    await user.type(screen.getByLabelText(/รหัส 6 หลัก/), "265074");
    await user.click(screen.getByRole("button", { name: /ยืนยันและเปิดการแจ้งเตือน/ }));

    expect(await screen.findByText("TH123")).toBeInTheDocument();
    expect(screen.getByText("รับแจ้งเตือนอยู่")).toBeInTheDocument();
    expect(pushSupport.subscribe).toHaveBeenCalledWith("BPUB");
    expect(verifyBody).toEqual({ claimToken: "claim-1", code: "265074", subscription: SUB });
    expect(localStorage.getItem(TOKEN_KEY)).toBe("dev-token");
  });

  it("shows how many tries are left on a wrong code", async () => {
    mockConfig();
    server.use(
      http.post("/api/v1/resident/otp", () =>
        HttpResponse.json({ claimToken: "c", expiresAt: new Date(Date.now() + 300000).toISOString(), roomNumber: "101", buildingCode: "3" }, { status: 201 })),
      http.post("/api/v1/resident/otp/verify", () => HttpResponse.json(apiError("OTP_INVALID", { attemptsLeft: 3 }), { status: 422 }))
    );
    vi.mocked(pushSupport.subscribe).mockResolvedValue(SUB);
    const user = userEvent.setup();
    render(<ResidentApp />);
    await user.type(await screen.findByLabelText(/เลขห้อง/), "3101");
    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: "ขอรหัสยืนยัน" }));
    await user.type(await screen.findByLabelText(/รหัส 6 หลัก/), "000000");
    await user.click(screen.getByRole("button", { name: /ยืนยันและเปิดการแจ้งเตือน/ }));
    expect(await screen.findByRole("alert")).toHaveTextContent("รหัสไม่ถูกต้อง (ลองได้อีก 3 ครั้ง)");
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
  });

  it("explains a blocked notification permission and never calls verify", async () => {
    mockConfig();
    let verified = false;
    server.use(
      http.post("/api/v1/resident/otp", () =>
        HttpResponse.json({ claimToken: "c", expiresAt: new Date(Date.now() + 300000).toISOString(), roomNumber: "101", buildingCode: "3" }, { status: 201 })),
      http.post("/api/v1/resident/otp/verify", () => {
        verified = true;
        return HttpResponse.json({}, { status: 201 });
      })
    );
    vi.mocked(pushSupport.subscribe).mockRejectedValue(new pushSupport.PushPermissionError("denied"));
    const user = userEvent.setup();
    render(<ResidentApp />);
    await user.type(await screen.findByLabelText(/เลขห้อง/), "3101");
    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: "ขอรหัสยืนยัน" }));
    await user.type(await screen.findByLabelText(/รหัส 6 หลัก/), "123456");
    await user.click(screen.getByRole("button", { name: /ยืนยันและเปิดการแจ้งเตือน/ }));
    expect(await screen.findByRole("alert")).toHaveTextContent("บล็อกการแจ้งเตือน");
    expect(verified).toBe(false);
  });

  it("a registered device opens on its status, and can turn notifications off", async () => {
    localStorage.setItem(TOKEN_KEY, "dev-token");
    mockConfig();
    mockStatus([]);
    let deleted = false;
    server.use(
      http.delete("/api/v1/resident/push/subscription", () => {
        deleted = true;
        return new HttpResponse(null, { status: 204 });
      })
    );
    const user = userEvent.setup();
    render(<ResidentApp />);
    expect(await screen.findByText(/ยังไม่มีพัสดุรอรับ/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /ปิดการแจ้งเตือนบนอุปกรณ์นี้/ }));
    await user.click(screen.getByRole("button", { name: "ยืนยันปิดการแจ้งเตือน" }));
    expect(await screen.findByRole("button", { name: "ขอรหัสยืนยัน" })).toBeInTheDocument();
    expect(deleted).toBe(true);
    expect(pushSupport.unsubscribeBrowser).toHaveBeenCalled();
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
  });

  it("a revoked device token falls back to registration", async () => {
    localStorage.setItem(TOKEN_KEY, "revoked");
    mockConfig();
    mockStatus([]);
    render(<ResidentApp />);
    expect(await screen.findByRole("button", { name: "ขอรหัสยืนยัน" })).toBeInTheDocument();
    await waitFor(() => expect(localStorage.getItem(TOKEN_KEY)).toBeNull());
  });

  it("re-sends a rotated browser subscription when it opens", async () => {
    localStorage.setItem(TOKEN_KEY, "dev-token");
    mockConfig();
    mockStatus([]);
    vi.mocked(pushSupport.currentSubscription).mockResolvedValue(SUB);
    let put;
    server.use(
      http.put("/api/v1/resident/push/subscription", async ({ request }) => {
        put = await request.json();
        return new HttpResponse(null, { status: 204 });
      })
    );
    render(<ResidentApp />);
    await waitFor(() => expect(put).toEqual(SUB));
  });

  it("tells iPhone users to add the page to the Home Screen first", async () => {
    vi.mocked(pushSupport.pushSupport).mockReturnValue("ios_install");
    render(<ResidentApp />);
    expect(screen.getByText("เพิ่มไว้ที่หน้าจอโฮมก่อน")).toBeInTheDocument();
  });

  it("reports when the server has push turned off", async () => {
    server.use(http.get("/api/v1/resident/push/config", () => HttpResponse.json(apiError("PUSH_NOT_CONFIGURED"), { status: 503 })));
    render(<ResidentApp />);
    expect(await screen.findByRole("alert")).toHaveTextContent("ระบบแจ้งเตือนยังไม่เปิดใช้งาน");
  });
});
