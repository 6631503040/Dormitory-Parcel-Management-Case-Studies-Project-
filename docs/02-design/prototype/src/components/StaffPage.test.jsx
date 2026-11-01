import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { server } from "../test/server";
import StaffPage from "./StaffPage";
import { makeStaff } from "../test/fixtures";

function listHandler(items) {
  return http.get("/api/v1/admin/staff", () =>
    HttpResponse.json({ items, page: 1, pageSize: 20, total: items.length })
  );
}

async function fillForm(user, { username = "newstaff", fullName = "สมศรี ใจดี", password = "longenough1", confirm = password } = {}) {
  await user.type(screen.getByLabelText("ชื่อผู้ใช้"), username);
  await user.type(screen.getByLabelText("ชื่อ-นามสกุล"), fullName);
  await user.type(screen.getByLabelText("รหัสผ่าน"), password);
  await user.type(screen.getByLabelText("ยืนยันรหัสผ่าน"), confirm);
}

describe("StaffPage", () => {
  it("lists existing accounts with Staff/Admin role labels", async () => {
    server.use(listHandler([
      { ...makeStaff({ id: 1, username: "admin", fullName: "Admin", role: "admin" }), isActive: true, lastLoginAt: null, createdAt: "2026-11-01T00:00:00Z" },
      { ...makeStaff(), isActive: true, lastLoginAt: null, createdAt: "2026-11-01T00:00:00Z" },
    ]));
    render(<StaffPage />);

    expect(await screen.findByText("somsri")).toBeInTheDocument();
    const table = screen.getByRole("table");
    expect(table).toHaveTextContent("Admin");
    expect(table).toHaveTextContent("Staff");
    expect(screen.getByText("2 บัญชี")).toBeInTheDocument();
  });

  it("registers a Staff account with the chosen role, then clears the form and reports it", async () => {
    let body;
    server.use(
      listHandler([]),
      http.post("/api/v1/admin/staff", async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ staff: makeStaff({ id: 9, username: body.username, role: body.role }) }, { status: 201 });
      })
    );
    const user = userEvent.setup();
    const onCreated = vi.fn();
    render(<StaffPage onCreated={onCreated} />);

    await fillForm(user, { username: " NewStaff " });
    await user.selectOptions(screen.getByLabelText("สิทธิ์การใช้งาน"), "admin");
    await user.click(screen.getByRole("button", { name: /ลงทะเบียน/ }));

    await waitFor(() => expect(onCreated).toHaveBeenCalled());
    expect(body).toEqual({ username: "newstaff", fullName: "สมศรี ใจดี", password: "longenough1", role: "admin" });
    expect(screen.getByLabelText("ชื่อผู้ใช้")).toHaveValue("");
    expect(screen.getByLabelText("สิทธิ์การใช้งาน")).toHaveValue("operator");
  });

  it("stops on mismatched passwords without calling the API", async () => {
    const post = vi.fn();
    server.use(listHandler([]), http.post("/api/v1/admin/staff", post));
    const user = userEvent.setup();
    render(<StaffPage />);

    await fillForm(user, { confirm: "different1" });
    await user.click(screen.getByRole("button", { name: /ลงทะเบียน/ }));

    expect(await screen.findByRole("alert")).toHaveTextContent("รหัสผ่านทั้งสองช่องไม่ตรงกัน");
    expect(screen.getByLabelText("ยืนยันรหัสผ่าน")).toHaveAttribute("aria-invalid", "true");
    expect(post).not.toHaveBeenCalled();
  });

  it("shows USERNAME_TAKEN against the username field", async () => {
    server.use(
      listHandler([]),
      http.post("/api/v1/admin/staff", () =>
        HttpResponse.json({ code: "USERNAME_TAKEN", params: { username: "somsri" } }, { status: 409 })
      )
    );
    const user = userEvent.setup();
    render(<StaffPage />);

    await fillForm(user, { username: "somsri" });
    await user.click(screen.getByRole("button", { name: /ลงทะเบียน/ }));

    expect(await screen.findByRole("alert")).toHaveTextContent("ชื่อผู้ใช้ somsri ถูกใช้แล้ว");
    expect(screen.getByLabelText("ชื่อผู้ใช้")).toHaveAttribute("aria-invalid", "true");
  });
});
