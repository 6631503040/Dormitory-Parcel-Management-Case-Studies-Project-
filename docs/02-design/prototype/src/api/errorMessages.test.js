import { describe, it, expect } from "vitest";
import { errorMessage } from "./errorMessages";

describe("errorMessage()", () => {
  it("names the existing parcel's room and time on a duplicate tracking code", () => {
    const msg = errorMessage({
      code: "DUPLICATE_TRACKING_CODE",
      params: { trackingCode: "TH1", roomNumber: "101", buildingCode: "1", checkedInAt: "2026-09-20T01:00:00Z" },
    });
    expect(msg).toContain("TH1");
    expect(msg).toContain("1101");
  });

  it("still gives a sensible duplicate message when the existing parcel has no room", () => {
    const msg = errorMessage({ code: "DUPLICATE_TRACKING_CODE", params: { trackingCode: "TH1", checkedInAt: "2026-09-20T01:00:00Z" } });
    expect(msg).toContain("TH1");
    expect(msg).not.toContain("undefined");
  });

  it("lists the affected tracking codes for PARCEL_NOT_PENDING", () => {
    const msg = errorMessage({ code: "PARCEL_NOT_PENDING", params: { trackingCodes: ["A1", "A2"] } });
    expect(msg).toContain("A1");
    expect(msg).toContain("A2");
  });

  it("reports the actual count for PENDING_COUNT_CHANGED", () => {
    expect(errorMessage({ code: "PENDING_COUNT_CHANGED", params: { expected: 3, actual: 2 } })).toContain("2");
  });

  it("has a distinct message per known code (no accidental duplicates/fallback collisions)", () => {
    const codes = [
      "VALIDATION_ERROR", "UNAUTHENTICATED", "INVALID_CREDENTIALS", "FORBIDDEN", "NOT_FOUND",
      "ROOM_NOT_IN_DIRECTORY", "RESIDENT_NOT_IN_ROOM", "PARCEL_NOT_FOUND", "PARCEL_HAS_ROOM",
      "NO_PENDING_PARCELS", "NETWORK_ERROR", "INTERNAL_ERROR",
    ];
    const messages = codes.map((code) => errorMessage({ code, params: {} }));
    expect(new Set(messages).size).toBe(messages.length);
  });

  it("falls back to a generic message for an unknown code instead of throwing", () => {
    expect(() => errorMessage({ code: "SOMETHING_NEW_FROM_THE_SERVER", params: {} })).not.toThrow();
    expect(errorMessage({ code: "SOMETHING_NEW_FROM_THE_SERVER" })).toBe(errorMessage({ code: "INTERNAL_ERROR" }));
  });

  it("does not throw when params is missing entirely", () => {
    expect(() => errorMessage({ code: "PARCEL_NOT_PENDING" })).not.toThrow();
  });
});
