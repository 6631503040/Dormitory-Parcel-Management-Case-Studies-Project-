import React, { useRef, useState } from "react";
import { Package, ArrowRight, Eye, EyeOff } from "lucide-react";

export default function LoginPage({ onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [invalid, setInvalid] = useState({});
  const usernameInput = useRef(null);
  const passwordInput = useRef(null);
  const submit = (event) => {
    event.preventDefault();
    if (!username.trim() || !password.trim()) {
      setInvalid({ username: !username.trim(), password: !password.trim() });
      setError("กรุณากรอกชื่อผู้ใช้และรหัสผ่าน");
      (!username.trim() ? usernameInput : passwordInput).current?.focus();
      return;
    }
    setInvalid({});
    setError("");
    const result = onLogin(username.trim());
    if (!result?.ok) setError(result?.error || "เข้าสู่ระบบไม่สำเร็จ กรุณาลองใหม่");
  };
  return (
    <main className="login-page">
      <section className="login-panel" aria-labelledby="login-heading">
        <div className="desk-brand"><Package size={25} aria-hidden="true" /><span>ParcelHub</span></div>
        <div className="login-content">
          <h1 id="login-heading">เข้าสู่ระบบ</h1>
          <p className="login-description">ระบบจัดการพัสดุประจำอาคาร</p>
          <form onSubmit={submit} className="login-form">
            <div className="form-field"><label htmlFor="username">ชื่อผู้ใช้</label><input ref={usernameInput} id="username" autoComplete="username" autoCapitalize="none" spellCheck={false} value={username} onChange={(e) => { setUsername(e.target.value); setInvalid((fields) => ({ ...fields, username: false })); setError(""); }} placeholder="กรอกชื่อผู้ใช้" aria-invalid={!!invalid.username} aria-describedby={error ? "login-error" : undefined} /></div>
            <div className="form-field"><label htmlFor="password">รหัสผ่าน</label><div className="login-password"><input ref={passwordInput} id="password" type={showPassword ? "text" : "password"} autoComplete="current-password" value={password} onChange={(e) => { setPassword(e.target.value); setInvalid((fields) => ({ ...fields, password: false })); setError(""); }} placeholder="กรอกรหัสผ่าน" aria-invalid={!!invalid.password} aria-describedby={error ? "login-error" : undefined} /><button type="button" className="icon-button login-password-toggle" aria-label={showPassword ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"} onClick={() => setShowPassword((value) => !value)}>{showPassword ? <EyeOff size={19} aria-hidden="true" /> : <Eye size={19} aria-hidden="true" />}</button></div></div>
            <div className="login-feedback">{error && <p id="login-error" className="field-error" role="alert">{error}</p>}</div>
            <button type="submit" className="desk-button desk-button-primary">เข้าสู่ระบบ<ArrowRight size={18} aria-hidden="true" /></button>
          </form>
        </div>
      </section>
      <div className="login-visual" aria-hidden="true"><img src={`${import.meta.env.BASE_URL}images/dormitory-login-campus.webp`} width="1122" height="1402" alt="" fetchpriority="high" /></div>
    </main>
  );
}
