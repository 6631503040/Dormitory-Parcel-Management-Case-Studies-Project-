#!/usr/bin/env python3
"""Spike and soak load profiles for the Parcel API (Test Summary 2026-11-16, item 9).

Standard library only. Runs closed-loop Staff sessions against an ISOLATED stack — never the dev
or production database. Each session signs in once, then loops with no think time (a worst case, not a user model): 6 reads (list, search by code,
search by name, room lookup, dashboard, Parcel detail), 1 Check-In, 1 Check-Out of its own Parcel.

  python3 -I docs/03-test/tools/load_profile.py spike --base http://localhost:18080 --out spike.json
  python3 -I docs/03-test/tools/load_profile.py soak  --base http://localhost:18080 --minutes 30 --out soak.json

spike: 5 sessions (60 s) -> 50 sessions (60 s) -> 5 sessions (60 s), per-phase percentiles.
soak:  10 sessions for --minutes, percentiles per 5-minute window to expose drift.
Integrity check afterwards: every Parcel this run checked in exists once and is Picked Up with
exactly one checked_in and one checked_out event (sampled via the API).
"""
import argparse
import http.cookiejar
import json
import random
import statistics
import string
import sys
import threading
import time
import urllib.error
import urllib.parse
import urllib.request

PASSWORD = "parcel1234"
USERNAME = "somsri"


class Session:
    def __init__(self, base):
        self.base = base
        self.opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))

    def call(self, method, path, body=None):
        data = json.dumps(body).encode() if body is not None else None
        req = urllib.request.Request(self.base + path, data=data, method=method)
        if data is not None:
            req.add_header("Content-Type", "application/json")
        t0 = time.perf_counter()
        try:
            with self.opener.open(req, timeout=30) as r:
                payload = r.read()
                status = r.status
        except urllib.error.HTTPError as e:
            payload, status = e.read(), e.code
        except Exception:  # connection reset, timeout
            payload, status = b"", 0
        return status, (time.perf_counter() - t0) * 1000, payload


class Recorder:
    def __init__(self):
        self.lock = threading.Lock()
        self.rows = []  # (t, phase, op, ms, status)

    def add(self, phase, op, ms, status):
        with self.lock:
            self.rows.append((time.time(), phase, op, ms, status))


def pct(values, p):
    if not values:
        return None
    s = sorted(values)
    k = max(0, min(len(s) - 1, int(round(p / 100 * len(s) + 0.5)) - 1))  # nearest rank
    return round(s[k], 1)


def summarize(rows):
    out = {}
    for op in sorted({r[2] for r in rows}) + ["ALL"]:
        sel = [r for r in rows if op == "ALL" or r[2] == op]
        ms = [r[3] for r in sel]
        bad = [r for r in sel if not (200 <= r[4] < 300)]
        out[op] = {"n": len(sel), "p50": pct(ms, 50), "p95": pct(ms, 95), "p99": pct(ms, 99),
                   "max": round(max(ms), 1) if ms else None, "errors": len(bad),
                   "errorStatuses": sorted({r[4] for r in bad})}
    return out


def worker(base, rec, created, phase_ref, stop, tag, room_ids):
    s = Session(base)
    st, _, _ = s.call("POST", "/api/v1/auth/login", {"username": USERNAME, "password": PASSWORD})
    if st != 200:
        rec.add(phase_ref[0], "login", 0, st)
        return
    n = 0
    while not stop.is_set():
        phase = phase_ref[0]
        n += 1
        code = f"{tag}-{threading.get_ident() % 100000}-{n}"
        room = random.choice(room_ids)
        reads = [
            ("list", "GET", "/api/v1/parcels?status=pending&pageSize=20"),
            ("search_code", "GET", "/api/v1/parcels?q=" + random.choice(["TH", "SPX", "FLS", tag[:4]])),
            ("search_name", "GET", "/api/v1/parcels?q=" + urllib.parse.quote(random.choice(["สม", "วิ", "นา"]))),
            ("room_lookup", "GET", "/api/v1/rooms/search?q=" + random.choice(["1101", "2203", "305"])),
            ("dashboard", "GET", "/api/v1/dashboard"),
        ]
        for op, m, p in reads:
            st, ms, _ = s.call(m, p)
            rec.add(phase, op, ms, st)
        st, ms, _ = s.call("POST", "/api/v1/parcels", {"trackingCode": code, "roomId": room})
        rec.add(phase, "check_in", ms, st)
        if st == 201:
            with rec.lock:
                created.append(code)
            st, ms, _ = s.call("GET", "/api/v1/parcels/" + code)
            rec.add(phase, "detail", ms, st)
            st, ms, _ = s.call("POST", "/api/v1/parcels/check-out", {"trackingCodes": [code]})
            rec.add(phase, "check_out", ms, st)


def run(base, plan, tag):
    """plan: list of (phase_name, sessions, seconds). Sessions persist across phases; extra ones stop."""
    probe = Session(base)
    probe.call("POST", "/api/v1/auth/login", {"username": USERNAME, "password": PASSWORD})
    room_ids = []
    for q in ["1101", "1102", "2101", "3101", "4101"]:
        _, _, body = probe.call("GET", "/api/v1/rooms/search?q=" + q)
        try:
            items = json.loads(body)
            items = items.get("items", items)
            room_ids += [i["id"] for i in items[:3]]
        except Exception:
            pass
    if not room_ids:
        sys.exit("no rooms found — is the database seeded?")

    rec, created, phase_ref = Recorder(), [], [plan[0][0]]
    workers = []  # (thread, stop_event)
    t_start = time.time()
    for name, sessions, seconds in plan:
        phase_ref[0] = name
        while len(workers) < sessions:
            ev = threading.Event()
            th = threading.Thread(target=worker, args=(base, rec, created, phase_ref, ev, tag, room_ids), daemon=True)
            th.start()
            workers.append((th, ev))
        while len(workers) > sessions:
            th, ev = workers.pop()
            ev.set()
        time.sleep(seconds)
    for th, ev in workers:
        ev.set()
    for th, _ in workers:
        th.join(timeout=60)
    return rec, created, time.time() - t_start, probe


def integrity(probe, created, sample=200):
    bad = []
    for code in random.sample(created, min(sample, len(created))):
        st, _, body = probe.call("GET", "/api/v1/parcels/" + code)
        if st != 200:
            bad.append((code, f"status {st}"))
            continue
        p = json.loads(body)
        types = [e.get("eventType") or e.get("type") for e in p.get("events", [])]
        if p.get("status") != "picked_up" or types.count("checked_in") != 1 or types.count("checked_out") != 1:
            bad.append((code, f"{p.get('status')} {types}"))
    return {"created": len(created), "unique": len(set(created)), "sampled": min(sample, len(created)), "problems": bad[:20]}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("profile", choices=["spike", "soak"])
    ap.add_argument("--base", default="http://localhost:18080")
    ap.add_argument("--minutes", type=float, default=30)
    ap.add_argument("--out", required=True)
    a = ap.parse_args()
    tag = a.profile[:2].upper() + "".join(random.choices(string.ascii_uppercase, k=4))

    if a.profile == "spike":
        plan = [("baseline", 5, 60), ("spike", 50, 60), ("recovery", 5, 60)]
    else:
        plan = [("soak", 10, a.minutes * 60)]
    rec, created, secs, probe = run(a.base, plan, tag)

    result = {"profile": a.profile, "base": a.base, "tag": tag, "seconds": round(secs, 1), "plan": plan}
    if a.profile == "spike":
        result["phases"] = {name: summarize([r for r in rec.rows if r[1] == name]) for name, _, _ in plan}
    else:
        t0 = rec.rows[0][0] if rec.rows else time.time()
        windows = {}
        for r in rec.rows:
            windows.setdefault(int((r[0] - t0) // 300), []).append(r)
        result["windows5min"] = {f"{k * 5}-{k * 5 + 5}min": summarize(v)["ALL"] for k, v in sorted(windows.items())}
        result["overall"] = summarize(rec.rows)
    result["integrity"] = integrity(probe, created)
    with open(a.out, "w") as f:
        json.dump(result, f, ensure_ascii=False, indent=2)
    print(json.dumps({k: result[k] for k in result if k in ("phases", "windows5min", "integrity")}, ensure_ascii=False)[:4000])


if __name__ == "__main__":
    main()
