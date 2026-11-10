import React, { useState } from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { server } from "../test/server";
import RoomCombobox from "./RoomCombobox";
import { makeRoomHit } from "../test/fixtures";

// A tiny controlled wrapper: RoomCombobox is otherwise stateless w.r.t. the chosen room.
function Controlled({ onChange }) {
  const [value, setValue] = useState(null);
  return (
    <RoomCombobox
      value={value}
      onChange={(v) => {
        setValue(v);
        onChange?.(v);
      }}
    />
  );
}

function mockRooms(byQuery) {
  server.use(
    http.get("/api/v1/rooms/search", ({ request }) => {
      const q = new URL(request.url).searchParams.get("q");
      return HttpResponse.json({ items: byQuery[q] ?? [] });
    })
  );
}

describe("RoomCombobox", () => {
  it("never accepts free text: onChange only ever receives an option chosen from the list", async () => {
    const room101 = makeRoomHit({ id: 1, roomNumber: "101", buildingCode: "1", residents: [{ id: 1, fullName: "สมชาย ใจดี", nickname: null }] });
    mockRooms({ "10": [room101] });
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<Controlled onChange={onChange} />);

    await user.type(screen.getByRole("combobox"), "10");
    await user.click(await screen.findByRole("option", { name: /1101/ }));

    expect(onChange).toHaveBeenCalledWith(room101);
    expect(await screen.findByText("1101 · สมชาย ใจดี")).toBeInTheDocument();
    // Once selected, the free-text input is gone — there's no way to type over the chosen room.
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  });

  it("selects with the keyboard: ArrowDown then Enter", async () => {
    mockRooms({
      "1": [makeRoomHit({ id: 1, roomNumber: "101", buildingCode: "1", residents: [] }), makeRoomHit({ id: 2, roomNumber: "102", buildingCode: "1", residents: [] })],
    });
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<Controlled onChange={onChange} />);

    await user.type(screen.getByRole("combobox"), "1");
    await screen.findByRole("option", { name: /1102/ });
    await user.keyboard("{ArrowDown}{Enter}");

    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ id: 2, roomNumber: "102" }));
  });

  it("clearing a selected room returns to free text and refocuses the input", async () => {
    const room = makeRoomHit({ id: 1, roomNumber: "101", buildingCode: "1", residents: [] });
    mockRooms({ "101": [room] });
    const user = userEvent.setup();
    render(<Controlled />);

    await user.type(screen.getByRole("combobox"), "101");
    await user.click(await screen.findByRole("option", { name: /101/ }));
    await user.click(screen.getByLabelText("เปลี่ยนห้อง"));

    const input = screen.getByRole("combobox");
    expect(input).toHaveValue("");
    await waitFor(() => expect(input).toHaveFocus());
  });

  it("shows a not-found message when the directory has no match", async () => {
    mockRooms({ zzz: [] });
    const user = userEvent.setup();
    render(<Controlled />);
    await user.type(screen.getByRole("combobox"), "zzz");
    expect(await screen.findByText("ไม่พบห้องหรือชื่อนี้ในรายชื่อผู้พัก")).toBeInTheDocument();
  });

  it("shows a distinct error message when the search request itself fails", async () => {
    server.use(http.get("/api/v1/rooms/search", () => HttpResponse.json({ code: "INTERNAL_ERROR" }, { status: 500 })));
    const user = userEvent.setup();
    render(<Controlled />);
    await user.type(screen.getByRole("combobox"), "101");
    expect(await screen.findByText("ค้นหาห้องไม่สำเร็จ ลองใหม่อีกครั้ง")).toBeInTheDocument();
  });

  it("aborts an in-flight search instead of letting its slow response clobber a newer one", async () => {
    server.use(
      http.get("/api/v1/rooms/search", async ({ request }) => {
        const q = new URL(request.url).searchParams.get("q");
        if (q === "1") {
          await new Promise((r) => setTimeout(r, 150)); // slow: still in flight when "10" is typed
          return HttpResponse.json({ items: [makeRoomHit({ id: 1, roomNumber: "111", buildingCode: "1", residents: [] })] });
        }
        return HttpResponse.json({ items: [makeRoomHit({ id: 2, roomNumber: "222", buildingCode: "2", residents: [] })] });
      })
    );
    const user = userEvent.setup();
    render(<Controlled />);
    const input = screen.getByRole("combobox");

    await user.type(input, "1");
    // Let the debounce (200ms) elapse so the slow "1" request actually starts...
    await new Promise((r) => setTimeout(r, 250));
    // ...then type more before it resolves. The component must abort it, not race it.
    await user.type(input, "0");

    await screen.findByRole("option", { name: /2222/ });
    // Give the slow "1" response's own 150ms every chance to arrive and (wrongly) overwrite the list.
    await new Promise((r) => setTimeout(r, 200));
    expect(screen.queryByRole("option", { name: /1111/ })).not.toBeInTheDocument();
    expect(screen.getByRole("option", { name: /2222/ })).toBeInTheDocument();
  });
});
