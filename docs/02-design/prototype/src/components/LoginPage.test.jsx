import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { server } from "../test/server";
import LoginPage from "./LoginPage";
import { makeStaff } from "../test/fixtures";

describe("LoginPage", () => {
  it("shows a client-side error and never calls the API when fields are empty", async () => {
    const user = userEvent.setup();
    const onLogin = vi.fn();
    render(<LoginPage onLogin={onLogin} />);

    await user.click(screen.getByRole("button", { name: /เข้าสู่ระบบ/ }));

    expect(await screen.findByRole("alert")).toHaveTextContent("กรุณากรอกชื่อผู้ใช้และรหัสผ่าน");
    expect(onLogin).not.toHaveBeenCalled();
  });

  it("logs in and hands the returned staff object to onLogin", async () => {
    const staff = makeStaff();
    let receivedBody;
    server.use(
      http.post("/api/v1/auth/login", async ({ request }) => {
        receivedBody = await request.json();
        return HttpResponse.json({ staff });
      })
    );
    const user = userEvent.setup();
    const onLogin = vi.fn();
    render(<LoginPage onLogin={onLogin} />);

    await user.type(screen.getByLabelText("ชื่อผู้ใช้"), "somsri");
    await user.type(screen.getByLabelText("รหัสผ่าน"), "parcel1234");
    await user.click(screen.getByRole("button", { name: /เข้าสู่ระบบ/ }));

    await waitFor(() => expect(onLogin).toHaveBeenCalledWith(staff));
    expect(receivedBody).toEqual({ username: "somsri", password: "parcel1234" });
  });

  it("shows the server's message on invalid credentials and does not log in", async () => {
    server.use(http.post("/api/v1/auth/login", () => HttpResponse.json({ code: "INVALID_CREDENTIALS" }, { status: 401 })));
    const user = userEvent.setup();
    const onLogin = vi.fn();
    render(<LoginPage onLogin={onLogin} />);

    await user.type(screen.getByLabelText("ชื่อผู้ใช้"), "somsri");
    await user.type(screen.getByLabelText("รหัสผ่าน"), "wrong");
    await user.click(screen.getByRole("button", { name: /เข้าสู่ระบบ/ }));

    expect(await screen.findByRole("alert")).toHaveTextContent("ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง");
    expect(onLogin).not.toHaveBeenCalled();
  });

  it("disables the submit button and shows a loading label while the request is in flight", async () => {
    let resolveLogin;
    server.use(
      http.post(
        "/api/v1/auth/login",
        () =>
          new Promise((resolve) => {
            resolveLogin = () => resolve(HttpResponse.json({ staff: makeStaff() }));
          })
      )
    );
    const user = userEvent.setup();
    render(<LoginPage onLogin={vi.fn()} />);

    await user.type(screen.getByLabelText("ชื่อผู้ใช้"), "somsri");
    await user.type(screen.getByLabelText("รหัสผ่าน"), "parcel1234");
    await user.click(screen.getByRole("button", { name: /เข้าสู่ระบบ/ }));

    const button = await screen.findByRole("button", { name: /กำลังเข้าสู่ระบบ/ });
    expect(button).toBeDisabled();
    resolveLogin();
  });
});
