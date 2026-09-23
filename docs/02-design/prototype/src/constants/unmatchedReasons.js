// Mirrors the backend's `unmatched_reason` enum (db/migrations/0002) — keep in sync if it changes.
export const UNMATCHED_REASONS = [
  { id: "no_match", label: "ไม่พบห้องที่ตรงกัน" },
  { id: "no_resident", label: "ห้องนี้ยังไม่มีผู้พักในระบบ" },
  { id: "ambiguous", label: "ชื่อตรงกับหลายห้อง" },
  { id: "other", label: "อื่น ๆ" },
];

export function unmatchedReasonLabel(id) {
  return UNMATCHED_REASONS.find((r) => r.id === id)?.label || "";
}
