"""Teaching marks for the 12-lead ECGs, shown in the app after a wrong answer.

For each ECG this records the beat timings plus, lead by lead, what proves the correct finding, measured on the
noise-free waveform: ST elevation and reciprocal depression (with the size in mm), Q waves, peaked / inverted /
biphasic T waves, U waves, J-point notches, rSR', broad QS and notched R waves, delta waves, voltage, PR segment
shifts and the QT interval. Each mark has a kind; the app gives every kind its own color:
  stu = ST elevation (red)      rec / std = ST depression (blue)     q = Q wave (orange)
  tpk / tinv / tbi = T-wave change (purple)                          u / qt = U wave, QT (amber)
  rsr / sw / qs / notch / delta / volt / tallr = QRS and conduction (teal)      pr = PR segment (green)
  j / brug / dw = J point and ST shape (red family)
"""
import numpy as np
import twelve as T

LEADS = T.LEADS


def mm(v):
    return f"{abs(v) * 10:.1f}".rstrip("0").rstrip(".")


def marks(cat, e):
    st = {ld: e.st60(ld) for ld in LEADS}
    f = []
    add = lambda ld, kind, label, v=0.0: f.append([ld, kind, label, round(float(v), 3)])
    up = [ld for ld in LEADS if st[ld] >= 0.1]
    dn = [ld for ld in LEADS if st[ld] <= -0.1]
    stemi = cat in ("Inferior STEMI", "Anterior STEMI", "Lateral STEMI", "Anterolateral STEMI")
    if stemi:
        for ld in up:
            add(ld, "stu", f"ST ↑ {mm(st[ld])} mm", st[ld])
            if e.lead[ld]["q"] >= 0.12:
                add(ld, "q", "Q wave", -e.lead[ld]["q"])
        for ld in dn:
            add(ld, "rec", f"reciprocal ST ↓ {mm(st[ld])} mm", st[ld])
    elif cat == "ST elevation in aVR with diffuse ST depression":
        for ld in up:
            add(ld, "stu", f"ST ↑ {mm(st[ld])} mm", st[ld])
        for ld in dn:
            add(ld, "rec", f"diffuse ST ↓ {mm(st[ld])} mm", st[ld])
    elif cat == "Posterior MI":
        for ld in ("V1", "V2", "V3"):
            if st[ld] <= -0.08:
                add(ld, "rec", f"ST ↓ {mm(st[ld])} mm (posterior mirror)", st[ld])
                add(ld, "tallr", "tall R (R > S)", e.qrs_parts(ld)[0])
    elif cat == "Right bundle branch block (RBBB)":
        for ld in LEADS:
            k = e.lead[ld]["kind"]
            if k == "rsr":
                add(ld, "rsr", "rSR′ (rabbit ears)", e.qrs_parts(ld)[0])
            elif k == "rs_wide":
                add(ld, "sw", "wide, slurred S", e.qrs_parts(ld)[1])
    elif cat == "Left bundle branch block (LBBB)":
        for ld in LEADS:
            k = e.lead[ld]["kind"]
            if k == "qs_wide":
                add(ld, "qs", "broad, deep QS", e.qrs_parts(ld)[1])
            elif k == "notched":
                add(ld, "notch", "broad, notched R", e.qrs_parts(ld)[0])
    elif cat == "Hyperkalemia":
        for ld in LEADS:
            tp = e.tpeak(ld)
            if tp >= 0.55:
                add(ld, "tpk", "peaked T", tp)
    elif cat == "Pericarditis":
        for ld in up:
            add(ld, "stu", f"ST ↑ {mm(st[ld])} mm (concave)", st[ld])
        for ld in LEADS:
            pr = e.prseg(ld)
            if pr <= -0.03:
                add(ld, "pr", "PR ↓", pr)
            elif pr >= 0.03:
                add(ld, "pr", "PR ↑ (aVR)", pr)
    elif cat == "Wellens syndrome":
        for ld in ("V2", "V3", "V1", "V4"):
            tmin = e.t_extreme(ld, np.min)
            if tmin <= -0.15:
                add(ld, "tbi" if e.lead[ld]["tb"] else "tinv", "biphasic T" if e.lead[ld]["tb"] else "deep T inversion", tmin)
    elif cat == "De Winter T waves":
        for ld in LEADS:
            if e.lead[ld]["dw"]:
                add(ld, "dw", "upsloping ST ↓ → tall T", e.st_at(ld, 0.015))
        if st["aVR"] >= 0.05:
            add("aVR", "stu", f"ST ↑ {mm(st['aVR'])} mm", st["aVR"])
    elif cat == "Left ventricular hypertrophy (LVH) with strain":
        for ld in ("V1", "V2"):
            add(ld, "volt", f"deep S {mm(e.qrs_parts(ld)[1])} mm", e.qrs_parts(ld)[1])
        for ld in ("V5", "V6"):
            add(ld, "volt", f"tall R {mm(e.qrs_parts(ld)[0])} mm", e.qrs_parts(ld)[0])
        for ld in ("I", "aVL", "V5", "V6"):
            tmin = e.t_extreme(ld, np.min)
            if tmin <= -0.1:
                add(ld, "tinv", "strain: ST ↓, T inverted", tmin)
    elif cat == "Benign early repolarization":
        for ld in up:
            add(ld, "j", f"ST ↑ {mm(st[ld])} mm + J notch", st[ld])
    elif cat == "Hypokalemia":
        for ld in LEADS:
            if e.lead[ld]["u"] and e.u_peak(ld) > 0.08:
                add(ld, "u", "U wave", e.u_peak(ld))
    elif cat == "Brugada pattern":
        for ld in ("V1", "V2"):
            add(ld, "brug", f"coved ST ↑ {mm(e.st_at(ld, 0.02))} mm → inverted T", e.st_at(ld, 0.02))
    elif cat == "Wolff-Parkinson-White (WPW) pattern":
        for ld in LEADS:
            if e.lead[ld]["delta"] > 0.05:
                add(ld, "delta", "delta wave", e.lead[ld]["delta"])
    out = {"b": [[int(round(c * 1000)), int(round(e.tp(c, rr) * 1000))] for c, rr in e.beats if 0 < c < T.DUR],
           "d": int(round(e.d * 1000)), "f": f}
    wide = {ld: int(round(e.lead[ld]["d"] * 1000)) for ld in LEADS if "d" in e.lead[ld]}
    if wide:
        out["ld"] = wide
    if cat == "Long QT":
        qt, qtc = e.qtc()
        c, rr = e.beats[2]
        out["qt"] = [int(round((c - e.d / 2) * 1000)), int(round((c - e.d / 2 + qt) * 1000)), f"QT {qt:.2f} s · QTc {qtc:.2f} s"]
    if cat == "Wolff-Parkinson-White (WPW) pattern":
        out["spr"] = "short PR (< 0.12 s)"
    return out
