import React, { useState } from "react";
import { Package, User, Lock, LogIn } from "lucide-react";
import { C, bodyFont, displayFont } from "./shared";

export default function LoginPage({ onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const submit = () => {
    if (!username.trim() || !password.trim()) {
      setError("กรุณากรอกชื่อผู้ใช้และรหัสผ่าน");
      return;
    }
    setError("");
    onLogin(username.trim());
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") submit();
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden" style={{ background: C.bg }}>
      <div className="absolute top-10 left-8 w-24 h-10 rounded-full rotate-[-18deg]" style={{ background: "#FBBC04", opacity: 0.8 }} />
      <div className="absolute bottom-16 right-8 w-28 h-10 rounded-full rotate-[22deg]" style={{ background: "#34A853", opacity: 0.8 }} />
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4 shadow-lg" style={{ background: C.primary }}>
            <Package size={26} color="#fff" strokeWidth={2.5} />
          </div>
          <h1 className="text-2xl font-bold" style={{ ...displayFont, color: C.text }}>ParcelHub</h1>
          <p className="text-sm mt-1" style={{ ...bodyFont, color: C.textMuted }}>ระบบจัดการพัสดุประจำอาคาร</p>
        </div>

        <div className="rounded-3xl border p-6 space-y-4 shadow-sm" style={{ background: C.card, borderColor: C.border }}>
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ ...bodyFont, color: C.textMuted }}>ชื่อผู้ใช้</label>
            <div className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border" style={{ borderColor: C.border }}>
              <User size={16} style={{ color: C.textMuted }} />
              <input value={username} onChange={(e) => setUsername(e.target.value)} onKeyDown={handleKeyDown} placeholder="admin" className="w-full outline-none text-sm bg-transparent" style={bodyFont} />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ ...bodyFont, color: C.textMuted }}>รหัสผ่าน</label>
            <div className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border" style={{ borderColor: C.border }}>
              <Lock size={16} style={{ color: C.textMuted }} />
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={handleKeyDown} placeholder="••••••••" className="w-full outline-none text-sm bg-transparent" style={bodyFont} />
            </div>
          </div>
          {error && <p className="text-xs" style={{ ...bodyFont, color: "#D64545" }}>{error}</p>}
          <button type="button" onClick={submit} className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-white" style={{ ...bodyFont, background: C.primary }}>
            <LogIn size={16} />
            เข้าสู่ระบบ
          </button>
        </div>
      </div>
    </div>
  );
}
