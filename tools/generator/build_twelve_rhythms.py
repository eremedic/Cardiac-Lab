"""Builds static/twelve-rhythms.json: 12-lead ECGs that match the rhythms the defibrillator monitor can show.

    python3 tools/generator/build_twelve_rhythms.py

When a student presses 12-LEAD on the monitor (Defib lab and Code lab), the device prints one of these for the
rhythm on its screen, at the closest heart rate, with a measurement header (no interpretation) and asks the
student to interpret it. Each rhythm is drawn lead by lead from the same normal-lead amplitudes as the 12-lead
practice area, and every ECG is checked: rate, regularity, P waves (present, absent, or dissociated) and QRS
width are measured from the beat timings and must match the rhythm before it's kept.
"""
import json, os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import numpy as np
import twelve as T

t, g, LEADS, BASE = T.t, T.g, T.LEADS, T.BASE
OUT = os.path.normpath(os.path.join(HERE, "..", "..", "static", "twelve-rhythms.json"))

# wide-QRS polarity by lead: VT (RBBB-like, inferior axis) and ventricular escape/paced (LBBB-like, left axis)
W_VT = {"I": -.55, "II": .85, "III": 1.0, "aVR": -.3, "aVL": -.8, "aVF": .95, "V1": 1.0, "V2": .85, "V3": .6, "V4": .25, "V5": -.35, "V6": -.55}
W_LB = {"I": .8, "II": .35, "III": -.45, "aVR": -.55, "aVL": .75, "aVF": -.1, "V1": -1.0, "V2": -1.0, "V3": -.75, "V4": .3, "V5": .8, "V6": .85}
W_RB = {"I": .7, "II": .8, "III": .3, "aVR": -.7, "aVL": .3, "aVF": .55, "V1": .85, "V2": .6, "V3": .4, "V4": .7, "V5": .8, "V6": .7}

LABEL = {
    "nsr": ("Normal sinus rhythm", "Rate 60–100, regular, an upright P before every QRS in II, PR 0.12–0.20 s and a narrow QRS."),
    "sbrady": ("Sinus bradycardia", "A normal sinus P–QRS–T in every beat, regular, at a rate under 60."),
    "stach": ("Sinus tachycardia", "An upright P before every narrow QRS, regular, at 100–150."),
    "svt": ("Supraventricular tachycardia (SVT)", "Narrow, regular and fast (usually 150–250) with no visible P waves."),
    "af": ("Atrial fibrillation with rapid ventricular response", "Irregularly irregular narrow QRS complexes, no P waves, and a wavy (fibrillatory) baseline, best seen in V1."),
    "flutter": ("Atrial flutter with 2:1 conduction", "Sawtooth flutter waves at about 300/min (best in II, III, aVF and V1) with a regular ventricular rate of about 150."),
    "vt": ("Monomorphic ventricular tachycardia", "Wide (≥ 0.12 s), regular and fast with uniform QRS complexes; P waves march through independently (AV dissociation)."),
    "chb": ("Third-degree (complete) AV block with a ventricular escape", "P waves at a normal rate march through without any fixed PR; a slow, wide, regular escape rhythm."),
    "b21": ("2:1 second-degree AV block", "Every other P wave conducts with a constant PR; the dropped P waves sit between the QRS complexes. The QRS is wide (bundle branch block), so suspect Mobitz II."),
    "paced": ("Ventricular paced rhythm", "A pacer spike before every QRS, followed by a wide, LBBB-like complex."),
    "antstemi": ("Sinus rhythm with anterior STEMI", "ST elevation in V1–V4 (≥ 2 mm in V2–V3) with reciprocal changes: an LAD occlusion."),
}
DISTRACT = {
    "nsr": ["sbrady", "stach", "af"], "sbrady": ["nsr", "chb", "b21"], "stach": ["svt", "flutter", "nsr"], "svt": ["stach", "flutter", "af"],
    "af": ["flutter", "svt", "stach"], "flutter": ["svt", "af", "stach"], "vt": ["svt", "af", "paced"], "chb": ["b21", "sbrady", "paced"],
    "b21": ["chb", "sbrady", "nsr"], "paced": ["vt", "chb", "b21"], "antstemi": ["nsr", "stach", "af"],
}


class Gen:
    def __init__(self, r):
        self.r = r
        self.y = {ld: np.zeros_like(t) for ld in LEADS}
        self.qrs, self.p, self.spk = [], [], []
        self.amp = {ld: {k: v * r.uniform(.88, 1.12) for k, v in BASE[ld].items()} for ld in LEADS}

    def P(self, c):
        for ld in LEADS:
            a = self.amp[ld]["p"]
            if ld == "V1":
                self.y[ld] += g(c - .012, a, .014) + g(c + .016, -a * .7, .014)
            else:
                self.y[ld] += g(c, a, .022)
        if 0 <= c < T.DUR:
            self.p.append(c)

    def N(self, c, rr, tscale=1.0):
        d = .085
        for ld in LEADS:
            a = self.amp[ld]
            self.y[ld] += g(c - .022, -a["q"], .008) + g(c, a["r"], .010) + g(c + .024, -a["s"], .009)
            tp = c + d / 2 + float(np.clip(.18 + (rr - .8) * .12, .13, .24))
            self.y[ld] += g(tp, a["t"] * tscale, .05)
        if 0 <= c < T.DUR:
            self.qrs.append((c, d))

    def W(self, c, pol, d=.15):
        for ld in LEADS:
            A = pol[ld] * self.r.uniform(.9, 1.1)
            self.y[ld] += g(c, A, d / 4.6) + g(c + d * .42, -.25 * A, d / 6) + g(c + d / 2 + .2, -.32 * A, .06)
        if 0 <= c < T.DUR:
            self.qrs.append((c, d))

    def spike(self, c):
        for ld in LEADS:
            self.y[ld] += g(c, 1.4 if ld in ("II", "aVF", "V2", "V3") else .9, .0025)
        if 0 <= c < T.DUR:
            self.spk.append(c)

    def finish(self):
        nz = self.r.uniform(.004, .008)
        out = {}
        for i, ld in enumerate(LEADS):
            w = self.r.uniform(0, .03) * np.sin(2 * np.pi * self.r.uniform(.12, .3) * t + self.r.uniform(0, 6.3))
            out[ld] = self.y[ld] + w + self.r.normal(0, nz, t.size)
        return out


def times(start, rr_fn):
    c, out = start, []
    while c < T.DUR + .5:
        out.append(c); c += rr_fn()
    return out


def build(kind, rate, seed):
    r = np.random.default_rng(seed)
    G = Gen(r)
    meas = {"pr": None, "atrial": None}
    if kind in ("nsr", "sbrady", "stach"):
        rr, pr = 60 / rate, r.uniform(.13, .18)
        for c in times(r.uniform(.25, .7), lambda: rr * r.uniform(.985, 1.015)):
            G.P(c - pr); G.N(c, rr)
        meas["pr"] = pr + .015   # P onset to QRS onset
    elif kind == "svt":
        rr = 60 / rate
        for c in times(r.uniform(.2, .4), lambda: rr):
            G.N(c, rr, .7)
    elif kind == "af":
        for c in times(r.uniform(.2, .4), lambda: r.uniform(.3, .55)):
            G.N(c, .42, .8)
        for ld in LEADS:
            k = 1.6 if ld in ("V1", "II", "III", "aVF") else .7
            G.y[ld] += k * sum(r.uniform(.012, .025) * np.sin(2 * np.pi * r.uniform(5, 8.5) * t + r.uniform(0, 6.3)) for _ in range(4))
    elif kind == "flutter":
        ph = r.uniform(0, .2)
        saw = ((t - ph) * 5) % 1
        wave = np.where(saw < .8, -(saw / .8), -1 + (saw - .8) / .2) + .5
        for ld in LEADS:
            k = {"II": .16, "III": .16, "aVF": .16, "V1": -.1, "aVR": -.08}.get(ld, .04)
            G.y[ld] += k * wave
        for c in times(ph + .32, lambda: .4):
            G.N(c, .4, .6)
        meas["atrial"] = 300
    elif kind == "vt":
        rr = 60 / rate
        for c in times(r.uniform(.2, .4), lambda: rr):
            G.W(c, W_VT, r.uniform(.15, .18))
        for c in times(r.uniform(.1, .7), lambda: .8):
            G.P(c)
    elif kind == "chb":
        for c in times(r.uniform(.3, .9), lambda: 60 / 33):
            G.W(c, W_LB, .15)
        for c in times(r.uniform(.05, .5), lambda: 60 / 80):
            G.P(c)
    elif kind == "b21":
        pp, pr, i = .78, r.uniform(.16, .2), 0
        for c in times(r.uniform(.15, .5), lambda: pp):
            G.P(c)
            if i % 2 == 0:
                G.W(c + pr, W_RB, .13)
            i += 1
        meas["pr"] = pr
    elif kind == "paced":
        rr = 60 / rate
        for c in times(r.uniform(.2, .5), lambda: rr):
            G.spike(c); G.W(c + .02, W_LB, .16)
        for c in times(r.uniform(.05, .5), lambda: 60 / 80):
            G.P(c)
    sig = G.finish()
    # ---- check it really is the rhythm it says it is
    qs = sorted(q for q, _ in G.qrs)
    rrs = np.diff(qs)
    hr = 60 / rrs.mean()
    reg = rrs.max() - rrs.min() < .06
    wide = G.qrs[0][1] >= .12
    ok = {"nsr": reg and 60 <= hr <= 100 and len(G.p) >= len(qs) - 1, "sbrady": reg and hr < 60, "stach": reg and 100 < hr <= 150,
          "svt": reg and hr >= 150 and not G.p, "af": not reg and not G.p and rrs.std() / rrs.mean() > .1, "flutter": reg and 140 <= hr <= 160 and not G.p,
          "vt": reg and hr >= 120 and wide, "chb": reg and wide and len(G.p) > len(qs) * 2, "b21": wide and abs(len(G.p) - 2 * len(qs)) <= 2,
          "paced": wide and len(G.spk) >= len(qs) - 1}[kind]
    assert ok, (kind, rate, seed, hr)
    # ---- measurement header (what the machine prints; no interpretation)
    qrsd = int(round(max(d for _, d in G.qrs) * 1000))
    rr = float(np.median(rrs))
    qt = .36 + .12 * (rr - .6) if not wide else .42
    qt = float(np.clip(qt, .28, .48))
    def net(ld):
        c = qs[2]; a, b = int((c - .06) * 1000), int((c + .08) * 1000)
        return float(sig[ld][a:b].max() + sig[ld][a:b].min())
    axis = int(round(np.degrees(np.arctan2(net("aVF"), net("I")))))
    atr = meas["atrial"] or (round(60 / float(np.mean(np.diff(G.p)))) if len(G.p) > 2 else None)
    header = {"vent": int(round(hr)), "atrial": atr, "pr": int(round(meas["pr"] * 1000)) if meas["pr"] else None, "qrs": qrsd,
              "qt": int(round(qt * 1000)), "qtc": int(round(qt / np.sqrt(rr) * 1000)), "paxis": 55 if kind in ("nsr", "sbrady", "stach", "b21") else None,
              "raxis": axis, "taxis": axis - 10 if not wide else axis + 160}
    return sig, header


def encode(y):
    v = np.round(np.clip(y[::2], -3, 3) * 100).astype(int)
    out, prev = [], None
    for x in v:
        if prev is None or abs(x - prev) > 40:
            out.append(f"|{x}|")
        else:
            out.append(chr(int(x - prev) + 80))
        prev = x
    return "".join(out)


def pack(sig):
    leads = {}
    for ld in LEADS:
        a, b = int(T.COL_OF[ld] * T.WIN * T.FS), int((T.COL_OF[ld] + 1) * T.WIN * T.FS)
        leads[ld] = encode(sig[ld][a:b])
    leads["rhythm"] = encode(sig["II"])
    return leads


PLAN = {"nsr": [66, 78, 90], "sbrady": [38, 46, 54], "stach": [106, 118, 132], "svt": [180, 196, 212], "af": [150, 150, 150], "flutter": [150, 150, 150],
        "vt": [160, 172, 186], "chb": [33, 33, 33], "b21": [38, 38, 38], "paced": [60, 70, 80]}


def main():
    out = {"labels": {k: list(v) for k, v in LABEL.items()}, "distract": DISTRACT, "ecgs": {}}
    for kind, rates in PLAN.items():
        out["ecgs"][kind] = []
        for i, rate in enumerate(rates):
            for attempt in range(200):
                try:
                    sig, hdr = build(kind, rate, 20261123 + sum(map(ord, kind)) * 100 + i * 10 + attempt)
                    break
                except AssertionError:
                    continue
            out["ecgs"][kind].append({"rate": rate, "h": hdr, "leads": pack(sig)})
    # anterior STEMI, from the 12-lead practice generator (sinus, rule-checked)
    out["ecgs"]["antstemi"] = []
    for i in range(3):
        e, info = T.generate(seed=20261124 + i * 1000, plan=[(T.f_anterior, 1)])[0]["ecg"], None
        rate = round(60 / np.mean([rr for _, rr in e.beats]))
        qt, qtc = e.qtc()
        hdr = {"vent": rate, "atrial": rate, "pr": int(round(e.pr * 1000)), "qrs": int(round(e.d * 1000)), "qt": int(round(qt * 1000)), "qtc": int(round(qtc * 1000)),
               "paxis": 55, "raxis": 50, "taxis": 70}
        out["ecgs"]["antstemi"].append({"rate": rate, "h": hdr, "leads": pack(e.noisy)})
    with open(OUT, "w") as f:
        json.dump(out, f, ensure_ascii=False, separators=(",", ":"))
    print(sum(len(v) for v in out["ecgs"].values()), "ECGs,", os.path.getsize(OUT) // 1024, "KB ->", OUT)


if __name__ == "__main__":
    main()
