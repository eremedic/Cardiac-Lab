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
                                 t=b["t"] * j() * self.tscale, st=0.0, prseg=0.0, rp=0.0, kind="narrow", tw=r.uniform(0.045, 0.06),
                                 u=0.0, jn=0.0, tb=0.0, dw=0.0, delta=0.0)
        self.beats = []
        self.qtx = 0.0      # extra QT time (long QT, hypokalemia)
        self.wpw = False    # short PR + delta wave

    def timeline(self):
        rr = 60 / self.rate; c = self.r.uniform(0.25, 0.25 + rr * 0.8)
        while c < DUR + 0.5:
            self.beats.append((c, rr)); c += rr * self.r.uniform(0.985, 1.015)

    def lead_signal(self, ld):
        P = self.lead[ld]; y = np.zeros_like(t); d = P.get("d", self.d)
        for c, rr in self.beats:
            onset = c - d / 2; J = c + d / 2
            pc = (onset - 0.04 if self.wpw else onset) - self.pr + 0.045
            if self.wpw and P["delta"]:   # slurred initial upstroke beginning right after the P wave
                y += P["delta"] * L((t - (onset - 0.04)) / 0.008) * L((onset + 0.012 - t) / 0.006)
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
            Tp = self.tp(c, rr, d)
            if P["jn"]:
                y += g(J + 0.008, P["jn"], 0.007)
            if P["dw"]:                  # de Winter: upsloping ST depression from the J point
                y += -P["dw"] * L((t - J) / 0.004) * np.exp(-np.clip(t - J, 0, None) / 0.07)
            if P["tb"]:                  # second, negative half of a biphasic T
                y += g(Tp + 0.075, P["tb"], P["tw"] * 0.9)
            if P["u"]:
                y += g(Tp + 0.17, P["u"], 0.04)
            if P["st"]:
                y += P["st"] * L((t - J) / 0.006) * L((Tp - t) / 0.03)
            y += g(Tp, P["t"], P["tw"])
        return y

    def tp(self, c, rr, d=None):
        d = self.d if d is None else d
        return c + d / 2 + float(np.clip(0.18 + (rr - 0.8) * 0.12, 0.13, 0.24)) + self.qtx

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

    def st_at(self, ld, off):
        d = self.lead[ld].get("d", self.d)
        return self._at(ld, lambda c, rr: c + d / 2 + off)

    def t_extreme(self, ld, fn):
        seg = []
        for c, rr in self.beats[1:-1]:
            tp = self.tp(c, rr)
            a, b = int((tp - 0.08) * FS), int((tp + 0.14) * FS)
            if b < len(t):
                seg.append(fn(self.clean[ld][a:b]))
        return float(np.mean(seg))

    def u_peak(self, ld):
        seg = []
        for c, rr in self.beats[1:-1]:
            tp = self.tp(c, rr); a, b = int((tp + 0.12) * FS), int((tp + 0.24) * FS)
            if b < len(t):
                seg.append(self.clean[ld][a:b].max())
        return float(np.mean(seg))

    def qtc(self):
        """QT from QRS onset to the end of T (lead II), corrected with Bazett's formula."""
        c, rr = self.beats[2]; tw = self.lead["II"]["tw"]
        qt = (self.tp(c, rr) + 2.2 * tw) - (c - self.d / 2)
        return qt, qt / np.sqrt(rr)

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


# ------------------------------------------------------------------ more findings (set 2)
def f_anterolateral(r):
    e = stemi(r, ["V2", "V3", "V4", "V5", "V6", "I", "aVL"] + (["V1"] if r.random() < 0.5 else []), ["II", "III", "aVF"], (0.2, 0.42), (0.08, 0.18))
    el = leads_where(e, lambda v: v >= 0.1)
    need(len(contiguous(["V2", "V3", "V4"], leads_where(e, lambda v: v >= 0.2))) >= 2 and len(contiguous(["I", "aVL", "V5", "V6"], el)) >= 2, "anterolateral criteria")
    need(e.st60("III") <= -0.05, "reciprocal")
    return e, dict(cat="Anterolateral STEMI", st=st_summary(e), twave="Hyperacute across V2–V6, I and aVL; inverted inferiorly",
                   finding="ST elevation across the anterior (V2–V4) and lateral (I, aVL, V5, V6) leads: a large territory, usually the proximal LAD",
                   action=["STEMI alert and transmit; aspirin; go straight to a PCI center", "High risk of VF and cardiogenic shock: pads on, IV access, be ready to defibrillate"])


def f_wellens(r):
    e = ECG(r, 58, 88); typeA = r.random() < 0.4
    for ld in ["V2", "V3"] + (["V4"] if r.random() < 0.6 else []):
        e.lead[ld]["st"] = r.uniform(0.0, 0.05)
        if typeA:
            e.lead[ld]["t"] = r.uniform(0.15, 0.25); e.lead[ld]["tb"] = -r.uniform(0.3, 0.45)
        else:
            e.lead[ld]["t"] = -r.uniform(0.35, 0.65); e.lead[ld]["tw"] = r.uniform(0.05, 0.065)
    e.build()
    need(not leads_where(e, lambda v: v >= 0.1), "no STE")
    need(all(e.t_extreme(ld, np.min) <= -0.2 for ld in ["V2", "V3"]), "deep or biphasic T in V2-V3")
    need(all(e.qrs_parts(ld)[0] >= 0.3 for ld in ["V2", "V3"]), "R waves preserved")
    kind = "biphasic (up, then down)" if typeA else "deep, symmetric inversion"
    return e, dict(cat="Wellens syndrome", st="No significant ST elevation (under 1 mm)", twave=f"{kind[0].upper() + kind[1:]} in V2–V3",
                   finding=f"{'Biphasic' if typeA else 'Deeply inverted'} T waves in V2–V3 with preserved R waves and no ST elevation: a critical LAD narrowing, often seen when the pain has eased",
                   action=["High risk of a large anterior MI soon: transmit and go to a PCI center even if the pain has stopped", "Aspirin; no stress testing or 'rule-out' approach; repeat the 12-lead if pain returns"])


def f_dewinter(r):
    e = ECG(r, 62, 95)
    for ld in ["V1", "V2", "V3", "V4", "V5", "V6"]:
        e.lead[ld]["dw"] = r.uniform(0.15, 0.3) * (0.6 if ld in ("V1", "V6") else 1)
        e.lead[ld]["t"] = r.uniform(0.65, 1.0) * (0.6 if ld in ("V1", "V6") else 1); e.lead[ld]["tw"] = r.uniform(0.035, 0.045)
    e.lead["aVR"]["st"] = r.uniform(0.06, 0.12)
    e.build()
    dep = [ld for ld in ["V1", "V2", "V3", "V4", "V5", "V6"] if e.st_at(ld, 0.015) <= -0.1]
    tall = [ld for ld in ["V2", "V3", "V4"] if e.tpeak(ld) >= 0.6]
    need(len(dep) >= 3 and len(tall) >= 2 and e.st60("aVR") >= 0.05 and all(e.st60(ld) < 0.12 for ld in LEADS if ld != "aVR"), "de Winter criteria")
    return e, dict(cat="De Winter T waves", st=f"Upsloping ST depression at the J point in {', '.join(dep)} (about {mm(min(e.st_at(ld, 0.015) for ld in dep))} mm at its deepest); slight elevation in aVR",
                   twave="Tall, symmetric, 'hyperacute' T waves across the precordial leads",
                   finding="Upsloping ST depression with tall, symmetric T waves in V1–V6 and no classic ST elevation: a STEMI equivalent from an acute LAD occlusion",
                   action=["Treat as a STEMI: alert, transmit, aspirin, PCI center", "It won't evolve into classic elevation on its own: don't wait for it"])


def f_avr(r):
    e = ECG(r, 70, 105)
    e.lead["aVR"]["st"] = r.uniform(0.12, 0.25); e.lead["aVR"]["t"] = r.uniform(0.0, 0.1)
    if r.random() < 0.5:
        e.lead["V1"]["st"] = r.uniform(0.04, 0.1)
    for ld in ["I", "II", "aVF", "aVL", "V3", "V4", "V5", "V6"]:
        e.lead[ld]["st"] = -r.uniform(0.12, 0.25); e.lead[ld]["t"] *= r.uniform(0.2, 0.6)
    e.lead["III"]["st"] = -r.uniform(0.0, 0.12)
    e.build()
    dn = leads_where(e, lambda v: v <= -0.1)
    need(e.st60("aVR") >= 0.1 and len(dn) >= 6, "aVR criteria")
    return e, dict(cat="ST elevation in aVR with diffuse ST depression", st=st_summary(e),
                   twave="Flattened in the leads with ST depression",
                   finding="ST elevation in aVR (often V1) with widespread ST depression in 6 or more leads: severe ischemia from left main or three-vessel disease",
                   action=["High-risk ACS: transmit and consult per protocol; go to a PCI center with cardiac surgery if possible", "Watch closely for hypotension and arrhythmias; aspirin unless contraindicated"])


def f_lvh(r):
    e = ECG(r, 58, 90)
    e.lead["V1"]["s"] = r.uniform(1.6, 2.3); e.lead["V2"]["s"] = r.uniform(2.0, 2.7)
    for ld, (lo, hi) in {"V5": (2.2, 2.9), "V6": (1.8, 2.4), "I": (1.1, 1.5), "aVL": (1.0, 1.4)}.items():
        e.lead[ld]["r"] = r.uniform(lo, hi); e.lead[ld]["st"] = -r.uniform(0.06, 0.14); e.lead[ld]["t"] = -r.uniform(0.18, 0.35); e.lead[ld]["tw"] = r.uniform(0.05, 0.065)
    e.lead["V1"]["st"] = r.uniform(0.04, 0.12); e.lead["V2"]["st"] = r.uniform(0.06, 0.16)
    e.build()
    sv1 = -e.qrs_parts("V1")[1]; rv5 = max(e.qrs_parts("V5")[0], e.qrs_parts("V6")[0])
    need(sv1 + rv5 >= 3.5, "Sokolow-Lyon")
    need(e.t_extreme("V5", np.min) <= -0.12 and e.t_extreme("V6", np.min) <= -0.1, "strain")
    return e, dict(cat="Left ventricular hypertrophy (LVH) with strain", st=st_summary(e) + " (the V1–V2 elevation is discordant to deep S waves, expected with LVH)",
                   twave="Asymmetric inversion in I, aVL, V5 and V6 ('strain')",
                   finding=f"Very large voltages: S in V1 + R in V5/V6 = {mm(sv1 + rv5)} mm (35 mm or more), with ST depression and T inversion laterally",
                   action=["LVH mimics and can hide ischemia: compare with an old ECG and treat the patient's symptoms", "Ask about high blood pressure; transmit if you're unsure about ST changes"],
                   extra=[["Voltage", f"S V1 {mm(sv1)} mm + R V5/V6 {mm(rv5)} mm = {mm(sv1 + rv5)} mm"]])


def f_early_repol(r):
    e = ECG(r, 52, 80)
    for ld in ["V2", "V3", "V4"] + (["V5"] if r.random() < 0.6 else []):
        e.lead[ld]["st"] = r.uniform(0.1, 0.22); e.lead[ld]["jn"] = r.uniform(0.06, 0.12); e.lead[ld]["t"] = r.uniform(0.5, 0.8)
    for ld in (["II", "aVF"] if r.random() < 0.4 else []):
        e.lead[ld]["st"] = r.uniform(0.04, 0.08); e.lead[ld]["jn"] = r.uniform(0.04, 0.07)
    e.build()
    up = contiguous(["V2", "V3", "V4", "V5"], leads_where(e, lambda v: v >= 0.1))
    need(len(up) >= 2 and not [ld for ld in LEADS if ld != "aVR" and e.st60(ld) <= -0.05], "early repolarization")
    return e, dict(cat="Benign early repolarization", st=f"Mild, concave elevation in {', '.join(up)}; no reciprocal depression",
                   twave="Large, upright, slightly asymmetric", finding="Concave ST elevation with a notched J point ('fish hook') in V2–V4, tall T waves, a slower heart rate and no reciprocal changes",
                   action=["Usually a normal variant in younger, healthy adults: always compare with symptoms", "If the patient has chest pain and you can't tell it from a STEMI, transmit and consult"])


def f_hypok(r):
    e = ECG(r, 62, 95)
    for ld in LEADS:
        e.lead[ld]["t"] *= r.uniform(0.15, 0.35)
        if ld not in ("aVR",):
            e.lead[ld]["st"] = -r.uniform(0.0, 0.07)
    for ld in ["V2", "V3", "V4", "II"]:
        e.lead[ld]["u"] = r.uniform(0.12, 0.22)
    e.qtx = r.uniform(0.02, 0.05)
    e.build()
    us = [ld for ld in ["V2", "V3", "V4"] if e.u_peak(ld) >= 0.1]
    need(len(us) >= 2 and any(e.u_peak(ld) > e.tpeak(ld) for ld in us), "U waves")
    return e, dict(cat="Hypokalemia", st="Slight ST depression; no elevation", twave="Small and flattened, followed by prominent U waves (taller than the T in some leads)",
                   finding=f"Flat T waves with prominent U waves, best seen in {', '.join(us)}: low potassium",
                   action=["Ask about vomiting, diarrhea, diuretics and poor intake", "Risk of ventricular arrhythmias (including torsades): monitor, pads ready; magnesium per protocol if torsades"])


def f_brugada(r):
    e = ECG(r, 58, 90)
    for ld in ["V1", "V2"]:
        e.lead[ld]["st"] = r.uniform(0.25, 0.42); e.lead[ld]["t"] = -r.uniform(0.18, 0.3); e.lead[ld]["rp"] = 0
        e.lead[ld]["jn"] = r.uniform(0.12, 0.2)
    e.build()
    need(all(e.st_at(ld, 0.02) >= 0.2 for ld in ["V1", "V2"]) and all(e.t_extreme(ld, np.min) <= -0.08 for ld in ["V1", "V2"]), "coved")
    need(not contiguous(["II", "III", "aVF", "I", "aVL", "V4", "V5", "V6"], leads_where(e, lambda v: v >= 0.1)), "isolated to V1-V2")
    return e, dict(cat="Brugada pattern", st=f"Coved elevation of {mm(min(e.st_at('V1', 0.02), e.st_at('V2', 0.02)))}–{mm(max(e.st_at('V1', 0.02), e.st_at('V2', 0.02)))} mm in V1–V2", twave="Inverted in V1–V2",
                   finding="Coved ('shark fin') ST elevation of 2 mm or more in V1–V2 sloping down into an inverted T wave (type 1 Brugada): a channelopathy with risk of sudden death",
                   action=["Ask about fainting, palpitations, fever and family history of sudden death", "Monitor, pads ready; treat fever; transport for cardiology evaluation"])


def f_wpw(r):
    e = ECG(r, 62, 95); e.wpw = True; e.pr = r.uniform(0.08, 0.11); e.d = r.uniform(0.11, 0.13)
    for ld in LEADS:
        sign = 1 if e.lead[ld]["r"] >= e.lead[ld]["s"] else -1
        e.lead[ld]["delta"] = sign * r.uniform(0.28, 0.42) * max(e.lead[ld]["r"], e.lead[ld]["s"])
    e.build()
    need(e.pr < 0.12 and e.d >= 0.11, "WPW criteria")
    return e, dict(cat="Wolff-Parkinson-White (WPW) pattern", st="No significant ST elevation", twave="May point opposite the delta wave",
                   finding=f"Short PR ({e.pr:.2f} s), a slurred upstroke at the start of the QRS (delta wave) and a widened QRS: an accessory pathway",
                   action=["Stable patient: note it and transmit; ask about palpitations or fainting", "If AF develops with WPW, avoid AV-nodal blockers (adenosine, diltiazem, beta-blockers); cardiovert if unstable"],
                   extra=[["PR interval", f"{e.pr:.2f} s (short)"]])


def f_longqt(r):
    e = ECG(r, 56, 82); e.qtx = r.uniform(0.12, 0.19)
    for ld in LEADS:
        e.lead[ld]["tw"] *= r.uniform(1.1, 1.35)
    e.build()
    qt, qtc = e.qtc()
    need(qtc >= 0.5 and not leads_where(e, lambda v: abs(v) >= 0.1), "QTc")
    return e, dict(cat="Long QT", st="No significant ST elevation or depression", twave="Broad, late T waves",
                   finding=f"QT {qt * 1000:.0f} ms, QTc {qtc * 1000:.0f} ms (500 ms or more): high risk of torsades de pointes",
                   action=["Look for causes: drugs (methadone, antipsychotics, ondansetron, antiarrhythmics), low K⁺ or Mg²⁺, congenital", "Avoid QT-prolonging drugs; monitor; magnesium and defibrillation if torsades develops"],
                   extra=[["QT / QTc", f"{qt * 1000:.0f} ms / {qtc * 1000:.0f} ms (Bazett)"]])


PLAN = [(f_normal, 7), (f_inferior, 7), (f_anterior, 6), (f_lateral, 5), (f_posterior, 5), (f_rbbb, 5), (f_lbbb, 5), (f_hyperk, 5), (f_pericarditis, 5)]
# Set 2: 50 more ECGs with ten more findings. Kept separate (and seeded separately) so set 1 never changes.
PLAN2 = [(f_anterolateral, 5), (f_wellens, 5), (f_dewinter, 5), (f_avr, 5), (f_lvh, 5), (f_early_repol, 5), (f_hypok, 5), (f_brugada, 5), (f_wpw, 5), (f_longqt, 5)]

CATS = {
    "Normal 12-lead ECG": ("Sinus rhythm, normal QRS width, and no ST elevation or depression of 1 mm or more.", "Nothing is elevated, depressed or wide: check every lead before calling it normal."),
    "Inferior STEMI": ("ST elevation in II, III and aVF (≥ 1 mm in at least 2), usually with reciprocal depression in I and aVL.", "Look at II, III and aVF together, then find the mirror image in aVL."),
    "Anterior STEMI": ("ST elevation in the anterior leads V1–V4 (≥ 2 mm in V2–V3).", "The elevation sits in V2–V4, the leads over the front of the heart."),
    "Lateral STEMI": ("ST elevation in I, aVL, V5 and V6, often with reciprocal depression in III and aVF.", "High lateral (I, aVL) and low lateral (V5, V6) leads are elevated together."),
    "Posterior MI": ("ST depression in V1–V3 with tall R waves: the mirror image of a posterior STEMI. Confirm with V7–V9.", "Depression in V1–V3 with tall R waves: flip it over and it's a STEMI."),
    "Right bundle branch block (RBBB)": ("QRS ≥ 0.12 s with an rSR′ in V1 and a broad, slurred S wave in I and V6.", "Rabbit ears in V1 and a wide S in V6."),
    "Left bundle branch block (LBBB)": ("QRS ≥ 0.12 s with a deep QS in V1 and broad, notched R waves without Q waves in I, aVL, V5 and V6.", "Wide, with a deep, broad V1 and an M-shaped R in V6; ST changes go opposite the QRS."),
    "Hyperkalemia": ("Tall, narrow, peaked T waves; P waves flatten and the QRS widens as potassium rises.", "The T waves are taller than they are wide, like a tent."),
    "Anterolateral STEMI": ("ST elevation across the anterior (V2–V4) and lateral (I, aVL, V5, V6) leads, with reciprocal depression inferiorly.", "Elevation runs from V2 all the way to V6, plus I and aVL."),
    "Wellens syndrome": ("Deeply inverted or biphasic T waves in V2–V3 with preserved R waves and no ST elevation, often in a pain-free patient.", "No elevation, but the T waves in V2–V3 dive down or flip halfway."),
    "De Winter T waves": ("Upsloping ST depression at the J point in V1–V6 leading into tall, symmetric T waves, often with slight elevation in aVR.", "The ST dips at the J point and climbs into a giant T wave across the chest leads."),
    "ST elevation in aVR with diffuse ST depression": ("ST elevation in aVR (often V1) with ST depression in 6 or more other leads.", "Almost every lead is depressed while aVR is the one that's up."),
    "Left ventricular hypertrophy (LVH) with strain": ("Very tall voltages (S in V1 + R in V5/V6 of 35 mm or more) with asymmetric ST depression and T inversion laterally.", "The complexes are huge and the lateral T waves sag downward."),
    "Benign early repolarization": ("Concave ST elevation with a notched J point and tall T waves, mostly V2–V4, without reciprocal depression.", "A 'fish hook' notch at the end of the QRS, concave elevation and nothing depressed anywhere."),
    "Hypokalemia": ("Flattened T waves, prominent U waves (sometimes taller than the T) and slight ST depression.", "Look after the T wave: a second bump (the U wave) stands out."),
    "Brugada pattern": ("Coved ST elevation of 2 mm or more in V1–V2 sloping into an inverted T wave.", "Only V1–V2 are elevated, and the ST curves down like a shark fin."),
    "Wolff-Parkinson-White (WPW) pattern": ("Short PR interval (under 0.12 s), a delta wave and a widened QRS.", "The QRS starts with a slurred ramp right after a short PR."),
    "Long QT": ("QTc of 500 ms or more: the T wave ends late in the cardiac cycle.", "The T wave ends more than halfway to the next QRS."),
    "Pericarditis": ("Diffuse concave ST elevation across many leads, PR depression, and no reciprocal changes except in aVR.", "Elevation everywhere, with no single territory and the PR segment dipping below the baseline."),
}


# "Call the cardiologist" hint 1: where to look, without naming the finding.
HINT_LOOK = {
    "Normal 12-lead ECG": "Work through it in order: rate, rhythm, QRS width, then every ST segment and T wave. Is anything actually abnormal?",
    "Inferior STEMI": "Start with the leads that look at the bottom of the heart: II, III and aVF. Then check aVL for a mirror image.",
    "Anterior STEMI": "Focus on the chest leads over the front of the heart, V1 to V4, and compare their ST segments with the baseline.",
    "Lateral STEMI": "Look at the leads on the left side of the heart: I and aVL (high lateral) and V5–V6 (low lateral).",
    "Posterior MI": "No lead faces the back of the heart. Look at V1–V3 and ask what their changes would look like upside down.",
    "Right bundle branch block (RBBB)": "Measure the QRS first. If it's wide, look at the shape of V1 and at the S wave in V6.",
    "Left bundle branch block (LBBB)": "Measure the QRS first. If it's wide, compare V1 with V6, and check whether the ST changes go the same way as the QRS or opposite.",
    "Hyperkalemia": "Set the ST segments aside and study the T waves: their height, width and shape. Then look at the P waves.",
    "Pericarditis": "Count how many leads have ST elevation. Does it fit one artery's territory? Then look closely at the PR segments.",
    "Anterolateral STEMI": "Map the elevation: where does it start and where does it stop? Check the chest leads and I/aVL.",
    "Wellens syndrome": "The ST segments aren't the story here. Look at the shape of the T waves in V2 and V3.",
    "De Winter T waves": "Look at where the ST segment starts (the J point) in the chest leads, then at what the T wave does next.",
    "ST elevation in aVR with diffuse ST depression": "Most leads are going one way and one lead is going the other. Find the odd one out.",
    "Left ventricular hypertrophy (LVH) with strain": "Before the ST segments, look at the size of the QRS complexes in V1 and V5–V6, and add them up.",
    "Benign early repolarization": "Look at the end of the QRS in V2–V4 for a notch, at the shape of the ST segment, and at whether anything is depressed anywhere.",
    "Hypokalemia": "Look just after each T wave. Is there an extra bump before the next P wave?",
    "Brugada pattern": "The changes are only in V1 and V2. Describe the shape of the ST segment there.",
    "Wolff-Parkinson-White (WPW) pattern": "Measure the PR interval, then look closely at how the QRS starts.",
    "Long QT": "Measure from the start of the QRS to the end of the T wave, and compare it with the R–R interval.",
}
T_FOCUSED = {"Wellens syndrome", "De Winter T waves", "Hyperkalemia", "Hypokalemia", "Long QT"}


def hints_for(item):
    """Three progressively stronger hints: where to look, this ECG's measurements, the tell."""
    import re
    rows = {k: v for k, v in item["rows"]}
    parts = []
    if not rows["QRS"].startswith("Narrow"):
        parts.append(f"QRS {rows['QRS'].lower()}")
    for k in ("Voltage", "PR interval", "QT / QTc"):
        if k in rows:
            parts.append(f"{k}: {rows[k]}")
    st = re.sub(r"\s*\([^)]*(LBBB|LVH)[^)]*\)", "", rows["ST segments"])
    parts.append(f"ST segments: {st[0].lower() + st[1:]}")
    if item["cat"] in T_FOCUSED:
        parts.append(f"T waves: {rows['T waves'][0].lower() + rows['T waves'][1:]}")
    return [HINT_LOOK[item["cat"]], "Here's what I measure on this one. " + "; ".join(parts) + ".", CATS[item["cat"]][1]]


# Answer choices come from look-alikes, so a question can't be solved by elimination.
RELATED = [
    ["Inferior STEMI", "Anterior STEMI", "Lateral STEMI", "Anterolateral STEMI", "Posterior MI", "ST elevation in aVR with diffuse ST depression", "Pericarditis"],
    ["Anterior STEMI", "Anterolateral STEMI", "Benign early repolarization", "Pericarditis", "Brugada pattern", "Left bundle branch block (LBBB)", "Left ventricular hypertrophy (LVH) with strain"],
    ["Wellens syndrome", "De Winter T waves", "Hyperkalemia", "Hypokalemia", "Long QT", "Anterior STEMI", "Normal 12-lead ECG"],
    ["Right bundle branch block (RBBB)", "Left bundle branch block (LBBB)", "Wolff-Parkinson-White (WPW) pattern", "Brugada pattern", "Left ventricular hypertrophy (LVH) with strain", "Normal 12-lead ECG"],
    ["Posterior MI", "ST elevation in aVR with diffuse ST depression", "Left ventricular hypertrophy (LVH) with strain", "Hypokalemia", "Wellens syndrome"],
]


def related_to(cat):
    out = []
    for grp in RELATED:
        if cat in grp:
            out += [c for c in grp if c != cat and c not in out]
    return out


def fingerprint(e):
    return hashlib.sha1(np.round(e.noisy["II"][::10], 2).tobytes() + np.round(e.noisy["V2"][::10], 2).tobytes()).hexdigest()


def generate(seed=20261117, plan=None):
    items, seen = [], set()
    idx = 0
    for fn, count in (plan or PLAN):
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
            rows = [["Rate", f"{rate}/min"], ["Rhythm", rhythm], ["QRS", f"{'Narrow' if d < 0.1 else ('Borderline' if d < 0.12 else 'Wide')} ({d:.2f} s)"]] + info.get("extra", []) + \
                   [["ST segments", info["st"]], ["T waves", info["twave"]], ["Key finding", info["finding"]]]
            items.append({"cat": info["cat"], "name": info["cat"], "ecg": e, "rows": rows, "action": info["action"]})
    return items
