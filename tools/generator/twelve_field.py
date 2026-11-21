"""Real-patient look for the third set of 12-lead ECGs (used by build_twelve.py).

While installed, ECG.build keeps the noise-free waveform (`clean`) exactly as before, so every finding is still
measured and rule-checked on it, but the displayed tracing (`noisy`) gets:
  * beat-to-beat amplitude variation and breathing-related amplitude change (every lead, every beat);
  * baseline wander that differs from lead to lead;
  * on some ECGs a burst of muscle tremor in the limb leads (shivering or a tense patient) or a trace of
    60-cycle interference. No electrode bumps: a sharp transient can look like an extra beat.
"""
import numpy as np
import twelve as T

t, LEADS = T.t, T.LEADS
LIMB = ["I", "II", "III", "aVR", "aVL", "aVF"]
_orig = {}


def field_build(self):
    self.timeline()
    self.clean = {ld: self.lead_signal(ld) for ld in LEADS}
    r = self.r
    centers = [c for c, _ in self.beats]
    gains = [1 + float(np.clip(r.normal(0, 0.05), -0.1, 0.1)) for _ in centers]
    beat_gain = np.interp(t, centers, gains)
    fr, ph = r.uniform(0.22, 0.4), r.uniform(0, 6.3)
    resp = 1 + r.uniform(0.04, 0.09) * np.sin(2 * np.pi * fr * t + ph)
    nz = r.uniform(0.004, 0.009)
    tremor = r.random() < 0.4
    if tremor:
        tc, tw = r.uniform(1.5, 8.5), r.uniform(1.0, 2.5)
        emg = np.convolve(r.normal(0, 1, t.size), np.ones(3) / 3, mode="same") * np.exp(-0.5 * ((t - tc) / (tw / 2.6)) ** 2) * r.uniform(0.02, 0.045)
    bump_lead = str(r.choice(LEADS)) if r.random() < 0.25 else None
    hum = r.uniform(0.006, 0.014) if r.random() < 0.15 else 0.0
    self.noisy = {}
    for ld in LEADS:
        y = self.clean[ld] * beat_gain * resp
        y = y + r.uniform(0.02, 0.09) * np.sin(2 * np.pi * fr * t + ph + r.uniform(-0.8, 0.8)) + r.normal(0, nz, t.size)
        if tremor and ld in LIMB:
            y = y + emg * (0.6 if ld in ("aVR", "aVL") else 1.0)
        if hum:
            y = y + hum * np.sin(2 * np.pi * 60 * t)
        if ld == bump_lead:
            col = T.COL_OF[ld]
            lo, hi = col * T.WIN + 0.3, (col + 1) * T.WIN - 0.3
            for _ in range(40):
                c = float(r.uniform(lo, hi))
                if all(abs(c - b) > 0.42 for b in centers):
                    m = t >= c
                    d = t[m] - c
                    r.uniform(0.15, 0.35); r.choice([-1, 1])   # draws kept so set 3 stays the same; no bump is added (it looked like an extra beat)
                    break
        self.noisy[ld] = y
    return self


def install():
    _orig["build"] = T.ECG.build
    T.ECG.build = field_build


def uninstall():
    T.ECG.build = _orig["build"]
