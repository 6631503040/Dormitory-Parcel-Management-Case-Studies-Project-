"""Recompute the UAT round-1 results from the results workbook.

Reads "Parcel Desk – UAT results (DPMS-TP-002).xlsx" (exported from the Google Sheet
that the uat-forms.gs forms write to), recomputes SUS and TAM per participant
independently of the sheet's formulas, summarises task times per task and method,
and exports each sheet as CSV so the raw data can be read on GitHub.

Usage (from the repo root):
    python docs/03-test/results/20261102-uat/analyze_uat.py

Requires openpyxl. Output next to this file: task-records.csv, staff-responses.csv,
resident-responses.csv, summary.txt (the numbers quoted in README.md).

Rules (see README.md, "How the results were computed"):
- SUS: odd items score (x - 1), even items (5 - x); sum x 2.5 -> 0-100.
- TAM: PU = mean of 4 items, PEOU = mean of 4, BI = mean of 3, TAM = mean of the three.
- Task time 0 s means "no such step" (Residents' existing method has no registration
  and no notifications: UAT07, UAT10). Those rows are excluded from the means,
  never averaged in as 0.
- PILOT rows are excluded.
"""
import csv
import pathlib
import statistics as st
from collections import defaultdict

import openpyxl

HERE = pathlib.Path(__file__).resolve().parent
WORKBOOK = HERE / "Parcel Desk – UAT results (DPMS-TP-002).xlsx"


def export_csv(wb, sheet, name):
    with open(HERE / name, "w", newline="", encoding="utf-8-sig") as f:
        w = csv.writer(f)
        for row in wb[sheet].iter_rows(values_only=True):
            if any(c is not None for c in row):
                w.writerow(["" if c is None else c for c in row])


def sd(xs):
    return st.stdev(xs) if len(xs) > 1 else 0.0


def questionnaire(wb, sheet, out):
    rows = []
    for r in wb[sheet].iter_rows(min_row=2, values_only=True):
        pid = r[1]
        if not pid or str(pid).upper().startswith("PILOT"):
            continue
        sus_items = r[2:12]
        sus = (sum(sus_items[0::2]) - 5 + 25 - sum(sus_items[1::2])) * 2.5
        pu, peou, bi = st.mean(r[12:16]), st.mean(r[16:20]), st.mean(r[20:23])
        rows.append((pid, sus, pu, peou, bi, (pu + peou + bi) / 3))
    rows.sort()
    out.append(f"\n## {sheet} (n = {len(rows)})")
    out.append("ID     SUS    PU    PEOU  BI    TAM")
    for pid, *v in rows:
        out.append(f"{pid:<6} {v[0]:5.1f}  {v[1]:.2f}  {v[2]:.2f}  {v[3]:.2f}  {v[4]:.2f}")
    for i, label in enumerate(["SUS", "PU", "PEOU", "BI", "TAM"], start=1):
        xs = [row[i] for row in rows]
        out.append(f"{label:<5} mean {st.mean(xs):6.2f}  SD {sd(xs):5.2f}  min {min(xs):6.2f}  max {max(xs):6.2f}")


def tasks(wb, out):
    times = defaultdict(list)
    status = defaultdict(lambda: [0, 0])
    excluded = []
    for r in wb["Task records"].iter_rows(min_row=2, values_only=True):
        pid, task, method, result, secs = r[2], r[4], r[5], r[6], r[8]
        if not pid or str(pid).upper().startswith("PILOT"):
            continue
        code = task.split()[0]
        m = "new" if method == "New system" else "existing"
        if m == "new":
            status[code][0] += result == "Pass"
            status[code][1] += 1
        if not secs:
            excluded.append(f"{pid} {code} {m}")
            continue
        times[(code, m)].append(secs)
    out.append("\n## Task time in seconds (mean, SD, n) and new-system success rate")
    out.append("Task   Existing                New system              Change   Success (new)")
    for code in sorted({k[0] for k in times}):
        old, new = times.get((code, "existing")), times.get((code, "new"))
        fmt = lambda xs: f"{st.mean(xs):5.1f} SD {sd(xs):4.1f} n={len(xs)}" if xs else "N/A (no such step)  "
        change = f"{(st.mean(new) - st.mean(old)) / st.mean(old) * 100:+5.0f}%" if old and new else "  N/A "
        ok, n = status[code]
        out.append(f"{code}  {fmt(old):<22}  {fmt(new):<22}  {change}   {ok}/{n}")
    out.append("\nExcluded from means (time 0 = no such step): " + ", ".join(excluded))


def main():
    wb = openpyxl.load_workbook(WORKBOOK, data_only=True)
    export_csv(wb, "Task records", "task-records.csv")
    export_csv(wb, "Staff responses", "staff-responses.csv")
    export_csv(wb, "Resident responses", "resident-responses.csv")
    out = ["UAT round 1 - recomputed by analyze_uat.py from " + WORKBOOK.name]
    questionnaire(wb, "Staff responses", out)
    questionnaire(wb, "Resident responses", out)
    tasks(wb, out)
    text = "\n".join(out) + "\n"
    (HERE / "summary.txt").write_text(text, encoding="utf-8")
    print(text)


if __name__ == "__main__":
    main()
