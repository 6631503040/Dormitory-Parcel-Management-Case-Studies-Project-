#!/usr/bin/env node
// UAT datasets for Test Plan DPMS-TP-002 section 5.3.1 (sessions S01-S12 and the two pilots).
//
//   node uat-dataset.mjs plan     read-only: pick each session's rooms, write plan.json
//   node uat-dataset.mjs seed     Check-In each Staff session's starting Parcels (P01-P03 in A, Q01 in B)
//   node uat-dataset.mjs status   read-only: Pending Parcels in every planned room
//   node uat-dataset.mjs print    write out/: labels.html, cards.html, google-sheet/*.csv (no network)
//
// Environment: UAT_BASE_URL (default: the Render deployment), UAT_USERNAME, UAT_PASSWORD (a Staff
// account; never commit it). Node 18+ (built-in fetch), no packages.
//
// Every session gets rooms of its own, chosen from directory rooms that have one Resident and no
// Parcels at all, so no session can see another's data and nothing needs resetting between them.
// Tracking Codes carry the session (TP69-S01-P01) so results never mix (Test Plan 5.4).

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const PLAN = join(HERE, "plan.json");
const OUT = join(HERE, "out");
const BASE = (process.env.UAT_BASE_URL || "https://dormitory-parcel-management-case-studies.onrender.com").replace(/\/$/, "");
const API = `${BASE}/api/v1`;

// Session id, participant, group and the short id used inside Tracking Codes.
const SESSIONS = [
  ...["S01", "S02", "S03", "S04", "S05"].map((s, i) => ({ session: s, participant: `U0${i + 1}`, group: "staff", tag: s })),
  ...["S06", "S07", "S08", "S09", "S10"].map((s, i) => ({ session: s, participant: `R0${i + 1}`, group: "resident", tag: s })),
  { session: "S11 (reserve)", participant: "U06 (reserve)", group: "staff", tag: "S11" },
  { session: "S12 (reserve)", participant: "R06 (reserve)", group: "resident", tag: "S12" },
  { session: "PILOT", participant: "PILOT-STAFF", group: "staff", tag: "PS" },
  { session: "PILOT", participant: "PILOT-RESIDENT", group: "resident", tag: "PR" },
];

const code = (tag, id) => `TP69-${tag}-${id}`;

// Codes per session. "g" codes belong to the existing method (Google Forms/Sheets copy) and never
// enter the new system, so the two methods use equivalent but separate data (Test Plan 5.3).
function codesFor(s) {
  const c = (id) => code(s.tag, id);
  if (s.group === "staff") {
    return {
      seedA: [c("P01"), c("P02"), c("P03")], // Pending in room A before the session (UAT03-UAT06)
      seedB: [c("Q01")], // Pending in room B; must stay untouched (UAT05)
      scanIn: [c("N01"), c("N02")], // UAT01 Check-In to B
      damaged: c("D01"), // UAT02 typed by hand, reason "Dented box"
      gA: [c("GP01"), c("GP02"), c("GP03")],
      gB: [c("GQ01")],
      gScanIn: [c("GN01"), c("GN02")],
    };
  }
  return {
    arrive: [c("N01"), c("N02")], // UAT08: the moderator checks both in to C
    pickup: c("N01"), // UAT09: the moderator checks this one out
    afterOff: c("N03"), // UAT10: checked in after unregistering; the phone must stay silent
    gC: [c("GN01"), c("GN02")], // existing method: both checked in, GN01 checked out -> 1 waiting
  };
}

// ---------- API ----------

let cookie = "";
async function api(method, path, body) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { ...(body ? { "Content-Type": "application/json" } : {}), ...(cookie ? { Cookie: cookie } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  return { status: res.status, data, res };
}

async function login() {
  const username = process.env.UAT_USERNAME;
  const password = process.env.UAT_PASSWORD;
  if (!username || !password) die("Set UAT_USERNAME and UAT_PASSWORD (a Staff account on " + BASE + ").");
  const { status, data, res } = await api("POST", "/auth/login", { username, password });
  if (status !== 200) die(`Login failed: ${status} ${data?.code ?? ""}`);
  cookie = res.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
  console.log(`Signed in to ${BASE} as ${data.staff?.fullName ?? username}.`);
}

async function allPages(path) {
  const items = [];
  for (let page = 1; ; page++) {
    const sep = path.includes("?") ? "&" : "?";
    const { status, data } = await api("GET", `${path}${sep}page=${page}&pageSize=100`);
    if (status !== 200) die(`GET ${path} failed: ${status} ${data?.code ?? ""}`);
    items.push(...data.items);
    if (items.length >= data.total || data.items.length === 0) return items;
  }
}

// ---------- commands ----------

async function plan() {
  await login();
  const residents = await allPages("/directory");
  const parcels = await allPages("/parcels");
  const used = new Set(parcels.filter((p) => p.room).map((p) => p.room.id));
  const rooms = new Map();
  for (const r of residents) {
    const room = rooms.get(r.roomId) ?? { roomId: r.roomId, buildingCode: r.buildingCode, roomNumber: r.roomNumber, residents: [] };
    room.residents.push({ id: r.residentId, fullName: r.fullName, nickname: r.nickname });
    rooms.set(r.roomId, room);
  }
  // One Resident per room keeps "Room Number + name" unambiguous for UAT03. Highest buildings first,
  // away from the rooms used in demos.
  const free = [...rooms.values()]
    .filter((r) => r.residents.length === 1 && !used.has(r.roomId))
    .sort((a, b) => Number(b.buildingCode) - Number(a.buildingCode) || a.roomNumber.localeCompare(b.roomNumber));
  const need = SESSIONS.reduce((n, s) => n + (s.group === "staff" ? 2 : 1), 0);
  if (free.length < need) die(`Only ${free.length} free single-Resident rooms; ${need} needed.`);

  const room = (r) => ({ ...r, label: `${r.buildingCode}${r.roomNumber}` });
  let i = 0;
  const sessions = SESSIONS.map((s) =>
    s.group === "staff"
      ? { ...s, roomA: room(free[i++]), roomB: room(free[i++]), codes: codesFor(s) }
      : { ...s, roomC: room(free[i++]), codes: codesFor(s) },
  );
  writeFileSync(PLAN, JSON.stringify({ baseUrl: BASE, createdAt: new Date().toISOString(), sessions }, null, 2) + "\n");
  console.log(`Wrote ${PLAN}`);
  printTable(sessions);
}

async function seed() {
  const { sessions } = readPlan();
  await login();
  const pending = await allPages("/parcels?status=pending");
  let created = 0;
  let skipped = 0;
  for (const s of sessions.filter((x) => x.group === "staff")) {
    for (const [room, list] of [[s.roomA, s.codes.seedA], [s.roomB, s.codes.seedB]]) {
      const foreign = pending.filter((p) => p.room?.id === room.roomId && !list.includes(p.trackingCode));
      if (foreign.length) die(`${s.session}: room ${room.label} already has other Pending Parcels (${foreign.map((p) => p.trackingCode).join(", ")}). Re-run "plan".`);
      for (const trackingCode of list) {
        const { status, data } = await api("POST", "/parcels", { trackingCode, roomId: room.roomId });
        if (status === 201) created++;
        else if (status === 409 && data?.code === "DUPLICATE_TRACKING_CODE") skipped++;
        else die(`${s.session}: Check-In ${trackingCode} -> ${status} ${data?.code ?? ""}`);
      }
    }
  }
  console.log(`Checked in ${created} Parcels (${skipped} already there).`);
  await status(false);
}

async function status(signIn = true) {
  const { sessions } = readPlan();
  if (signIn) await login();
  const pending = await allPages("/parcels?status=pending");
  const inRoom = (room) => pending.filter((p) => p.room?.id === room.roomId).map((p) => p.trackingCode).sort();
  const rows = [];
  for (const s of sessions) {
    const rooms = s.group === "staff" ? [["A", s.roomA, s.codes.seedA], ["B", s.roomB, s.codes.seedB]] : [["C", s.roomC, []]];
    for (const [name, room, expected] of rooms) {
      const now = inRoom(room);
      const ready = now.length === expected.length && expected.every((c) => now.includes(c));
      rows.push({ session: s.session, who: s.participant, room: `${name} ${room.label}`, pending: now.join(" ") || "-", ready: ready ? "ready" : "NOT READY" });
    }
  }
  console.table(rows);
}

// ---------- printables ----------

function print() {
  const { sessions, baseUrl } = readPlan();
  mkdirSync(join(OUT, "google-sheet"), { recursive: true });
  writeFileSync(join(OUT, "labels.html"), labelsPage(sessions));
  writeFileSync(join(OUT, "cards.html"), cardsPage(sessions, baseUrl));
  for (const s of sessions) {
    const { checkIn, checkOut } = sheetRows(s);
    writeFileSync(join(OUT, "google-sheet", `${s.tag}-check-in.csv`), csv(["ประทับเวลา", "เลขห้อง", "เลขพัสดุ"], checkIn));
    writeFileSync(join(OUT, "google-sheet", `${s.tag}-check-out.csv`), csv(["ประทับเวลา", "เลขห้อง", "เลขพัสดุ"], checkOut));
  }
  console.log(`Wrote ${OUT}: labels.html, cards.html, google-sheet/ (${sessions.length * 2} CSV files)`);
}

// Existing-method rows: the same starting state as the new system, with "G" codes.
function sheetRows(s) {
  const d = new Date();
  const t = (h, m) => `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()} ${h}:${String(m).padStart(2, "0")}:00`;
  if (s.group === "staff") {
    return {
      checkIn: [...s.codes.gA.map((c, i) => [t(9, 10 + i), s.roomA.label, c]), ...s.codes.gB.map((c) => [t(9, 20), s.roomB.label, c])],
      checkOut: [],
    };
  }
  return {
    checkIn: s.codes.gC.map((c, i) => [t(9, 10 + i), s.roomC.label, c]),
    checkOut: [[t(10, 0), s.roomC.label, s.codes.gC[0]]],
  };
}

function csv(header, rows) {
  const cell = (v) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  return "﻿" + [header, ...rows].map((r) => r.map(cell).join(",")).join("\r\n") + "\r\n";
}

const esc = (s) => String(s).replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[ch]);

const PAGE_STYLE = `
  body { font-family: "Sarabun", "Leelawadee UI", Tahoma, sans-serif; margin: 12mm; color: #111; background: #fff; }
  h1 { font-size: 18pt; margin: 0 0 4mm; } h2 { font-size: 14pt; margin: 6mm 0 2mm; }
  .note { font-size: 10pt; color: #444; margin-bottom: 4mm; }
  @media print { .note { display: none; } section { break-inside: avoid; } .page { break-after: page; } }
`;

function labelsPage(sessions) {
  const label = (codeText, caption, damaged = false) => `
    <div class="label${damaged ? " damaged" : ""}">
      <div class="cap">${esc(caption)}</div>
      ${damaged ? `<div class="bars-damaged">ฉลากชำรุด สแกนไม่ได้</div>` : code128Svg(codeText)}
      <div class="code">${esc(codeText)}</div>
    </div>`;
  // Only the codes someone scans during a task. Q01, GP02-GP03 and GQ01 are never scanned; the
  // Resident's existing-method task is a lookup in the Sheet, so it needs no labels either.
  const blocks = sessions.map((s) => {
    const c = s.codes;
    const items =
      s.group === "staff"
        ? [
            ...c.scanIn.map((x) => [x, `${s.tag} · UAT01 สแกนรับเข้า ห้อง B`]),
            [c.damaged, `${s.tag} · UAT02 ฉลากชำรุด (พิมพ์เลขเอง)`, true],
            ...c.seedA.map((x, i) => [x, `${s.tag} · ${i === 0 ? "UAT04" : "UAT05"} สแกนนำออก ห้อง A`]),
            ...c.gScanIn.map((x) => [x, `${s.tag} · วิธีเดิม · รับเข้า ห้อง B`]),
            [c.gA[0], `${s.tag} · วิธีเดิม · นำออก ห้อง A`],
          ]
        : [
            ...c.arrive.map((x) => [x, `${s.tag} · UAT08 รับเข้า ห้อง C`]),
            [c.afterOff, `${s.tag} · UAT10 รับเข้า ห้อง C`],
          ];
    return `<section class="page"><h2>${esc(s.session)} · ${esc(s.participant)}</h2><div class="grid">${items.map((it) => label(...it)).join("")}</div></section>`;
  });
  return `<!doctype html><html lang="th"><head><meta charset="utf-8"><title>UAT labels</title><style>${PAGE_STYLE}
  .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 4mm; }
  .label { border: 1px dashed #888; padding: 3mm; text-align: center; }
  .cap { font-size: 8pt; color: #333; margin-bottom: 1mm; }
  .code { font: 11pt monospace; letter-spacing: .5px; margin-top: 1mm; }
  .label svg { width: 100%; height: 16mm; }
  .bars-damaged { height: 16mm; display: flex; align-items: center; justify-content: center; font-size: 9pt;
    background: repeating-linear-gradient(45deg, #bbb 0 3px, #fff 3px 7px); }
  </style></head><body>
  <h1>ฉลากพัสดุสำหรับ UAT</h1>
  <p class="note">พิมพ์ขนาดจริง (100%) แล้วตัดตามเส้นประ ติดบนกล่องจำลอง มีเฉพาะฉลากที่ต้องสแกนใน task ส่วน "วิธีเดิม" ใช้กับ Google Forms/Sheets เท่านั้น
  ทดสอบสแกนอย่างน้อย 1 ใบก่อนวันจริง</p>
  ${blocks.join("\n")}</body></html>`;
}

function cardsPage(sessions, baseUrl) {
  const who = (room) => room.residents.map((r) => r.fullName + (r.nickname ? ` (${r.nickname})` : "")).join(", ");
  const cards = sessions.map((s) => {
    const c = s.codes;
    if (s.group === "staff") {
      return `<section class="page"><h2>${esc(s.session)} · ${esc(s.participant)} · Staff</h2>
      <table><tr><th>ห้อง A</th><td>${esc(s.roomA.label)} · ${esc(who(s.roomA))}</td></tr>
      <tr><th>ห้อง B</th><td>${esc(s.roomB.label)} · ${esc(who(s.roomB))}</td></tr></table>
      <h3>ก่อนเริ่ม</h3><ul>
        <li>รัน <code>node uat-dataset.mjs status</code> แถวของ session นี้ต้องขึ้น <b>ready</b> (A = P01-P03, B = Q01)</li>
        <li>Google Sheet สำเนา: นำเข้า <code>google-sheet/${esc(s.tag)}-check-in.csv</code></li>
        <li>เตรียมกล่อง: ${esc(c.seedA.join(", "))} บนชั้น (${esc(c.seedB[0])} อยู่ในระบบแล้ว ไม่ต้องมีกล่อง) ·${esc(c.scanIn.join(", "))} และฉลากชำรุด ${esc(c.damaged)} แยกไว้</li></ul>
      <h3>วิธีเดิม (Google Forms/Sheets)</h3><table>
        <tr><th>Check-In 2 ชิ้น</th><td>${esc(c.gScanIn.join(", "))} เข้าห้อง B ${esc(s.roomB.label)}</td></tr>
        <tr><th>ดูจำนวน Pending</th><td>ห้อง A ${esc(s.roomA.label)} · คำตอบที่ถูก: <b>3 ชิ้น</b> (${esc(c.gA.join(", "))})</td></tr>
        <tr><th>Check-Out 1 ชิ้น</th><td>${esc(c.gA[0])} จากห้อง A</td></tr></table>
      <h3>ระบบใหม่</h3><table>
        <tr><th>UAT01</th><td>สแกน ${esc(c.scanIn.join(", "))} เข้าห้อง B ${esc(s.roomB.label)} · ต้องได้ 2 รายการ ไม่ซ้ำ</td></tr>
        <tr><th>UAT02</th><td>ฉลากชำรุด เลขที่ยืนยันแล้วคือ <b>${esc(c.damaged)}</b> · ห้อง B · เหตุผล "กล่องบุบ"</td></tr>
        <tr><th>UAT03</th><td>บอกผู้ทดสอบ: ห้อง ${esc(s.roomA.label)} ชื่อ ${esc(who(s.roomA))} · คำตอบ: <b>3 ชิ้น</b> ${esc(c.seedA.join(", "))}</td></tr>
        <tr><th>UAT04</th><td>Check-Out เฉพาะ ${esc(c.seedA[0])} · ${esc(c.seedA[1])} และ ${esc(c.seedA[2])} ต้องยัง Pending</td></tr>
        <tr><th>UAT05</th><td>เลือก ${esc(c.seedA[1])}, ${esc(c.seedA[2])} → ย้อนกลับ 1 ครั้ง → Check-Out · ${esc(c.seedB[0])} ในห้อง B ต้องยัง Pending</td></tr>
        <tr><th>UAT06</th><td>หา ${esc(c.seedA[0])} และ ${esc(c.damaged)} ในประวัติ · ตรวจเวลา สถานะ และเหตุผล "กล่องบุบ"</td></tr></table></section>`;
    }
    return `<section class="page"><h2>${esc(s.session)} · ${esc(s.participant)} · ผู้พัก</h2>
      <table><tr><th>ห้อง C</th><td>${esc(s.roomC.label)} · ผู้พักในทะเบียน: ${esc(who(s.roomC))} (ผู้ทดสอบใช้เลขห้องนี้ ไม่ต้องเป็นคนนี้)</td></tr>
      <tr><th>หน้าเว็บผู้พัก</th><td>${esc(baseUrl)}/resident/</td></tr></table>
      <h3>ก่อนเริ่ม</h3><ul>
        <li><code>node uat-dataset.mjs status</code> แถวห้อง C ต้องขึ้น <b>ready</b> (ไม่มีพัสดุ)</li>
        <li>Google Sheet สำเนา: นำเข้า <code>google-sheet/${esc(s.tag)}-check-in.csv</code> และ <code>-check-out.csv</code></li></ul>
      <h3>วิธีเดิม</h3><table><tr><th>ถามที่เคาน์เตอร์</th><td>ผู้ทดสอบถามว่าห้อง ${esc(s.roomC.label)} มีพัสดุรอกี่ชิ้น · moderator ค้นใน Sheet · คำตอบ: <b>1 ชิ้น</b> (${esc(c.gC[1])})</td></tr></table>
      <h3>ระบบใหม่</h3><table>
        <tr><th>UAT07</th><td>ผู้ทดสอบลงทะเบียนห้อง ${esc(s.roomC.label)} · moderator เปิดไอคอนกระดิ่ง เลือกห้องนี้ แล้วอ่านรหัสให้</td></tr>
        <tr><th>UAT08</th><td>moderator Check-In ${esc(c.arrive.join(" และ "))} เข้าห้อง ${esc(s.roomC.label)} · จดเวลาที่กดบันทึก</td></tr>
        <tr><th>UAT09</th><td>moderator Check-Out ${esc(c.pickup)} · คำตอบ: <b>เหลือ 1 ชิ้น</b></td></tr>
        <tr><th>UAT10</th><td>ผู้ทดสอบกด "ยกเลิกการลงทะเบียนอุปกรณ์นี้" · moderator Check-In ${esc(c.afterOff)} เข้าห้องนี้ มือถือต้องไม่ได้รับแจ้งเตือน</td></tr></table>
      <h3>หลังจบ</h3><ul><li>ตรวจว่ามือถือถูกยกเลิกการลงทะเบียนแล้ว ถ้ายังไม่ได้ยกเลิก ให้เปิดไอคอนกระดิ่งแล้วเพิกถอนอุปกรณ์ของห้องนี้</li></ul></section>`;
  });
  return `<!doctype html><html lang="th"><head><meta charset="utf-8"><title>UAT moderator cards</title><style>${PAGE_STYLE}
  h3 { font-size: 11pt; margin: 4mm 0 1mm; } table { border-collapse: collapse; width: 100%; font-size: 10pt; }
  th, td { border: 1px solid #999; padding: 1.5mm 2mm; text-align: left; vertical-align: top; } th { width: 28mm; background: #f2f2f2; }
  ul { font-size: 10pt; margin: 0; padding-left: 5mm; } code { font-size: 9pt; }
  </style></head><body><h1>การ์ด moderator · UAT</h1>
  <p class="note">พิมพ์ 1 หน้าต่อ session · ข้อมูลทั้งหมดเป็นข้อมูลจำลอง</p>${cards.join("\n")}</body></html>`;
}

// ---------- Code 128 (set B) ----------

// Bar/space widths for values 0-105 and the stop symbol (106), from the Code 128 specification.
const C128 = (
  "212222 222122 222221 121223 121322 131222 122213 122312 132212 221213 221312 231212 112232 122132 122231 113222 123122 123221 223211 221132 " +
  "221231 213212 223112 312131 311222 321122 321221 312212 322112 322211 212123 212321 232121 111323 131123 131321 112313 132113 132311 211313 " +
  "231113 231311 112133 112331 132131 113123 113321 133121 313121 211331 231131 213113 213311 213131 311123 311321 331121 312113 312311 332111 " +
  "314111 221411 431111 111224 111422 121124 121421 141122 141221 112214 112412 122114 122411 142112 142211 241211 221114 413111 241112 134111 " +
  "111242 121142 121241 114212 124112 124211 411212 421112 421211 212141 214121 412121 111143 111341 131141 114113 114311 411113 411311 113141 " +
  "114131 311141 411131 211412 211214 211232 2331112"
).split(" ");

export function code128Values(text) {
  const values = [104]; // Start B
  for (const ch of text) {
    const v = ch.charCodeAt(0) - 32;
    if (v < 0 || v > 94) throw new Error(`Code 128 B cannot encode ${JSON.stringify(ch)}`);
    values.push(v);
  }
  values.push(values.reduce((sum, v, i) => sum + v * (i || 1), 0) % 103, 106);
  return values;
}

function code128Svg(text) {
  const widths = code128Values(text).map((v) => C128[v]).join("");
  const quiet = 10;
  let x = quiet;
  let rects = "";
  [...widths].forEach((w, i) => {
    if (i % 2 === 0) rects += `<rect x="${x}" y="0" width="${w}" height="50"/>`;
    x += Number(w);
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${x + quiet} 50" preserveAspectRatio="none" shape-rendering="crispEdges" role="img" aria-label="${esc(text)}">${rects}</svg>`;
}

// ---------- helpers ----------

function readPlan() {
  try {
    return JSON.parse(readFileSync(PLAN, "utf8"));
  } catch {
    die(`No ${PLAN}. Run "node uat-dataset.mjs plan" first.`);
  }
}

function printTable(sessions) {
  console.table(
    sessions.map((s) => ({
      session: s.session,
      who: s.participant,
      rooms: s.group === "staff" ? `A ${s.roomA.label} · B ${s.roomB.label}` : `C ${s.roomC.label}`,
    })),
  );
}

function die(msg) {
  console.error(msg);
  process.exit(1);
}

const commands = { plan, seed, status, print };
const cmd = process.argv[2];
if (fileURLToPath(import.meta.url) === process.argv[1]) {
  if (!commands[cmd]) die("Usage: node uat-dataset.mjs plan|seed|status|print");
  await commands[cmd]();
}
