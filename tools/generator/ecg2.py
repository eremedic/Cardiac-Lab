"""Paced-rhythm teaching strips + 50 practice strips with an answer manifest.

Rates in the answers are computed from the generated beat times, so the
interpretation always matches the picture.
"""
import json, os, random
import numpy as np, matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

FS, DUR = 1000, 6.0
t = np.arange(0, DUR, 1 / FS)
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "strips")
os.makedirs(OUT, exist_ok=True)


def g(c, a, w):
    return a * np.exp(-((t - c) ** 2) / (2 * w ** 2))


class S:
    def __init__(self, seed=0, noise=0.008, wander=0.03):
        self.r = np.random.default_rng(seed)
        self.y = wander * np.sin(2 * np.pi * 0.23 * t + self.r.uniform(0, 6)) + self.r.normal(0, noise, t.size)
        self.q, self.p, self.spk = [], [], []

    def P(self, c, a=0.2, w=0.022):
        if c < DUR + 0.1:
            self.y += g(c, a, w); self.p.append(c)

    def spike(self, c, a=0.95):
        self.y += g(c, a, 0.0012); self.spk.append(c)

    def tcp_art(self, c):
        self.y += g(c, 1.35, 0.006)
        m = t > c
        self.y[m] += -0.55 * np.exp(-(t[m] - c) / 0.05)
        self.spk.append(c)

    def Q(self, c, kind="n", amp=1.0):
        y = self.y
        if kind == "n":
            y += amp * (g(c - 0.022, -0.12, 0.008) + g(c, 1.1, 0.010) + g(c + 0.024, -0.28, 0.009) + g(c + 0.30, 0.28, 0.045))
        elif kind == "nq":  # narrow, no T separate (fast)
            y += g(c - 0.022, -0.1, 0.008) + g(c, 1.0, 0.01) + g(c + 0.024, -0.3, 0.009) + g(c + 0.2, 0.22, 0.035)
        elif kind == "w":
            y += amp * (g(c - 0.05, -0.15, 0.02) + g(c, 0.9, 0.026) + g(c + 0.06, -0.3, 0.024) + g(c + 0.36, -0.35, 0.06))
        elif kind == "p":  # ventricular paced (lead II: broad negative, upright T)
            y += g(c + 0.03, 0.12, 0.015) + g(c + 0.08, -0.95, 0.035) + g(c + 0.15, 0.1, 0.02) + g(c + 0.4, 0.38, 0.06)
        elif kind == "v":
            y += g(c + 0.05, 1.3, 0.035) + g(c + 0.13, -0.3, 0.03) + g(c + 0.38, -0.5, 0.07)
        elif kind == "v2":
            y += g(c + 0.05, -1.05, 0.035) + g(c + 0.13, 0.2, 0.03) + g(c + 0.36, 0.45, 0.07)
        elif kind == "tcp":
            y += g(c + 0.08, -1.0, 0.045) + g(c + 0.42, 0.55, 0.08)
        elif kind == "agonal":
            y += g(c, 0.45, 0.06) + g(c + 0.12, -0.25, 0.06) + g(c + 0.5, -0.15, 0.09)
        if c < DUR:
            self.q.append(c)


# ---------- rate helpers ----------
def inside(ts):
    return [x for x in sorted(ts) if 0 <= x < DUR]


def rate(ts, tol=0.06):
    ts = inside(ts)
    if len(ts) < 2:
        return None, False
    rr = np.diff(ts)
    reg = rr.max() - rr.min() <= tol
    return (round(60 / rr.mean()) if reg else len(ts) * 10), reg


def vr(st, tol=0.06):
    r, reg = rate(st.q, tol)
    if r is None:
        return "0 — no QRS complexes"
    return f"{r}/min" if reg else f"≈ {r}/min (6-second count)"


def ar(st):
    r, reg = rate(st.p)
    return f"{r}/min" if reg else f"≈ {r}/min"


# ---------- rhythm builders ----------
def sinus(rate_, pr=0.16, kind="n", seed=0, start=0.2, pamp=0.2):
    s = S(seed); pp = 60 / rate_
    for b in np.arange(start, DUR + 0.5, pp):
        s.P(b, pamp); s.Q(b + pr, kind)
    return s


def sinus_arrhythmia(seed=1):
    s = S(seed); b = 0.15
    i = 0
    while b < DUR + 0.3:
        s.P(b); s.Q(b + 0.16)
        b += 0.85 + 0.25 * np.sin(i * 0.9)
        i += 1
    return s


def with_pvcs(pattern, rr=0.8, couple=0.45, seed=2):
    """pattern string over beats: N normal, V pvc, W other-focus pvc."""
    s = S(seed); b = 0.15; i = 0; prev = None
    while b < DUR + 0.3:
        c = pattern[i % len(pattern)]
        if c == "N":
            s.P(b); s.Q(b + 0.16); nxt = rr
            if pattern[(i + 1) % len(pattern)] in "VW":
                nxt = couple
        else:
            s.Q(b + 0.16, "v" if c == "V" else "v2")
            nxt = couple if pattern[(i + 1) % len(pattern)] in "VW" else 2 * rr - couple
        b += nxt; i += 1
    return s


def sinus_pause(seed=3):
    s = S(seed)
    for b in [0.15, 0.97, 1.79, 4.25, 5.07, 5.89]:
        s.P(b); s.Q(b + 0.16)
    return s


def junctional(rate_, inv_p=True, seed=4):
    s = S(seed); rr = 60 / rate_
    for q in np.arange(0.4, DUR + 0.3, rr):
        if inv_p:
            s.y += g(q - 0.08, -0.14, 0.02)
        s.Q(q)
    return s


def idio(rate_, seed=5, kind="w"):
    s = S(seed); rr = 60 / rate_
    for q in np.arange(0.5, DUR + 0.3, rr):
        s.Q(q, kind)
    return s


def vf(amp=0.45, seed=6):
    s = S(seed, noise=0.01)
    r = np.random.default_rng(seed)
    for f, a in ((4.1, 1.0), (5.3, 0.75), (6.7, 0.5), (3.3, 0.55)):
        s.y += amp * a * np.sin(2 * np.pi * f * t + r.uniform(0, 6)) * (0.6 + 0.4 * np.sin(2 * np.pi * r.uniform(0.2, 0.5) * t))
    return s


def vt(rate_, seed=7):
    s = S(seed); f = rate_ / 60
    s.y += 0.15 + 0.7 * np.sin(2 * np.pi * f * t) + 0.2 * np.sin(2 * np.pi * 2 * f * t + 1)
    s.q = list(np.arange(0.25 / f, DUR, 1 / f))
    return s


def torsades(seed=8):
    s = S(seed); f = 4.0
    env = 0.25 + 0.85 * np.abs(np.sin(2 * np.pi * 0.3 * t))
    s.y += env * np.sin(2 * np.pi * f * t + 0.6 * np.sin(2 * np.pi * 0.5 * t))
    s.q = list(np.arange(0.06, DUR, 1 / f))
    return s


def asystole(seed=9):
    s = S(seed, noise=0.004, wander=0.04)
    return s


def p_asystole(seed=10):
    s = S(seed, noise=0.005)
    for b in np.arange(0.3, DUR, 0.8):
        s.P(b)
    return s


def cpr_artifact(seed=11):
    s = S(seed, noise=0.015)
    f = 1.85
    ph = (t * f) % 1.0
    s.y += 0.55 * np.exp(-((ph - 0.3) ** 2) / (2 * 0.08 ** 2)) - 0.25 * np.exp(-((ph - 0.6) ** 2) / (2 * 0.1 ** 2))
    return s


def vt_to_vf(seed=12):
    s = S(seed, noise=0.01); f = 3.0
    vtw = 0.15 + 0.7 * np.sin(2 * np.pi * f * t)
    v = vf(0.45, seed + 1).y
    ramp = np.clip((t - 2.6) / 0.8, 0, 1)
    s.y += vtw * (1 - ramp) + v * ramp
    s.q = list(np.arange(1 / 12, 2.8, 1 / f))
    return s


def avb1(rate_, pr, seed=13):
    return sinus(rate_, pr=pr, seed=seed, start=0.1)


def wenck(n, pp=0.7, prs=None, seed=14):
    s = S(seed)
    base = [0.18, 0.28, 0.34, 0.38, 0.41][: n - 1]
    i = 0
    for b in np.arange(0.1, DUR + 0.3, pp):
        k = i % n
        s.P(b)
        if k < n - 1:
            s.Q(b + base[k])
        i += 1
    return s


def mobitz2(n, pp=0.68, kind="w", seed=15):
    s = S(seed); i = 0
    for b in np.arange(0.1, DUR + 0.3, pp):
        s.P(b)
        if i % n != n - 1:
            s.Q(b + 0.18, kind)
        i += 1
    return s


def block_ratio(ratio, pp, kind, seed=16):
    s = S(seed); i = 0
    for b in np.arange(0.1, DUR + 0.3, pp):
        s.P(b)
        if i % ratio == 0:
            s.Q(b + 0.2, kind)
        i += 1
    return s


def chb(p_rate, v_rate, kind="w", seed=17, q0=0.55):
    s = S(seed)
    for b in np.arange(0.15, DUR + 0.2, 60 / p_rate):
        s.P(b)
    for q in np.arange(q0, DUR + 0.3, 60 / v_rate):
        s.Q(q, kind)
    return s


# ---- paced ----
def a_paced(rate_, seed=20):
    s = S(seed); pp = 60 / rate_
    for b in np.arange(0.2, DUR + 0.3, pp):
        s.spike(b, 0.8); s.P(b + 0.04, 0.18); s.Q(b + 0.22)
    return s


def v_paced(rate_, seed=21):
    s = S(seed); rr = 60 / rate_
    for b in np.arange(0.3, DUR + 0.3, rr):
        s.spike(b); s.Q(b, "p")
    return s


def ddd(rate_, seed=22):
    s = S(seed); pp = 60 / rate_
    for b in np.arange(0.15, DUR + 0.3, pp):
        s.spike(b, 0.75); s.P(b + 0.04, 0.16); s.spike(b + 0.18); s.Q(b + 0.18, "p")
    return s


def vdd(rate_, seed=23):
    s = S(seed); pp = 60 / rate_
    for b in np.arange(0.15, DUR + 0.3, pp):
        s.P(b); s.spike(b + 0.16); s.Q(b + 0.16, "p")
    return s


def vvi_demand(seed=24):
    s = S(seed)
    for b in [0.1, 1.15, 2.2]:
        s.P(b); s.Q(b + 0.16)
    for c in np.arange(2.36 + 1.0, DUR + 0.3, 1.0):
        s.spike(c); s.Q(c, "p")
    return s


def fail_capture(rate_=72, pattern=(1, 1, 0, 1, 0, 0, 1, 1), seed=25):
    s = S(seed); rr = 60 / rate_
    for i, c in enumerate(np.arange(0.3, DUR, rr)):
        s.spike(c)
        if pattern[i % len(pattern)]:
            s.Q(c, "p")
    return s


def fail_capture_asystole(rate_=70, seed=26):
    s = S(seed, noise=0.005)
    for c in np.arange(0.3, DUR, 60 / rate_):
        s.spike(c)
    return s


def undersense(seed=27):
    s = S(seed)
    events = []
    for b in np.arange(0.15, DUR + 0.3, 0.75):
        events.append((b + 0.16, "intr", b))
    for c in np.arange(0.62, DUR, 1.0):
        events.append((c, "spk", c))
    events.sort()
    last = -9
    for tm, kind, b in events:
        if kind == "intr":
            s.P(b)
            if tm - last > 0.4:
                s.Q(tm); last = tm
        else:
            s.spike(tm)
            if tm - last > 0.4:
                s.Q(tm, "p"); last = tm
    return s


def oversense(seed=28):
    s = S(seed)
    for c in [0.3, 1.15, 2.0]:
        s.spike(c); s.Q(c, "p")
    for c in [4.6, 5.45]:
        s.spike(c); s.Q(c, "p")
    return s


def tcp_capture(rate_=70, seed=29):
    s = S(seed, noise=0.012)
    for c in np.arange(0.3, DUR, 60 / rate_):
        s.tcp_art(c); s.Q(c, "tcp")
    for b in np.arange(0.5, DUR, 0.75):  # dissociated P waves continue underneath
        s.P(b, 0.14)
    s.p = []
    return s


def tcp_nocapture(seed=30):
    s = S(seed, noise=0.012)
    for b in np.arange(0.15, DUR + 0.2, 0.75):
        s.P(b)
    for q in np.arange(1.1, DUR + 0.3, 2.0):
        s.Q(q, "w")
    s.q = inside(s.q)
    escape_q = list(s.q)
    for c in np.arange(0.4, DUR, 60 / 70):
        s.tcp_art(c)
    s.q = escape_q
    return s


# ---------- draw ----------
def draw(name, y):
    fig = plt.figure(figsize=(12, 1.92), dpi=200)
    ax = fig.add_axes([0, 0, 1, 1])
    ax.set_xlim(0, DUR); ax.set_ylim(-0.9, 1.5)
    for x in np.arange(0, DUR + 0.001, 0.04):
        major = abs((x / 0.2) - round(x / 0.2)) < 1e-6
        ax.axvline(x, color="#E7A1AD" if major else "#F8DCE1", lw=1.0 if major else 0.5, zorder=0)
    for v in np.arange(-0.9, 1.501, 0.1):
        major = abs((v / 0.5) - round(v / 0.5)) < 1e-6
        ax.axhline(v, color="#E7A1AD" if major else "#F8DCE1", lw=1.0 if major else 0.5, zorder=0)
    ax.set_facecolor("#FFF7F8")
    ax.plot(t, np.clip(y, -0.88, 1.48), color="#1B1F2A", lw=1.5, zorder=2)
    ax.axis("off")
    fig.savefig(os.path.join(OUT, name + ".png"), facecolor="#FFF7F8")
    plt.close(fig)


# ---------- teaching strips for the paced section ----------
TEACH = {
    "pace_a": a_paced(70), "pace_v": v_paced(70), "pace_ddd": ddd(70),
    "pace_ftc": fail_capture(), "pace_fts": undersense(), "pace_ftp": oversense(), "pace_tcp": tcp_capture(70),
}

# ---------- 50 practice strips ----------
NARROW = "Narrow (≈ 0.08 s)"
WIDE = "Wide (≥ 0.12 s)"


def item(st, name, stem, rhythm, p, pr, qrs, action, rate_txt=None, spikes=None):
    rows = [["Rate", rate_txt or vr(st)], ["Rhythm", rhythm], ["P waves", p], ["PR interval", pr], ["QRS", qrs]]
    if spikes:
        rows.append(["Pacer spikes", spikes])
    return {"st": st, "name": name, "stem": stem, "rows": rows, "action": action}


def build_practice():
    L = []
    s = sinus(75); L.append(item(s, "Normal sinus rhythm", "58-year-old, dizzy after standing; now feels well.", "Regular", "Upright, one before each QRS", "0.16 s", NARROW, ["Normal rhythm — look for a non-cardiac cause of the dizziness", "Orthostatic vitals, glucose, history"]))
    s = sinus(48, seed=31); L.append(item(s, "Sinus bradycardia", "Fit 30-year-old runner, routine monitoring.", "Regular", "Upright, one before each QRS", "0.16 s", NARROW, ["Asymptomatic: no treatment", "If symptomatic: atropine 1 mg IV, then pacing / infusion"]))
    s = sinus(125, pr=0.14, kind="nq", seed=32); L.append(item(s, "Sinus tachycardia", "Febrile 70-year-old, BP 96/60.", "Regular", "Upright, one before each QRS", "0.14 s", NARROW, ["A response, not a primary problem — treat the cause", "Fever, sepsis, hypovolemia, pain, hypoxia"]))
    s = sinus_arrhythmia(); L.append(item(s, "Sinus arrhythmia", "Healthy 19-year-old; rate varies with breathing.", "Irregular — cyclic with respiration", "Upright, identical, one before each QRS", "0.16 s, constant", NARROW, ["Normal variant, common in the young", "No treatment"]))
    s = with_pvcs("NNNVNNN", seed=33); L.append(item(s, "Sinus rhythm with a unifocal PVC", "62-year-old with palpitations.", "Regular except for one early beat", "Absent before the early wide beat", "0.16 s on sinus beats", "Narrow; the PVC is wide and bizarre", ["Isolated PVCs: treat the patient, not the ectopy", "Check K⁺/Mg²⁺ risk, ischemia, hypoxia"]))
    s = with_pvcs("NV", rr=0.82, couple=0.46, seed=34); L.append(item(s, "Sinus rhythm with ventricular bigeminy", "74-year-old with chest tightness.", "Regularly irregular — every other beat early", "Before sinus beats only", "0.16 s on sinus beats", "Alternating narrow and wide", ["Consider ischemia, electrolytes, digoxin", "12-lead ECG; monitor for runs of VT"]))
    s = with_pvcs("NNNVVNN", seed=35); L.append(item(s, "Sinus rhythm with a PVC couplet", "55-year-old, post-MI, feels 'skipped beats'.", "Irregular at the couplet", "Before sinus beats only", "0.16 s on sinus beats", "Narrow; two consecutive wide PVCs", ["Couplets suggest an irritable ventricle", "Monitor closely; 12-lead; treat ischemia"]))
    s = sinus_pause(); L.append(item(s, "Sinus rhythm with sinus arrest (pause)", "80-year-old with a near-syncope episode.", "Regular, interrupted by a 2.5-second pause", "Upright; none during the pause", "0.16 s", NARROW, ["Symptomatic pauses suggest sick sinus syndrome", "Pads on; atropine / pacing if symptomatic"]))
    s = junctional(48); L.append(item(s, "Junctional rhythm", "67-year-old on a beta-blocker, BP 100/64.", "Regular", "Inverted, just before the QRS", "Short (< 0.12 s)", NARROW, ["Junctional escape (40–60/min)", "Treat as bradycardia if symptomatic; review medications"]))
    s = junctional(82, inv_p=False, seed=36); L.append(item(s, "Accelerated junctional rhythm", "Patient taking digoxin, nauseated.", "Regular", "Not visible", "Not measurable", NARROW, ["Rate 60–100 from the junction", "Consider digoxin toxicity; monitor"]))
    s = idio(35); L.append(item(s, "Idioventricular rhythm", "Unresponsive 82-year-old; weak carotid pulse, BP 70/40.", "Regular", "None", "None", WIDE, ["Ventricular escape — the heart's last back-up", "Do NOT suppress with antiarrhythmics; pace / support perfusion"]))
    s = idio(68, seed=37); L.append(item(s, "Accelerated idioventricular rhythm (AIVR)", "Occurs 10 min after successful reperfusion in a STEMI patient.", "Regular", "None", "None", WIDE, ["Classic reperfusion rhythm; usually transient", "Do not treat with antiarrhythmics if perfusing"]))
    s = vf(0.45, 38); L.append(item(s, "Coarse ventricular fibrillation", "Witnessed collapse in a shopping centre; pulseless.", "Chaotic", "None", "None", "No identifiable QRS", ["Shock immediately, resume CPR 2 min", "Epinephrine after initial shocks fail; amiodarone / lidocaine"], rate_txt="Not measurable"))
    s = vf(0.14, 39); L.append(item(s, "Fine ventricular fibrillation", "Unwitnessed arrest, ~10 min down-time; CPR in progress.", "Chaotic, low amplitude", "None", "None", "No identifiable QRS", ["Still shockable — defibrillate", "Confirm it isn't asystole: check leads and gain"], rate_txt="Not measurable"))
    s = vt(170, 40); L.append(item(s, "Monomorphic ventricular tachycardia", "Pulseless 59-year-old, CPR started by bystander.", "Regular", "Not seen", "None", "Wide, uniform", ["Pulseless VT = shock (defibrillation dose)", "With a pulse and unstable: synchronized 100 J"]))
    s = vt(210, 41); L.append(item(s, "Ventricular tachycardia (rapid)", "Patient pale, diaphoretic, BP 70 systolic — has a pulse.", "Regular", "Not seen", "None", "Wide, uniform", ["Unstable VT with a pulse: synchronized cardioversion 100 J", "Sedate if time allows; amiodarone after"]))
    s = torsades(); L.append(item(s, "Polymorphic VT — torsades de pointes", "On methadone, long QT history; collapses.", "Irregular", "None", "None", "Wide, twisting around the baseline", ["Pulseless: defibrillate (unsynchronized)", "Magnesium sulfate 1–2 g IV/IO"], rate_txt="≈ 240/min"))
    s = asystole(); L.append(item(s, "Asystole", "Found unresponsive, cool to touch; CPR started.", "None", "None", "None", "None", ["Confirm in 2 leads; check leads and gain", "CPR + epinephrine ASAP; consider TOR criteria"], rate_txt="0 — no electrical activity"))
    s = p_asystole(); L.append(item(s, "P-wave asystole (ventricular standstill)", "Pulseless; monitor shows only small bumps.", "P–P regular; no QRS", "Present, no QRS follows", "None", "None", ["Treat as asystole: CPR, epinephrine", "Pacing is not recommended in arrest"], rate_txt=f"Atrial {ar(s)}; ventricular 0"))
    s = sinus(92, seed=42); L.append(item(s, "Pulseless electrical activity (PEA)", "Monitor shows this — but NO carotid or femoral pulse.", "Regular", "Upright, one before each QRS", "0.16 s", NARROW, ["Organized rhythm + no pulse = PEA", "CPR, epinephrine ASAP, hunt H's & T's (narrow + fast → mechanical cause)"]))
    s = idio(18, 43, kind="agonal"); L.append(item(s, "Agonal rhythm", "Arrest, 25 min of resuscitation, no ROSC.", "Irregular / very slow", "None", "None", "Very wide, low amplitude", ["Dying heart — treat as PEA if pulseless", "Often a terminal rhythm; consider TOR with medical direction"], rate_txt="< 20/min"))
    s = cpr_artifact(); L.append(item(s, "CPR artifact", "Recorded while compressions are ongoing.", "Regular, matches compression rate", "None", "None", "Not cardiac — artifact", ["You cannot interpret a rhythm during compressions", "Analyze during the planned 2-minute pause (< 10 s)"], rate_txt="≈ 110/min (compressions)"))
    s = vt_to_vf(); L.append(item(s, "VT degenerating into VF", "Patient with a pulse loses consciousness during the strip.", "Regular, then chaotic", "None", "None", "Wide, then no identifiable QRS", ["Now pulseless and shockable: defibrillate", "Begin VF/pVT algorithm"], rate_txt="VT ≈ 180/min → VF"))
    s = avb1(65, 0.28); L.append(item(s, "Sinus rhythm with 1st-degree AV block", "72-year-old on diltiazem, routine transport.", "Regular", "Upright, one before each QRS", "0.28 s, constant", NARROW, ["Benign conduction delay; monitor", "Note AV-nodal blocking medications"]))
    s = avb1(50, 0.30, seed=44); L.append(item(s, "Sinus bradycardia with 1st-degree AV block", "Inferior STEMI patient, alert, BP 118/70.", "Regular", "Upright, one before each QRS", "0.30 s, constant", NARROW, ["Watch for progression in inferior MI", "Atropine only if symptomatic"]))
    s = wenck(3, 0.92, seed=45); L.append(item(s, "2nd-degree AV block type I (Wenckebach), 3:2", "Inferior MI, mildly lightheaded.", "Regularly irregular — grouped beats", f"Atrial {ar(s)}; some not conducted", "0.18 → 0.28 s, then dropped beat", NARROW, ["Usually nodal, often transient", "Atropine if symptomatic"]))
    s = wenck(4, 0.84, seed=46); L.append(item(s, "2nd-degree AV block type I (Wenckebach), 4:3", "Athlete at rest, asymptomatic.", "Regularly irregular — grouped beats", f"Atrial {ar(s)}; every 4th not conducted", "Lengthens 0.18 → 0.34 s, then drop", NARROW, ["Benign in athletes / high vagal tone", "Monitor only"]))
    s = wenck(5, 0.76, seed=47); L.append(item(s, "2nd-degree AV block type I (Wenckebach), 5:4", "Elderly patient on digoxin.", "Regularly irregular — grouped beats", f"Atrial {ar(s)}; every 5th not conducted", "Progressively lengthens, then drop", NARROW, ["Look for digoxin toxicity", "Monitor; treat if symptomatic"]))
    s = mobitz2(3, 0.68, seed=48); L.append(item(s, "2nd-degree AV block type II (Mobitz II), 3:2", "Anterior MI, BP 84/50, confused.", "Irregular", f"Atrial {ar(s)}; some not conducted", "0.18 s, constant", WIDE, ["Unstable — pads on, transcutaneous pacing", "Atropine unlikely to work; don't delay pacing"]))
    s = mobitz2(4, 0.7, seed=49); L.append(item(s, "2nd-degree AV block type II (Mobitz II), 4:3", "Syncope at home; now alert.", "Irregular", f"Atrial {ar(s)}; every 4th not conducted", "0.18 s, constant", WIDE, ["High risk of complete block", "Pads on, prepare to pace, transport to PCI/cardiac centre"]))
    s = block_ratio(2, 0.7, "n", 50); L.append(item(s, "2nd-degree AV block, 2:1 conduction (narrow)", "Weak and dizzy, BP 98/60.", "Regular", f"Atrial {ar(s)}; 2 P waves per QRS", "0.20 s, constant on conducted beats", NARROW, ["Type can't be determined from 2:1 alone", "Narrow QRS → likely nodal; atropine may help"]))
    s = block_ratio(2, 0.72, "w", 51); L.append(item(s, "2nd-degree AV block, 2:1 conduction (wide)", "Fatigue and dyspnea, BP 88/52.", "Regular", f"Atrial {ar(s)}; 2 P waves per QRS", "0.20 s, constant on conducted beats", WIDE, ["Wide QRS → likely infranodal (behaves like Mobitz II)", "Pads on; pacing if unstable"]))
    s = block_ratio(3, 0.6, "w", 52); L.append(item(s, "Advanced (high-grade) AV block, 3:1", "Syncope, HR in the 30s, BP 76/40.", "Regular", f"Atrial {ar(s)}; 3 P waves per QRS", "0.20 s, constant on conducted beats", WIDE, ["High-grade block — treat like complete heart block", "Transcutaneous pacing; epinephrine / dopamine bridge"]))
    s = chb(85, 34, "w", 53); L.append(item(s, "3rd-degree (complete) AV block, ventricular escape", "Grey, diaphoretic 78-year-old, BP 70/40.", "Regular (R–R); P–P also regular", f"Atrial {ar(s)}; unrelated to QRS", "None — varies (AV dissociation)", WIDE, ["Unstable: transcutaneous pacing now", "Infusion bridge: epinephrine 2–10 mcg/min or dopamine"]))
    s = chb(80, 45, "n", 54, q0=0.35); L.append(item(s, "3rd-degree (complete) AV block, junctional escape", "Inferior MI, alert, BP 104/66.", "Regular (R–R); P–P also regular", f"Atrial {ar(s)}; unrelated to QRS", "None — varies (AV dissociation)", NARROW, ["Junctional escape is more stable", "Pads on; atropine may be tried; pace if unstable"]))
    s = chb(100, 30, "w", 55, q0=0.8); L.append(item(s, "3rd-degree (complete) AV block, slow ventricular escape", "Found on floor, GCS 11, BP 64 palpable.", "Regular (R–R); P–P also regular", f"Atrial {ar(s)}; unrelated to QRS", "None — varies (AV dissociation)", WIDE, ["Peri-arrest: pace immediately", "Prepare for arrest; consider hyperkalemia / drug toxicity"]))
    s = a_paced(70, 56); L.append(item(s, "Atrial paced rhythm", "Patient has a pacemaker for sick sinus syndrome.", "Regular", "Each P preceded by a pacer spike", "0.18 s", NARROW, ["Normal atrial pacing — device working", "Ask for device card; note rate"], spikes="Atrial — before each P wave"))
    s = v_paced(70, 57); L.append(item(s, "Ventricular paced rhythm (100% capture)", "History of complete heart block; feels well.", "Regular", "Not seen", "None", "Wide, after each spike", ["Normal ventricular pacing", "Wide paced QRS hides STEMI — use clinical picture / Sgarbossa"], spikes="Ventricular — before each QRS"))
    s = ddd(72, 58); L.append(item(s, "AV sequential (dual-chamber) paced rhythm", "Dual-chamber pacemaker, routine transport.", "Regular", "Paced P after each atrial spike", "AV delay ≈ 0.18 s (spike to spike)", "Wide, after ventricular spike", ["Both chambers paced and captured", "Normal function"], spikes="Two per beat — atrial and ventricular"))
    s = vdd(88, 59); L.append(item(s, "Atrial-sensed, ventricular paced rhythm", "Pacemaker patient walking briskly — rate rises.", "Regular", "Native sinus P waves", "≈ 0.16 s (P to V spike)", "Wide, after each ventricular spike", ["Device tracks the sinus rate (DDD/VDD)", "Normal function"], spikes="Ventricular only, after each P"))
    s = vvi_demand(); L.append(item(s, "Sinus rhythm with demand (VVI) ventricular pacing", "Sinus rate slows; pacemaker takes over.", "Irregular at the transition", "Present on the first 3 beats only", "0.16 s on native beats", "Narrow native, then wide paced", ["Demand pacing: fires only when the native rate falls", "Normal sensing and capture"], spikes="Ventricular, only after the pause"))
    s = fail_capture(); L.append(item(s, "Ventricular pacing with failure to capture", "Pacemaker patient, presyncope, BP 86/50.", "Irregular (ventricular)", "Not seen", "None", "Wide when captured; absent after some spikes", ["Malfunction: lead displacement, battery, high threshold, hyperkalemia", "Transcutaneous pacing if unstable; transport"], spikes="Regular — not all followed by QRS"))
    s = fail_capture_asystole(); L.append(item(s, "Pacemaker spikes with no capture (underlying asystole)", "Pacemaker patient, unresponsive and pulseless.", "Spikes regular; no QRS", "None", "None", "None", ["This is cardiac arrest: start CPR", "Treat as asystole; place pads ≥ 8 cm from the device"], rate_txt="0 — spikes only", spikes="Regular, no capture"))
    s = undersense(); L.append(item(s, "Pacemaker failure to sense (undersensing)", "Pacemaker patient with palpitations.", "Irregular", "Native P waves present", "0.16 s on native beats", "Mostly narrow native; some paced", ["Spikes fire regardless of native beats — risk of R-on-T", "Monitor, transport; ensure pads are ready"], spikes="Fixed rate, some land on QRS/T"))
    s = oversense(); L.append(item(s, "Pacemaker failure to pace (oversensing)", "Pacemaker patient with a syncopal episode.", "Irregular — long pause", "None", "None", "Wide paced beats", ["Device sensed 'noise' and withheld pacing → pause", "Pads on; TCP if pauses recur or unstable"], spikes="Absent during a 2.6-second pause"))
    s = tcp_capture(70, 60); L.append(item(s, "Transcutaneous pacing with electrical capture", "You are pacing a patient in complete heart block.", "Regular", "Obscured by artifact", "None", "Wide, with large T wave after each spike", ["Electrical capture confirmed — now check a FEMORAL pulse", "Give analgesia / sedation"], spikes="Large pacing artifacts at the set rate"))
    s = tcp_nocapture(); L.append(item(s, "Transcutaneous pacing WITHOUT capture", "Pacing at 70/min, 40 mA; patient remains hypotensive.", "Pacer spikes regular; slow escape beats unrelated", f"Atrial {ar(s)}", "None", "Wide escape beats only", ["Increase mA until each spike is followed by a wide QRS", "Check pad position (anterior–posterior)"], rate_txt=f"Ventricular {vr(s)} (escape); pacer 70/min", spikes="Large artifacts not followed by QRS"))
    s = sinus(140, pr=0.12, kind="nq", seed=61); L.append(item(s, "Sinus tachycardia", "Trauma patient, pale, BP 88/60.", "Regular", "Upright, close to the preceding T", "0.12 s", NARROW, ["Compensating for hypovolemia — don't slow it down", "Hemorrhage control, fluids/blood, rapid transport"]))
    s = with_pvcs("NNV", rr=0.85, couple=0.48, seed=62); L.append(item(s, "Sinus rhythm with ventricular trigeminy", "COPD patient with hypokalemia.", "Regularly irregular — every 3rd beat early", "Before sinus beats only", "0.16 s on sinus beats", "Two narrow, then one wide", ["Correct the cause: K⁺, hypoxia, ischemia", "Monitor"]))
    s = with_pvcs("NNVNNNWN", rr=0.78, couple=0.46, seed=63); L.append(item(s, "Sinus rhythm with multifocal PVCs", "Septic patient, SpO₂ 86%.", "Irregular", "Before sinus beats only", "0.16 s on sinus beats", "Narrow; PVCs of two different shapes", ["Multifocal = irritable myocardium", "Fix hypoxia, check electrolytes, 12-lead"]))
    assert len(L) == 50, len(L)
    return L


if __name__ == "__main__":
    for k, st in TEACH.items():
        draw(k, st.y)
    L = build_practice()
    order = list(range(50))
    random.Random(2025).shuffle(order)
    manifest = []
    for n, idx in enumerate(order, 1):
        it = L[idx]
        fname = f"practice_{n:02d}"
        draw(fname, it["st"].y)
        manifest.append({"n": n, "file": fname, "name": it["name"], "stem": it["stem"], "rows": it["rows"], "action": it["action"]})
    with open(os.path.join(HERE, "practice.json"), "w") as f:
        json.dump(manifest, f, ensure_ascii=False, indent=1)
    print("ok", len(manifest))
