import { describe, it, expect, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "../test/server";
import { api, ApiError, setUnauthenticatedHandler } from "./client";

describe("request()", () => {
  it("sends credentials so the session cookie is included on every call", async () => {
    let seenCredentials;
    server.use(
      http.get("/api/v1/auth/me", ({ request }) => {
        seenCredentials = request.credentials;
        return HttpResponse.json({ staff: { id: 1 } });
      })
    );
    await api.me();
    expect(seenCredentials).toBe("include");
  });

  it("sends a JSON body with Content-Type when the call has one", async () => {
    let seenContentType, seenBody;
    server.use(
      http.post("/api/v1/auth/login", async ({ request }) => {
        seenContentType = request.headers.get("content-type");
        seenBody = await request.json();
        return HttpResponse.json({ staff: { id: 1 } });
      })
    );
    await api.login("somsri", "secret");
    expect(seenContentType).toMatch(/application\/json/);
    expect(seenBody).toEqual({ username: "somsri", password: "secret" });
  });

  it("omits the body entirely for checkOutAll() with no expectedCount", async () => {
    let seenContentType, seenBodyText;
    server.use(
      http.post("/api/v1/rooms/1/check-out-all", async ({ request }) => {
        seenContentType = request.headers.get("content-type");
        seenBodyText = await request.text();
        return HttpResponse.json({ checkedOutCount: 0, parcels: [] });
      })
    );
    await api.checkOutAll(1);
    expect(seenContentType).toBeNull();
    expect(seenBodyText).toBe("");
  });

  it("builds the query string and drops undefined/null/empty values", async () => {
    let seenSearch;
    server.use(
      http.get("/api/v1/parcels", ({ request }) => {
        seenSearch = new URL(request.url).search;
        return HttpResponse.json({ items: [], page: 1, pageSize: 20, total: 0 });
      })
    );
    await api.listParcels({ q: "101", status: undefined, roomId: null, unmatched: "" });
    expect(seenSearch).toBe("?q=101");
  });

  it("throws an ApiError carrying the response's code, params and status on a 4xx/5xx", async () => {
    server.use(
      http.post("/api/v1/parcels", () =>
        HttpResponse.json({ code: "ROOM_NOT_IN_DIRECTORY", params: { roomId: 999 } }, { status: 422 })
      )
    );
    await expect(api.checkIn({ trackingCode: "X", roomId: 999 })).rejects.toMatchObject({
      code: "ROOM_NOT_IN_DIRECTORY",
      params: { roomId: 999 },
      status: 422,
    });
  });

  it("returns null for a 204 No Content", async () => {
    server.use(http.post("/api/v1/auth/logout", () => new HttpResponse(null, { status: 204 })));
    await expect(api.logout()).resolves.toBeNull();
  });

  it("wraps a network failure as NETWORK_ERROR", async () => {
    server.use(http.get("/api/v1/auth/me", () => HttpResponse.error()));
    await expect(api.me()).rejects.toBeInstanceOf(ApiError);
    await expect(api.me()).rejects.toMatchObject({ code: "NETWORK_ERROR" });
  });

  it("falls back to INTERNAL_ERROR when a failed response has no code", async () => {
    server.use(http.get("/api/v1/auth/me", () => new HttpResponse("oops", { status: 500 })));
    await expect(api.me()).rejects.toMatchObject({ code: "INTERNAL_ERROR", status: 500 });
  });

  it("calls the registered handler once on every 401, in addition to throwing", async () => {
    const handler = vi.fn();
    setUnauthenticatedHandler(handler);
    server.use(http.get("/api/v1/auth/me", () => HttpResponse.json({ code: "UNAUTHENTICATED" }, { status: 401 })));
    await expect(api.me()).rejects.toMatchObject({ code: "UNAUTHENTICATED" });
    expect(handler).toHaveBeenCalledTimes(1);
    setUnauthenticatedHandler(null);
  });
});
