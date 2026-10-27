// The exact consent text shown before a registration code is issued (LR-01 / LR-05). Its version
// must equal PushConsentVersion in backend/internal/api/push_handlers.go — the backend records
// the version on every registration, so change the text => bump BOTH versions together.
export const CONSENT_VERSION = "push-v1";

export const CONSENT_POINTS = [
  "ระบบจะเก็บเลขห้องของคุณ และข้อมูลสำหรับส่งแจ้งเตือนของเบราว์เซอร์นี้ (ไม่เก็บชื่อ เบอร์โทร หรือรหัสนักศึกษา)",
  "ใช้เพื่อแจ้งเตือนเมื่อมีพัสดุของห้องคุณมาถึงเคาน์เตอร์เท่านั้น ข้อความแจ้งเตือนมีเพียงเลขห้องและจำนวนพัสดุ",
  "การลงทะเบียนหมดอายุใน 180 วัน และคุณกดปิดการแจ้งเตือนได้ทุกเมื่อจากหน้านี้ หรือแจ้งเจ้าหน้าที่ที่เคาน์เตอร์",
];
