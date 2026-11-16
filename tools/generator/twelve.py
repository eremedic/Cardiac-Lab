"""12-lead ECG practice area: 50 unique 12-lead ECGs across nine findings.

Each ECG is built lead by lead from a randomized normal pattern, then the finding is
applied (ST/T changes, bundle-branch QRS shapes, peaked T waves, PR depression).
The finished tracing is then MEASURED (ST level 60 ms after the J point, PR segment,
T amplitude, QRS width and shape) and checked against the diagnostic criteria for
that finding. ECGs that don't meet them are discarded and regenerated.

    python3 tools/generator/build_twelve.py
"""
import hashlib
import numpy as np

FS = 1000
DUR = 10.0
t = np.arange(0, DUR, 1 / FS)
LEADS = ["I", "II", "III", "aVR", "aVL", "aVF", "V1", "V2", "V3", "V4", "V5", "V6"]
COLS = [["I", "II", "III"], ["aVR", "aVL", "aVF"], ["V1", "V2", "V3"], ["V4", "V5", "V6"]]
COL_OF = {ld: ci for ci, col in enumerate(COLS) for ld in col}
WIN = 2.5  # seconds per column

BASE = {
    "I": dict(p=.10, q=.05, r=.70, s=.10, t=.25), "II": dict(p=.15, q=.05, r=1.0, s=.20, t=.30),
    "III": dict(p=.06, q=.05, r=.45, s=.20, t=.10), "aVR": dict(p=-.12, q=0, r=.10, s=.75, t=-.22),
    "aVL": dict(p=.04, q=.05, r=.35, s=.25, t=.10), "aVF": dict(p=.10, q=.04, r=.70, s=.15, t=.20),
    "V1": dict(p=.07, q=0, r=.25, s=1.0, t=.05), "V2": dict(p=.08, q=0, r=.45, s=1.4, t=.40),
    "V3": dict(p=.08, q=0, r=.80, s=.90, t=.45), "V4": dict(p=.08, q=.03, r=1.3, s=.50, t=.45),
    "V5": dict(p=.08, q=.05, r=1.2, s=.25, t=.35), "V6": dict(p=.08, q=.05, r=.90, s=.10, t=.28),
}


class Retry(Exception):
    pass


def need(cond, why):
    if not cond:
        raise Retry(why)


def g(c, a, w):
    return a * np.exp(-((t - c) ** 2) / (2 * w ** 2))


def L(x):
    return 1 / (1 + np.exp(-np.clip(x, -60, 60)))


def mm(v):
    return f"{abs(v) * 10:.1f}".rstrip("0").rstrip(".")


# ------------------------------------------------------------------ the ECG model
class ECG:
    def __init__(self, r, rate_lo=58, rate_hi=96):
        self.r = r
        self.rate = r.uniform(rate_lo, rate_hi)
        self.d = r.uniform(0.075, 0.1)            # QRS duration
        self.pr = r.uniform(0.13, 0.19)
        self.qscale = r.uniform(0.8, 1.25)
        self.tscale = r.uniform(0.8, 1.2)
        self.lead = {}
        for ld in LEADS:
            b = BASE[ld]; j = lambda: r.uniform(0.85, 1.15)
            self.lead[ld] = dict(p=b["p"] * j(), q=b["q"] * j() * self.qscale, r=b["r"] * j() * self.qscale, s=b["s"] * j() * self.qscale,
                                 t=b["t"] * j() * self.tscale, st=0.0, prseg=0.0, rp=0.0, kind="narrow", tw=r.uniform(0.045, 0.06))
        self.beats = []

    def timeline(self):
        rr = 60 / self.rate; c = self.r.uniform(0.25, 0.25 + rr * 0.8)
        while c < DUR + 0.5:
            self.beats.append((c, rr)); c += rr * self.r.uniform(0.985, 1.015)

    def lead_signal(self, ld):
        P = self.lead[ld]; y = np.zeros_like(t); d = P.get("d", self.d)
        for c, rr in self.beats:
            onset = c - d / 2; J = c + d / 2
            pc = onset - self.pr + 0.045
            if ld == "V1":
                y += g(pc - 0.012, P["p"], 0.014) + g(pc + 0.016, -P["p"] * 0.7, 0.014)
            else:
                y += g(pc, P["p"], 0.022)
            if P["prseg"]:
                y += P["prseg"] * L((t - (pc + 0.05)) / 0.004) * L((onset - 0.004 - t) / 0.004)
            k = d / 0.08
            if P["kind"] == "narrow":
                y += g(c - 0.022 * k, -P["q"], 0.008 * k) + g(c, P["r"], 0.010 * k) + g(c + 0.024 * k, -P["s"], 0.009 * k)
            elif P["kind"] == "rsr":      # RBBB right precordial: rSR'
                y += g(onset + 0.2 * d, P["r"], 0.07 * d) + g(onset + 0.45 * d, -P["s"], 0.08 * d) + g(onset + 0.75 * d, P["rp"], 0.11 * d)
            elif P["kind"] == "rs_wide":  # RBBB left leads: normal R + broad slurred S
                y += g(onset + 0.25 * d, P["r"], 0.09 * d) + g(onset + 0.7 * d, -P["s"], 0.16 * d)
            elif P["kind"] == "qr_wide":  # RBBB aVR: terminal R
                y += g(onset + 0.3 * d, -P["s"], 0.1 * d) + g(onset + 0.75 * d, P["rp"], 0.12 * d)
            elif P["kind"] == "qs_wide":  # LBBB right precordial: deep broad QS
                y += g(onset + 0.5 * d, -P["s"], 0.22 * d)
            elif P["kind"] == "notched":  # LBBB left leads: broad notched R, no q
                y += g(onset + 0.35 * d, P["r"] * 0.88, 0.15 * d) + g(onset + 0.68 * d, P["r"], 0.15 * d)
            elif P["kind"] == "rs_lbbb":  # LBBB transitional
                y += g(onset + 0.3 * d, P["r"], 0.13 * d) + g(onset + 0.7 * d, -P["s"], 0.17 * d)
            Tp = J + float(np.clip(0.18 + (rr - 0.8) * 0.12, 0.13, 0.24))
            if P["st"]:
                y += P["st"] * L((t - J) / 0.006) * L((Tp - t) / 0.03)
            y += g(Tp, P["t"], P["tw"])
        return y

    def build(self):
        self.timeline()
        self.clean = {ld: self.lead_signal(ld) for ld in LEADS}
        nz = self.r.uniform(0.004, 0.009); wa = self.r.uniform(0.0, 0.04)
        self.noisy = {}
        for ld in LEADS:
            w = wa * np.sin(2 * np.pi * self.r.uniform(0.1, 0.3) * t + self.r.uniform(0, 6.3))
            self.noisy[ld] = self.clean[ld] + w + self.r.normal(0, nz, t.size)
        return self

    # ---- measurements on the finished (noise-free) waveform
    def _at(self, ld, offs_fn):
        vals = []
        for c, rr in self.beats[1:-1]:
            tt = offs_fn(c, rr)
            if 0 < tt < DUR:
                vals.append(self.clean[ld][int(tt * FS)])
        return float(np.mean(vals))

    def st60(self, ld):
        d = self.lead[ld].get("d", self.d)
        return self._at(ld, lambda c, rr: c + d / 2 + 0.06)

    def prseg(self, ld):
        d = self.lead[ld].get("d", self.d)
        return self._at(ld, lambda c, rr: c - d / 2 - 0.02)

    def tpeak(self, ld):
        seg = []
        for c, rr in self.beats[1:-1]:
            a = int((c + self.d / 2 + 0.05) * FS); b = int((c + self.d / 2 + 0.3) * FS)
            if b < len(t):
                seg.append(self.clean[ld][a:b].max())
        return float(np.mean(seg))

    def qrs_parts(self, ld):
        """Largest positive and negative deflection inside the QRS window (one beat)."""
        c, rr = self.beats[2]; d = self.lead[ld].get("d", self.d)
        a, b = int((c - d / 2 - 0.01) * FS), int((c + d / 2 + 0.01) * FS)
        w = self.clean[ld][a:b]
        return float(w.max()), float(w.min())


def leads_where(ecg, cond):
    return [ld for ld in LEADS if cond(ecg.st60(ld))]


def st_summary(ecg):
    up = [(ld, ecg.st60(ld)) for ld in LEADS if ecg.st60(ld) >= 0.1]
    dn = [(ld, ecg.st60(ld)) for ld in LEADS if ecg.st60(ld) <= -0.1]
    parts = []
    def rng_txt(vals):
        lo, hi = mm(min(vals, key=abs)), mm(max(vals, key=abs))
        return f"{lo} mm" if lo == hi else f"{lo}–{hi} mm"
    if up:
        parts.append(f"Elevated in {', '.join(l for l, _ in up)} ({rng_txt([v for _, v in up])})")
    if dn:
        parts.append(f"{'depressed' if up else 'Depressed'} in {', '.join(l for l, _ in dn)} ({rng_txt([v for _, v in dn])})")
    return "; ".join(parts) if parts else "No significant elevation or depression (all under 1 mm)"


def contiguous(group, leads):
    return [ld for ld in group if ld in leads]


# ------------------------------------------------------------------ findings
def f_normal(r):
    e = ECG(r).build()
    need(all(abs(e.st60(ld)) < 0.08 for ld in LEADS), "no ST shift")
    return e, dict(cat="Normal 12-lead ECG", st=st_summary(e), twave="Upright except aVR (and sometimes V1)", finding="No acute ST changes, normal intervals",
                   action=["A normal ECG doesn't rule out a heart attack: treat the patient's symptoms", "Repeat the 12-lead if symptoms change; transmit per protocol"])


def stemi(r, up, recip, up_rng, recip_rng, hyper=True, extra=None):
    e = ECG(r)
    if extra:
        extra(e)
    for ld in up:
        e.lead[ld]["st"] = r.uniform(*up_rng); e.lead[ld]["t"] = abs(e.lead[ld]["t"]) * (r.uniform(1.2, 1.7) if hyper else 1)
    for ld in recip:
        e.lead[ld]["st"] = -r.uniform(*recip_rng); e.lead[ld]["t"] = -abs(e.lead[ld]["t"]) * r.uniform(0.3, 0.8)
    return e.build()


def f_inferior(r):
    qwave = r.random() < 0.5
    e = stemi(r, ["II", "III", "aVF"], ["I", "aVL"], (0.15, 0.35), (0.08, 0.2),
              extra=(lambda e: e.lead["III"].update(q=r.uniform(0.12, 0.25))) if qwave else None)
    el = leads_where(e, lambda v: v >= 0.1)
    need(len(contiguous(["II", "III", "aVF"], el)) >= 2 and e.st60("aVL") <= -0.05, "inferior criteria")
    need(not contiguous(["V1", "V2", "V3", "V4"], el), "isolated")
    return e, dict(cat="Inferior STEMI", st=st_summary(e), twave="Tall (hyperacute) in II, III, aVF; inverted in I and aVL",
                   finding="ST elevation in the inferior leads with reciprocal depression in I and aVL. Usually the right coronary artery",
                   action=["STEMI alert and transmit; aspirin 162–324 mg chewed; go to a PCI center", "Get right-sided V4R: if the right ventricle is involved, avoid nitroglycerin and give fluids for hypotension"])


def f_anterior(r):
    up = ["V1", "V2", "V3", "V4"] if r.random() < 0.6 else ["V2", "V3", "V4"]
    e = stemi(r, up, ["II", "III", "aVF"] if r.random() < 0.6 else [], (0.22, 0.45), (0.05, 0.12))
    el = leads_where(e, lambda v: v >= 0.2)
    need(len(contiguous(["V2", "V3", "V4"], el)) >= 2, "anterior criteria")
    need(not contiguous(["II", "III", "aVF"], leads_where(e, lambda v: v >= 0.1)), "not inferior")
    return e, dict(cat="Anterior STEMI", st=st_summary(e), twave="Tall (hyperacute) across the precordial leads",
                   finding=f"ST elevation in {', '.join(up)}. Left anterior descending (LAD) artery",
                   action=["STEMI alert and transmit; aspirin; go to a PCI center", "Large territory: watch for VF and cardiogenic shock; pads on"])


def f_lateral(r):
    e = stemi(r, ["I", "aVL", "V5", "V6"], ["III", "aVF"], (0.12, 0.3), (0.08, 0.18))
    el = leads_where(e, lambda v: v >= 0.1)
    need(len(contiguous(["I", "aVL", "V5", "V6"], el)) >= 2 and e.st60("III") <= -0.05, "lateral criteria")
    return e, dict(cat="Lateral STEMI", st=st_summary(e), twave="Hyperacute in I, aVL, V5, V6; inverted in III and aVF",
                   finding="ST elevation in the lateral leads (I, aVL, V5, V6) with reciprocal depression inferiorly. Usually the circumflex artery",
                   action=["STEMI alert and transmit; aspirin; go to a PCI center", "Repeat the 12-lead if the first one is borderline"])


def f_posterior(r):
    e = ECG(r)
    for ld, (rr_, ss) in {"V1": (r.uniform(0.75, 1.05), r.uniform(0.2, 0.35)), "V2": (r.uniform(0.9, 1.3), r.uniform(0.3, 0.5)), "V3": (r.uniform(1.0, 1.4), r.uniform(0.3, 0.5))}.items():
        e.lead[ld]["r"] = rr_; e.lead[ld]["s"] = ss
        e.lead[ld]["st"] = -r.uniform(0.15, 0.32); e.lead[ld]["t"] = r.uniform(0.25, 0.45)
    e.build()
    dn = leads_where(e, lambda v: v <= -0.1)
    rmax, rmin = e.qrs_parts("V2")
    need(len(contiguous(["V1", "V2", "V3"], dn)) >= 2 and rmax > -rmin and not leads_where(e, lambda v: v >= 0.1), "posterior criteria")
    return e, dict(cat="Posterior MI", st=st_summary(e), twave="Upright in V1–V3", finding="Horizontal ST depression in V1–V3 with tall R waves (R larger than S in V2): the mirror image of a posterior STEMI",
                   action=["Get posterior leads V7–V9: ST elevation ≥ 0.5 mm there confirms a posterior STEMI", "Treat as a STEMI equivalent per protocol: aspirin, transmit, PCI center"])


def f_rbbb(r):
    e = ECG(r); d = r.uniform(0.125, 0.16); e.d = d
    for ld in ["V1", "V2"]:
        e.lead[ld].update(kind="rsr", r=r.uniform(0.25, 0.4), s=r.uniform(0.3, 0.5), rp=r.uniform(0.85, 1.25) * (1 if ld == "V1" else 0.8), t=-r.uniform(0.15, 0.3), st=-r.uniform(0.0, 0.05))
    for ld in ["I", "aVL", "V5", "V6"]:
        e.lead[ld].update(kind="rs_wide", s=r.uniform(0.25, 0.45))
    e.lead["aVR"].update(kind="qr_wide", rp=r.uniform(0.25, 0.4))
    e.build()
    v1max, _ = e.qrs_parts("V1")
    need(d >= 0.12 and e.lead["V1"]["rp"] > e.lead["V1"]["r"] and v1max > 0.4, "RBBB criteria")
    return e, dict(cat="Right bundle branch block (RBBB)", st=st_summary(e), twave="Inverted in V1–V2 (expected with RBBB)",
                   finding=f"QRS {d:.2f} s with an rSR′ ('rabbit ears') in V1 and a broad, slurred S wave in I and V6",
                   action=["RBBB by itself isn't a STEMI and doesn't hide ST elevation: still look for STEMI criteria", "Compare with an old ECG if available; treat the patient's symptoms"])


def f_lbbb(r):
    e = ECG(r); d = r.uniform(0.14, 0.18); e.d = d
    for ld in ["V1", "V2", "V3"]:
        e.lead[ld].update(kind="qs_wide", s=r.uniform(1.0, 1.7) * (1 if ld != "V3" else 0.8), st=r.uniform(0.12, 0.25), t=r.uniform(0.25, 0.45))
    for ld in ["I", "aVL", "V5", "V6"]:
        e.lead[ld].update(kind="notched", r=r.uniform(0.8, 1.3), st=-r.uniform(0.08, 0.16), t=-r.uniform(0.15, 0.3))
    e.lead["V4"].update(kind="rs_lbbb", r=r.uniform(0.4, 0.7), s=r.uniform(0.6, 1.0), st=r.uniform(0.0, 0.08))
    e.build()
    v1max, v1min = e.qrs_parts("V1"); _, i_min = e.qrs_parts("I"); _, v6min = e.qrs_parts("V6")
    need(d >= 0.12 and v1max < 0.06 and v1min < -0.8 and i_min > -0.03 and v6min > -0.03, "LBBB criteria")
    return e, dict(cat="Left bundle branch block (LBBB)", st=st_summary(e) + " (discordant: opposite the QRS, expected with LBBB)", twave="Opposite the main QRS direction in each lead",
                   finding=f"QRS {d:.2f} s with a deep QS in V1 and broad, notched R waves with no Q in I, aVL, V5 and V6",
                   action=["LBBB hides STEMI: apply Sgarbossa criteria (concordant ST elevation ≥ 1 mm, or ST depression ≥ 1 mm in V1–V3)", "A new LBBB alone is no longer a STEMI alert: transmit and consult if the patient is symptomatic"])


def f_hyperk(r):
    e = ECG(r, 55, 82); e.d = r.uniform(0.09, 0.11)
    for ld in LEADS:
        e.lead[ld]["p"] *= r.uniform(0.3, 0.55)
    for ld in ["V2", "V3", "V4"]:
        e.lead[ld]["t"] = r.uniform(0.75, 1.15); e.lead[ld]["tw"] = r.uniform(0.026, 0.034)
    for ld in ["II", "aVF", "V5"]:
        e.lead[ld]["t"] = r.uniform(0.45, 0.7); e.lead[ld]["tw"] = r.uniform(0.028, 0.036)
    e.build()
    tall = [ld for ld in ["V2", "V3", "V4"] if e.tpeak(ld) >= 0.6]
    need(len(tall) >= 2 and not leads_where(e, lambda v: v >= 0.12), "peaked T")
    return e, dict(cat="Hyperkalemia", st="No STEMI-pattern elevation", twave=f"Tall, narrow, peaked ('tented') T waves, largest in {', '.join(tall)}",
                   finding="Peaked T waves with small, flattened P waves: classic early hyperkalemia",
                   action=["Ask about dialysis, kidney failure, missed treatments and potassium-sparing drugs", "Unstable or wide QRS: calcium chloride per protocol; continuous monitoring, pads ready"])


def f_pericarditis(r):
    e = ECG(r, 92, 112)
    diffuse = ["I", "II", "aVF", "aVL", "V2", "V3", "V4", "V5", "V6"]
    for ld in diffuse:
        e.lead[ld]["st"] = r.uniform(0.08, 0.18); e.lead[ld]["prseg"] = -r.uniform(0.04, 0.08)
    e.lead["III"]["st"] = r.uniform(0.0, 0.06)
    e.lead["aVR"]["st"] = -r.uniform(0.08, 0.15); e.lead["aVR"]["prseg"] = r.uniform(0.04, 0.08)
    e.build()
    up = leads_where(e, lambda v: v >= 0.05)
    need(len(up) >= 6 and e.st60("aVR") < -0.04 and e.prseg("II") <= -0.03 and e.prseg("aVR") >= 0.03, "pericarditis criteria")
    need(not [ld for ld in LEADS if ld not in ("aVR", "V1") and e.st60(ld) <= -0.05], "no reciprocal changes")
    return e, dict(cat="Pericarditis", st=f"Widespread, concave (saddle-shaped) elevation in {len(up)} leads; depressed only in aVR", twave="Upright",
                   finding="Diffuse ST elevation that doesn't fit one coronary territory, PR depression (PR elevation in aVR) and no reciprocal changes",
                   action=["Ask about pain that's sharp, worse lying flat and better leaning forward, and recent viral illness", "If you can't confidently tell it from a STEMI, treat and transmit as a STEMI"])


PLAN = [(f_normal, 7), (f_inferior, 7), (f_anterior, 6), (f_lateral, 5), (f_posterior, 5), (f_rbbb, 5), (f_lbbb, 5), (f_hyperk, 5), (f_pericarditis, 5)]

CATS = {
    "Normal 12-lead ECG": ("Sinus rhythm, normal QRS width, and no ST elevation or depression of 1 mm or more.", "Nothing is elevated, depressed or wide: check every lead before calling it normal."),
    "Inferior STEMI": ("ST elevation in II, III and aVF (≥ 1 mm in at least 2), usually with reciprocal depression in I and aVL.", "Look at II, III and aVF together, then find the mirror image in aVL."),
    "Anterior STEMI": ("ST elevation in the anterior leads V1–V4 (≥ 2 mm in V2–V3).", "The elevation sits in V2–V4, the leads over the front of the heart."),
    "Lateral STEMI": ("ST elevation in I, aVL, V5 and V6, often with reciprocal depression in III and aVF.", "High lateral (I, aVL) and low lateral (V5, V6) leads are elevated together."),
    "Posterior MI": ("ST depression in V1–V3 with tall R waves: the mirror image of a posterior STEMI. Confirm with V7–V9.", "Depression in V1–V3 with tall R waves: flip it over and it's a STEMI."),
    "Right bundle branch block (RBBB)": ("QRS ≥ 0.12 s with an rSR′ in V1 and a broad, slurred S wave in I and V6.", "Rabbit ears in V1 and a wide S in V6."),
    "Left bundle branch block (LBBB)": ("QRS ≥ 0.12 s with a deep QS in V1 and broad, notched R waves without Q waves in I, aVL, V5 and V6.", "Wide, with a deep, broad V1 and an M-shaped R in V6; ST changes go opposite the QRS."),
    "Hyperkalemia": ("Tall, narrow, peaked T waves; P waves flatten and the QRS widens as potassium rises.", "The T waves are taller than they are wide, like a tent."),
    "Pericarditis": ("Diffuse concave ST elevation across many leads, PR depression, and no reciprocal changes except in aVR.", "Elevation everywhere, with no single territory and the PR segment dipping below the baseline."),
}


def fingerprint(e):
    return hashlib.sha1(np.round(e.noisy["II"][::10], 2).tobytes() + np.round(e.noisy["V2"][::10], 2).tobytes()).hexdigest()


def generate(seed=20261117):
    items, seen = [], set()
    idx = 0
    for fn, count in PLAN:
        for _ in range(count):
            for attempt in range(400):
                r = np.random.default_rng(seed + idx * 1000 + attempt)
                try:
                    e, info = fn(r)
                    fp = fingerprint(e); need(fp not in seen, "duplicate")
                    break
                except Retry:
                    continue
            else:
                raise RuntimeError(f"could not build {fn.__name__}")
            seen.add(fp); idx += 1
            rate = round(60 / np.mean([rr for _, rr in e.beats]))
            rhythm = "Sinus tachycardia" if rate > 100 else ("Sinus bradycardia" if rate < 60 else "Sinus rhythm")
            d = max(e.lead[ld].get("d", e.d) for ld in LEADS)
            rows = [["Rate", f"{rate}/min"], ["Rhythm", rhythm], ["QRS", f"{'Narrow' if d < 0.12 else 'Wide'} ({d:.2f} s)"],
                    ["ST segments", info["st"]], ["T waves", info["twave"]], ["Key finding", info["finding"]]]
            items.append({"cat": info["cat"], "name": info["cat"], "ecg": e, "rows": rows, "action": info["action"]})
    return items
