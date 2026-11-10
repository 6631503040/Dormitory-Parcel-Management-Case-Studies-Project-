import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { server } from "../test/server";
import DashboardPage from "./DashboardPage";
import { makeDashboard, makeParcel } from "../test/fixtures";

const noUnmatched = () => HttpResponse.json({ items: [], page: 1, pageSize: 1, total: 0 });

// UnmatchedQueue is a real child of DashboardPage and makes its own requests (counts + list) to
// the same /api/v1/parcels endpoint — give it an empty, harmless queue by default so these tests
// can focus on the Dashboard's own behaviour.
function mockEnv({ dashboard = makeDashboard(), search } = {}) {
  server.use(http.get("/api/v1/dashboard", () => HttpResponse.json(dashboard)));
  server.use(
    http.get("/api/v1/parcels", ({ request }) => {
      const url = new URL(request.url);
      if (url.searchParams.get("unmatched") === "true") return noUnmatched();
      return search ? search(url) : HttpResponse.json({ items: [], page: 1, pageSize: 20, total: 0 });
    })
  );
}

describe("DashboardPage", () => {
  it("shows pending parcels with eight-item server pages and replaces the page", async () => {
    const requests = [];
    mockEnv({ search: (url) => {
      requests.push(url.searchParams);
      const page = Number(url.searchParams.get("page"));
      const start = (page - 1) * 8;
      return HttpResponse.json({ items: Array.from({ length: page === 1 ? 8 : 2 }, (_, i) => makeParcel({ trackingCode: `P${start + i}` })), total: 10 });
    }});
    const user = userEvent.setup();
    render(<DashboardPage onOpenHistory={vi.fn()} refreshKey={0} />);
    await screen.findAllByText("P0");
    expect(screen.getByText("1–8 จาก 10 รายการ")).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "สถานะ" })).toBeInTheDocument();
    expect(requests[0].get("status")).toBe("pending");
    expect(requests[0].get("unmatched")).toBe("false");
    expect(requests[0].get("pageSize")).toBe("8");
    await user.click(screen.getByRole("button", { name: "หน้า 2" }));
    await screen.findAllByText("P9");
    expect(screen.queryByText("P0")).not.toBeInTheDocument();
    expect(screen.getByText("9–10 จาก 10 รายการ")).toBeInTheDocument();
    await user.type(screen.getByLabelText("ค้นหาพัสดุรอรับ"), "101");
    await waitFor(() => expect(requests.at(-1).get("q")).toBe("101"));
    expect(requests.at(-1).get("page")).toBe("1");
  });
  it("opens existing parcel history and check-in/out actions", async () => {
    mockEnv({ search: () => HttpResponse.json({ items: [makeParcel({ trackingCode: "TH100" })], total: 1 }) });
    const history = vi.fn(), checkIn = vi.fn(), checkOut = vi.fn();
    const user = userEvent.setup();
    render(<DashboardPage onOpenHistory={history} onOpenCheckIn={checkIn} onOpenCheckOut={checkOut} refreshKey={0} />);
    await user.click((await screen.findAllByText("TH100"))[0]);
    expect(history).toHaveBeenCalledWith(expect.objectContaining({ trackingCode: "TH100" }));
    await user.click(screen.getByRole("button", { name: "รับพัสดุเข้า" }));
    await user.click(screen.getByRole("button", { name: "นำพัสดุออก" }));
    expect(checkIn).toHaveBeenCalledTimes(1);
    expect(checkOut).toHaveBeenCalledTimes(1);
  });
  it("surfaces API failures", async () => {
    mockEnv({ search: () => HttpResponse.json({ code: "INTERNAL_ERROR" }, { status: 500 }) });
    render(<DashboardPage refreshKey={0} />);
    expect(await screen.findByRole("alert")).toHaveTextContent("เกิดข้อผิดพลาด");
  });
});
