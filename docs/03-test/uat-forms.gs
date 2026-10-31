/**
 * Parcel Desk — UAT forms for Test Plan DPMS-TP-002 v1.6 (sections 5.3, 5.3.1, 5.3.2, Appendix A).
 *
 * How to use: paste this file into an Apps Script project (script.google.com), select
 * createAllForms in the toolbar and press Run. Allow the permissions it asks for. It creates, in a
 * new Drive folder "Parcel Desk UAT":
 *   - Staff questionnaire     (SUS + TAM, Thai with the English item beside it)
 *   - Resident questionnaire  (same, TAM wording for Residents)
 *   - Task record             (note-taker, one response per task attempt)
 *   - Consent form            (separate spreadsheet: it holds real names)
 * Links are printed in the Execution log. Run it once; running again creates a new set.
 */

const PARTICIPANTS = {
  staff: ['U01', 'U02', 'U03', 'U04', 'U05', 'U06 (reserve)', 'PILOT-STAFF'],
  resident: ['R01', 'R02', 'R03', 'R04', 'R05', 'R06 (reserve)', 'PILOT-RESIDENT'],
};
const SESSIONS = ['S01', 'S02', 'S03', 'S04', 'S05', 'S06', 'S07', 'S08', 'S09', 'S10',
  'S11 (reserve)', 'S12 (reserve)', 'PILOT'];

const SCALE_LOW = 'ไม่เห็นด้วยอย่างยิ่ง (Strongly disagree)';
const SCALE_HIGH = 'เห็นด้วยอย่างยิ่ง (Strongly agree)';
const SCALE_GUIDE = '1 = ไม่เห็นด้วยอย่างยิ่ง · 2 = ไม่เห็นด้วย · 3 = เฉยๆ · 4 = เห็นด้วย · 5 = เห็นด้วยอย่างยิ่ง';

// System Usability Scale — standard items (Brooke, 1996). Odd items positive, even items negative.
const SUS = [
  ['SUS1', 'ฉันคิดว่าฉันอยากใช้ระบบนี้บ่อยๆ', 'I think that I would like to use this system frequently.'],
  ['SUS2', 'ฉันรู้สึกว่าระบบนี้ซับซ้อนเกินความจำเป็น', 'I found the system unnecessarily complex.'],
  ['SUS3', 'ฉันคิดว่าระบบนี้ใช้งานง่าย', 'I thought the system was easy to use.'],
  ['SUS4', 'ฉันคิดว่าฉันต้องมีผู้ที่มีความรู้ด้านเทคนิคช่วย จึงจะใช้ระบบนี้ได้', 'I think that I would need the support of a technical person to be able to use this system.'],
  ['SUS5', 'ฉันรู้สึกว่าฟังก์ชันต่างๆ ในระบบนี้ทำงานเข้ากันได้ดี', 'I found the various functions in this system were well integrated.'],
  ['SUS6', 'ฉันคิดว่าระบบนี้มีความไม่สอดคล้องกันมากเกินไป', 'I thought there was too much inconsistency in this system.'],
  ['SUS7', 'ฉันคิดว่าคนส่วนใหญ่จะเรียนรู้วิธีใช้ระบบนี้ได้อย่างรวดเร็ว', 'I would imagine that most people would learn to use this system very quickly.'],
  ['SUS8', 'ฉันรู้สึกว่าระบบนี้ใช้งานยุ่งยาก', 'I found the system very cumbersome to use.'],
  ['SUS9', 'ฉันรู้สึกมั่นใจมากเมื่อใช้ระบบนี้', 'I felt very confident using the system.'],
  ['SUS10', 'ฉันต้องเรียนรู้หลายอย่างก่อน จึงจะเริ่มใช้ระบบนี้ได้', 'I needed to learn a lot of things before I could get going with this system.'],
];

// Technology Acceptance Model (Davis, 1989; Venkatesh & Davis, 2000), task wording per group.
function tamItems(group) {
  const staff = group === 'staff';
  const taskTh = staff ? 'งานรับ-ส่งพัสดุที่เคาน์เตอร์' : 'การติดตามพัสดุของฉัน';
  const taskEn = staff ? 'my parcel desk work' : 'keeping track of my parcels';
  const oldTh = staff ? 'Google Forms/Sheets' : 'การเดินไปถามที่เคาน์เตอร์';
  const oldEn = staff ? 'Google Forms/Sheets' : 'asking at the desk';
  return [
    ['PU1', `การใช้ระบบนี้ช่วยให้ฉันทำ${taskTh}ได้เร็วขึ้น`, `Using the system enables me to do ${taskEn} more quickly.`],
    ['PU2', `การใช้ระบบนี้ช่วยให้ฉันทำ${taskTh}ได้ดีขึ้น`, `Using the system improves how well I do ${taskEn}.`],
    ['PU3', `การใช้ระบบนี้ทำให้${taskTh}ง่ายขึ้น`, `Using the system makes ${taskEn} easier.`],
    ['PU4', `ฉันคิดว่าระบบนี้มีประโยชน์ต่อ${taskTh}`, `I find the system useful for ${taskEn}.`],
    ['PEOU1', 'การเรียนรู้วิธีใช้ระบบนี้เป็นเรื่องง่ายสำหรับฉัน', 'Learning to operate the system is easy for me.'],
    ['PEOU2', 'ฉันสั่งให้ระบบทำสิ่งที่ต้องการได้ง่าย', 'I find it easy to get the system to do what I want it to do.'],
    ['PEOU3', 'การใช้งานระบบนี้ชัดเจนและเข้าใจง่าย', 'My interaction with the system is clear and understandable.'],
    ['PEOU4', 'ฉันคิดว่าระบบนี้ใช้งานง่าย', 'I find the system easy to use.'],
    ['BI1', 'หากฉันเข้าถึงระบบนี้ได้ ฉันตั้งใจจะใช้งาน', 'Assuming I have access to the system, I intend to use it.'],
    ['BI2', `ฉันจะเลือกใช้ระบบนี้แทนวิธีเดิม (${oldTh})`, `I would use the system rather than the current method (${oldEn}).`],
    ['BI3', 'ฉันวางแผนจะใช้ระบบนี้เป็นประจำ', 'I plan to use the system regularly.'],
  ];
}

const UAT_TASKS = [
  'UAT01 Scanner Check-In (Staff)',
  'UAT02 Manual fallback and damage (Staff)',
  'UAT03 Pending lookup (Staff)',
  'UAT04 Selective collection (Staff)',
  'UAT05 Full-room collection and cancellation (Staff)',
  'UAT06 Collection evidence (Staff)',
  'UAT07 Resident registration (Resident)',
  'UAT08 Parcel arrival (Resident)',
  'UAT09 Pickup update (Resident)',
  'UAT10 Turn off notifications (Resident)',
  'C-S1 Comparison: Check-In of two records (Staff)',
  'C-S2 Comparison: Pending count lookup (Staff)',
  'C-S3 Comparison: Check-Out of one record (Staff)',
  'C-R1 Comparison: how many Parcels are waiting for room C (Resident)',
];

// ---------------------------------------------------------------------------------------------

function createAllForms() {
  const folder = DriveApp.createFolder('Parcel Desk UAT');
  const results = SpreadsheetApp.create('Parcel Desk – UAT results (DPMS-TP-002)');
  const consentBook = SpreadsheetApp.create('Parcel Desk – UAT consent (restricted: real names)');

  const staff = createQuestionnaire('staff', results);
  const resident = createQuestionnaire('resident', results);
  const tasks = createTaskRecordForm(results);
  const consent = createConsentForm(consentBook);

  addScoreSheet(results, staff, 'Staff');
  addScoreSheet(results, resident, 'Resident');
  nameResponseSheet(results, tasks, 'Task records');
  nameResponseSheet(consentBook, consent, 'Consent');
  removeBlankDefaultSheets(results);
  removeBlankDefaultSheets(consentBook);

  [staff, resident, tasks, consent].forEach((f) => DriveApp.getFileById(f.getId()).moveTo(folder));
  [results, consentBook].forEach((s) => DriveApp.getFileById(s.getId()).moveTo(folder));

  const lines = [
    `Folder: ${folder.getUrl()}`,
    `Staff questionnaire    – fill: ${staff.getPublishedUrl()}`,
    `                        – edit: ${staff.getEditUrl()}`,
    `Resident questionnaire – fill: ${resident.getPublishedUrl()}`,
    `                        – edit: ${resident.getEditUrl()}`,
    `Task record            – fill: ${tasks.getPublishedUrl()}`,
    `Consent form           – fill: ${consent.getPublishedUrl()}`,
    `Results spreadsheet (responses + SUS/TAM scores): ${results.getUrl()}`,
    `Consent spreadsheet (restricted): ${consentBook.getUrl()}`,
  ];
  Logger.log(lines.join('\n'));
}

function createQuestionnaire(group, book) {
  const staff = group === 'staff';
  const form = FormApp.create(staff
    ? 'Parcel Desk – แบบสอบถามหลังการทดสอบ (เจ้าหน้าที่ / Staff)'
    : 'Parcel Desk – แบบสอบถามหลังการทดสอบ (ผู้พัก / Resident)');
  form.setDescription([
    'ตอบหลังทำ task เสร็จทุกข้อ ใช้เวลาประมาณ 5 นาที ไม่มีคำตอบถูกหรือผิด ตอบตามความรู้สึกจริง',
    'Answer after finishing all tasks (about 5 minutes). There are no right or wrong answers.',
    '',
    'ระบบที่ประเมิน / System: ' + (staff ? 'Parcel Desk (เว็บเจ้าหน้าที่)' : 'หน้าแจ้งเตือนพัสดุสำหรับผู้พัก (Resident page)'),
    SCALE_GUIDE,
  ].join('\n'))
    .setCollectEmail(false)
    .setProgressBar(true)
    .setConfirmationMessage('ขอบคุณที่ร่วมทดสอบ / Thank you for taking part.');

  form.addListItem()
    .setTitle('รหัสผู้เข้าร่วม / Participant ID')
    .setHelpText('ผู้ดำเนินการทดสอบเลือกให้ ห้ามกรอกชื่อจริง / Selected by the moderator — do not enter a real name.')
    .setChoiceValues(PARTICIPANTS[group])
    .setRequired(true);

  form.addPageBreakItem()
    .setTitle('ส่วนที่ 1 · System Usability Scale (SUS)')
    .setHelpText(SCALE_GUIDE);
  SUS.forEach((item) => addScale(form, item));

  form.addPageBreakItem()
    .setTitle('ส่วนที่ 2 · การยอมรับการใช้งาน (TAM)')
    .setHelpText(SCALE_GUIDE);
  tamItems(group).forEach((item) => addScale(form, item));

  form.addParagraphTextItem()
    .setTitle('ข้อเสนอแนะเพิ่มเติม (ไม่บังคับ) / Other comments (optional)');

  form.setDestination(FormApp.DestinationType.SPREADSHEET, book.getId());
  return form;
}

function addScale(form, [code, th, en]) {
  form.addScaleItem()
    .setTitle(`${code}. ${th}`)
    .setHelpText(en)
    .setBounds(1, 5)
    .setLabels(SCALE_LOW, SCALE_HIGH)
    .setRequired(true);
}

function createTaskRecordForm(book) {
  const form = FormApp.create('Parcel Desk – บันทึกผลราย task (Task record · note-taker)');
  form.setDescription([
    'สำหรับผู้จดบันทึก: ส่ง 1 คำตอบต่อ 1 task ต่อ 1 วิธี (Test Plan 5.3.1)',
    'Note-taker: one response per task attempt and method. Start timing after the prompt is read;',
    'stop at success or required termination. Do not replace an unsuccessful attempt with zero time.',
  ].join('\n'))
    .setCollectEmail(false)
    .setProgressBar(false);

  const number = FormApp.createTextValidation()
    .setHelpText('กรอกเป็นตัวเลข 0 ขึ้นไป / Enter a number, 0 or more')
    .requireNumberGreaterThanOrEqualTo(0)
    .build();

  form.addListItem().setTitle('Session').setChoiceValues(SESSIONS).setRequired(true);
  form.addListItem().setTitle('Participant ID')
    .setChoiceValues(PARTICIPANTS.staff.concat(PARTICIPANTS.resident)).setRequired(true);
  form.addTextItem().setTitle('Build / version').setHelpText('e.g. git commit or release tag');
  form.addListItem().setTitle('Task').setChoiceValues(UAT_TASKS).setRequired(true);
  form.addMultipleChoiceItem().setTitle('Method')
    .setChoiceValues(['New system', 'Existing method (Google Forms/Sheets, or asking at the desk)'])
    .setRequired(true);
  form.addMultipleChoiceItem().setTitle('Status')
    .setChoiceValues(['Pass', 'Fail', 'Terminated']).setRequired(true);
  form.addMultipleChoiceItem().setTitle('Unassisted success')
    .setHelpText('Yes only if the participant finished without any help.')
    .setChoiceValues(['Yes', 'No']).setRequired(true);
  form.addTextItem().setTitle('Time (seconds)').setValidation(number).setRequired(true);
  form.addTextItem().setTitle('Errors (count)').setValidation(number).setRequired(true);
  form.addMultipleChoiceItem().setTitle('Assistance')
    .setChoiceValues(['None', 'Hint given', 'Moderator completed a step']).setRequired(true);
  form.addParagraphTextItem().setTitle('Actual result and observations');
  form.addTextItem().setTitle('Evidence / defect ID');

  form.setDestination(FormApp.DestinationType.SPREADSHEET, book.getId());
  return form;
}

function createConsentForm(book) {
  const form = FormApp.create('Parcel Desk – ใบยินยอมเข้าร่วมการทดสอบ (Consent)');
  form.setDescription([
    'โครงการ: Dormitory Parcel Management System (Parcel Desk) · รายวิชา 1305493 Software Engineering Case Studies',
    'ข้อความยินยอมฉบับ: UAT-consent-v1 (28 ตุลาคม 2569)',
    '',
    'วัตถุประสงค์: ทดสอบว่าระบบใช้งานได้จริงและใช้ง่ายเพียงใด ไม่ได้ทดสอบความสามารถของคุณ',
    'สิ่งที่ต้องทำ: ทำ task ตามที่ผู้ดำเนินการอ่านให้ฟัง แล้วตอบแบบสอบถามสั้นๆ ใช้เวลาประมาณ 45 นาที',
    'ข้อมูลที่เก็บ: ผลแต่ละ task เวลา จำนวนข้อผิดพลาด และคำตอบแบบสอบถาม บันทึกด้วยรหัสผู้เข้าร่วม (เช่น U01, R01) ไม่ใช้ชื่อจริงในผลการทดสอบ',
    'ชื่อจริงในแบบฟอร์มนี้เก็บแยก และเข้าถึงได้เฉพาะผู้ประสานงานการทดสอบ ข้อมูลใช้เพื่อการประเมินในรายวิชานี้เท่านั้น',
    'ข้อมูลที่ใช้ทดสอบเป็นข้อมูลจำลองทั้งหมด ไม่มีข้อมูลพัสดุจริง',
    'การเข้าร่วมเป็นไปโดยสมัครใจ คุณถอนตัวได้ทุกเมื่อโดยไม่ต้องให้เหตุผล',
  ].join('\n'))
    .setCollectEmail(false)
    .setConfirmationMessage('บันทึกความยินยอมแล้ว ขอบคุณครับ/ค่ะ');

  form.addListItem().setTitle('รหัสผู้เข้าร่วม / Participant ID')
    .setChoiceValues(PARTICIPANTS.staff.concat(PARTICIPANTS.resident)).setRequired(true);
  form.addTextItem().setTitle('ชื่อ-นามสกุล / Full name').setRequired(true);
  form.addMultipleChoiceItem().setTitle('กลุ่ม / Group')
    .setChoiceValues(['เจ้าหน้าที่ / Staff', 'ผู้พัก / Resident']).setRequired(true);
  form.addCheckboxItem()
    .setTitle('ความยินยอม / Consent')
    .setChoiceValues(['ฉันได้อ่านและเข้าใจข้อมูลข้างต้น และยินยอมเข้าร่วมการทดสอบโดยสมัครใจ / I have read the information above and agree to take part.'])
    .setRequired(true);
  form.addMultipleChoiceItem()
    .setTitle('การบันทึกภาพหน้าจอ/เสียงระหว่างทดสอบ / Screen or audio recording')
    .setChoiceValues(['ยินยอม / I agree', 'ไม่ยินยอม / I do not agree']).setRequired(true);
  form.addMultipleChoiceItem()
    .setTitle('(ผู้พัก) ลงทะเบียนโทรศัพท์ของฉันกับห้องทดสอบชั่วคราว และยกเลิกหลังจบการทดสอบ / (Residents) Register my phone to the test room for this session only')
    .setChoiceValues(['ยินยอม / I agree', 'ไม่ยินยอม / I do not agree', 'ไม่เกี่ยวข้อง (เจ้าหน้าที่) / Not applicable (Staff)'])
    .setRequired(true);
  form.addDateItem().setTitle('วันที่ / Date').setRequired(true);

  form.setDestination(FormApp.DestinationType.SPREADSHEET, book.getId());
  return form;
}

// ---------------------------------------------------------------------------------------------

// The response sheet appears a moment after setDestination; wait for it.
function responseSheet(book, form) {
  for (let attempt = 0; attempt < 10; attempt++) {
    SpreadsheetApp.flush();
    const sheet = book.getSheets().find((s) => (s.getFormUrl() || '').indexOf(form.getId()) !== -1);
    if (sheet && sheet.getLastColumn() > 1) return sheet;
    Utilities.sleep(1500);
  }
  throw new Error('Response sheet not found for ' + form.getTitle());
}

function nameResponseSheet(book, form, name) {
  const sheet = responseSheet(book, form);
  sheet.setName(name);
  return sheet;
}

function columnLetter(n) {
  let s = '';
  for (; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
}

// One scores sheet per group: SUS (0-100) and TAM construct means per participant, plus group means.
function addScoreSheet(book, form, group) {
  const resp = nameResponseSheet(book, form, `${group} responses`);
  const headers = resp.getRange(1, 1, 1, resp.getLastColumn()).getValues()[0];
  const col = (code) => {
    const i = headers.findIndex((h) => String(h).indexOf(code + '.') === 0);
    if (i < 0) throw new Error('Column not found: ' + code);
    return `'${resp.getName()}'!${columnLetter(i + 1)}2:${columnLetter(i + 1)}`;
  };
  const idCol = `'${resp.getName()}'!B2:B`;
  const sum = (codes) => codes.map(col).join('+');

  const susParts = SUS.map(([code], i) => (i % 2 === 0 ? `(${col(code)}-1)` : `(5-${col(code)})`));
  const scores = book.insertSheet(`${group} scores`);
  scores.getRange('A1:E1').setValues([['Participant ID', 'SUS (0-100)', 'PU mean', 'PEOU mean', 'BI mean']])
    .setFontWeight('bold');
  scores.getRange('A2').setFormula(`=ARRAYFORMULA(IF(${idCol}="","",${idCol}))`);
  scores.getRange('B2').setFormula(`=ARRAYFORMULA(IF(${idCol}="","",2.5*(${susParts.join('+')})))`);
  scores.getRange('C2').setFormula(`=ARRAYFORMULA(IF(${idCol}="","",(${sum(['PU1', 'PU2', 'PU3', 'PU4'])})/4))`);
  scores.getRange('D2').setFormula(`=ARRAYFORMULA(IF(${idCol}="","",(${sum(['PEOU1', 'PEOU2', 'PEOU3', 'PEOU4'])})/4))`);
  scores.getRange('E2').setFormula(`=ARRAYFORMULA(IF(${idCol}="","",(${sum(['BI1', 'BI2', 'BI3'])})/3))`);

  scores.getRange('G1:H1').setValues([['Group summary', '']]).setFontWeight('bold');
  scores.getRange('G2:G7').setValues([['Responses'], ['Mean SUS'], ['SD SUS'], ['Mean PU'], ['Mean PEOU'], ['Mean BI']]);
  scores.getRange('H2:H7').setFormulas([
    ['=COUNT(B2:B)'],
    ['=IFERROR(AVERAGE(B2:B),"")'],
    ['=IFERROR(STDEV(B2:B),"")'],
    ['=IFERROR(AVERAGE(C2:C),"")'],
    ['=IFERROR(AVERAGE(D2:D),"")'],
    ['=IFERROR(AVERAGE(E2:E),"")'],
  ]);
  scores.getRange('G9').setValue('SUS benchmark: 68 = average (Sauro, 2011). Exclude PILOT rows before reporting.');
  scores.autoResizeColumns(1, 8);
}

function removeBlankDefaultSheets(book) {
  book.getSheets()
    .filter((s) => !s.getFormUrl() && s.getLastRow() === 0 && !/scores$/.test(s.getName()))
    .forEach((s) => { if (book.getSheets().length > 1) book.deleteSheet(s); });
}
