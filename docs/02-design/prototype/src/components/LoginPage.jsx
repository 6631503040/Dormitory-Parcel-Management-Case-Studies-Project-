import React, { useState } from "react";
import { Package, LogIn } from "lucide-react";

export default function LoginPage({ onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const submit = (event) => {
    event.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError("กรุณากรอกชื่อผู้ใช้และรหัสผ่าน");
      return;
    }
    setError("");
    const result = onLogin(username.trim());
    if (!result?.ok) setError(result?.error || "เข้าสู่ระบบไม่สำเร็จ กรุณาลองใหม่");
  };
  return (
    <main className="login-page">
      <div className="login-content">
        <div className="desk-brand"><Package size={25} aria-hidden="true" /><span>ParcelHub</span></div>
        <h1>เข้าสู่ระบบ</h1>
        <p className="login-description">ระบบจัดการพัสดุประจำอาคาร</p>
        <form onSubmit={submit} className="login-form">
          <div className="form-field"><label htmlFor="username">ชื่อผู้ใช้</label><input id="username" autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="admin" aria-describedby={error ? "login-error" : undefined} /></div>
          <div className="form-field"><label htmlFor="password">รหัสผ่าน</label><input id="password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} aria-describedby={error ? "login-error" : undefined} /></div>
          {error && <p id="login-error" className="field-error" role="alert">{error}</p>}
          <button type="submit" className="desk-button desk-button-primary"><LogIn size={18} aria-hidden="true" />เข้าสู่ระบบ</button>
        </form>
      </div>
    </main>
  );
}
