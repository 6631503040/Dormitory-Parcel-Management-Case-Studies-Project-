import React, { useEffect, useRef, useState } from "react";
import { UserPlus } from "lucide-react";
import { C, bodyFont, PagePagination, PageHeader, formatThaiDateTime } from "./shared";
import { api } from "../api/client";
import { errorMessage } from "../api/errorMessages";

export const STAFF_PAGE_SIZE = 20;

const ROLE_LABELS = { operator: "Staff", admin: "Admin" };
const EMPTY_FORM = { username: "", fullName: "", password: "", confirmPassword: "", role: "operator" };

// Same rules the API enforces (store.ValidateNewStaff); checked here first so the Admin gets the
// message without a round trip. The server re-validates regardless.
function validate(form) {
  const username = form.username.trim().toLowerCase();
  if (!username) return ["username", "กรุณากรอกชื่อผู้ใช้"];
  if (!/^[a-z0-9._-]{3,32}$/.test(username)) return ["username", "ชื่อผู้ใช้ต้องมี 3–32 ตัว ใช้ได้เฉพาะ a-z 0-9 . _ -"];
  if (!form.fullName.trim()) return ["fullName", "กรุณากรอกชื่อ-นามสกุล"];
  if (form.password.length < 8) return ["password", "รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร"];
  if (form.password !== form.confirmPassword) return ["confirmPassword", "รหัสผ่านทั้งสองช่องไม่ตรงกัน"];
  return null;
}

export default function StaffPage({ onCreated }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [invalidField, setInvalidField] = useState(null);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [page, setPage] = useState(1);
  const [list, setList] = useState({ items: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const fields = { username: useRef(null), fullName: useRef(null), password: useRef(null), confirmPassword: useRef(null) };

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    api
      .listStaff({ page, pageSize: STAFF_PAGE_SIZE }, controller.signal)
      .then((res) => {
        setList({ items: res.items, total: res.total });
        setListError("");
      })
      .catch((err) => {
        if (err.name !== "AbortError") setListError(errorMessage(err));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [page, reloadKey]);

  const change = (key) => (e) => {
    setForm((f) => ({ ...f, [key]: e.target.value }));
    setInvalidField(null);
    setError("");
  };

  const submit = async (event) => {
    event.preventDefault();
    const problem = validate(form);
    if (problem) {
      setInvalidField(problem[0]);
      setError(problem[1]);
      fields[problem[0]].current?.focus();
      return;
    }
    setSubmitting(true);
    try {
      const res = await api.createStaff({
        username: form.username.trim().toLowerCase(),
        fullName: form.fullName.trim(),
        password: form.password,
        role: form.role,
      });
      setForm(EMPTY_FORM);
      setPage(1);
      setReloadKey((k) => k + 1);
      onCreated?.(res.staff);
    } catch (err) {
      if (err.code === "USERNAME_TAKEN") {
        setInvalidField("username");
        fields.username.current?.focus();
      }
      setError(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const fieldProps = (key) => ({
    id: `staff-${key}`,
    ref: fields[key],
    value: form[key],
    onChange: change(key),
    disabled: submitting,
    "aria-invalid": invalidField === key,
    "aria-describedby": invalidField === key ? "staff-form-error" : undefined,
  });

  return (
    <>
      <PageHeader title="ลงทะเบียนผู้ใช้" description="สร้างบัญชีเข้าสู่ระบบให้ Staff และ Admin" />
      <section className="parcel-register mb-6" aria-labelledby="staff-form-heading">
        <div className="archive-toolbar">
          <p id="staff-form-heading" className="text-base font-semibold mb-4" style={{ ...bodyFont, color: C.text }}>บัญชีใหม่</p>
          <form onSubmit={submit} noValidate>
            <div className="grid gap-x-4 sm:grid-cols-2">
              <div className="form-field">
                <label htmlFor="staff-username">ชื่อผู้ใช้</label>
                <input {...fieldProps("username")} autoComplete="off" autoCapitalize="none" spellCheck={false} placeholder="เช่น somsri" />
              </div>
              <div className="form-field">
                <label htmlFor="staff-fullName">ชื่อ-นามสกุล</label>
                <input {...fieldProps("fullName")} autoComplete="off" placeholder="กรอกชื่อ-นามสกุล" />
              </div>
              <div className="form-field">
                <label htmlFor="staff-password">รหัสผ่าน</label>
                <input {...fieldProps("password")} type="password" autoComplete="new-password" placeholder="อย่างน้อย 8 ตัวอักษร" />
              </div>
              <div className="form-field">
                <label htmlFor="staff-confirmPassword">ยืนยันรหัสผ่าน</label>
                <input {...fieldProps("confirmPassword")} type="password" autoComplete="new-password" placeholder="กรอกรหัสผ่านอีกครั้ง" />
              </div>
              <div className="form-field">
                <label htmlFor="staff-role">สิทธิ์การใช้งาน</label>
                <select id="staff-role" value={form.role} onChange={change("role")} disabled={submitting}>
                  <option value="operator">{ROLE_LABELS.operator}</option>
                  <option value="admin">{ROLE_LABELS.admin}</option>
                </select>
              </div>
            </div>
            <div className="login-feedback">{error && <p id="staff-form-error" className="field-error" role="alert">{error}</p>}</div>
            <div className="desk-actions">
              <button type="submit" disabled={submitting} className="desk-button desk-button-primary">
                <UserPlus size={18} aria-hidden="true" />
                {submitting ? "กำลังลงทะเบียน…" : "ลงทะเบียน"}
              </button>
            </div>
          </form>
        </div>
      </section>

      <section className="parcel-register" aria-label="บัญชีผู้ใช้ทั้งหมด">
        <div className="archive-toolbar">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <p className="text-base font-semibold" style={{ ...bodyFont, color: C.text }}>บัญชีผู้ใช้ทั้งหมด</p>
            <span className="text-xs font-medium px-2.5 py-1 rounded-full" style={{ background: C.bg, color: C.textMuted, ...bodyFont }}>{list.total.toLocaleString()} บัญชี</span>
          </div>
          {listError && <p className="field-error" role="alert">{listError}</p>}
        </div>
        <PagePagination page={page} total={list.total} pageSize={STAFF_PAGE_SIZE} onChange={setPage} loading={loading} label="บัญชีผู้ใช้" />
        <div aria-busy={loading}>
          {loading ? (
            <p className="table-empty" role="status">กำลังโหลด…</p>
          ) : (
            <div className="table-scroll" role="region" aria-label="บัญชีผู้ใช้" tabIndex={0}>
              <table className="parcel-table">
                <caption className="sr-only">บัญชีผู้ใช้</caption>
                <thead>
                  <tr><th scope="col">ชื่อผู้ใช้</th><th scope="col">ชื่อ-นามสกุล</th><th scope="col">สิทธิ์</th><th scope="col">เข้าสู่ระบบล่าสุด</th></tr>
                </thead>
                <tbody>
                  {list.items.map((s) => (
                    <tr key={s.id}>
                      <td>{s.username}</td>
                      <td>{s.fullName}{!s.isActive && <span style={{ color: C.textMuted }}> (ปิดใช้งาน)</span>}</td>
                      <td>{ROLE_LABELS[s.role] ?? s.role}</td>
                      <td className="date-cell">{s.lastLoginAt ? formatThaiDateTime(s.lastLoginAt) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </>
  );
}
