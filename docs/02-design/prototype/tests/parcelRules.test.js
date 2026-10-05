import test from 'node:test';
import assert from 'node:assert/strict';
import { parcelMatches, resolveRoom, entryErrors, validateBatch, scanResult, validateCheckOut, emptyDraft, hasCurrentEntry, hasDraft, parseParcelDate, formatBangkokDate, loadParcelState, persistParcels, dashboardResults, pendingDamagedParcels } from '../src/lib/parcelRules.js';
const p = (id, code, room = '090', extra = {}) => ({ id, code, room, name: '-', qty: 1, status: 'in', receivedAt: '2026-08-15T08:30:00', ...extra });
const parcels = [p('1', 'PK123'), p('2', 'PK1234'), p('3', 'OTHER', '101/2'), p('4', 'OUT', '090', { status: 'out' })];
const entry = (code, extra = {}) => ({ code, room: '090', damaged: false, damageReason: '', ...extra });
test('full scanner codes distinguish prefix-related parcels and reject trailing input', () => {
  assert.equal(scanResult(parcels, '090', 'PK1234', []).parcel.id, '2');
  assert.ok(scanResult(parcels, '090', 'PK1234X', []).error);
  assert.equal(scanResult(parcels, '090', ' pk123 ', ['1']).repeated, true);
});
test('wrong room and previously checked-out scans cannot join selection', () => {
  assert.ok(scanResult(parcels, '090', 'OTHER', []).error);
  assert.ok(scanResult(parcels, '090', 'OUT', []).error);
});
test('displayed directory name is searchable even when legacy stored name is absent', () => {
  assert.equal(parcelMatches(p('1', 'A'), 'สมชาย'), true);
  assert.equal(parcelMatches(p('1', 'A', '090', { name: null }), 'สมชาย'), true);
  assert.equal(parcelMatches(p('1', 'A'), '不存在😀'), false);
});
test('room lookup resolves one resident room but leaves ambiguous lookup unselected', () => {
  assert.equal(resolveRoom(parcels, 'สมชาย'), '090');
  assert.equal(resolveRoom(parcels, 'OTHER'), '101/2');
  assert.equal(resolveRoom(parcels, 'PK123'), '090');
  assert.equal(resolveRoom([...parcels, p('9', 'PK12345', '101/2')], 'PK'), '');
  assert.equal(resolveRoom(parcels, ''), '');
});
test('invalid room, duplicate and missing damage reason block Check-In without modifying draft', () => {
  const form = entry('PK123', { room: 'ZZ99', damaged: true });
  const before = structuredClone(form);
  const errors = entryErrors(form, parcels);
  assert.ok(errors.code && errors.room && errors.damageReason);
  assert.deepEqual(form, before);
  assert.ok(entryErrors(entry('NEW', { damageReason: '字'.repeat(2001) }), []).damageReason);
});
test('batch validation rejects repeated codes and malformed next entries', () => {
  assert.ok(validateBatch([entry('NEW'), entry('new')], parcels));
  assert.ok(validateBatch([entry('NEW'), entry('SECOND', { damaged: true })], parcels));
  assert.equal(validateBatch([entry('NEW'), entry('SECOND', { damaged: true, damageReason: 'กล่องบุบ 😀 العربية' })], parcels), '');
});
test('retained room alone is not an unfinished parcel but entered tracking or condition is', () => {
  const draft = emptyDraft(); draft.form.room = '090';
  assert.equal(hasCurrentEntry(draft.form), false);
  assert.equal(hasDraft(draft), true);
  draft.form.code = 'NEXT'; assert.equal(hasCurrentEntry(draft.form), true);
});
test('commit revalidates missing, stale, duplicate and mixed-room selections', () => {
  assert.equal(validateCheckOut(parcels, ['1', '2'], '090'), '');
  for (const ids of [['1', '3'], ['4'], ['missing'], ['1', '1'], []]) assert.ok(validateCheckOut(parcels, ids, '090'));
});
test('large room selection validates all records across pagination boundaries', () => {
  const records = Array.from({ length: 1024 }, (_, i) => p(String(i), `CODE-${i}`));
  assert.equal(validateCheckOut(records, records.map((item) => item.id), '090'), '');
});
test('legacy Bangkok wall time and explicit UTC render identically across device timezones', () => {
  assert.equal(parseParcelDate('2026-08-15T08:30:00').toISOString(), '2026-08-15T01:30:00.000Z');
  const previous = process.env.TZ;
  try {
    for (const timezone of ['UTC', 'Asia/Bangkok', 'America/New_York']) {
      process.env.TZ = timezone;
      assert.equal(formatBangkokDate('2026-08-15T01:30:00Z'), '15 ส.ค. 2569 08:30');
      assert.equal(formatBangkokDate('2026-08-15T08:30:00'), '15 ส.ค. 2569 08:30');
    }
  } finally { if (previous === undefined) delete process.env.TZ; else process.env.TZ = previous; }
  assert.equal(formatBangkokDate('broken'), 'ไม่ทราบวันที่');
});
function storage(initial) {
  let raw = initial; let writes = 0;
  return { getItem: () => raw, setItem: (_, value) => { raw = value; writes++; }, get raw() { return raw; }, get writes() { return writes; } };
}
test('empty stored list is retained, not replaced with demo records', () => {
  const store = storage('[]'); const result = loadParcelState(store, parcels);
  assert.deepEqual(result.parcels, []); assert.equal(store.writes, 0);
});
test('malformed data stays untouched and blocks overwrite', () => {
  for (const raw of ['broken JSON', JSON.stringify([p('1', 'A'), p('1', 'B')]), JSON.stringify([p('1', 'A', '090', { name: {} })])]) {
    const store = storage(raw); const result = loadParcelState(store, parcels);
    assert.ok(result.error); assert.equal(store.raw, raw);
    assert.equal(persistParcels(store, parcels, result.raw).ok, false); assert.equal(store.writes, 0);
  }
});
test('blocked storage and quota failure report failure without losing prepared data', () => {
  const store = { getItem: () => null, setItem: () => { throw new Error('quota'); } };
  const before = structuredClone(parcels);
  assert.equal(persistParcels(store, parcels, null).ok, false);
  assert.deepEqual(parcels, before);
  assert.ok(loadParcelState({ getItem: () => { throw new Error('blocked'); } }, parcels).error);
});
test('cross-tab changes block stale write; successful persistence preserves extra fields and notes', () => {
  const initial = JSON.stringify(parcels); const store = storage(initial);
  store.setItem('parcelhub-parcels', '[]');
  assert.equal(persistParcels(store, parcels, initial).ok, false); assert.equal(store.raw, '[]');
  const records = [p('1', 'A', '090', { damaged: true, damageReason: 'กล่องบุบ', custom: 'keep', identityConfirmed: true })];
  const fresh = storage(null); assert.equal(persistParcels(fresh, records, null).ok, true);
  assert.deepEqual(JSON.parse(fresh.raw), records);
});

// Regressions from the Dashboard audit: search scope and mixed date formats.
test('Dashboard searches only pending parcels; checked-out records remain outside results', () => {
  assert.equal(dashboardResults(parcels, 'OUT').length, 0);
  assert.equal(dashboardResults(parcels, '').length, 3);
  assert.equal(dashboardResults(parcels, 'สมชาย').length, 2);
  assert.equal(dashboardResults(parcels, '不存在').length, 0);
});
test('pending damage ranking uses Bangkok wall time regardless of device timezone', () => {
  const records = [p('later', 'LATER', '090', { damaged: true, receivedAt: '2026-08-15T02:00:00Z' }), p('earlier', 'EARLIER', '090', { damaged: true, receivedAt: '2026-08-15T08:30:00' }), p('out', 'OUT', '090', { damaged: true, status: 'out' }), p('normal', 'NORMAL')];
  const before = structuredClone(records), previous = process.env.TZ;
  try {
    for (const timezone of ['UTC', 'Asia/Bangkok', 'America/New_York']) {
      process.env.TZ = timezone;
      assert.deepEqual(pendingDamagedParcels(records).map((item) => item.id), ['earlier', 'later']);
    }
  } finally { if (previous === undefined) delete process.env.TZ; else process.env.TZ = previous; }
  assert.deepEqual(records, before);
});
