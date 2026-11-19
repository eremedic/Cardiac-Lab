"""Real-patient morphology for the field strips (used only by build_field.py).

Installs field versions of the Strip drawing methods in areas.py, so that within one strip:
  * every P, QRS and T varies a little from beat to beat (no two complexes identical);
  * each strip gets its own P-wave shape (peaked, flat, notched, biphasic or normal), T-wave shape
    (inverted, flattened, peaked, biphasic, ST depression or normal), and sometimes U waves, J-point
    notching, a small terminal rSR' notch, or low/high QRS voltage;
  * selected sinus strips get a delta wave (pre-excitation), and selected PVC strips get R-on-T PVCs.
Rhythm timing is untouched, so areas.verify still checks every strip against its rhythm's rules.
"""
import numpy as np
import areas

g, DUR = areas.g, areas.DUR
CUR = {"delta": False, "ront": False}
_orig = {}


def _j(r, sd, lim):
    return 1 + float(np.clip(r.normal(0, sd), -lim, lim))


def f_init(self, rng, noise=None, wander=None):
    _orig["init"](self, rng, noise, wander)
    r = rng
    fm = {"p": str(r.choice(["normal", "normal", "normal", "peaked", "flat", "notched", "biphasic"])),
          "t": str(r.choice(["normal"] * 4 + ["inverted", "flat", "peaked", "biphasic", "depressed"])),
          "u": r.random() < 0.2, "j": r.random() < 0.12, "rsr": r.random() < 0.12,
          "volt": str(r.choice(["normal"] * 8 + ["low", "high"])), "st": float(r.uniform(-0.02, 0.03)),
          "uamp": float(r.uniform(0.04, 0.08)), "delta": CUR["delta"], "nP": 0, "nN": 0}
    if fm["t"] == "depressed":
        fm["st"] = -float(r.uniform(0.06, 0.12))
    if fm["delta"] and fm["volt"] == "low":
        fm["volt"] = "normal"   # keep the delta wave easy to see
    if fm["p"] == "notched":
        self.pbifid = True
    self.fm = fm


def f_P(self, c, amp=None, w=None, inverted=False):
    fm, r = self.fm, self.r
    base = amp is None and not inverted
    a = self.pa if amp is None else amp
    w = self.pw if w is None else w
    a *= _j(r, 0.09, 0.2); w *= _j(r, 0.05, 0.1)
    if inverted:
        a = -abs(a)
    shape = fm["p"] if base else "normal"
    if shape == "peaked":
        a, w = a * 1.35, w * 0.8
    elif shape == "flat":
        a *= 0.6
    if self.pbifid and base:
        self.y += g(c - w * 0.55, a * 0.85, w * 0.7) + g(c + w * 0.55, a * 0.85, w * 0.7)
    elif shape == "biphasic":
        self.y += g(c - w * 0.5, a * 0.85, w * 0.7) + g(c + w * 0.85, -a * 0.45, w * 0.7)
    else:
        self.y += g(c, a, w)
    if base:
        fm["nP"] += 1
    if 0 <= c < DUR:
        self.p.append(c)


def f_T(self, c, rr, amp=None):
    fm, r = self.fm, self.r
    qt = float(np.clip(0.4 * np.sqrt(max(rr, 0.25)), 0.25, 0.44))
    tw = self.tw
    tc = self.onset(c) + qt - 2 * tw
    a = (self.ta if amp is None else amp) * _j(r, 0.12, 0.25)
    shape = fm["t"] if amp is None else "normal"
    if shape == "inverted":
        a = -abs(a) * 0.8
    elif shape == "flat":
        a *= 0.3
    elif shape == "peaked":
        a, tw = abs(a) * 1.5 + 0.1, tw * 0.75
    if shape == "biphasic":
        self.y += g(tc - tw * 0.6, abs(a) * 0.7, tw * 0.8) + g(tc + tw * 0.9, -abs(a) * 0.5, tw * 0.8)
    else:
        self.y += g(tc, a, tw)
    end = self.onset(c) + 0.08 * self.k
    if abs(fm["st"]) > 0.001 and tc - end > 0.04:
        self.y += g((end + tc) / 2, fm["st"], (tc - end) / 3)
    if fm["u"] and rr > 0.55:
        self.y += g(tc + 2.2 * tw + 0.06, fm["uamp"], tw * 0.9)


def f_N(self, c, rr, t_amp=None, record=True):
    fm, r, k = self.fm, self.r, self.k
    v = {"low": 0.55, "high": 1.3}.get(fm["volt"], 1.0)
    jq = _j(r, 0.06, 0.14)
    ra = min(self.ra * v * jq, 1.25)
    self.y += g(c - 0.022 * k, -self.qd * v * jq, 0.008 * k) + g(c, ra, 0.010 * k) + g(c + 0.024 * k, -self.sd * v * jq, 0.009 * k)
    if fm["delta"]:
        # a slurred ramp that runs straight into the R wave (not a separate bump)
        self.y += g(c - 0.03 * k, max(ra * 0.34, 0.18), 0.024) + g(c - 0.06 * k, max(ra * 0.12, 0.06), 0.018)
    if fm["rsr"]:
        self.y += g(c + 0.05 * k, ra * 0.22, 0.008 * k)
    if fm["j"]:
        self.y += g(c + 0.052 * k, 0.08, 0.007)
    fm["nN"] += 1
    self.T(c, rr, t_amp)
    if record and 0 <= c < DUR:
        self.q.append(c)


def f_W(self, c, tm, record=True, t_scale=1.0):
    tm = dict(tm, amp=tm["amp"] * _j(self.r, 0.07, 0.15))
    _orig["W"](self, c, tm, record, t_scale)


def f_pvc_strip(r, pattern, n_foci=1):
    """areas.pvc_strip, with the PVCs landing right on the preceding T wave when CUR['ront'] is set."""
    s = areas.Strip(r); rate = r.uniform(64, 92); pp = 60 / rate; pr = r.uniform(0.13, 0.19)
    foci = [s.wide_tmpl(pol=1), s.wide_tmpl(pol=-1)] if n_foci > 1 else [s.wide_tmpl()]
    if CUR["ront"]:
        qt = float(np.clip(0.4 * np.sqrt(pp), 0.25, 0.44))
        coup = (qt - 0.038 * s.k - 2 * s.tw + r.uniform(-0.015, 0.015)) / pp
    else:
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


def install():
    S = areas.Strip
    _orig.update(init=S.__init__, W=S.W)
    S.__init__, S.P, S.T, S.N, S.W = f_init, f_P, f_T, f_N, f_W
    areas.pvc_strip = f_pvc_strip


def notes(s):
    """Plain-language list of what's notable about this strip's morphology."""
    fm, out = s.fm, []
    if fm["nP"]:
        out += [{"peaked": "tall, peaked P waves", "flat": "small, flat P waves", "notched": "notched (M-shaped) P waves",
                 "biphasic": "biphasic P waves"}.get(fm["p"])]
    if fm["nN"]:
        out += [{"inverted": "inverted T waves", "flat": "flattened T waves", "peaked": "tall, peaked T waves",
                 "biphasic": "biphasic T waves", "depressed": "ST depression"}.get(fm["t"])]
        out += ["U waves after the T" if fm["u"] else None, "J-point notching" if fm["j"] else None,
                "a small terminal notch (rSR′) in the QRS" if fm["rsr"] else None,
                {"low": "low QRS voltage", "high": "tall QRS voltage"}.get(fm["volt"])]
        if fm["delta"]:
            out.append("a delta wave (slurred QRS upstroke) with a short PR: pre-excitation (WPW pattern)")
    out = [x for x in out if x]
    out.append("small beat-to-beat changes in every complex, as on a real patient")
    return out


def delta_pr(s):
    prs = [(q - 0.038 * s.k - 0.05) - (p - 2 * s.pw) for p, q in s.pairs if 0 <= p and q < DUR]
    return float(np.mean(prs)) if prs else None
