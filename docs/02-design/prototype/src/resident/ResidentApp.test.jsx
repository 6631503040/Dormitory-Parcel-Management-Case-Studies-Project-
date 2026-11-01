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
    notificationPermission: vi.fn(() => "granted"),
    isIOS: vi.fn(() => false),
    isStandalone: vi.fn(() => false),
    showTestNotification: vi.fn(async () => true),
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

function mockClaim(expiresInMs = 300000, bodies = []) {
  server.use(
    http.post("/api/v1/resident/otp", async ({ request }) => {
      bodies.push(await request.json());
      return HttpResponse.json({ claimToken: `c${bodies.length}`, expiresAt: new Date(Date.now() + expiresInMs).toISOString(), roomNumber: "101", buildingCode: "3" }, { status: 201 });
    })
  );
  return bodies;
}

async function claimRoom(user) {
  await user.type(await screen.findByLabelText(/เลขห้อง/), "3101");
  await user.click(screen.getByRole("checkbox"));
  await user.click(screen.getByRole("button", { name: "ขอรหัสยืนยัน" }));
}

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  vi.mocked(pushSupport.pushSupport).mockReturnValue("ok");
  vi.mocked(pushSupport.notificationPermission).mockReturnValue("granted");
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
      }),
      http.put("/api/v1/resident/push/subscription", () => new HttpResponse(null, { status: 204 }))
    );
    vi.mocked(pushSupport.subscribe).mockResolvedValue(SUB);
    vi.mocked(pushSupport.currentSubscription).mockResolvedValue(SUB); // what a real browser reports right after subscribing
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
    expect(await screen.findByText(/ห้อง 3101 จะได้รับแจ้งเตือนบนอุปกรณ์นี้ ส่งแจ้งเตือนทดสอบไปแล้ว/)).toBeInTheDocument();
    expect(screen.getByText("ลงทะเบียนแล้ว")).toBeInTheDocument();
    expect(pushSupport.showTestNotification).toHaveBeenCalledWith(expect.stringContaining("ห้อง 3101"));
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
    const code = screen.getByLabelText(/รหัส 6 หลัก/);
    expect(code).toHaveAttribute("aria-invalid", "true");
    await waitFor(() => expect(code).toHaveFocus());
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

    await user.click(screen.getByRole("button", { name: "ยกเลิกการลงทะเบียนอุปกรณ์นี้" }));
    await user.click(screen.getByRole("button", { name: "ยืนยันยกเลิกการลงทะเบียน" }));
    expect(await screen.findByRole("button", { name: "ขอรหัสยืนยัน" })).toBeInTheDocument();
    expect(screen.getByText(/ยกเลิกการลงทะเบียนอุปกรณ์นี้แล้ว/)).toBeInTheDocument();
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
    expect(screen.getByText(/หมดอายุหรือถูกยกเลิกแล้ว/)).toBeInTheDocument();
    await waitFor(() => expect(localStorage.getItem(TOKEN_KEY)).toBeNull());
  });

  it("puts a missing Room Number error on the field and focuses it", async () => {
    mockConfig();
    const user = userEvent.setup();
    render(<ResidentApp />);
    await user.click(await screen.findByRole("button", { name: "ขอรหัสยืนยัน" }));
    const room = screen.getByLabelText(/เลขห้อง/);
    expect(room).toHaveAttribute("aria-invalid", "true");
    expect(room).toHaveFocus();
    expect(room).toHaveAccessibleDescription(/กรุณากรอกเลขห้อง/);
  });

  it("warns before a code is requested when the browser already blocks notifications", async () => {
    vi.mocked(pushSupport.notificationPermission).mockReturnValue("denied");
    mockConfig();
    render(<ResidentApp />);
    expect(await screen.findByRole("alert")).toHaveTextContent("บล็อกการแจ้งเตือนของเว็บนี้อยู่");
    expect(screen.getByRole("alert")).toHaveTextContent("› การแจ้งเตือน › อนุญาต"); // a platform path, not a generic hint
    expect(screen.queryByRole("button", { name: "ขอรหัสยืนยัน" })).not.toBeInTheDocument();
  });

  it("names the typed room when it is not in the directory", async () => {
    mockConfig();
    server.use(http.post("/api/v1/resident/otp", () => HttpResponse.json(apiError("ROOM_NOT_IN_DIRECTORY"), { status: 422 })));
    const user = userEvent.setup();
    render(<ResidentApp />);
    await user.type(await screen.findByLabelText(/เลขห้อง/), "9999");
    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: "ขอรหัสยืนยัน" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("ไม่พบห้อง 9999 ในทะเบียนผู้พัก");
    expect(screen.getByRole("alert")).not.toHaveTextContent("เลือกห้องจากรายการ");
  });

  it("warns about the browser's permission prompt and marks finished steps on the code screen", async () => {
    vi.mocked(pushSupport.notificationPermission).mockReturnValue("default");
    mockConfig();
    mockClaim();
    const user = userEvent.setup();
    render(<ResidentApp />);
    await claimRoom(user);
    expect(await screen.findByText(/เบราว์เซอร์จะขอสิทธิ์ส่งการแจ้งเตือน/)).toBeInTheDocument();
    expect(screen.getByText("(เสร็จแล้ว)", { exact: false })).toBeInTheDocument();
  });

  it("shows the last loaded parcels, marked with their time, when a reload fails", async () => {
    localStorage.setItem(TOKEN_KEY, "dev-token");
    localStorage.setItem("dpms.residentLastStatus", JSON.stringify({
      token: "dev-token",
      updatedAt: "2026-10-28T03:00:00Z",
      status: { device: DEVICE, pendingCount: 1, pending: [{ trackingCode: "TH7", checkedInAt: "2026-10-27T03:00:00Z" }] },
    }));
    mockConfig();
    server.use(http.get("/api/v1/resident/me", () => HttpResponse.json(apiError("INTERNAL_ERROR"), { status: 500 })));
    render(<ResidentApp />);
    expect(await screen.findByText(/ยังโหลดข้อมูลล่าสุดไม่ได้/)).toBeInTheDocument();
    expect(screen.getByText("TH7")).toBeInTheDocument();
    expect(screen.getByText(/ข้อมูลเมื่อ/)).toBeInTheDocument();
  });

  it("turns notifications back on for a registered device that lost its subscription", async () => {
    localStorage.setItem(TOKEN_KEY, "dev-token");
    mockConfig();
    mockStatus([]);
    vi.mocked(pushSupport.subscribe).mockResolvedValue(SUB);
    let put;
    server.use(
      http.put("/api/v1/resident/push/subscription", async ({ request }) => {
        put = await request.json();
        return new HttpResponse(null, { status: 204 });
      })
    );
    const user = userEvent.setup();
    render(<ResidentApp />);
    await user.click(await screen.findByRole("button", { name: "เปิดการแจ้งเตือนอีกครั้ง" }));
    expect(await screen.findByText("รับแจ้งเตือนอยู่")).toBeInTheDocument();
    expect(put).toEqual(SUB);
  });

  it("an expired code is replaced in one tap for the same room", async () => {
    mockConfig();
    const bodies = mockClaim(-1000);
    const user = userEvent.setup();
    render(<ResidentApp />);
    await claimRoom(user);
    expect(await screen.findByRole("heading", { name: "รหัสหมดอายุแล้ว" })).toBeInTheDocument();

    mockClaim(300000, bodies);
    await user.click(screen.getByRole("button", { name: "ขอรหัสใหม่สำหรับห้อง 3101" }));
    expect(await screen.findByLabelText(/รหัส 6 หลัก/)).toBeEnabled();
    expect(bodies.map((b) => b.roomNumber)).toEqual(["3101", "3101"]);
  });

  it("a code the server locked offers a new one instead of the dead code field", async () => {
    mockConfig();
    const bodies = mockClaim();
    server.use(http.post("/api/v1/resident/otp/verify", () => HttpResponse.json(apiError("OTP_EXPIRED", { reason: "locked" }), { status: 422 })));
    vi.mocked(pushSupport.subscribe).mockResolvedValue(SUB);
    const user = userEvent.setup();
    render(<ResidentApp />);
    await claimRoom(user);
    await user.type(await screen.findByLabelText(/รหัส 6 หลัก/), "999999");
    await user.click(screen.getByRole("button", { name: /ยืนยันและเปิดการแจ้งเตือน/ }));
    expect(await screen.findByRole("heading", { name: "ใส่รหัสผิดหลายครั้งเกินไป" })).toBeInTheDocument();
    expect(screen.queryByLabelText(/รหัส 6 หลัก/)).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "ขอรหัสใหม่สำหรับห้อง 3101" }));
    expect(await screen.findByLabelText(/รหัส 6 หลัก/)).toBeEnabled();
    expect(bodies).toHaveLength(2);
  });

  it("keeps the pending claim across a reload", async () => {
    mockConfig();
    mockClaim();
    const user = userEvent.setup();
    const { unmount } = render(<ResidentApp />);
    await claimRoom(user);
    expect(await screen.findByLabelText(/รหัส 6 หลัก/)).toBeInTheDocument();
    unmount();

    render(<ResidentApp />);
    expect(await screen.findByLabelText(/รหัส 6 หลัก/)).toBeInTheDocument();
    expect(screen.getByText("3101")).toBeInTheDocument();
  });

  it("changing the room keeps what was typed", async () => {
    mockConfig();
    mockClaim();
    const user = userEvent.setup();
    render(<ResidentApp />);
    await claimRoom(user);
    await user.click(await screen.findByRole("button", { name: "เปลี่ยนเลขห้อง" }));
    expect(screen.getByLabelText(/เลขห้อง/)).toHaveValue("3101");
    expect(screen.getByRole("checkbox")).toBeChecked();
  });

  it("offers a retry when the status cannot be loaded", async () => {
    localStorage.setItem(TOKEN_KEY, "dev-token");
    mockConfig();
    server.use(http.get("/api/v1/resident/me", () => HttpResponse.json(apiError("INTERNAL"), { status: 500 })));
    const user = userEvent.setup();
    render(<ResidentApp />);
    await user.click(await screen.findByRole("button", { name: "ลองใหม่" }));
    expect(screen.queryByText("กำลังโหลด…")).not.toBeInTheDocument();

    mockStatus([{ trackingCode: "TH9", checkedInAt: "2026-10-21T03:00:00Z" }]);
    await user.click(screen.getByRole("button", { name: "ลองใหม่" }));
    expect(await screen.findByText("TH9")).toBeInTheDocument();
  });

  it("says so when the browser blocks notifications for a registered device", async () => {
    vi.mocked(pushSupport.notificationPermission).mockReturnValue("denied");
    localStorage.setItem(TOKEN_KEY, "dev-token");
    mockConfig();
    mockStatus([]);
    render(<ResidentApp />);
    expect(await screen.findByText("เบราว์เซอร์บล็อกการแจ้งเตือน")).toBeInTheDocument();
    expect(screen.queryByText("รับแจ้งเตือนอยู่")).not.toBeInTheDocument();
  });

  it("the unregister confirm states the consequence and focuses the safe choice", async () => {
    localStorage.setItem(TOKEN_KEY, "dev-token");
    mockConfig();
    mockStatus([]);
    const user = userEvent.setup();
    render(<ResidentApp />);
    await user.click(await screen.findByRole("button", { name: "ยกเลิกการลงทะเบียนอุปกรณ์นี้" }));
    expect(screen.getByRole("button", { name: "เก็บการลงทะเบียนไว้" })).toHaveFocus();
    expect(screen.getByText(/ไม่แสดงรายการพัสดุอีก/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "เก็บการลงทะเบียนไว้" }));
    expect(screen.getByRole("button", { name: "ยกเลิกการลงทะเบียนอุปกรณ์นี้" })).toHaveFocus();
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

  it("reloads the Pending list when the page comes back to the foreground", async () => {
    localStorage.setItem(TOKEN_KEY, "dev-token");
    mockConfig();
    mockStatus([{ trackingCode: "TH1", checkedInAt: "2026-10-21T03:00:00Z" }]);
    render(<ResidentApp />);
    expect(await screen.findByText("TH1")).toBeInTheDocument();

    mockStatus([]); // Staff checked it out meanwhile — no push is sent for a Check-Out
    document.dispatchEvent(new Event("visibilitychange"));
    expect(await screen.findByText(/ยังไม่มีพัสดุรอรับ/)).toBeInTheDocument();
    expect(screen.queryByText("TH1")).not.toBeInTheDocument();
  });

  it("reloads the Pending list when the service worker reports a new push", async () => {
    const worker = new EventTarget();
    Object.defineProperty(navigator, "serviceWorker", { value: worker, configurable: true });
    try {
      localStorage.setItem(TOKEN_KEY, "dev-token");
      mockConfig();
      mockStatus([]);
      render(<ResidentApp />);
      expect(await screen.findByText(/ยังไม่มีพัสดุรอรับ/)).toBeInTheDocument();

      mockStatus([{ trackingCode: "TH2", checkedInAt: "2026-10-21T03:00:00Z" }]);
      worker.dispatchEvent(new MessageEvent("message", { data: { type: "parcel_arrived" } }));
      expect(await screen.findByText("TH2")).toBeInTheDocument();
    } finally {
      delete navigator.serviceWorker;
    }
  });

  it("tells iPhone users to add the page to the Home Screen first", async () => {
    vi.mocked(pushSupport.pushSupport).mockReturnValue("ios_install");
    render(<ResidentApp />);
    expect(screen.getByText("กรุณาเพิ่มหน้านี้ไว้ที่หน้าจอโฮม")).toBeInTheDocument();
  });

  it("reports when the server has push turned off", async () => {
    server.use(http.get("/api/v1/resident/push/config", () => HttpResponse.json(apiError("PUSH_NOT_CONFIGURED"), { status: 503 })));
    render(<ResidentApp />);
    expect(await screen.findByRole("alert")).toHaveTextContent("ระบบแจ้งเตือนยังไม่เปิดใช้งาน");
  });
});
