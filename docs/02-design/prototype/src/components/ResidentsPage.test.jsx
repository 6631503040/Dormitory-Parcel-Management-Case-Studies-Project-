import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { server } from "../test/server";
import ResidentsPage from "./ResidentsPage";

const CSV = "room_number,full_name,phone\n1101,สมชาย ใจดี,\n1103,New Person,0899999999\n";

function summary(overrides = {}) {
  return {
    rows: 2, unchanged: 1, addedCount: 1, movedCount: 0, movedOutCount: 1, newRoomCount: 1, errorCount: 0,
    added: [{ fullName: "New Person", roomNumber: "1103" }], moved: [],
    movedOut: [{ fullName: "ณัฐพล สุขใจ", roomNumber: "2101", pendingParcels: 2 }],
    newRooms: ["1103"], errors: [], ...overrides,
  };
}

function csvFile(text = CSV) {
  return new File([text], "residents.csv", { type: "text/csv" });
}

describe("ResidentsPage", () => {
  it("explains the required columns before any upload", () => {
    render(<ResidentsPage />);
    const table = screen.getByRole("table", { name: /รูปแบบคอลัมน์/ });
    expect(table).toHaveTextContent("room_number");
    expect(table).toHaveTextContent("full_name");
    expect(table).toHaveTextContent("phone");
    expect(screen.getByText(/ผู้พักทุกคนที่พักอยู่ตอนนี้/)).toBeInTheDocument();
  });

  it("previews the upload, warns about pending parcels, and applies only on confirm", async () => {
    let previewBody, applyBody;
    server.use(
      http.post("/api/v1/admin/residents/import/preview", async ({ request }) => {
        previewBody = await request.json();
        return HttpResponse.json(summary());
      }),
      http.post("/api/v1/admin/residents/import", async ({ request }) => {
        applyBody = await request.json();
        return HttpResponse.json(summary());
      })
    );
    const user = userEvent.setup();
    const onImported = vi.fn();
    render(<ResidentsPage onImported={onImported} />);

    await user.upload(screen.getByLabelText("เลือกไฟล์ CSV"), csvFile());

    expect(await screen.findByText("ย้ายออก: 1 คน")).toBeInTheDocument();
    expect(previewBody).toEqual({ csv: CSV });
    expect(applyBody).toBeUndefined();
    await user.click(screen.getByText("ย้ายออก (1)"));
    expect(screen.getByText(/ยังมีพัสดุรอรับ 2 ชิ้น/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "ยืนยันอัปเดตรายชื่อ" }));
    await waitFor(() => expect(onImported).toHaveBeenCalled());
    expect(applyBody).toEqual({ csv: CSV });
  });

  it("lists file errors by line and blocks confirming", async () => {
    server.use(
      http.post("/api/v1/admin/residents/import/preview", () =>
        HttpResponse.json(summary({ errorCount: 1, errors: [{ line: 3, field: "room_number", reason: "invalid_format" }] }))
      )
    );
    const user = userEvent.setup();
    render(<ResidentsPage />);

    await user.upload(screen.getByLabelText("เลือกไฟล์ CSV"), csvFile());

    expect(await screen.findByText(/บรรทัด 3: เลขห้องต้องเป็นตัวเลข/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "ยืนยันอัปเดตรายชื่อ" })).toBeDisabled();
  });

  it("rejects a file that is not UTF-8 without calling the API", async () => {
    const preview = vi.fn();
    server.use(http.post("/api/v1/admin/residents/import/preview", preview));
    const user = userEvent.setup();
    render(<ResidentsPage />);

    // 0xC1 0xD2 is Thai in Windows-874, and invalid as UTF-8.
    await user.upload(screen.getByLabelText("เลือกไฟล์ CSV"), new File([new Uint8Array([0xc1, 0xd2, 0x0a])], "ansi.csv", { type: "text/csv" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("CSV UTF-8");
    expect(preview).not.toHaveBeenCalled();
  });
});
