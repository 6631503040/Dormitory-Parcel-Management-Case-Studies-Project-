// Maps the API's stable machine `code` values to the Thai text shown to Staff (design-spec §5:
// the backend never sends user-facing text; the frontend owns the message for every code).
import { formatThaiDateTime } from "../components/shared";

const MESSAGES = {
  VALIDATION_ERROR: () => "ข้อมูลไม่ถูกต้อง กรุณาตรวจสอบและลองใหม่",
  UNAUTHENTICATED: () => "เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่",
  INVALID_CREDENTIALS: () => "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง",
  FORBIDDEN: () => "คุณไม่มีสิทธิ์ทำรายการนี้",
  NOT_FOUND: () => "ไม่พบข้อมูลที่ต้องการ",
  UNSUPPORTED_MEDIA_TYPE: () => "เกิดข้อผิดพลาดในการส่งข้อมูล กรุณาลองใหม่",
  ROOM_NOT_IN_DIRECTORY: () => "ไม่พบห้องนี้ในทะเบียนผู้พัก กรุณาเลือกห้องจากรายการ",
  RESIDENT_NOT_IN_ROOM: () => "ผู้รับที่เลือกไม่ได้อยู่ห้องนี้",
  DUPLICATE_TRACKING_CODE: (p) =>
    p?.roomNumber
      ? `เลขพัสดุ ${p.trackingCode} ถูกบันทึกไว้แล้วที่ห้อง ${p.buildingCode}${p.roomNumber} เมื่อ ${formatThaiDateTime(p.checkedInAt)}`
      : `เลขพัสดุ ${p?.trackingCode ?? ""} ถูกบันทึกไว้แล้ว (มีปัญหา) เมื่อ ${formatThaiDateTime(p?.checkedInAt)}`,
  PARCEL_NOT_FOUND: (p) =>
    p?.trackingCodes?.length ? `ไม่พบพัสดุ: ${p.trackingCodes.join(", ")}` : "ไม่พบพัสดุนี้ในระบบ",
  PARCEL_NOT_PENDING: (p) =>
    p?.trackingCodes?.length
      ? `พัสดุต่อไปนี้นำออกไปแล้วหรือยังไม่มีห้อง: ${p.trackingCodes.join(", ")} — กรุณาตรวจสอบรายการอีกครั้ง`
      : "พัสดุนี้ถูกนำออกไปแล้วหรือยังไม่มีห้อง",
  PARCEL_HAS_ROOM: () => "พัสดุนี้ถูกระบุห้องไปแล้ว",
  NO_PENDING_PARCELS: () => "ไม่มีพัสดุที่รอนำออกสำหรับห้องนี้แล้ว — อาจมีคนดำเนินการไปก่อนแล้ว",
  PENDING_COUNT_CHANGED: (p) =>
    `จำนวนพัสดุที่รอนำออกเปลี่ยนไป (ตอนนี้มี ${p?.actual ?? "?"} รายการ) กรุณาตรวจสอบรายการแล้วลองใหม่`,
  NO_PENDING_LINE_OTP: () => "ห้องนี้ไม่มีคำขอยืนยันตัวตนผ่าน LINE ที่รอดำเนินการอยู่ในขณะนี้",
  NETWORK_ERROR: () => "ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้ กรุณาตรวจสอบการเชื่อมต่อแล้วลองใหม่",
  INTERNAL_ERROR: () => "เกิดข้อผิดพลาดบางอย่าง กรุณาลองใหม่อีกครั้ง",
};

// err is an ApiError (or anything with .code/.params); unknown codes fall back to a generic message.
export function errorMessage(err) {
  const build = MESSAGES[err?.code];
  if (build) return build(err.params);
  return MESSAGES.INTERNAL_ERROR();
}
