"""Practice areas: 50 unique strips in each of six rhythm families.

Every strip is generated with its own random morphology (P, QRS and T shape and size,
noise, baseline wander), rate and intervals, then checked against the rules of the
rhythm it illustrates. A strip that breaks a rule is discarded and regenerated.

    python3 tools/generator/build_areas.py
"""
import hashlib
import numpy as np
import ecg2 as E
from practice_set import CAT

t, DUR, g = E.t, E.DUR, E.g
FS = E.FS


class Retry(Exception):
    pass


def need(cond, why):
    if not cond:
        raise Retry(why)


def inside(ts):
    return [x for x in sorted(ts) if 0 <= x < DUR]


# ------------------------------------------------------------------ morphology
class Strip:
    """One 6-second lead II strip with randomized morphology and an event log."""

    def __init__(self, rng, noise=None, wander=None):
        self.r = rng
        nz = rng.uniform(0.004, 0.012) if noise is None else noise
        wa = rng.uniform(0.0, 0.055) if wander is None else wander
        self.y = wa * np.sin(2 * np.pi * rng.uniform(0.12, 0.35) * t + rng.uniform(0, 6.3)) + rng.normal(0, nz, t.size)
        self.q, self.p, self.spk = [], [], []
        self.pairs = []          # (p_time, qrs_time) for conducted beats
        self.blocked = []        # P waves not followed by a QRS
        self.wq = []             # wide (ventricular-origin) QRS times, for the on-strip teaching marks
        # sinus P
        self.pa = rng.uniform(0.11, 0.24)
        self.pw = rng.uniform(0.018, 0.027)
        self.pbifid = rng.random() < 0.15
        # narrow QRS
        self.k = rng.uniform(0.85, 1.18)
        self.qd = rng.uniform(0.04, 0.17)
        self.ra = rng.uniform(0.75, 1.3)
        self.sd = rng.uniform(0.12, 0.38)
        self.ta = rng.uniform(0.14, 0.38) * (1 if rng.random() > 0.08 else 0.35)
        self.tw = rng.uniform(0.036, 0.056)

    # duration of a narrow QRS in seconds (onset to end)
    @property
    def qrs_d(self):
        return 0.08 * self.k

    def onset(self, c):
        return c - 0.038 * self.k

    def P(self, c, amp=None, w=None, inverted=False):
        a = self.pa if amp is None else amp
        w = self.pw if w is None else w
        if inverted:
            a = -abs(a)
        if self.pbifid and amp is None and not inverted:
            self.y += g(c - w * 0.55, a * 0.85, w * 0.7) + g(c + w * 0.55, a * 0.85, w * 0.7)
        else:
            self.y += g(c, a, w)
        if 0 <= c < DUR:
            self.p.append(c)

    def p_for_pr(self, qrs_c, pr, w=None):
        """Center of a P wave whose onset is `pr` seconds before the QRS onset."""
        w = self.pw if w is None else w
        return self.onset(qrs_c) - pr + 2 * w

    def T(self, c, rr, amp=None):
        qt = float(np.clip(0.4 * np.sqrt(max(rr, 0.25)), 0.25, 0.44))
        tc = self.onset(c) + qt - 2 * self.tw
        self.y += g(tc, self.ta if amp is None else amp, self.tw)

    def N(self, c, rr, t_amp=None, record=True):
        """Narrow QRS + T."""
        k = self.k
        self.y += g(c - 0.022 * k, -self.qd, 0.008 * k) + g(c, self.ra, 0.010 * k) + g(c + 0.024 * k, -self.sd, 0.009 * k)
        self.T(c, rr, t_amp)
        if record and 0 <= c < DUR:
            self.q.append(c)

    def wide_tmpl(self, pol=None, d=None):
        r = self.r
        return {"pol": pol if pol is not None else (1 if r.random() < 0.6 else -1), "amp": r.uniform(0.75, 1.3),
                "d": d if d is not None else r.uniform(0.13, 0.2), "ta": r.uniform(0.25, 0.5), "tg": r.uniform(0.17, 0.26),
                "tw": r.uniform(0.055, 0.08)}

    def W(self, c, tm, record=True, t_scale=1.0):
        """Wide QRS (ventricular origin) with discordant T."""
        d, pol, a = tm["d"], tm["pol"], tm["amp"]
        if pol > 0:
            self.y += g(c, a, d / 5) + g(c + d * 0.45, -0.25 * a, d / 6)
        else:
            self.y += g(c, -a, d / 5) + g(c - d * 0.42, 0.12, d / 8)
        self.y += g(c + d / 2 + tm["tg"], -pol * tm["ta"] * t_scale, tm["tw"])
        if record and 0 <= c < DUR:
            self.q.append(c)
            self.wq.append(c)

    def spike(self, c, a):
        if 0 <= c < DUR:
            self.spk.append((c, a))

    def tcp(self, c):
        m = t > c
        self.y[m] += -0.5 * np.exp(-(t[m] - c) / 0.05)
        self.spike(c, 1.35)

    def conducted(self, pc, qc):
        self.pairs.append((pc, qc))


def rr_stats(qs):
    qs = inside(qs)
    if len(qs) < 2:
        return None
    rr = np.diff(qs)
    return {"mean": rr.mean(), "min": rr.min(), "max": rr.max(), "n": len(qs), "rr": rr}


def rate_text(qs, tol=0.06):
    st = rr_stats(qs)
    if not st:
        return "0", None, False
    reg = st["max"] - st["min"] <= tol
    r = round(60 / st["mean"]) if reg else st["n"] * 10
    return (f"{r}/min" if reg else f"≈ {r}/min (6-second count)"), r, reg


def sec(x):
    return f"{x:.2f} s"


def qrs_txt(d):
    return f"{'Narrow' if d < 0.12 else 'Wide'} ({d:.2f} s)"


def regular_rate(qs):
    st = rr_stats(qs)
    need(st is not None, "too few beats")
    return 60 / st["mean"], st


# ------------------------------------------------------------------ builders
# Each returns (strip, info) where info has name/rhythm/p/pr/qrs/action and optional rate/spikes.

def sinus_train(s, start, rr_list, pr):
    """Places sinus beats; rr_list are successive R-R intervals."""
    q = start
    prev_rr = rr_list[0]
    for rr in rr_list:
        pc = s.p_for_pr(q, pr)
        s.P(pc); s.N(q, prev_rr); s.conducted(pc, q)
        prev_rr = rr
        q += rr
        if q > DUR + 0.6:
            break


def rr_seq(rr, n=20):
    return [rr] * n


def b_nsr(r):
    s = Strip(r); rate = r.uniform(62, 98); pr = r.uniform(0.13, 0.19)
    sinus_train(s, r.uniform(0.15, 0.55), rr_seq(60 / rate), pr)
    hr, st = regular_rate(s.q); need(60 <= hr <= 100, "rate")
    return s, dict(cat="Normal sinus rhythm", rhythm="Regular", p="Upright, one before each QRS", pr=sec(pr) + ", constant",
                   qrs=qrs_txt(s.qrs_d), action=["Normal rhythm: assess the patient, not just the monitor", "Vitals, glucose, history"])


def b_brady(r):
    s = Strip(r); rate = r.uniform(34, 57); pr = r.uniform(0.13, 0.2)
    sinus_train(s, r.uniform(0.2, 0.9), rr_seq(60 / rate), pr)
    hr, st = regular_rate(s.q); need(hr < 60 and st["n"] >= 3, "rate")
    return s, dict(cat="Sinus bradycardia", rhythm="Regular", p="Upright, one before each QRS", pr=sec(pr) + ", constant",
                   qrs=qrs_txt(s.qrs_d), action=["Asymptomatic: no treatment", "Symptomatic: atropine 1 mg IV; pacing or infusion if it fails"])


def b_tach(r):
    s = Strip(r); rate = r.uniform(104, 150); pr = r.uniform(0.11, 0.16)
    s.ta = r.uniform(0.12, 0.26)
    sinus_train(s, r.uniform(0.12, 0.4), rr_seq(60 / rate), pr)
    hr, st = regular_rate(s.q); need(100 < hr <= 150, "rate")
    return s, dict(cat="Sinus tachycardia", rhythm="Regular", p="Upright, one before each QRS", pr=sec(pr) + ", constant",
                   qrs=qrs_txt(s.qrs_d), action=["A response: find and treat the cause (pain, fever, hypovolemia, hypoxia)", "Don't try to slow it down"])


def b_sinus_arr(r):
    s = Strip(r); base = r.uniform(0.75, 1.05); depth = r.uniform(0.14, 0.26); ph = r.uniform(0, 6.3); per = r.uniform(3.2, 5.0)
    pr = r.uniform(0.13, 0.19)
    q = r.uniform(0.15, 0.5); rrs = []
    while q < DUR + 0.6:
        rr = base + depth * np.sin(2 * np.pi * q / per + ph)
        rrs.append(rr); q += rr
    sinus_train(s, r.uniform(0.15, 0.5), rrs, pr)
    st = rr_stats(s.q); need(st and st["max"] - st["min"] >= 0.16 and 50 <= 60 / st["mean"] <= 100, "variation")
    return s, dict(cat="Sinus arrhythmia", rhythm="Irregular in a smooth cycle (R–R varies by ≥ 0.16 s)", p="Upright and identical, one before each QRS",
                   pr=sec(pr) + ", constant", qrs=qrs_txt(s.qrs_d), action=["Normal variant, especially in young people", "No treatment"])


def b_sinus_pause(r, exit_block=False):
    s = Strip(r); rate = r.uniform(62, 90); pp = 60 / rate; pr = r.uniform(0.13, 0.19)
    q = r.uniform(0.15, 0.45); drop_after = int(r.integers(1, 3)); i = 0; rr_prev = pp
    pause = 2 * pp if exit_block else None
    if not exit_block:
        for _ in range(50):
            pause = r.uniform(1.9, 2.9)
            if abs(pause / pp - round(pause / pp)) > 0.25:
                break
    pause_start = None
    while q < DUR + 0.6:
        pc = s.p_for_pr(q, pr); s.P(pc); s.N(q, rr_prev); s.conducted(pc, q)
        if i == drop_after:
            pause_start = q; q += pause; rr_prev = pause
        else:
            q += pp; rr_prev = pp
        i += 1
    need(pause_start is not None and pause_start + pause < DUR - 0.2, "pause visible")
    if exit_block:
        need(abs(pause - 2 * pp) < 0.01, "exit block multiple")
        return s, dict(cat="Sinoatrial (SA) exit block", rhythm="Regular, with one dropped P–QRS–T", p="Upright; one cycle missing",
                       pr=sec(pr) + ", constant", qrs=qrs_txt(s.qrs_d), rate_note=f"Underlying {round(rate)}/min",
                       action=[f"The pause ({pause:.2f} s) is exactly two P–P intervals ({pp:.2f} s each)", "Monitor; treat as bradycardia if symptomatic"])
    need(abs(pause / pp - round(pause / pp)) > 0.25, "arrest not multiple")
    return s, dict(cat="Sinus arrest (pause)", rhythm="Regular, interrupted by a pause", p="Upright; none during the pause",
                   pr=sec(pr) + ", constant", qrs=qrs_txt(s.qrs_d), rate_note=f"Underlying {round(rate)}/min",
                   action=[f"The {pause:.1f}-second pause is not a multiple of the P–P interval ({pp:.2f} s): sinus node failure", "Pads on; atropine or pacing if symptomatic"])


# ---- atrial
P_SHAPES = [
    ("peaked", lambda s, c: s.P(c, amp=s.r.uniform(0.24, 0.32), w=0.014)),
    ("inverted", lambda s, c: s.P(c, amp=s.r.uniform(0.1, 0.16), w=0.02, inverted=True)),
    ("biphasic", lambda s, c: (s.P(c - 0.012, amp=0.13, w=0.013), s.P(c + 0.014, amp=0.09, w=0.013, inverted=True))),
    ("flat", lambda s, c: s.P(c, amp=s.r.uniform(0.05, 0.08), w=0.03)),
    ("wide", lambda s, c: s.P(c, amp=s.r.uniform(0.12, 0.18), w=0.032)),
]


def b_pac(r):
    s = Strip(r); rate = r.uniform(62, 95); pp = 60 / rate; pr = r.uniform(0.13, 0.19)
    at = int(r.integers(2, 5)); shape_i = int(r.integers(0, 5)); coup = r.uniform(0.55, 0.74)
    q = r.uniform(0.15, 0.4); i = 0; rr_prev = pp; pac_q = None; prev_q = None
    while q < DUR + 0.6:
        if i == at:
            prpac = r.uniform(0.12, 0.18)
            pc = s.p_for_pr(q, prpac); P_SHAPES[shape_i][1](s, pc); s.N(q, rr_prev); s.conducted(pc, q)
            pac_q = q; nxt = pp * r.uniform(1.0, 1.12)
            need(q - prev_q + nxt < 2 * pp - 0.05, "non-compensatory")
            q += nxt; rr_prev = nxt
        else:
            pc = s.p_for_pr(q, pr); s.P(pc); s.N(q, rr_prev); s.conducted(pc, q)
            prev_q = q
            step = pp * coup if i + 1 == at else pp
            q += step; rr_prev = step
        i += 1
    need(pac_q is not None and pac_q < DUR - 0.8, "pac visible")
    return s, dict(cat="Sinus rhythm with PACs", rhythm="Regular except the early beat", p=f"Early beat has a different ({P_SHAPES[shape_i][0]}) P wave",
                   pr=sec(pr) + " on sinus beats", qrs=qrs_txt(s.qrs_d), rate_note=f"Underlying {round(rate)}/min",
                   action=["Usually benign: reduce triggers (caffeine, nicotine, stress)", "Frequent PACs can precede AF or SVT"])


def multi_focal(r, lo_rate, hi_rate):
    s = Strip(r); order = list(r.permutation(len(P_SHAPES)))
    rate = r.uniform(lo_rate, hi_rate); base = 60 / rate
    q = r.uniform(0.15, 0.35); i = 0; rr_prev = base; used = set(); prs = []
    while q < DUR + 0.5:
        name, fn = P_SHAPES[order[i % len(order)]]
        pr = r.uniform(0.12, 0.2); prs.append(pr)
        pc = s.p_for_pr(q, pr); fn(s, pc); s.N(q, rr_prev); s.conducted(pc, q)
        if q < DUR - 0.1:
            used.add(name)
        rr = base * r.uniform(0.84, 1.16); q += rr; rr_prev = rr; i += 1
    need(len(used) >= 3 and max(prs) - min(prs) >= 0.03, "≥3 P shapes")
    return s, used


def b_wap(r):
    s, used = multi_focal(r, 62, 92)
    st = rr_stats(s.q); need(st and 60 / st["mean"] < 100, "rate")
    return s, dict(cat="Wandering atrial pacemaker", rhythm="Slightly irregular", p=f"{len(used)} different shapes, changing beat to beat",
                   pr="Varies (0.12–0.20 s)", qrs=qrs_txt(s.qrs_d), action=["Usually benign; no treatment", "If the rate goes over 100, it's MAT"])


def b_mat(r):
    s, used = multi_focal(r, 112, 140)
    st = rr_stats(s.q); need(st and 60 / st["mean"] > 100 and st["max"] - st["min"] > 0.07, "rate/irregular")
    return s, dict(cat="Multifocal atrial tachycardia (MAT)", rhythm="Irregularly irregular", p=f"{len(used)} different shapes, changing beat to beat",
                   pr="Varies (0.12–0.20 s)", qrs=qrs_txt(s.qrs_d), action=["Treat the cause: oxygen, bronchodilators, sepsis care", "Cardioversion doesn't work"])


def b_svt(r):
    s = Strip(r); rate = r.uniform(152, 240); rr = 60 / rate
    s.ta = r.uniform(0.1, 0.24); q = r.uniform(0.08, 0.3)
    while q < DUR + 0.4:
        s.N(q, rr); q += rr
    hr, st = regular_rate(s.q); need(150 <= hr <= 250, "rate")
    unstable = hr > 210
    return s, dict(cat="Supraventricular tachycardia (SVT)", rhythm="Regular", p="Not visible (hidden in QRS or T)", pr="Not measurable",
                   qrs=qrs_txt(s.qrs_d), action=(["Unstable: synchronized cardioversion 50–100 J"] if unstable else ["Stable: vagal maneuver, then adenosine 6 mg rapid push, then 12 mg"]) + ["12-lead ECG; record a strip during adenosine"])


def b_flutter(r, ratio):
    s = Strip(r, wander=r.uniform(0, 0.025)); fp = r.uniform(0.18, 0.235); amp = r.uniform(0.12, 0.24); f0 = r.uniform(0, fp)
    ph = ((t - f0) / fp) % 1.0; slope = r.uniform(0.72, 0.85)
    s.y += np.where(ph < slope, -amp * (ph / slope), -amp + amp * ((ph - slope) / (1 - slope))) + amp / 2
    ratios = ratio if isinstance(ratio, list) else [ratio]
    delay = r.uniform(0.14, 0.24); k = 0; q = f0 + fp * int(r.integers(1, 3)) + delay
    while q < DUR + 0.5:
        rr = ratios[k % len(ratios)] * fp
        s.N(q, rr, t_amp=0.0); q += rr; k += 1
    frate = 60 / fp; rt, hr, reg = rate_text(s.q)
    need(250 <= frate <= 350 and len(inside(s.q)) >= 3, "F rate")
    lab = f"{ratios[0]}:1" if len(ratios) == 1 else "variable"
    return s, dict(cat="Atrial flutter", name=f"Atrial flutter with {lab} conduction", rhythm="Regular" if len(ratios) == 1 else "Irregular (variable conduction)",
                   p=f"Sawtooth flutter waves at {round(frate)}/min", pr="Not measured", qrs=qrs_txt(s.qrs_d),
                   action=["Stable: rate control per protocol", "Unstable: synchronized cardioversion 50–100 J"])


def b_afib(r, kind):
    s = Strip(r, wander=r.uniform(0, 0.03))
    amp = r.uniform(0.018, 0.05)
    for f in r.uniform(4.5, 9.5, 4):
        s.y += amp * np.sin(2 * np.pi * f * t + r.uniform(0, 6.3)) * (1 + 0.5 * np.sin(2 * np.pi * r.uniform(0.4, 1.0) * t + r.uniform(0, 6)))
    lo, hi = {"slow": (0.95, 1.6), "controlled": (0.55, 1.05), "rvr": (0.32, 0.56)}[kind]
    q = r.uniform(0.1, 0.4); rr_prev = (lo + hi) / 2
    while q < DUR + 0.5:
        s.N(q, rr_prev, t_amp=s.ta * 0.7); rr_prev = r.uniform(lo, hi); q += rr_prev
    st = rr_stats(s.q); need(st and st["rr"].std() / st["rr"].mean() > 0.1 and st["max"] - st["min"] > 0.15, "irregular")
    label = {"slow": "slow ventricular response", "controlled": "controlled rate", "rvr": "rapid ventricular response"}[kind]
    return s, dict(cat="Atrial fibrillation", name=f"Atrial fibrillation, {label}", rhythm="Irregularly irregular", p="None; wavy fibrillatory baseline",
                   pr="None", qrs=qrs_txt(s.qrs_d), action=["Stable: rate control per protocol; ask about onset and anticoagulants", "Unstable: synchronized cardioversion 120–200 J"])


# ---- junctional
def junc_beat(s, q, rr, mode):
    if mode == "before":
        rp = s.r.uniform(0.06, 0.1); s.P(s.onset(q) - rp + 2 * 0.02, amp=s.r.uniform(0.1, 0.18), w=0.02, inverted=True); return rp
    if mode == "after":
        rp = s.r.uniform(0.07, 0.13); s.P(q + 0.05 + rp, amp=s.r.uniform(0.09, 0.15), w=0.02, inverted=True); return rp
    return None


def b_junc(r, lo, hi, cat):
    s = Strip(r); rate = r.uniform(lo, hi); rr = 60 / rate; mode = ["before", "after", "none"][int(r.integers(0, 3))]
    if cat in ("Junctional tachycardia",):
        mode = ["before", "after"][int(r.integers(0, 2))]
        s.ta = r.uniform(0.12, 0.26)
    q = r.uniform(0.2, 0.7); val = None
    while q < DUR + 0.5:
        v = junc_beat(s, q, rr, mode); val = v if v else val; s.N(q, rr); q += rr
    hr, st = regular_rate(s.q); need(lo <= hr <= hi and st["n"] >= 2, "rate")
    ptxt = {"before": "Inverted, just before the QRS", "after": "Inverted, just after the QRS", "none": "Not visible"}[mode]
    prtxt = {"before": f"Short ({val:.2f} s)" if val else "Short", "after": "None (P follows the QRS)", "none": "Not measurable"}[mode]
    act = {"Junctional rhythm": ["Junctional escape at 40–60/min", "Treat as bradycardia if symptomatic; review medications"],
           "Junctional bradycardia": ["Slower than the normal junctional rate", "Atropine; pacing or infusion if unstable; look for drugs, ischemia, hypothermia"],
           "Accelerated junctional rhythm": ["Junction firing at 60–100/min", "Consider digoxin toxicity or ischemia; monitor"],
           "Junctional tachycardia": ["Junction firing over 100/min", "Treat the cause (digoxin, ischemia, stimulants); tachycardia algorithm if unstable"]}[cat]
    return s, dict(cat=cat, rhythm="Regular", p=ptxt, pr=prtxt, qrs=qrs_txt(s.qrs_d), action=act)


def b_pjc(r):
    s = Strip(r); rate = r.uniform(62, 92); pp = 60 / rate; pr = r.uniform(0.13, 0.19)
    at = int(r.integers(2, 5)); mode = ["before", "none", "after"][int(r.integers(0, 3))]; coup = r.uniform(0.58, 0.75)
    q = r.uniform(0.15, 0.4); i = 0; rr_prev = pp; hit = None
    while q < DUR + 0.6:
        if i == at:
            junc_beat(s, q, rr_prev, mode); s.N(q, rr_prev); hit = q; nxt = pp * r.uniform(1.0, 1.1); q += nxt; rr_prev = nxt
        else:
            pc = s.p_for_pr(q, pr); s.P(pc); s.N(q, rr_prev); s.conducted(pc, q)
            step = pp * coup if i + 1 == at else pp; q += step; rr_prev = step
        i += 1
    need(hit is not None and hit < DUR - 0.8, "visible")
    ptxt = {"before": "Early beat: inverted P with a short PR", "none": "Early beat: no P wave", "after": "Early beat: inverted P after the QRS"}[mode]
    return s, dict(cat="Sinus rhythm with PJCs", rhythm="Regular except the early beat", p=ptxt, pr=sec(pr) + " on sinus beats",
                   qrs=qrs_txt(s.qrs_d), rate_note=f"Underlying {round(rate)}/min", action=["Usually benign", "Treat the cause; check for digoxin toxicity"])


def b_junc_escape(r):
    s = Strip(r); rate = r.uniform(60, 85); pp = 60 / rate; pr = r.uniform(0.13, 0.19)
    at = int(r.integers(1, 3)); gap = r.uniform(1.25, 1.75)
    q = r.uniform(0.15, 0.4); i = 0; rr_prev = pp; esc = None
    while q < DUR + 0.6:
        pc = s.p_for_pr(q, pr); s.P(pc); s.N(q, rr_prev); s.conducted(pc, q)
        if i == at:
            e = q + gap; s.N(e, gap); esc = e; rr_prev = pp * 0.95; q = e + pp * 0.95
        else:
            q += pp; rr_prev = pp
        i += 1
    need(esc is not None and esc < DUR - 0.6 and gap > pp * 1.3, "visible late")
    return s, dict(cat="Sinus rhythm with a junctional escape beat", rhythm="Irregular at the pause", p="Upright on sinus beats; none on the late beat",
                   pr=sec(pr) + " on sinus beats", qrs=qrs_txt(s.qrs_d), rate_note=f"Underlying {round(rate)}/min",
                   action=["A protective escape after a pause: never suppress it", "Find the cause of the sinus pause"])


# ---- ventricular
def pvc_strip(r, pattern, n_foci=1):
    s = Strip(r); rate = r.uniform(64, 92); pp = 60 / rate; pr = r.uniform(0.13, 0.19)
    foci = [s.wide_tmpl(pol=1), s.wide_tmpl(pol=-1)]
    if n_foci == 1:
        foci = [s.wide_tmpl()]
    coup = r.uniform(0.5, 0.68)
    q = r.uniform(0.15, 0.35); i = 0; rr_prev = pp; vs = 0; fi = 0; last_n = None
    while q < DUR + 0.6:
        c = pattern[i % len(pattern)]
        nxt_c = pattern[(i + 1) % len(pattern)]
        if c == "N":
            pc = s.p_for_pr(q, pr); s.P(pc); s.N(q, rr_prev); s.conducted(pc, q); last_n = q
            step = pp * coup if nxt_c == "V" else pp
        else:
            s.W(q, foci[fi % len(foci)]); fi += 1
            if 0 <= q < DUR:
                vs += 1
            step = pp * coup if nxt_c == "V" else (2 * pp - (q - last_n) if last_n is not None else pp)
        q += step; rr_prev = step; i += 1
    return s, vs, pr


def b_pvc(r, kind):
    pats = {"unifocal": ["NNNVNNNN", "NNVNNNNN", "NNNNVNNN"], "bigeminy": ["NV"], "trigeminy": ["NNV"], "couplet": ["NNNVVNNN", "NNVVNNNN"],
            "multifocal": ["NNVNNNVN", "NVNNNVNN"]}
    pat = pats[kind][int(r.integers(0, len(pats[kind])))]
    s, vs, pr = pvc_strip(r, pat, 2 if kind == "multifocal" else 1)
    need(vs >= {"unifocal": 1, "bigeminy": 3, "trigeminy": 2, "couplet": 2, "multifocal": 2}[kind], "enough PVCs")
    info = {
        "unifocal": ("Sinus rhythm with unifocal PVCs", "Regular except the early wide beat", "Two narrow, then one wide"),
        "bigeminy": ("Sinus rhythm with ventricular bigeminy", "Regularly irregular: every other beat early", "Alternating narrow and wide"),
        "trigeminy": ("Sinus rhythm with ventricular trigeminy", "Regularly irregular: every 3rd beat early", "Two narrow, then one wide"),
        "couplet": ("Sinus rhythm with a PVC couplet", "Irregular at the two early beats", "Narrow; two consecutive wide PVCs"),
        "multifocal": ("Sinus rhythm with multifocal PVCs", "Irregular", "Narrow; PVCs of two different shapes"),
    }[kind]
    qrs = "Narrow on sinus beats; the PVC is wide and bizarre" if kind == "unifocal" else info[2]
    act = {"unifocal": ["Treat the patient, not the ectopy", "Check for hypoxia, ischemia, electrolytes"], "bigeminy": ["Consider ischemia, electrolytes, digoxin", "12-lead; watch for runs of VT"],
           "trigeminy": ["Correct K⁺, hypoxia, ischemia", "Monitor"], "couplet": ["Irritable ventricle: monitor closely", "12-lead; pads ready"],
           "multifocal": ["Multiple irritable foci", "Fix hypoxia; check electrolytes; 12-lead"]}[kind]
    return s, dict(cat=info[0], rhythm=info[1], p="Before sinus beats only", pr=sec(pr) + " on sinus beats", qrs=qrs, action=act)


def b_nsvt(r):
    s = Strip(r); rate = r.uniform(66, 90); pp = 60 / rate; pr = r.uniform(0.13, 0.19); tm = s.wide_tmpl(d=r.uniform(0.13, 0.17))
    run = int(r.integers(3, 7)); vr = r.uniform(0.3, 0.42)
    q = r.uniform(0.15, 0.35); n_before = int(r.integers(1, 3))
    for _ in range(n_before):
        pc = s.p_for_pr(q, pr); s.P(pc); s.N(q, pp); s.conducted(pc, q); q += pp
    q = q - pp + pp * 0.55
    for _ in range(run):
        s.W(q, tm, t_scale=0.6); q += vr
    q += pp * 0.6
    while q < DUR + 0.6:
        pc = s.p_for_pr(q, pr); s.P(pc); s.N(q, pp); s.conducted(pc, q); q += pp
    need(q > DUR and len(inside(s.q)) >= n_before + run + 1, "run visible")
    return s, dict(cat="Sinus rhythm with a run of VT (non-sustained VT)", rhythm=f"A {run}-beat run of wide beats, then sinus resumes", p="Before sinus beats only",
                   pr=sec(pr) + " on sinus beats", qrs=f"Wide during the run (≈ {round(60 / vr)}/min)", action=["Pads on; 12-lead; check electrolytes", "Treat ischemia; expert consult"])


def b_idio(r, lo, hi, cat):
    s = Strip(r); rate = r.uniform(lo, hi); rr = 60 / rate; tm = s.wide_tmpl(d=r.uniform(0.14, 0.22))
    q = r.uniform(0.2, min(rr, 1.5))
    while q < DUR + 0.6:
        s.W(q, tm); q += rr
    hr, st = regular_rate(s.q); need(lo <= hr <= hi and st["n"] >= 2, "rate")
    act = ["Ventricular escape: never suppress it with antiarrhythmics", "Pacing and perfusion support; if pulseless, treat as PEA"] if cat == "Idioventricular rhythm" else \
          ["Common after reperfusion; usually transient", "No antiarrhythmics if the patient is perfusing"]
    return s, dict(cat=cat, rhythm="Regular", p="None", pr="None", qrs=f"Wide ({tm['d']:.2f} s)", action=act)


def b_vt(r):
    s = Strip(r); rate = r.uniform(130, 240); rr = 60 / rate; tm = s.wide_tmpl(d=r.uniform(0.14, 0.2))
    tm["tg"] = min(tm["tg"], rr * 0.45)
    q = r.uniform(0.05, rr)
    while q < DUR + 0.4:
        s.W(q, tm, t_scale=0.7); q += rr
    hr, st = regular_rate(s.q); need(120 <= hr <= 250, "rate")
    return s, dict(cat="Monomorphic ventricular tachycardia", rhythm="Regular", p="Not seen", pr="None", qrs=f"Wide ({tm['d']:.2f} s), every complex the same",
                   action=["No pulse: defibrillate. Unstable with a pulse: synchronized cardioversion 100 J", "Stable: 12-lead, amiodarone or procainamide per protocol"])


def b_torsades(r):
    s = Strip(r, noise=0.008); f = r.uniform(3.4, 4.6); per = r.uniform(1.6, 3.0); ph = r.uniform(0, 6.3)
    env = 0.2 + r.uniform(0.75, 1.0) * np.abs(np.sin(np.pi * t / per + ph))
    s.y += env * np.sin(2 * np.pi * f * t + 0.6 * np.sin(2 * np.pi * 0.5 * t)) * r.choice([1, -1])
    return s, dict(cat="Polymorphic VT (torsades de pointes)", rhythm="Irregular", p="None", pr="None", qrs="Wide, twisting around the baseline",
                   rate=f"≈ {round(f * 60)}/min", action=["Pulseless: defibrillate (unsynchronized)", "Magnesium sulfate 1–2 g IV/IO"])


def b_vf(r, coarse):
    s = Strip(r, noise=0.01); amp = r.uniform(0.35, 0.55) if coarse else r.uniform(0.08, 0.15)
    for f, a in zip(r.uniform(3.0, 8.0, 5), r.uniform(0.4, 1.0, 5)):
        s.y += amp * a * np.sin(2 * np.pi * f * t + r.uniform(0, 6.3)) * (0.55 + 0.45 * np.sin(2 * np.pi * r.uniform(0.15, 0.5) * t + r.uniform(0, 6)))
    pk = np.percentile(s.y, 97) - np.percentile(s.y, 3)
    need(pk > 0.6 if coarse else 0.12 < pk < 0.45, "amplitude")
    need(chaotic(s.y), "VF must look chaotic, not regular")
    return s, dict(cat="Ventricular fibrillation (coarse)" if coarse else "Ventricular fibrillation (fine)", rhythm="Chaotic" if coarse else "Chaotic, low amplitude",
                   p="None", pr="None", qrs="No identifiable QRS", rate="Not measurable",
                   action=["Shock immediately, then CPR for 2 minutes", "Epinephrine after initial shocks; then amiodarone or lidocaine"] if coarse else
                   ["Still shockable: defibrillate", "Confirm it isn't asystole: check leads and gain"])


def chaotic(y):
    """VF rule: wave-to-wave spacing and height must both vary (unlike VT or torsades)."""
    ys = np.convolve(y, np.ones(15) / 15, mode="same")
    w = 40  # 40 ms each side
    peaks = [i for i in range(w, len(ys) - w) if ys[i] == ys[i - w:i + w + 1].max() and ys[i] > np.median(ys)]
    if len(peaks) < 8:
        return False
    iv = np.diff(peaks) / FS
    amps = ys[peaks] - np.median(ys)
    return iv.std() / iv.mean() > 0.22 and amps.std() / amps.mean() > 0.3


def b_asystole(r):
    s = Strip(r, noise=r.uniform(0.003, 0.007), wander=r.uniform(0.01, 0.05))
    return s, dict(cat="Asystole", rhythm="None", p="None", pr="None", qrs="None", rate="0, no electrical activity",
                   action=["Confirm in a second lead; check leads and gain", "CPR + epinephrine ASAP; search for reversible causes"])


def b_agonal(r):
    s = Strip(r); tm = s.wide_tmpl(d=r.uniform(0.26, 0.4)); tm["amp"] = r.uniform(0.3, 0.55)
    q = r.uniform(0.4, 1.4)
    while q < DUR + 0.5:
        s.W(q, tm); q += r.uniform(3.0, 5.0)
    need(1 <= len(inside(s.q)) <= 2, "very slow")
    return s, dict(cat="Agonal rhythm", rhythm="Very slow, irregular", p="None", pr="None", qrs=f"Very wide ({tm['d']:.2f} s), low amplitude",
                   rate="< 20/min", action=["Treat as PEA if pulseless", "Often a terminal rhythm; consider TOR with medical direction"])


# ---- blocks
def b_avb1(r):
    s = Strip(r); rate = r.uniform(48, 95); pr = r.uniform(0.22, 0.4)
    sinus_train(s, r.uniform(0.35, 0.8), rr_seq(60 / rate), pr)
    hr, st = regular_rate(s.q); need(st["n"] >= 3, "beats")
    return s, dict(cat="1st-degree AV block", rhythm="Regular", p="Upright, one before each QRS", pr=sec(pr) + ", constant (over 0.20 s)",
                   qrs=qrs_txt(s.qrs_d), action=["Benign conduction delay: monitor", "Note AV-nodal blocking drugs; watch for progression in an MI"])


def b_wenck(r):
    s = Strip(r); n = int(r.choice([3, 4, 5])); pp = r.uniform(0.62, 0.95)
    pr0 = r.uniform(0.14, 0.2); d1 = r.uniform(0.09, 0.14)
    prs = [pr0]
    for j in range(1, n - 1):
        prs.append(prs[-1] + d1 * (0.55 ** (j - 1)))
    start = r.uniform(0.05, pp); i = 0; drops = 0; groups_seen = 0
    pt = start
    while pt < DUR + 0.6:
        k = i % n
        if k < n - 1:
            q = pt + prs[k] + 0.038 * s.k - 2 * s.pw  # places the QRS so that PR = prs[k]
            s.P(pt); s.N(q, pp); s.conducted(pt, q)
        else:
            s.P(pt); s.blocked.append(pt)
            if 0 < pt < DUR - 0.3:
                drops += 1
        i += 1; pt += pp
    need(drops >= 1, "a dropped beat")
    # at least one full group of conducted beats with increasing PR is visible
    vis = [(p, q) for p, q in s.pairs if 0 <= p and q < DUR]
    need(len(vis) >= n - 1, "group visible")
    return s, dict(cat="2nd-degree AV block type I (Wenckebach)", name=f"2nd-degree AV block type I (Wenckebach), {n}:{n - 1}",
                   rhythm="Regularly irregular: grouped beats", p=f"Regular at {round(60 / pp)}/min; one per group not conducted",
                   pr=f"Lengthens {prs[0]:.2f} → {prs[-1]:.2f} s, then a dropped beat", qrs=qrs_txt(s.qrs_d), action=["Usually nodal and transient", "Symptomatic: pads on, pace if unstable (atropine isn't indicated)"])


def b_mobitz2(r):
    s = Strip(r); wide = r.random() < 0.7; tm = s.wide_tmpl(d=r.uniform(0.13, 0.17)) if wide else None
    pp = r.uniform(0.62, 0.9); pr = r.uniform(0.14, 0.22)
    pattern = [[1, 1, 0], [1, 1, 1, 0], [1, 1, 1, 1, 0], [1, 1, 0, 1, 1, 1, 0]][int(r.integers(0, 4))]
    pt = r.uniform(0.05, pp); i = 0; drops = 0
    while pt < DUR + 0.6:
        if pattern[i % len(pattern)]:
            q = pt + pr + (0.07 if wide else 0.038 * s.k) - 2 * s.pw
            s.P(pt)
            if wide:
                s.W(q, tm)
            else:
                s.N(q, pp)
            s.conducted(pt, q)
        else:
            s.P(pt); s.blocked.append(pt)
            if 0 < pt < DUR - 0.3:
                drops += 1
        i += 1; pt += pp
    need(drops >= 1, "drop")
    d = tm["d"] if wide else s.qrs_d
    first_drop = pattern.index(0)
    ratio = f"{first_drop + 1}:{first_drop}" if len(pattern) <= 5 else "variable"
    return s, dict(cat="2nd-degree AV block type II (Mobitz II)", name=f"2nd-degree AV block type II (Mobitz II), {ratio}",
                   rhythm="Irregular when beats drop", p=f"Regular at {round(60 / pp)}/min; some not conducted", pr=sec(pr) + ", constant on conducted beats",
                   qrs=qrs_txt(d), action=["High risk of complete block: pads on, prepare to pace", "Atropine isn't indicated; don't delay pacing"])


def b_ratio_block(r, ratio):
    s = Strip(r); wide = (ratio > 2 and r.random() < 0.75) or (ratio == 2 and r.random() < 0.45)
    tm = s.wide_tmpl(d=r.uniform(0.13, 0.17)) if wide else None
    pp = r.uniform(0.5, 0.78) if ratio == 2 else r.uniform(0.45, 0.65); pr = r.uniform(0.14, 0.22)
    pt = r.uniform(0.05, pp); i = int(r.integers(0, ratio))
    while pt < DUR + 0.6:
        s.P(pt)
        if i % ratio == 0:
            q = pt + pr + (0.07 if wide else 0.038 * s.k) - 2 * s.pw
            s.W(q, tm) if wide else s.N(q, pp * ratio); s.conducted(pt, q)
        else:
            s.blocked.append(pt)
        i += 1; pt += pp
    need(len(inside(s.q)) >= 2, "beats")
    d = tm["d"] if wide else s.qrs_d
    if ratio == 2:
        return s, dict(cat="2nd-degree AV block, 2:1", rhythm="Regular", p=f"Regular at {round(60 / pp)}/min; 2 for every QRS", pr=sec(pr) + ", constant on conducted beats",
                       qrs=qrs_txt(d), action=["The type can't be determined from 2:1 alone", "Pads on; pace if unstable. Atropine isn't indicated for 2nd-degree block."])
    return s, dict(cat="Advanced (high-grade) AV block", name=f"Advanced (high-grade) AV block, {ratio}:1", rhythm="Regular",
                   p=f"Regular at {round(60 / pp)}/min; {ratio} for every QRS", pr=sec(pr) + ", constant on conducted beats", qrs=qrs_txt(d),
                   action=["Treat like complete heart block", "Transcutaneous pacing; epinephrine or dopamine bridge"])


def b_chb(r):
    s = Strip(r); junctional = r.random() < 0.4
    pp = 60 / r.uniform(62, 105)
    vrate = r.uniform(40, 56) if junctional else r.uniform(22, 40); rr = 60 / vrate
    tm = None if junctional else s.wide_tmpl(d=r.uniform(0.14, 0.2))
    pt = r.uniform(0.02, pp)
    while pt < DUR + 0.3:
        s.P(pt); pt += pp
    q = r.uniform(0.25, min(rr, 1.6))
    while q < DUR + 0.6:
        s.N(q, rr) if junctional else s.W(q, tm); q += rr
    qs = inside(s.q); need(len(qs) >= 2, "beats")
    prs = []
    for qq in qs:
        before = [p for p in s.p if p < qq - 0.02]
        if before:
            prs.append(qq - before[-1])
    need(len(prs) >= 2 and max(prs) - min(prs) > 0.12, "dissociation")
    d = s.qrs_d if junctional else tm["d"]
    return s, dict(cat="3rd-degree (complete) AV block", name="3rd-degree (complete) AV block, " + ("junctional escape" if junctional else "ventricular escape"),
                   rhythm="R–R regular; P–P regular; unrelated", p=f"Regular at {round(60 / pp)}/min; unrelated to the QRS", pr="None, varies (AV dissociation)",
                   qrs=qrs_txt(d), action=["Unstable: transcutaneous pacing", "Bridge: epinephrine 2–10 mcg/min or dopamine 5–20 mcg/kg/min"])


# ---- paced
def ptm(s):
    tm = s.wide_tmpl(pol=-1, d=s.r.uniform(0.14, 0.18)); tm["amp"] = s.r.uniform(0.7, 1.1); return tm


def b_apaced(r):
    s = Strip(r); rate = r.uniform(60, 85); pp = 60 / rate; pr = r.uniform(0.16, 0.24); sa = r.uniform(0.35, 0.95)
    c = r.uniform(0.1, 0.5)
    while c < DUR + 0.5:
        s.spike(c, sa); pc = c + 0.035; s.P(pc, amp=s.pa * 0.8); q = pc + pr + 0.038 * s.k - 2 * s.pw; s.N(q, pp); s.conducted(pc, q); c += pp
    hr, st = regular_rate(s.q); need(st["n"] >= 3, "beats")
    return s, dict(cat="Atrial paced rhythm", rhythm="Regular", p="Each P follows a pacer spike", pr=sec(pr), qrs=qrs_txt(s.qrs_d),
                   spikes="Atrial, before each P", action=["Normal atrial pacing", "Ask for the device card"])


def b_vpaced(r):
    s = Strip(r); rate = r.uniform(55, 85); rr = 60 / rate; sa = r.uniform(0.4, 1.1); tm = ptm(s)
    c = r.uniform(0.1, 0.6)
    while c < DUR + 0.5:
        s.spike(c, sa); s.W(c + 0.06, tm); c += rr
    hr, st = regular_rate(s.q); need(st["n"] >= 3, "beats")
    return s, dict(cat="Ventricular paced rhythm", rhythm="Regular", p="Not seen", pr="None", qrs=f"Wide ({tm['d']:.2f} s), after each spike",
                   spikes="Ventricular, before each QRS", action=["Normal ventricular pacing", "A paced QRS hides STEMI: rely on symptoms and Sgarbossa"])


def b_ddd(r):
    s = Strip(r); rate = r.uniform(58, 85); pp = 60 / rate; avd = r.uniform(0.13, 0.22); sa = r.uniform(0.35, 0.9); sv = r.uniform(0.5, 1.1); tm = ptm(s)
    c = r.uniform(0.1, 0.5)
    while c < DUR + 0.5:
        s.spike(c, sa); s.P(c + 0.035, amp=s.pa * 0.75); s.spike(c + avd, sv); s.W(c + avd + 0.06, tm); c += pp
    need(len(inside(s.q)) >= 3, "beats")
    return s, dict(cat="AV sequential (dual-chamber) paced rhythm", rhythm="Regular", p="Paced P after each atrial spike", pr=f"AV delay {avd:.2f} s (spike to spike)",
                   qrs=f"Wide ({tm['d']:.2f} s), after the ventricular spike", spikes="Two per beat", action=["Both chambers paced and captured", "Normal function"])


def b_vdd(r):
    s = Strip(r); rate = r.uniform(78, 110); pp = 60 / rate; avd = r.uniform(0.12, 0.2); sv = r.uniform(0.5, 1.1); tm = ptm(s)
    pt = r.uniform(0.1, 0.5)
    while pt < DUR + 0.5:
        s.P(pt); c = pt + avd; s.spike(c, sv); s.W(c + 0.06, tm); s.conducted(pt, c); pt += pp
    need(len(inside(s.q)) >= 3, "beats")
    return s, dict(cat="Atrial-sensed, ventricular paced rhythm", rhythm="Regular", p="Native sinus P waves", pr=f"≈ {avd:.2f} s (P to V spike)",
                   qrs=f"Wide ({tm['d']:.2f} s), after each ventricular spike", spikes="Ventricular only, after each P", action=["The device tracks the sinus rate", "Normal function"])


def b_vvi_demand(r):
    s = Strip(r); rate = r.uniform(62, 80); pp = 60 / rate; pr = r.uniform(0.13, 0.19); esc = 60 / r.uniform(55, 65); sa = r.uniform(0.5, 1.1); tm = ptm(s)
    q = r.uniform(0.1, 0.4); n_native = int(r.integers(2, 4)); last = None
    for _ in range(n_native):
        pc = s.p_for_pr(q, pr); s.P(pc); s.N(q, pp); s.conducted(pc, q); last = q; q += pp
    c = last + esc
    while c < DUR + 0.5:
        s.spike(c, sa); s.W(c + 0.06, tm); c += esc
    need(last + esc < DUR - 1.0, "paced visible")
    return s, dict(cat="Demand (VVI) pacing with native beats", rhythm="Irregular at the transition", p="On native beats only", pr=sec(pr) + " on native beats",
                   qrs="Narrow native beats, then wide paced beats", spikes=f"Only after a {esc:.2f} s pause", action=["Demand pacing fires only when needed", "Normal sensing and capture"])


def b_ftc(r):
    s = Strip(r); rate = r.uniform(60, 80); rr = 60 / rate; sa = r.uniform(0.5, 1.1); tm = ptm(s)
    c = r.uniform(0.1, 0.5); miss = 0; i = 0; pat = r.random(20) > r.uniform(0.3, 0.55)
    while c < DUR + 0.3:
        s.spike(c, sa)
        if pat[i]:
            s.W(c + 0.06, tm)
        elif 0 <= c < DUR:
            miss += 1
        c += rr; i += 1
    need(miss >= 1 and len(inside(s.q)) >= 2, "missed captures")
    return s, dict(cat="Pacemaker failure to capture", rhythm="Irregular (ventricular)", p="Not seen", pr="None", qrs="Wide when captured",
                   spikes=f"Regular at {round(rate)}/min; {miss} not followed by a QRS", action=["Malfunction: lead, battery, threshold, hyperkalemia", "TCP if unstable; transport"])


def b_fts(r):
    s = Strip(r); rate = r.uniform(70, 95); pp = 60 / rate; pr = r.uniform(0.13, 0.19); prate = r.uniform(55, 72); prr = 60 / prate
    sa = r.uniform(0.5, 1.1); tm = ptm(s)
    events = [(q, "n") for q in np.arange(r.uniform(0.15, 0.4), DUR + 0.6, pp)] + [(c, "s") for c in np.arange(r.uniform(0.3, 0.9), DUR, prr)]
    events.sort(); last = -9; bad = 0
    for tm_, kind in events:
        if kind == "n":
            pc = s.p_for_pr(tm_, pr); s.P(pc)
            if tm_ - last > 0.36:
                s.N(tm_, pp); s.conducted(pc, tm_); last = tm_
        else:
            s.spike(tm_, sa)
            if tm_ - last > 0.36:
                s.W(tm_ + 0.06, tm); last = tm_
            elif 0 <= tm_ < DUR:
                bad += 1
    need(bad >= 1, "spikes on native beats")
    return s, dict(cat="Pacemaker failure to sense (undersensing)", rhythm="Irregular", p="Native P waves present", pr=sec(pr) + " on native beats",
                   qrs="Native narrow beats, some paced beats", spikes="Fixed rate, ignoring native beats (some fall on the QRS or T)", action=["Spikes ignore native beats: risk of R-on-T", "Monitor, transport, pads ready"])


def b_ftp(r):
    s = Strip(r); rate = r.uniform(60, 80); rr = 60 / rate; sa = r.uniform(0.5, 1.1); tm = ptm(s)
    c = r.uniform(0.1, 0.5); pause_at = int(r.integers(1, 3)); pause = r.uniform(2.0, 2.8); i = 0
    while c < DUR + 0.3:
        s.spike(c, sa); s.W(c + 0.06, tm)
        c += pause if i == pause_at else rr; i += 1
    need(pause > 1.6 * rr and len(inside(s.q)) >= 3, "pause")
    return s, dict(cat="Pacemaker failure to pace (oversensing)", rhythm="Irregular: a long pause", p="Not seen", pr="None", qrs="Wide paced beats",
                   spikes=f"Missing for {pause:.1f} s (pacing interval {rr:.2f} s)", action=["The device sensed 'noise' and withheld pacing", "Pads on; TCP if pauses recur"])


def b_tcp(r, capture):
    s = Strip(r, noise=r.uniform(0.008, 0.015)); rate = r.uniform(60, 85); rr = 60 / rate
    if capture:
        tm = s.wide_tmpl(pol=-1, d=r.uniform(0.16, 0.22)); tm["ta"] = r.uniform(0.45, 0.6); tm["pol"] = -1
        c = r.uniform(0.1, 0.5)
        while c < DUR + 0.3:
            s.tcp(c); s.W(c + 0.08, tm); c += rr
        need(len(inside(s.q)) >= 4, "beats")
        return s, dict(cat="Transcutaneous pacing with capture", rhythm="Regular", p="Obscured by artifact", pr="None", qrs="Wide, with a broad T after every spike",
                       spikes=f"Large artifacts at {round(rate)}/min", action=["Electrical capture: now check a FEMORAL pulse", "Give analgesia or sedation"])
    pp = 60 / r.uniform(70, 95); vr = 60 / r.uniform(25, 38); tm = s.wide_tmpl(d=r.uniform(0.14, 0.2))
    for p in np.arange(r.uniform(0, pp), DUR + 0.2, pp):
        s.P(p)
    for q in np.arange(r.uniform(0.4, 1.4), DUR + 0.5, vr):
        s.W(q, tm)
    c = r.uniform(0.1, 0.6)
    while c < DUR:
        s.tcp(c); c += rr
    need(len(inside(s.q)) >= 2, "escape beats")
    return s, dict(cat="Transcutaneous pacing without capture", rhythm="Pacer artifacts regular; escape beats unrelated", p="Present, unrelated", pr="None",
                   qrs="Wide escape beats only", rate=f"Ventricular {rate_text(s.q)[0]}; pacer {round(rate)}/min", spikes="Large artifacts without a QRS",
                   action=["Increase the mA until every spike captures", "Check pad position (anterior–posterior)"])


def b_spikes_asys(r):
    s = Strip(r, noise=r.uniform(0.003, 0.006)); rate = r.uniform(60, 80); rr = 60 / rate; sa = r.uniform(0.5, 1.1)
    for c in np.arange(r.uniform(0.1, 0.6), DUR, rr):
        s.spike(c, sa)
    return s, dict(cat="Pacer spikes without capture (asystole)", rhythm="Spikes regular; no QRS", p="None", pr="None", qrs="None", rate="0, spikes only",
                   spikes=f"Regular at {round(rate)}/min, no capture", action=["This is cardiac arrest: start CPR", "Treat as asystole; pads ≥ 8 cm from the device"])


# ------------------------------------------------------------------ the areas
def rep(n, fn, *a):
    return [(fn, a)] * n


AREAS = [
    ("sinus", "Sinus rhythms", rep(10, b_nsr) + rep(9, b_brady) + rep(9, b_tach) + rep(8, b_sinus_arr) + rep(7, b_sinus_pause, False) + rep(7, b_sinus_pause, True)),
    ("atrial", "Atrial rhythms", rep(9, b_pac) + rep(7, b_wap) + rep(7, b_mat) + rep(8, b_svt)
     + rep(3, b_flutter, 2) + rep(2, b_flutter, 3) + rep(2, b_flutter, 4) + [(b_flutter, ([2, 4, 3, 4],)), (b_flutter, ([4, 2, 3, 2, 4],))]
     + rep(3, b_afib, "slow") + rep(4, b_afib, "controlled") + rep(3, b_afib, "rvr")),
    ("junctional", "Junctional rhythms", rep(10, b_junc, 40, 60, "Junctional rhythm") + rep(7, b_junc, 26, 39, "Junctional bradycardia")
     + rep(9, b_junc, 61, 100, "Accelerated junctional rhythm") + rep(8, b_junc, 102, 160, "Junctional tachycardia") + rep(9, b_pjc) + rep(7, b_junc_escape)),
    ("ventricular", "Ventricular rhythms", rep(5, b_pvc, "unifocal") + rep(4, b_pvc, "bigeminy") + rep(4, b_pvc, "trigeminy") + rep(4, b_pvc, "couplet")
     + rep(4, b_pvc, "multifocal") + rep(4, b_nsvt) + rep(5, b_idio, 20, 40, "Idioventricular rhythm") + rep(5, b_idio, 41, 100, "Accelerated idioventricular rhythm (AIVR)")
     + rep(5, b_vt) + rep(3, b_torsades) + rep(3, b_vf, True) + rep(2, b_vf, False) + rep(1, b_asystole) + rep(1, b_agonal)),
    ("block", "AV blocks", rep(10, b_avb1) + rep(10, b_wenck) + rep(9, b_mobitz2) + rep(7, b_ratio_block, 2) + rep(3, b_ratio_block, 3) + rep(2, b_ratio_block, 4) + rep(9, b_chb)),
    ("paced", "Paced rhythms", rep(6, b_apaced) + rep(7, b_vpaced) + rep(7, b_ddd) + rep(6, b_vdd) + rep(5, b_vvi_demand) + rep(6, b_ftc) + rep(5, b_fts)
     + rep(4, b_ftp) + rep(1, b_tcp, True) + rep(1, b_tcp, False) + rep(2, b_spikes_asys)),
]

def make_item(info, s):
    rows_rate = info.get("rate") or rate_text(s.q)[0]
    if info.get("rate_note") and "6-second" in rows_rate:
        rows_rate = f"{rows_rate}; {info['rate_note'].lower()}"
    rows = [["Rate", rows_rate], ["Rhythm", info["rhythm"]], ["P waves", info["p"]], ["PR interval", info["pr"]], ["QRS", info["qrs"]]]
    if info.get("spikes"):
        rows.append(["Pacer spikes", info["spikes"]])
    return rows


def verify(cat, s):
    """Independent rule check: re-measures the finished strip from its beat timings."""
    qs = inside(s.q); st = rr_stats(qs)
    reg = bool(st) and st["max"] - st["min"] <= 0.06
    hr = 60 / st["mean"] if st else 0
    med = float(np.median(st["rr"])) if st else 0
    # true PR (P onset to QRS onset) for narrow conducted beats
    prs = [(q - 0.038 * s.k) - (p - 2 * s.pw) for p, q in s.pairs if p >= 0 and q < DUR]
    vis_p = inside(s.p)
    spikes = [c for c, _ in s.spk]

    def wenck_ok():
        if not s.blocked or len(prs) < 2:
            return False
        groups, cur, blocked = [], [], set(round(b, 4) for b in s.blocked)
        for p, q in sorted(s.pairs + [(b, None) for b in s.blocked]):
            if q is None:
                groups.append(cur); cur = []
            else:
                cur.append((q - 0.038 * s.k) - (p - 2 * s.pw))
        groups.append(cur)
        full = [gp for gp in groups if len(gp) >= 2]
        return bool(full) and all(all(b > a + 0.02 for a, b in zip(gp, gp[1:])) for gp in full)

    def const_pr():
        d = [q - p for p, q in s.pairs]
        return len(d) >= 2 and max(d) - min(d) < 0.003

    rules = {
        "Normal sinus rhythm": lambda: reg and 60 <= hr <= 100 and len(vis_p) >= len(qs) - 1 and all(0.12 <= x <= 0.20 for x in prs),
        "Sinus bradycardia": lambda: reg and hr < 60 and all(0.12 <= x <= 0.20 for x in prs),
        "Sinus tachycardia": lambda: reg and 100 < hr <= 150 and all(0.10 <= x <= 0.20 for x in prs),
        "Sinus arrhythmia": lambda: st["max"] - st["min"] >= 0.16 and len(vis_p) >= len(qs) - 1,
        "Sinus arrest (pause)": lambda: st["max"] >= 1.8 and abs(st["max"] / st["min"] - round(st["max"] / st["min"])) > 0.2,
        "Sinoatrial (SA) exit block": lambda: abs(st["max"] - 2 * st["min"]) < 0.02,
        "Sinus rhythm with PACs": lambda: st["min"] < 0.8 * med and len(vis_p) >= len(qs) - 1,
        "Wandering atrial pacemaker": lambda: hr < 100 and len(vis_p) >= len(qs) - 1,
        "Multifocal atrial tachycardia (MAT)": lambda: hr > 100 and not reg and len(vis_p) >= len(qs) - 1,
        "Supraventricular tachycardia (SVT)": lambda: reg and 150 <= hr <= 250 and not vis_p,
        "Atrial flutter": lambda: not vis_p and len(qs) >= 3,
        "Atrial fibrillation": lambda: not reg and not vis_p and st["rr"].std() / st["rr"].mean() > 0.1,
        "Junctional rhythm": lambda: reg and 40 <= hr <= 60,
        "Junctional bradycardia": lambda: reg and hr < 40,
        "Accelerated junctional rhythm": lambda: reg and 60 < hr <= 100,
        "Junctional tachycardia": lambda: reg and hr > 100,
        "Sinus rhythm with PJCs": lambda: st["min"] < 0.8 * med,
        "Sinus rhythm with a junctional escape beat": lambda: st["max"] > 1.25 * med,
        "Sinus rhythm with a run of VT (non-sustained VT)": lambda: st["min"] < 0.5,
        "Idioventricular rhythm": lambda: reg and 20 <= hr <= 40 and not vis_p,
        "Accelerated idioventricular rhythm (AIVR)": lambda: reg and 40 < hr <= 100 and not vis_p,
        "Monomorphic ventricular tachycardia": lambda: reg and hr >= 120 and not vis_p,
        "Asystole": lambda: not qs and float(np.abs(s.y).max()) < 0.2,
        "1st-degree AV block": lambda: reg and prs and all(x > 0.20 for x in prs) and not s.blocked,
        "2nd-degree AV block type I (Wenckebach)": wenck_ok,
        "2nd-degree AV block type II (Mobitz II)": lambda: bool(s.blocked) and const_pr(),
        "2nd-degree AV block, 2:1": lambda: bool(s.blocked) and const_pr() and abs(len(s.blocked) - len(s.pairs)) <= 1,
        "Advanced (high-grade) AV block": lambda: len(s.blocked) >= 2 * len(s.pairs) - 1 and const_pr(),
        "3rd-degree (complete) AV block": lambda: reg and not s.pairs and len(vis_p) > len(qs),
        "Atrial paced rhythm": lambda: all(any(0.02 < p - c < 0.06 for c in spikes) for p in vis_p) and len(spikes) >= 3,
        "Ventricular paced rhythm": lambda: all(any(0.04 < q - c < 0.08 for c in spikes) for q in qs),
        "AV sequential (dual-chamber) paced rhythm": lambda: len(spikes) >= 2 * len(qs) - 1,
        "Atrial-sensed, ventricular paced rhythm": lambda: all(any(0.04 < q - c < 0.08 for c in spikes) for q in qs) and len(vis_p) >= len(qs) - 1,
        "Pacemaker failure to capture": lambda: any(not any(0 < q - c < 0.1 for q in s.q) and any(q < c for q in qs) and any(q > c for q in qs) for c in spikes),
        "Pacemaker failure to sense (undersensing)": lambda: any(0 < c - q < 0.36 for c in spikes for q in qs),
        "Pacemaker failure to pace (oversensing)": lambda: max(np.diff(sorted(spikes))) > 1.6 * min(np.diff(sorted(spikes))),
        "Pacer spikes without capture (asystole)": lambda: not qs and len(spikes) >= 4,
    }
    fn = rules.get(cat)
    if fn is not None:
        need(bool(fn()), f"rule check failed for {cat}")


def fingerprint(s):
    y = np.round(s.y[::10], 2)
    return hashlib.sha1(y.tobytes()).hexdigest()


def generate(area_seed=20261116):
    out = {}
    seen = set()
    for ai, (key, title, plan) in enumerate(AREAS):
        assert len(plan) == 50, (key, len(plan))
        items = []
        for idx, (fn, args) in enumerate(plan):
            base = area_seed + ai * 100000 + idx * 1000
            for attempt in range(400):
                rng = np.random.default_rng(base + attempt)
                try:
                    s, info = fn(rng, *args)
                    verify(info["cat"], s)
                    fp = fingerprint(s)
                    need(fp not in seen, "duplicate")
                    break
                except Retry:
                    continue
            else:
                raise RuntimeError(f"could not generate {key} #{idx} {fn.__name__}")
            seen.add(fp)
            assert info["cat"] in CAT, info["cat"]
            items.append({"cat": info["cat"], "name": info.get("name", info["cat"]), "st": s, "rows": make_item(info, s), "action": info["action"]})
        out[key] = (title, items)
    return out
