export const ROOM_DIRECTORY = {
  '090': ['สมชาย ใจดี'], '101/2': ['ณัฐพล สุขใจ'],
  '203/1': ['พิมพ์ชนก แสงทอง'], '305': ['กันตพงศ์ วงศ์ไพร'],
  '108/1': ['อารียา คงสวัสดิ์'], '212': ['ธีรภัทร มั่นคง'], '150/3': ['ชญานิษฐ์ เพชรรัตน์'],
};
export const key = (value) => typeof value === 'string' ? value.trim().toLowerCase() : '';
export const residentsFor = (room) => Object.hasOwn(ROOM_DIRECTORY, room) ? ROOM_DIRECTORY[room] : [];
export function parcelMatches(p, query) {
  const q = key(query);
  return !q || [p.code, p.room, p.name, ...residentsFor(p.room)].some((v) => key(v).includes(q));
}
export function dashboardResults(parcels, query) {
  return parcels.filter((p) => p.status === 'in' && parcelMatches(p, query));
}
export function pendingDamagedParcels(parcels) {
  return parcels.filter((p) => p.status === 'in' && p.damaged)
    .sort((a, b) => parseParcelDate(a.receivedAt) - parseParcelDate(b.receivedAt));
}
export function resolveRoom(parcels, query) {
  const q = key(query);
  if (!q) return '';
  const exact = parcels.filter((p) => key(p.room) === q || key(p.code) === q);
  const matches = exact.length ? exact : parcels.filter((p) => parcelMatches(p, q));
  const rooms = [...new Set(matches.map((p) => p.room))];
  return rooms.length === 1 ? rooms[0] : '';
}
export const emptyDraft = () => ({ batch: [], form: { code: '', room: '', damaged: false, damageReason: '' } });
export const hasCurrentEntry = (form) => !!(key(form.code) || form.damaged || key(form.damageReason));
export const hasDraft = (draft) => draft.batch.length > 0 || hasCurrentEntry(draft.form) || !!key(draft.form.room);
export function entryErrors(form, existing, batch = []) {
  const errors = {};
  if (!key(form.code)) errors.code = 'กรุณาสแกนหรือกรอกเลขพัสดุ';
  else if (form.code.trim().length > 256 || /[\u0000-\u001f\u007f]/.test(form.code.trim())) errors.code = 'เลขพัสดุยาวเกิน 256 ตัวอักษรหรือมีอักขระควบคุม กรุณาตรวจรหัสอีกครั้ง';
  else {
    const duplicate = [...existing, ...batch].find((p) => key(p.code) === key(form.code));
    if (duplicate) errors.code = `เลขพัสดุ ${duplicate.code} มีอยู่แล้วสำหรับห้อง ${duplicate.room} กรุณาตรวจรายการเดิม`;
  }
  if (!residentsFor(form.room.trim()).length) errors.room = 'กรุณาเลือกเลขห้องที่มีอยู่ในทะเบียน';
  if (form.damaged && !key(form.damageReason)) errors.damageReason = 'กรุณาระบุสภาพกล่องหรือเหตุผลที่ชำรุด';
  else if (form.damageReason.length > 2000) errors.damageReason = 'หมายเหตุยาวเกิน 2,000 ตัวอักษร กรุณาย่อข้อความ';
  return errors;
}
export function validateBatch(batch, existing) {
  if (!batch.length) return 'ยังไม่มีรายการที่จะบันทึก';
  const accepted = [];
  for (const item of batch) {
    const errors = entryErrors(item, existing, accepted);
    if (Object.keys(errors).length) return Object.values(errors)[0];
    accepted.push(item);
  }
  return '';
}
export function checkoutLookup(parcels, code) {
  const normalized = key(code);
  if (!normalized) return { error: 'กรุณาสแกนหรือกรอกเลขพัสดุ' };
  if (normalized.length > 256 || /[\u0000-\u001f\u007f]/.test(normalized)) return { error: 'รหัสพัสดุไม่ถูกต้อง กรุณาสแกนหรือกรอกใหม่' };
  const matches = parcels.filter((p) => key(p.code) === normalized);
  if (!matches.length) return { error: 'ไม่พบเลขพัสดุนี้ กรุณาตรวจรหัสแล้วลองใหม่' };
  if (matches.length > 1) return { error: 'พบรหัสพัสดุซ้ำ กรุณาตรวจรายการใน Archive ก่อนนำออก' };
  if (matches[0].status !== 'in') return { error: 'พัสดุนี้นำออกแล้ว ไม่สามารถนำออกซ้ำได้' };
  return { parcel: matches[0] };
}
export function scanResult(parcels, room, code, selectedIds) {
  const exact = parcels.find((p) => key(p.code) === key(code));
  if (!exact) return { error: 'ไม่พบเลขพัสดุนี้ กรุณาตรวจรหัสแล้วสแกนใหม่' };
  if (exact.status !== 'in') return { error: 'พัสดุนี้นำออกแล้ว ไม่สามารถนำออกซ้ำได้' };
  if (exact.room !== room) return { error: `พัสดุนี้อยู่ห้อง ${exact.room} ไม่ใช่ห้อง ${room} รายการยังไม่ได้ถูกเลือก` };
  if (selectedIds.includes(exact.id)) return { message: `เลขพัสดุ ${exact.code} ถูกเลือกไว้แล้ว`, parcel: exact, repeated: true };
  return { message: `เลือก ${exact.code} ห้อง ${room} แล้ว`, parcel: exact };
}
export function validateCheckOut(parcels, ids, room) {
  if (!room || !ids.length || new Set(ids).size !== ids.length) return 'กรุณาเลือกพัสดุของห้องเดียวกันก่อนยืนยัน';
  const selected = ids.map((id) => parcels.find((p) => p.id === id));
  if (selected.some((p) => !p || p.status !== 'in' || p.room !== room)) return 'รายการที่เลือกเปลี่ยนแปลงหรืออยู่ต่างห้อง กรุณาตรวจสอบก่อนยืนยันอีกครั้ง';
  return '';
}
// Legacy offset-free demo timestamps represent the displayed Bangkok wall time.
export function parseParcelDate(value) {
  if (typeof value !== 'string' || !value.trim()) return new Date(NaN);
  const iso = value.trim();
  return new Date(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?$/.test(iso) ? `${iso}+07:00` : iso);
}
export function formatBangkokDate(value) {
  const date = parseParcelDate(value);
  if (!Number.isFinite(date.getTime())) return 'ไม่ทราบวันที่';
  const parts = new Intl.DateTimeFormat('th-TH-u-ca-buddhist', { timeZone: 'Asia/Bangkok', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(date);
  const get = (type) => parts.find((p) => p.type === type)?.value;
  return `${get('day')} ${get('month')} ${get('year')} ${get('hour')}:${get('minute')}`;
}
export function validStoredParcels(value) {
  if (!Array.isArray(value)) return false;
  const ids = new Set(), codes = new Set();
  return value.every((p) => {
    if (!p || typeof p.id !== 'string' || !p.id || !key(p.code) || !key(p.room) || !['in', 'out'].includes(p.status) || !Number.isFinite(Number(p.qty)) || Number(p.qty) <= 0 || !Number.isFinite(parseParcelDate(p.receivedAt).getTime()) || (p.exitedAt && !Number.isFinite(parseParcelDate(p.exitedAt).getTime())) || ids.has(p.id) || codes.has(key(p.code))) return false;
    if (['name', 'line', 'damageReason'].some((field) => p[field] != null && typeof p[field] !== 'string')) return false;
    ids.add(p.id); codes.add(key(p.code)); return true;
  });
}
export function loadParcelState(storage, fallback) {
  try {
    const raw = storage.getItem('parcelhub-parcels');
    if (raw === null) return { parcels: fallback, raw, error: '' };
    const parcels = JSON.parse(raw);
    if (!validStoredParcels(parcels)) throw new Error('invalid data');
    return { parcels, raw, error: '' };
  } catch {
    return { parcels: [], raw: undefined, error: 'อ่านข้อมูลพัสดุในเครื่องไม่ได้ ข้อมูลเดิมยังไม่ถูกเขียนทับ กรุณาตรวจพื้นที่จัดเก็บหรือข้อมูลเดิมแล้วโหลดหน้าใหม่' };
  }
}
export function persistParcels(storage, parcels, expectedRaw) {
  if (!validStoredParcels(parcels)) return { ok: false, error: 'ข้อมูลพัสดุไม่ครบถ้วน รายการยังไม่ได้บันทึก กรุณาตรวจข้อมูลอีกครั้ง' };
  try {
    if (expectedRaw === undefined || storage.getItem('parcelhub-parcels') !== expectedRaw) return { ok: false, error: 'ข้อมูลในเครื่องเปลี่ยนจากอีกหน้าต่าง กรุณาตรวจข้อมูลล่าสุดก่อนบันทึก ร่างนี้ยังคงอยู่' };
    const raw = JSON.stringify(parcels);
    storage.setItem('parcelhub-parcels', raw);
    return { ok: true, raw };
  } catch {
    return { ok: false, error: 'บันทึกข้อมูลในเครื่องไม่ได้ อาจเต็มหรือถูกปิดกั้น รายการยังไม่ได้บันทึกและร่างยังคงอยู่ กรุณาตรวจพื้นที่จัดเก็บแล้วลองใหม่' };
  }
}
