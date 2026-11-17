// Builds docs/03-test/Test-Result-Report.docx (DPMS-TR-001). cases.json = TC01-TC64 from Test Plan v1.7 with Round 1 results.
// Run: npm install --no-save docx && node docs/03-test/tools/test-result-report/build.js  (add a round: extend results + columns)
const fs = require('fs');
const path = require('path');
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, ShadingType, AlignmentType,
  HeadingLevel, PageOrientation, Footer, PageNumber, BorderStyle, VerticalAlign,
} = require('docx');

const REPO = path.resolve(__dirname, '../../../..');
const tcs = JSON.parse(fs.readFileSync(path.join(__dirname, 'cases.json'), 'utf8'));
const uat = JSON.parse(fs.readFileSync(path.join(__dirname, 'uat.json'), 'utf8'));
const r2 = JSON.parse(fs.readFileSync(path.join(REPO, 'docs/03-test/results/20261116/results.json'), 'utf8'));
const r3 = JSON.parse(fs.readFileSync(path.join(REPO, 'docs/03-test/results/20261118-retest/results.json'), 'utf8'));

const FONT = 'Calibri';
const SZ = 17; // 8.5 pt in tables
const GREY = 'F1F0EB';
const STATUS_FILL = { Pass: 'D9EAD3', Fail: 'F4CCCC', Blocked: 'FFF2CC' };
const border = { style: BorderStyle.SINGLE, size: 4, color: 'D9D9D9' };
const borders = { top: border, bottom: border, left: border, right: border };

// No em dashes in the document (requested 2026-11-17): every run goes through dash().
const dash = (v) => String(v).replace(/\u2014/g, '-');
const t = (text, o = {}) => new TextRun({ text: dash(text), font: FONT, size: o.size || SZ, bold: o.bold, italics: o.italics, color: o.color });
const p = (runs, o = {}) => new Paragraph({ children: Array.isArray(runs) ? runs : [t(runs, o)], spacing: { before: o.before ?? 40, after: o.after ?? 40 }, alignment: o.align });
const body = (text, o = {}) => p([t(text, { size: 21, ...o })], { before: 60, after: 100, ...o });
const lines = (arr, o = {}) => arr.filter((x) => x !== undefined && x !== null && x !== '').map((x) => p(typeof x === 'string' ? [t(x, o)] : x, { before: 20, after: 20 }));

function cell(content, width, o = {}) {
  const children = Array.isArray(content) ? content : lines([content], o);
  return new TableCell({
    children: children.length ? children : [p('')],
    width: { size: width, type: WidthType.DXA },
    borders,
    shading: o.fill ? { type: ShadingType.CLEAR, color: 'auto', fill: o.fill } : undefined,
    verticalAlign: o.valign || VerticalAlign.TOP,
    margins: { top: 50, bottom: 50, left: 80, right: 80 },
  });
}
function table(widths, header, rows) {
  const total = widths.reduce((a, b) => a + b, 0);
  return new Table({
    width: { size: total, type: WidthType.DXA },
    columnWidths: widths,
    rows: [
      new TableRow({ tableHeader: true, cantSplit: true, children: header.map((h, i) => cell(lines([h], { bold: true }), widths[i], { fill: GREY })) }),
      ...rows.map((r) => new TableRow({ cantSplit: false, children: r.map((c, i) => (c instanceof TableCell ? c : cell(c, widths[i]))) })),
    ],
  });
}
const H1 = (text) => new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: dash(text), font: FONT })] });
const H2 = (text) => new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun({ text: dash(text), font: FONT })] });

// ---------------------------------------------------------------- data
const DEFECT_ALIAS = { TC25: 'DF-01 = DEF-001', TC35: 'DF-02 = DEF-002 (Critical)', TC43: 'DF-03 = DEF-003' };
const rows = tcs.map((c) => {
  const two = r2[c.id];
  const three = r3[c.id];
  const final = three ? three.status : two ? two.status : c.r1_status;
  return { ...c, r2: two, r3: three, final };
});
const count = (key) => rows.reduce((m, r) => ((m[r[key]] = (m[r[key]] || 0) + 1), m), {});
const c1 = count('r1_status');
const cf = count('final');


// ---------------------------------------------------------------- UAT
const fmt = (v, d = 1) => (v === null || v === undefined ? 'N/A' : Number(v).toFixed(d));
const UW = [2900, 1200, 1500, 1500, 1700, 1400, 1300, 1100, 2222];
const uatTasks = table(UW, ['Task', 'Done', 'Before s (existing)', 'After s (new)', 'Paired diff s (SD)', 'Time change', 'Unassisted', 'Errors', 'Defects'],
  Object.entries(uat.tasks).map(([id, v]) => [
    cell(lines([[t(id + ' ', { bold: true }), t(v.name.replace(/^UAT\d\d /, ''))]]), UW[0]),
    `${v.completed}/${v.n}`,
    v.old ? `${fmt(v.old.mean)} (SD ${fmt(v.old.sd)})` : 'N/A — no equivalent step',
    `${fmt(v.new.mean)} (SD ${fmt(v.new.sd)})${v.new.n < v.n ? `, n=${v.new.n}` : ''}`,
    v.paired_diff ? `${v.paired_diff.mean > 0 ? '+' : ''}${fmt(v.paired_diff.mean)} (${fmt(v.paired_diff.sd)}), n=${v.paired_n}` : 'N/A',
    v.pct_change_mean === null ? 'N/A' : `${fmt(Math.abs(v.pct_change_mean))} % ${v.pct_change_mean >= 0 ? 'faster' : 'slower'}`,
    `${v.unassisted}/${v.n}`,
    String(v.errors),
    v.defects.join(', ') || '—',
  ]));
const g = uat.groups;
const SW = [2400, 4300, 1700, 1500, 1500, 1500, 1922];
const susRow = (name, k, label) => {
  const x = g[name][k];
  return [name, label, `${fmt(x.SUS.mean)} (SD ${fmt(x.SUS.sd)})`, `${fmt(x.SUS.min)}–${fmt(x.SUS.max)}`, fmt(x.PU, 2), fmt(x.PEOU, 2), fmt(x.BI, 2)];
};
const uatSus = table(SW, ['Group (n = 5)', 'Rule', 'SUS mean', 'SUS range', 'TAM PU', 'TAM PEOU', 'TAM BI'], [
  susRow('Staff', 'sensitivity_first', 'PRIMARY: first response after the session'),
  susRow('Staff', 'primary_latest', 'Sensitivity: latest response per participant'),
  ['Staff', 'As first reported (8 rows, U01/U02/U04 counted twice) — superseded', `${fmt(g.Staff.raw_SUS_mean)}`, '', '', '', ''],
  susRow('Resident', 'primary_latest', 'One response each (no duplicates)'),
]);
const uatDefects = table([1500, 1300, 7200, 1600, 3222], ['Defect', 'Task / participant', 'Observation', 'Severity', 'Status (17 Nov)'], [
  ['UAT-D01', 'UAT01 / U01', 'Clicking outside the Check-In dialog closes it and loses the typed code', 'Medium', 'Open — reproduced 16 Nov'],
  ['UAT-D02', 'UAT02 / U01', 'The "พัสดุมีปัญหา" (problem Parcel) checkbox is hard to see', 'Low', 'Open — not retested'],
  ['UAT-D03', 'UAT04–05 / U01, U02', 'Check-Out had no Room Number search', 'Medium', 'Fixed – verified 16 Nov'],
  ['UAT-D04', 'UAT01 / U02', 'A Room Number typed into the Tracking Code field is accepted as a code', 'Low', 'Needs decision'],
  ['UAT-D05', 'UAT06 / U02', 'A problem Parcel without a room was shown as "ไม่มีปัญหา" instead of "ชำรุด"', 'Medium', 'Fixed – verified 16 Nov'],
  ['UAT-D06', 'UAT06 / U03', 'Suggestion: larger button text', 'Low', 'Open — backlog candidate'],
]);

// ---------------------------------------------------------------- sections
const W = 14822; // A4 landscape 16838 - 2 x 1008 margins
const meta = table([3200, W - 3200], ['Item', 'Details'], [
  ['Document ID', 'DPMS-TR-001'],
  ['Version', '1.1 — 18 November 2026 (B.E. 2569): Round 3 retest added'],
  ['Project', 'Dormitory Parcel Management System — Parcel Desk'],
  ['Test Plan', 'DPMS-TP-002 v1.8 (docs/Test-Plan.docx). The plan defines the cases; this report records what happened when they were run.'],
  ['Prepared by', 'JOBAS Company — Software Tester'],
  ['Related records', 'Defect log docs/03-test/defects.md · Test Summary Report docs/03-test/results/20261116/TEST-SUMMARY.md · raw results results/20261028/results.json, results/20261116/results.json'],
]);

const rounds = table([1500, 2000, 3600, 4800, 2922], ['Round', 'Date', 'Build', 'Environment', 'Scope'], [
  ['Round 1', '28 Oct 2026', '4782b57', 'Isolated test stack (:5174 / :8081), synthetic data; headless Chrome 156, Edge 156; load database 31,024 Parcels', 'All 64 cases'],
  ['Round 2', '16 Nov 2026', '9344cff (branch Fix-UI 67b599b: identical backend, database and client source)', 'Isolated PostgreSQL 16 on tmpfs (:15432), API + client (:18080), seed data; Playwright Chromium / Firefox / Pixel 7', 'Re-run of the 12 Fail/Blocked cases; the 52 Pass cases covered by automated regression (Section 4)'],
  ['Round 3', '18 Nov 2026', '8cd36d9 (main after PR #63, defect fixes)', 'Isolated PostgreSQL 16 on tmpfs (:15432), API + client (:18080) with Web Push keys; Playwright Chromium / Firefox / Pixel 7', 'Tester retest of TC25, TC35, TC43 and the fixed defects; full automated regression (Section 4)'],
  ['Real devices', 'Reported by tester', 'To be recorded', 'Physical scanner, Android phone, iPhone (Safari / PWA)', 'TC07–TC09, TC46, TC52, TC55 — see Section 3; not yet counted'],
]);

const summary = table([3800, 2000, 2000, 2000, 5022], ['', 'Pass', 'Fail', 'Blocked', 'Note'], [
  ['Round 1 (28 Oct)', String(c1.Pass || 0), String(c1.Fail || 0), String(c1.Blocked || 0), 'Of 64 cases'],
  ['After Round 2 (16 Nov)', '52', '3', '9', 'No Fail was fixed between rounds 1 and 2.'],
  ['Current status after Round 3 (18 Nov)', String(cf.Pass || 0), String(cf.Fail || 0), String(cf.Blocked || 0), 'TC25, TC35 and TC43 now pass. Blocked is not a pass (Test Plan section 6).'],
]);

// case table
const CW = [850, 2100, 2900, 3500, 2500, 800, 2172];
function statusCell(s, w) { return cell(lines([s], { bold: true }), w, { fill: STATUS_FILL[s], valign: VerticalAlign.CENTER }); }
const groups = [...new Set(rows.map((r) => r.group))].sort((a, b) => {
  const n = (s) => s.split(' ')[0].split('.').map(Number);
  const [x, y] = [n(a), n(b)];
  return x[2] - y[2];
});
const caseSections = [];
for (const g of groups) {
  caseSections.push(H2(g.replace(/^5\.4\.(\d+)/, '3.$1')));
  caseSections.push(table(CW, ['ID', 'Case', 'Expected outcome (from Test Plan)', 'Round 1 — actual result (28 Oct)', 'Rounds 2–3 — actual result (16 / 18 Nov)', 'Status now', 'Evidence / defect'],
    rows.filter((r) => r.group === g).map((r) => [
      cell(lines([r.id, r.feature, r.level, r.priority]), CW[0]),
      cell(lines([[t(r.title, { bold: true })], r.procedure]), CW[1]),
      r.expected,
      cell(lines([[t(r.r1_status + ': ', { bold: true }), t(r.r1_actual)]]), CW[3]),
      r.r2 ? cell(lines([[t('R2 ' + r.r2.status + ': ', { bold: true }), t(r.r2.actual)], r.r3 ? [t('R3 ' + r.r3.status + ': ', { bold: true }), t(r.r3.actual)] : '']), CW[4])
           : cell(lines(['Not re-run individually. Covered by automated regression on 9344cff (Section 4).'], { italics: true, color: '666666' }), CW[4]),
      statusCell(r.final, CW[5]),
      cell(lines([DEFECT_ALIAS[r.id], r.r3 ? 'R3: ' + r.r3.evidence : '', r.r2 ? r.r2.evidence : '', r.r1_evidence.replace(/\s*Run 28 Oct 2026, build 4782b57, isolated test database\.?/, '').trim()]), CW[6]),
    ])));
}

const pendingDevices = table([1000, 4200, 6200, 3422], ['Case', 'What must be recorded', 'Tester report', 'Status in this report'], [
  ['TC07', 'Scanner model; 10 labels N01–N10: matched / missing / duplicated', 'Tester reports the physical scanner worked well', 'Blocked until recorded'],
  ['TC08', 'Focus after scan; saved to the chosen room', 'Same as TC07', 'Blocked until recorded'],
  ['TC09', 'Disconnect / reconnect; deteriorated label typed manually', 'Same as TC07', 'Blocked until recorded'],
  ['TC46', 'Resident side after a network cut: no duplicate or stale record', 'Tester reports Web Push on a real phone worked well', 'Blocked until recorded'],
  ['TC52', 'Seconds from Check-In to notification on Android and iPhone (target ≤ 90 s); wording', 'Same as TC46; Safari / iPhone tested', 'Blocked until recorded'],
  ['TC55', 'Phone offline then back online shows the latest state', 'Same as TC46', 'Blocked until recorded'],
]);

const auto = table([3800, 2600, 8422], ['Suite', 'Result', 'Source'], [
  ['Round 3 (8cd36d9, 18 Nov): Go unit + integration, -race', '57 / 57 pass, 0 skipped', 'results/20261118-retest/logs/go-test-summary.txt'],
  ['Round 3: Vitest (client)', '161 / 161 pass', 'results/20261118-retest/README.md'],
  ['Round 3: Playwright (Chromium, Firefox, Pixel 7)', '14 / 14 pass; TC25 / TC35 / TC43 regression tests pass', 'results/20261118-retest/logs/playwright.json'],
  ['Round 3: govulncheck', '0 vulnerabilities called', 'results/20261118-retest/README.md'],
  ['Round 2 (9344cff, 16 Nov): Go unit + integration (real PostgreSQL)', '54 / 54 pass, 0 skipped', 'results/20261116/logs/go-test.jsonl'],
  ['RBAC matrix (23 routes × 5 caller types)', 'Pass', 'backend/internal/api/rbac_matrix_test.go'],
  ['Vitest (client)', '159 / 159 pass', 'results/20261116/logs/vitest.log'],
  ['Playwright E2E (Chromium, Firefox, Pixel 7)', '11 pass; 3 reproduce open defects TC25 / TC35 / TC43', 'results/20261116/logs/playwright.json'],
  ['Accessibility (axe-core, WCAG 2.1 A/AA)', '0 violations on 4 screens', 'docs/02-design/prototype/e2e/a11y.spec.js'],
  ['Spike load 5 → 50 → 5 sessions', '0 errors; p95 341 ms at 50 sessions', 'results/20261116/logs/load-spike.json'],
  ['Soak 10 sessions × 30 min (17 Nov)', '515,928 requests, 0 errors, no lost or duplicated Parcels', 'results/20261116/logs/load-soak.json'],
  ['Coverage', 'Go internal/ 79.2 %; client statements 72.0 %', 'results/20261116/logs/go-cover.txt, vitest-coverage/'],
]);

const defects = table([1700, 6600, 2200, 4322], ['Defect', 'Summary', 'Severity', 'Status (18 Nov)'], [
  ['DEF-002 (DF-02)', 'Check-Out accepts Tracking Codes from different rooms in one request (TC35)', 'Critical', 'Fixed – verified 18 Nov (8cd36d9)'],
  ['QA-08', 'Resident OTP issued before move-out can still register a device', 'Critical', 'Fixed – verified 18 Nov (8cd36d9)'],
  ['DEF-004', 'GO-2026-6859 net/http advisory reachable from the app (fix: Go 1.26.11)', 'Medium', 'Fixed – verified 18 Nov (8cd36d9)'],
  ['DEF-003 (DF-03)', 'Server outage shown as the sign-in page without an error (TC43)', 'Medium', 'Fixed – verified 18 Nov (8cd36d9)'],
  ['DEF-001 (DF-01)', 'Problem queue newest first; US-06 requires oldest first (TC25)', 'Low', 'Fixed – verified 18 Nov (8cd36d9)'],
  ['DEF-005', 'TRUNCATE bypasses append-only triggers on audit tables', 'Low', 'Open (reproduced 18 Nov)'],
  ['UAT-D01 … D06', 'Found during UAT — see Section 5.3', '—', '2 fixed, 4 open / to decide'],
  ['QA-01 … QA-07', 'Session revocation, rate limit, input validation, paging, dependencies', '—', 'Fixed – verified'],
]);

const signoff = table([4000, 5400, 5422], ['Role', 'Name', 'Signature / date'], [
  ['Software Tester', '', ''], ['Developer', '', ''], ['Project lead', '', ''],
]);

const doc = new Document({
  creator: 'JOBAS Company',
  title: 'Test Result Report DPMS-TR-001',
  styles: {
    default: { document: { run: { font: FONT, size: 21 } } },
    paragraphStyles: [
      { id: 'Title', name: 'Title', basedOn: 'Normal', run: { font: FONT, size: 40, bold: true }, paragraph: { spacing: { before: 0, after: 120 }, keepNext: true } },
      { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { font: FONT, size: 28, bold: true }, paragraph: { spacing: { before: 280, after: 120 }, keepNext: true, outlineLevel: 0 } },
      { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { font: FONT, size: 23, bold: true }, paragraph: { spacing: { before: 200, after: 80 }, keepNext: true, outlineLevel: 1 } },
    ],
  },
  sections: [{
    properties: { page: { size: { width: 11909, height: 16834, orientation: PageOrientation.LANDSCAPE }, margin: { top: 936, bottom: 936, left: 1008, right: 1008 } } },
    footers: { default: new Footer({ children: [new Paragraph({ children: [t('DPMS-TR-001 | 18 November 2026    Page ', { size: 16 }), new TextRun({ children: [PageNumber.CURRENT], font: FONT, size: 16 })] })] }) },
    children: [
      new Paragraph({ heading: HeadingLevel.TITLE, children: [new TextRun({ text: 'Test Result Report', font: FONT })] }),
      body('Dormitory Parcel Management System — Parcel Desk. Results of executing the Test Plan DPMS-TP-002 test cases TC01–TC64.'),
      meta,
      H1('1 Summary'),
      summary,
      body(`UAT: every task completed by at least 4 of 5 participants without assistance; SUS Staff ${g.Staff.sensitivity_first.SUS.mean} and Resident ${g.Resident.primary_latest.SUS.mean} (target 68); every TAM construct ≥ 4 (Section 5).`),
      body('After the Round 3 retest no Critical or High defect is open: DEF-002 and QA-08 are fixed and verified. The exit criteria are still not fully met because nine cases are Blocked. The nine Blocked cases need physical equipment (scanner, registered phones), a real Thai keyboard, duplicate-delivery simulation or a page not yet built.'),
      H1('2 Execution rounds'),
      rounds,
      body('Status values follow the Test Plan: Pass requires every expected outcome; Fail is a mismatch; Blocked means the case could not yet be executed. Any failing subcase fails the case.'),
      H1('3 Results by test case'),
      body('Expected outcomes are copied from the Test Plan. "Status now" is the latest executed result. Round 2 re-ran only the cases that did not pass in Round 1; Round 3 re-ran the three that failed (TC25, TC35, TC43).'),
      ...caseSections,
      H2('3.12 Real-device runs reported by the tester — to be recorded'),
      body('The tester reports that the physical scanner, Web Push on a real phone and Safari on iPhone were tested and worked. They stay Blocked in this report until the date, build, device and measured values below are recorded with evidence; a result without a record cannot be cited as a source.'),
      pendingDevices,
      H1('4 Automated regression on the Round 2 build'),
      body('These suites are the regression evidence for the 52 cases that passed in Round 1 and were not re-run one by one.'),
      auto,
      H1('5 User acceptance testing (UAT01–UAT10)'),
      body('Five Staff (U01–U05: UAT01–UAT06) and five Residents (R01–R05: UAT07–UAT10) on 2 and 4 November 2026. Staff U01 and U02 used build 7dc4587, U03–U05 and all Residents used 9344cff; the two builds differ in the Check-Out room search and the damaged-status label. Participants appear by ID only; consent and names are kept outside the repository. With n = 5 per group the results are descriptive, not statistical.'),
      H2('5.1 Task results: existing method (before) vs new system (after)'),
      body('Time change follows Test Plan 5.3: (old time − new time) / old time × 100, averaged over participants timed under both methods. A positive value means the new system is faster. "N/A" marks steps that do not exist in the existing method or were not timed.'),
      uatTasks,
      H2('5.2 Satisfaction (SUS) and acceptance (TAM)'),
      body('Targets (Test Plan 6): mean SUS ≥ 68 (Sauro, 2011) and ≥ 4 of 5 on each TAM construct. The Staff sheet held two responses from U01, U02 and U04; the primary value is the first response after each session, as in the team’s UAT results (docs/03-test/results/20261102-uat); the latest response is shown for transparency.'),
      uatSus,
      H2('5.3 Defects and observations from UAT'),
      uatDefects,
      body('Source: Parcel Desk – UAT results (DPMS-TP-002).xlsx (raw, outside the repository) and its cleaned copy of 16 Nov 2026, whose Cleaning log sheet lists every correction (duplicate responses, 0-second times, missing builds).'),
      H1('6 Defects referenced'),
      body('Round 1 used IDs DF-01 to DF-03; the defect log keeps them as DEF-001 to DEF-003. Severity uses the Test Plan definitions (Critical = wrong-room data or data loss).'),
      defects,
      H1('7 Sign-off'),
      signoff,
    ],
  }],
});

Packer.toBuffer(doc).then((buf) => {
  const out = path.join(REPO, 'docs/03-test/Test-Result-Report.docx');
  fs.writeFileSync(out, buf);
  console.log('wrote', out, buf.length, 'bytes; round1', c1, 'now', cf);
});
