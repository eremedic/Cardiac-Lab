"""102 unique practice strips: 17 each of sinus, atrial, junctional, ventricular, AV block and paced."""
import numpy as np
import ecg2 as E

g, DUR = E.g, E.DUR
NARROW, WIDE = "Narrow (≈ 0.08 s)", "Wide (≥ 0.12 s)"

# category: (group, defining features, the tell)
CAT = {
 # ---- sinus ----
 "Normal sinus rhythm": ("sinus", "Rate 60–100, regular, upright P before every QRS, PR 0.12–0.20 s, narrow QRS.", "Everything is normal. Look for the problem in the patient, not the strip."),
 "Sinus bradycardia": ("sinus", "Sinus rhythm (normal P, normal PR, narrow QRS) at a rate below 60.", "Every beat is a normal sinus beat. Only the rate is slow."),
 "Sinus tachycardia": ("sinus", "Sinus rhythm at 100–150 with a visible upright P before each QRS.", "Visible upright P waves at under 150 point to sinus tachycardia, a response to something else."),
 "Sinus arrhythmia": ("sinus", "Identical sinus beats whose R–R interval speeds up and slows down in a smooth cycle.", "The P waves never change. Only the spacing changes, gradually."),
 "Sinus arrest (pause)": ("sinus", "Sinus rhythm interrupted by a pause that is NOT a multiple of the normal P–P interval.", "Measure the pause: it doesn't fit a whole number of normal cycles."),
 "Sinoatrial (SA) exit block": ("sinus", "A dropped P–QRS–T where the pause is exactly two normal P–P intervals.", "March out the P waves: the missing beat lands exactly where one was due."),
 "Pulseless electrical activity (PEA)": ("sinus", "An organized rhythm with no palpable pulse.", "The strip looks organized, but the scenario says there is no pulse."),
 # ---- atrial ----
 "Premature atrial contractions (PACs)": ("atrial", "Sinus rhythm with an early beat whose P wave looks different; narrow QRS; non-compensatory pause.", "Find the early beat and check that it has its own odd-shaped P wave."),
 "Wandering atrial pacemaker": ("atrial", "Rate under 100 with at least 3 different P-wave shapes and a varying PR.", "The P waves keep changing shape, but the rate stays below 100."),
 "Multifocal atrial tachycardia (MAT)": ("atrial", "Rate over 100, irregular, with at least 3 different P-wave shapes and a varying PR.", "It's irregular like AF but has distinct P waves of changing shapes."),
 "Supraventricular tachycardia (SVT)": ("atrial", "Regular narrow-complex tachycardia at 150–250 with no visible P waves.", "Narrow, regular and fast, with the P waves hidden."),
 "Atrial flutter": ("atrial", "Sawtooth flutter waves at about 300/min; ventricular rate set by the conduction ratio.", "Look between the QRS complexes for the sawtooth baseline."),
 "Atrial fibrillation": ("atrial", "Irregularly irregular narrow QRS complexes with no P waves and a wavy fibrillatory baseline.", "No two R–R intervals match and there are no P waves."),
 # ---- junctional ----
 "Junctional rhythm": ("junctional", "Regular narrow QRS at 40–60; P waves absent, inverted before the QRS with a short PR, or inverted after it.", "Narrow and 40–60, with no normal upright P waves."),
 "Junctional bradycardia": ("junctional", "Junctional rhythm (no normal P waves, narrow QRS) at a rate below 40.", "It looks junctional but is slower than the 40–60 escape rate."),
 "Accelerated junctional rhythm": ("junctional", "Junctional rhythm at 60–100: narrow QRS, no normal P waves.", "It's narrow and regular with no upright P, at a normal rate."),
 "Junctional tachycardia": ("junctional", "Junctional rhythm over 100; inverted P waves with a short PR (or none).", "Inverted P waves sit just before each QRS at a rate over 100."),
 "Premature junctional contractions (PJCs)": ("junctional", "Sinus rhythm with an early narrow beat that has an inverted P (short PR) or no P.", "The early beat is narrow, and its P wave is inverted or missing."),
 "Junctional escape beat": ("junctional", "After a sinus pause, a late narrow beat appears with no normal P wave.", "The odd beat comes LATE, after a pause, not early."),
 # ---- ventricular ----
 "Sinus rhythm with unifocal PVCs": ("ventricular", "Sinus rhythm with early, wide, bizarre beats of one shape and no P wave.", "The early wide beats all look the same."),
 "Ventricular bigeminy": ("ventricular", "Every other beat is a PVC: sinus, PVC, sinus, PVC.", "Normal and wide beats alternate."),
 "Ventricular trigeminy": ("ventricular", "Every third beat is a PVC: sinus, sinus, PVC.", "Two normal beats, then one wide, repeating."),
 "PVC couplet": ("ventricular", "Two PVCs in a row within a sinus rhythm.", "Two consecutive wide beats. Three or more in a row is VT."),
 "Multifocal PVCs": ("ventricular", "PVCs of two or more different shapes.", "Compare the wide beats: they look different from each other."),
 "Non-sustained VT (run of VT)": ("ventricular", "Three or more consecutive PVCs at > 100/min, lasting under 30 seconds, then sinus resumes.", "A burst of wide beats starts and stops within the strip."),
 "Idioventricular rhythm": ("ventricular", "Regular wide QRS at 20–40, no P waves.", "Wide and very slow with no P waves means the ventricles are pacing themselves."),
 "Accelerated idioventricular rhythm (AIVR)": ("ventricular", "Wide-QRS ventricular rhythm at 40–100 with no P waves.", "It looks like idioventricular rhythm but faster. It's common after reperfusion."),
 "Monomorphic ventricular tachycardia": ("ventricular", "Regular, wide, identical complexes over 100 (often 150–250); no P waves.", "Wide, fast and every complex the same."),
 "Polymorphic VT (torsades de pointes)": ("ventricular", "Wide rapid complexes that twist, growing and shrinking around the baseline.", "The amplitude waxes and wanes, so the complexes seem to twist."),
 "Ventricular fibrillation (coarse)": ("ventricular", "Chaotic, irregular waves of varying size; no identifiable P, QRS or T.", "No organized complexes at all, with large waves."),
 "Ventricular fibrillation (fine)": ("ventricular", "Low-amplitude chaotic undulation with no organized complexes.", "Small chaotic waves are still VF and still shockable. Asystole would be nearly flat."),
 "VT degenerating into VF": ("ventricular", "An organized wide tachycardia that breaks down into chaotic fibrillation.", "Compare the start and end of the strip: organized becomes chaotic."),
 "Asystole": ("ventricular", "No electrical activity: a nearly flat line.", "No complexes and no P waves. Always confirm leads, gain and a second lead."),
 "P-wave asystole (ventricular standstill)": ("ventricular", "P waves continue but no QRS complexes follow.", "The atria are firing, but there is no ventricular activity."),
 "Agonal rhythm": ("ventricular", "Very slow (< 20), very wide, low-amplitude complexes.", "Broad, shapeless and very slow complexes are the signature of a dying heart."),
 # ---- blocks ----
 "1st-degree AV block": ("block", "Every P conducts, but the PR is > 0.20 s and constant.", "The PR is long but never changes, and no beats drop."),
 "2nd-degree AV block type I (Wenckebach)": ("block", "PR lengthens progressively until a P is not conducted; grouped beating.", "The PR gets longer, longer, longer, then a beat drops."),
 "2nd-degree AV block type II (Mobitz II)": ("block", "Constant PR on conducted beats, then a P suddenly isn't conducted; QRS often wide.", "The PR never changes before the dropped beat."),
 "2nd-degree AV block, 2:1": ("block", "Every other P is conducted, with a constant PR on conducted beats.", "Two P waves for every QRS, and the type can't be determined from 2:1 alone."),
 "Advanced (high-grade) AV block": ("block", "Two or more consecutive P waves not conducted (3:1, 4:1); conducted beats have a constant PR.", "Several P waves in a row are blocked, yet each QRS still has a constant PR."),
 "3rd-degree (complete) AV block": ("block", "P waves and QRS complexes are each regular but completely independent (AV dissociation).", "The P waves march through at their own rate and the PR is never the same."),
 # ---- paced ----
 "Atrial paced rhythm": ("paced", "A pacer spike before each P wave, then normal conduction with a narrow QRS.", "The spike comes before the P wave, not before the QRS."),
 "Ventricular paced rhythm": ("paced", "A pacer spike before each wide QRS, unrelated to P waves.", "One spike per beat, followed by a wide QRS."),
 "AV sequential (dual-chamber) paced rhythm": ("paced", "Two spikes per beat: atrial spike → P, ventricular spike → wide QRS.", "Count the spikes: two per beat."),
 "Atrial-sensed, ventricular paced rhythm": ("paced", "Native sinus P waves, each followed by a ventricular spike and wide QRS.", "The P waves are the patient's own and only the ventricle is paced."),
 "Demand (VVI) pacing with native beats": ("paced", "Native beats, then paced beats appear only when the native rate drops.", "The pacer stays quiet until it's needed."),
 "Pacemaker failure to capture": ("paced", "Pacer spikes appear, but some are not followed by a P or QRS.", "Look for a spike with nothing after it."),
 "Pacemaker failure to sense (undersensing)": ("paced", "Spikes fire at a fixed rate regardless of native beats, landing on QRS or T waves.", "The spikes ignore the patient's own beats."),
 "Pacemaker failure to pace (oversensing)": ("paced", "A pause longer than the pacing interval with no spike.", "There's a gap where a spike should be."),
 "Transcutaneous pacing with capture": ("paced", "Large pacing artifacts, each followed by a wide QRS and broad T wave.", "Every artifact has a QRS and T after it, which is electrical capture."),
 "Transcutaneous pacing without capture": ("paced", "Large pacing artifacts not followed by a QRS; the underlying rhythm continues independently.", "The artifacts appear but the ventricles don't respond, so increase the mA."),
 "Pacer spikes without capture (asystole)": ("paced", "Regular pacer spikes on an otherwise flat line: no capture at all.", "Spikes but no P waves or QRS complexes, so this is an arrest."),
}
GROUP_EXTRA = {
 "sinus": ["1st-degree AV block", "Junctional rhythm", "Atrial fibrillation"],
 "atrial": ["Sinus tachycardia", "Junctional tachycardia", "Normal sinus rhythm"],
 "junctional": ["Sinus bradycardia", "Supraventricular tachycardia (SVT)", "Premature atrial contractions (PACs)"],
 "ventricular": ["Atrial fibrillation", "Pulseless electrical activity (PEA)"],
 "block": ["Sinus bradycardia", "Junctional rhythm", "Atrial flutter"],
 "paced": ["Idioventricular rhythm", "3rd-degree (complete) AV block"],
}
GROUP_LABEL = {"sinus": "Sinus", "atrial": "Atrial", "junctional": "Junctional", "ventricular": "Ventricular", "block": "AV blocks", "paced": "Paced"}


# ---------------- new builders ----------------
def qrs_only(s, c, amp=1.0, t_amp=0.25):
    s.y += g(c - 0.022, -0.1, 0.008) + g(c, amp, 0.01) + g(c + 0.024, -0.28, 0.009)
    if t_amp:
        s.y += g(c + 0.26, t_amp, 0.04)
    if 0 <= c < DUR:
        s.q.append(c)


def sinus_arr(base, depth, seed):
    s = E.S(seed); b = 0.15; i = 0
    while b < DUR + 0.3:
        s.P(b); s.Q(b + 0.16)
        b += base + depth * np.sin(i * 0.9); i += 1
    return s


def sinus_arrest(times, seed):
    s = E.S(seed)
    for b in times:
        s.P(b); s.Q(b + 0.16)
    return s


def sa_exit(rate, drop, seed):
    s = E.S(seed); pp = 60 / rate
    for i, b in enumerate(np.arange(0.15, DUR + 0.3, pp)):
        if i != drop:
            s.P(b); s.Q(b + 0.16)
    return s


def pac(rate, at, seed):
    s = E.S(seed); pp = 60 / rate; b = 0.15; i = 0
    while b < DUR + 0.3:
        if i == at:
            s.P(b, 0.24, 0.015); s.y += g(b + 0.02, -0.07, 0.01); s.Q(b + 0.14)
            b += pp * 1.1
        else:
            s.P(b); s.Q(b + 0.16)
            b += pp * (0.62 if i + 1 == at else 1)
        i += 1
    return s


def multi_p(intervals, seed):
    s = E.S(seed); b = 0.1; i = 0
    shapes = [(0.2, 0.022, 0.16), (-0.15, 0.02, 0.12), (0.28, 0.014, 0.18), (0.09, 0.03, 0.14), (0.16, 0.026, 0.2)]
    while b < DUR - 0.15:
        a, w, pr = shapes[i % 5]
        s.P(b, a, w); s.Q(b + pr)
        b += intervals[i % len(intervals)]; i += 1
    return s


def svt(rate, seed):
    s = E.S(seed)
    for q in np.arange(0.12, DUR + 0.3, 60 / rate):
        qrs_only(s, q, 1.0, 0.2)
    return s


def flutter(ratios, seed):
    s = E.S(seed)
    ph = (E.t * 5.0) % 1.0
    s.y += np.where(ph < 0.8, -0.22 * (ph / 0.8), -0.22 + 0.22 * ((ph - 0.8) / 0.2)) + 0.11
    q = 0.17; i = 0
    while q < DUR + 0.3:
        qrs_only(s, q, 1.05, 0)
        q += ratios[i % len(ratios)] * 0.2; i += 1
    return s


def afib(lo, hi, seed):
    s = E.S(seed); r = np.random.default_rng(seed)
    for f in (6.3, 7.7, 9.1, 5.1):
        s.y += 0.035 * np.sin(2 * np.pi * f * E.t + r.uniform(0, 6)) * (1 + 0.5 * np.sin(2 * np.pi * 0.7 * E.t + r.uniform(0, 6)))
    q = 0.2
    while q < DUR + 0.3:
        qrs_only(s, q, 1.05, 0.18)
        q += r.uniform(lo, hi)
    return s


def junct(rate, p_mode, seed, kind="n"):
    """p_mode: 'before' inverted P short PR, 'after' retrograde P after QRS, 'none'."""
    s = E.S(seed)
    for q in np.arange(0.4, DUR + 0.3, 60 / rate):
        if p_mode == "before":
            s.y += g(q - 0.085, -0.21, 0.02)
        elif p_mode == "after":
            s.y += g(q + 0.11, -0.19, 0.02)
        if rate > 100:
            qrs_only(s, q, 1.0, 0.2)
        else:
            s.Q(q)
    return s


def pjc(rate, at, seed, p_mode="before"):
    s = E.S(seed); pp = 60 / rate; b = 0.15; i = 0
    while b < DUR + 0.3:
        if i == at:
            q = b + 0.16
            if p_mode == "before":
                s.y += g(q - 0.08, -0.21, 0.02)
            s.Q(q); b += pp * 1.05
        else:
            s.P(b); s.Q(b + 0.16); b += pp * (0.65 if i + 1 == at else 1)
        i += 1
    return s


def junct_escape(rate, pause_after, gap, seed):
    s = E.S(seed); pp = 60 / rate; b = 0.15; i = 0
    while b < DUR + 0.3:
        s.P(b); s.Q(b + 0.16)
        if i == pause_after:
            q = b + 0.16 + gap
            s.Q(q)
            b = q - 0.16 + pp * 0.95
        else:
            b += pp
        i += 1
    return s


def nsvt(seed):
    s = E.S(seed)
    for b in (0.15, 0.95, 1.75):
        s.P(b); s.Q(b + 0.16)
    for k in range(5):
        s.Q(2.38 + k * 0.36, "v")
    for b in (4.55, 5.35):
        s.P(b); s.Q(b + 0.16)
    return s


def vt_mono(rate, seed):
    return E.vt(rate, seed)


# ---------------- the 102 items ----------------
ITEMS = []


def T(cat, st, stem, rhythm, p, pr, qrs, action, rate=None, spikes=None, name=None):
    assert cat in CAT, cat
    rows = [["Rate", rate or E.vr(st)], ["Rhythm", rhythm], ["P waves", p], ["PR interval", pr], ["QRS", qrs]]
    if spikes:
        rows.append(["Pacer spikes", spikes])
    ITEMS.append({"cat": cat, "name": name or cat, "st": st, "stem": stem, "rows": rows, "action": action})


def build():
    ITEMS.clear()
    UP = "Upright, one before each QRS"
    # ===== SINUS (17) =====
    for r, sd, stem in ((64, 101, "Post-op check, comfortable."), (75, 102, "58-year-old, dizzy after standing; now well."), (88, 103, "Routine monitoring before transfer.")):
        T("Normal sinus rhythm", E.sinus(r, seed=sd), stem, "Regular", UP, "0.16 s", NARROW, ["Normal rhythm: assess the patient for a non-cardiac cause", "Vitals, glucose, history"])
    for r, sd, stem in ((54, 104, "Sleeping 40-year-old, BP 118/72."), (48, 105, "Fit 30-year-old runner, asymptomatic."), (42, 106, "Hypothermic 70-year-old, BP 92/58, drowsy.")):
        T("Sinus bradycardia", E.sinus(r, seed=sd), stem, "Regular", UP, "0.16 s", NARROW, ["Asymptomatic: no treatment", "Symptomatic: atropine 1 mg IV, then pacing or infusion"])
    for r, pr, sd, stem in ((110, 0.15, 107, "Patient in pain from a femur fracture."), (125, 0.14, 108, "Febrile 70-year-old, BP 96/60."), (140, 0.12, 109, "Trauma patient, pale, BP 88/60.")):
        T("Sinus tachycardia", E.sinus(r, pr=pr, kind="nq", seed=sd), stem, "Regular", UP, f"{pr:.2f} s", NARROW, ["A response: treat the cause (pain, fever, bleeding, hypoxia)", "Don't try to slow it down"])
    for base, depth, sd, stem in ((0.85, 0.25, 110, "Healthy 19-year-old; rate varies with breathing."), (1.0, 0.3, 111, "Relaxed 25-year-old athlete.")):
        T("Sinus arrhythmia", sinus_arr(base, depth, sd), stem, "Irregular, cyclic with respiration", "Upright, identical", "0.16 s, constant", NARROW, ["Normal variant, common in the young", "No treatment"])
    for times, sd, stem in (([0.15, 0.97, 1.79, 4.25, 5.07, 5.89], 112, "80-year-old with near-syncope."), ([0.2, 0.92, 1.64, 2.36, 4.85, 5.57], 113, "Patient on a beta-blocker who 'fainted at church'.")):
        T("Sinus arrest (pause)", sinus_arrest(times, sd), stem, "Regular, interrupted by a pause", "Upright; none during the pause", "0.16 s", NARROW, ["Pause isn't a multiple of the P–P: sinus node failure", "Pads on; atropine or pacing if symptomatic"])
    for r, drop, sd, stem in ((72, 3, 114, "Elderly patient, occasional lightheadedness."), (60, 3, 115, "Patient on digoxin, mild fatigue.")):
        T("Sinoatrial (SA) exit block", sa_exit(r, drop, sd), stem, "Regular, with one dropped cycle", "Upright; one cycle missing", "0.16 s", NARROW, ["The pause is exactly 2 P–P intervals", "Monitor; treat as bradycardia if symptomatic"])
    for r, kind, sd, stem in ((92, "n", 116, "Monitor shows this, but there is NO carotid or femoral pulse."), (130, "nq", 117, "Hard to ventilate, absent breath sounds right; no pulse.")):
        T("Pulseless electrical activity (PEA)", E.sinus(r, pr=0.14, kind=kind, seed=sd), stem, "Regular", UP, "0.14 s", NARROW, ["Organized rhythm + no pulse = PEA", "CPR, epinephrine ASAP, hunt the H's and T's"])
    # ===== ATRIAL (17) =====
    for r, at, sd, stem in ((75, 3, 118, "Smoker with occasional 'flutters' in the chest."), (68, 4, 119, "Anxious patient after three coffees.")):
        T("Premature atrial contractions (PACs)", pac(r, at, sd), stem, "Irregular at the early beat", "Early beat has an abnormal P", "Normal; may differ on the PAC", NARROW, ["Usually benign: reduce triggers", "Frequent PACs can precede AF or SVT"])
    for iv, sd, stem in (([0.86, 0.9, 0.82, 0.95, 0.88], 120, "Sleeping athlete, no complaints."), ([0.76, 0.8, 0.72, 0.84, 0.78], 121, "Elderly patient, routine check.")):
        st = multi_p(iv, sd)
        T("Wandering atrial pacemaker", st, stem, "Slightly irregular", "≥ 3 shapes, changing beat to beat", "Varies", NARROW, ["Usually benign; no treatment", "If the rate is over 100, it's MAT"])
    for iv, sd, stem in (([0.46, 0.58, 0.42, 0.62, 0.5], 122, "COPD patient, SpO₂ 84%."), ([0.42, 0.5, 0.38, 0.54, 0.46], 123, "Pneumonia, working hard to breathe.")):
        T("Multifocal atrial tachycardia (MAT)", multi_p(iv, sd), stem, "Irregularly irregular", "≥ 3 shapes, changing beat to beat", "Varies", NARROW, ["Treat the cause: oxygen, bronchodilators", "Cardioversion is not effective"])
    for r, sd, stem in ((160, 124, "Sudden palpitations, BP 122/80, alert."), (185, 125, "Young woman, abrupt-onset racing heart."), (215, 126, "Pale, BP 82/50, chest discomfort.")):
        act = ["Unstable: synchronized cardioversion 50–100 J"] if r == 215 else ["Stable: vagal maneuver, then adenosine 6 mg rapid push, then 12 mg", "Record the strip during adenosine"]
        T("Supraventricular tachycardia (SVT)", svt(r, sd), stem, "Regular", "Not visible", "Not measurable", NARROW, act)
    for ratios, label, sd, stem in (([4], "4:1", 127, "75-year-old with palpitations."), ([2], "2:1", 128, "Regular rate of exactly ~150, BP 110/70."), ([3], "3:1", 129, "Known flutter, routine transport."), ([2, 4, 3, 4, 2, 3], "variable", 130, "Irregular pulse, mild dyspnea.")):
        st = flutter(ratios, sd)
        T("Atrial flutter", st, stem, "Regular" if len(ratios) == 1 else "Irregular (variable block)", "Sawtooth F waves ~300/min", "Not measured", NARROW,
          ["Stable: rate control per protocol", "Unstable: synchronized cardioversion 50–100 J"], name=f"Atrial flutter with {label} conduction")
    for lo, hi, label, sd, stem in ((0.55, 1.0, "controlled rate", 131, "On anticoagulants, routine transfer."), (0.32, 0.55, "rapid ventricular response", 132, "Palpitations and dyspnea, BP 104/70."), (0.95, 1.6, "slow ventricular response", 133, "On digoxin, fatigued."), (0.45, 0.75, "moderate rate", 134, "New palpitations since yesterday.")):
        T("Atrial fibrillation", afib(lo, hi, sd), stem, "Irregularly irregular", "None; fibrillatory baseline", "None", NARROW,
          ["Stable: rate control per protocol; ask about onset and anticoagulants", "Unstable: synchronized cardioversion 120–200 J"], name=f"Atrial fibrillation, {label}")
    # ===== JUNCTIONAL (17) =====
    for r, pm, sd, stem, ptxt in ((48, "before", 135, "67-year-old on a beta-blocker, BP 100/64.", "Inverted, just before the QRS"), (52, "after", 136, "Digoxin patient, nauseated.", "Inverted, just after the QRS"), (44, "none", 137, "Post-cardiac surgery patient, stable.", "Not visible")):
        T("Junctional rhythm", junct(r, pm, sd), stem, "Regular", ptxt, "Short (< 0.12 s)" if pm == "before" else "Not measurable", NARROW, ["Junctional escape (40–60/min)", "Treat as bradycardia if symptomatic; review medications"])
    for r, pm, sd, stem in ((36, "before", 138, "Calcium-channel-blocker overdose, BP 78/40."), (30, "none", 139, "Hypothermic, HR in the 30s.")):
        T("Junctional bradycardia", junct(r, pm, sd), stem, "Regular", "Inverted, just before the QRS" if pm == "before" else "Not visible", "Short" if pm == "before" else "Not measurable", NARROW, ["Below the normal junctional rate", "Atropine; pacing or infusion if unstable; treat toxin or temperature"])
    for r, pm, sd, stem in ((70, "none", 140, "Post-MI day 2, stable."), (82, "after", 141, "Digoxin patient, seeing yellow halos."), (95, "before", 142, "Post-op cardiac patient, BP 110/70.")):
        T("Accelerated junctional rhythm", junct(r, pm, sd), stem, "Regular", {"none": "Not visible", "after": "Inverted, after the QRS", "before": "Inverted, before the QRS"}[pm], "Short" if pm == "before" else "Not measurable", NARROW, ["Rate 60–100 from the junction", "Consider digoxin toxicity or ischemia; monitor"])
    for r, sd, stem in ((110, 143, "Digoxin toxicity suspected, BP 108/70."), (125, 144, "Post-cardiac surgery, BP 100/62."), (145, 145, "Theophylline overdose, anxious.")):
        T("Junctional tachycardia", junct(r, "before", sd), stem, "Regular", "Inverted, just before the QRS", "Short (< 0.12 s)", NARROW, ["Treat the cause (digoxin, ischemia, stimulants)", "Unstable: treat per the tachycardia algorithm"])
    for r, at, sd, pm, stem in ((75, 3, 146, "before", "Healthy adult, feels a 'skip'."), (68, 4, 147, "none", "Patient on digoxin, mild nausea."), (82, 2, 148, "before", "Caffeine and energy drinks before a night shift.")):
        T("Premature junctional contractions (PJCs)", pjc(r, at, sd, pm), stem, "Irregular at the early beat", "Early beat: inverted P" if pm == "before" else "Early beat: no P wave", "Short on the PJC", NARROW, ["Usually benign", "Treat the cause; check digoxin level"])
    for r, pa, gap, sd, stem in ((70, 2, 1.55, 149, "Elderly patient with a brief dizzy spell."), (56, 2, 1.8, 150, "Sleeping patient on a beta-blocker."), (78, 1, 1.45, 151, "Vagal episode during vomiting.")):
        T("Junctional escape beat", junct_escape(r, pa, gap, sd), stem, "Irregular at the pause", "Normal, except none on the late beat", "0.16 s on sinus beats", NARROW, ["A protective escape: never suppress it", "Find the cause of the sinus pause"])
    # ===== VENTRICULAR (17) =====
    T("Sinus rhythm with unifocal PVCs", E.with_pvcs("NNNVNNN", seed=152), "62-year-old with palpitations.", "Regular except the early beat", "Absent before the PVC", "0.16 s on sinus beats", "Narrow; the PVC is wide and bizarre", ["Treat the patient, not the ectopy", "Check for hypoxia, ischemia, electrolytes"])
    T("Ventricular bigeminy", E.with_pvcs("NV", rr=0.84, couple=0.46, seed=153), "74-year-old with chest tightness.", "Regularly irregular", "Before sinus beats only", "0.16 s on sinus beats", "Alternating narrow and wide", ["Consider ischemia, electrolytes, digoxin", "12-lead; watch for runs of VT"])
    T("Ventricular trigeminy", E.with_pvcs("NNV", rr=0.85, couple=0.48, seed=154), "COPD patient with low potassium.", "Regularly irregular", "Before sinus beats only", "0.16 s on sinus beats", "Two narrow, then one wide", ["Correct K⁺, hypoxia, ischemia", "Monitor"])
    T("PVC couplet", E.with_pvcs("NNNVVNN", seed=155), "55-year-old post-MI, 'skipped beats'.", "Irregular at the couplet", "Before sinus beats only", "0.16 s on sinus beats", "Two consecutive wide PVCs", ["Irritable ventricle: monitor closely", "12-lead; pads ready"])
    T("Multifocal PVCs", E.with_pvcs("NNVNNNWN", rr=0.78, couple=0.46, seed=156), "Septic patient, SpO₂ 86%.", "Irregular", "Before sinus beats only", "0.16 s on sinus beats", "PVCs of different shapes", ["Fix hypoxia; check electrolytes", "12-lead"])
    T("Non-sustained VT (run of VT)", nsvt(157), "Post-MI patient, felt a 'flutter' and lightheadedness.", "Irregular: a 5-beat run", "Before sinus beats only", "0.16 s on sinus beats", "Wide during the run", ["Pads on; 12-lead; check electrolytes", "Treat ischemia; expert consult"])
    T("Idioventricular rhythm", E.idio(34, 158), "Unresponsive 82-year-old; weak pulse, BP 70/40.", "Regular", "None", "None", WIDE, ["Ventricular escape: never suppress it", "Pacing and perfusion support; if pulseless, treat as PEA"])
    T("Accelerated idioventricular rhythm (AIVR)", E.idio(66, 159), "10 minutes after STEMI reperfusion.", "Regular", "None", "None", WIDE, ["Reperfusion rhythm, usually transient", "No antiarrhythmics if the patient is perfusing"])
    T("Monomorphic ventricular tachycardia", vt_mono(170, 160), "Pulseless 59-year-old, bystander CPR.", "Regular", "Not seen", "None", "Wide, uniform", ["Pulseless VT: defibrillate", "Then CPR and the VF/pVT algorithm"])
    T("Monomorphic ventricular tachycardia", vt_mono(205, 161), "Pale, diaphoretic, BP 70 systolic, has a pulse.", "Regular", "Not seen", "None", "Wide, uniform", ["Unstable with a pulse: synchronized cardioversion 100 J", "Sedate if time allows"])
    T("Polymorphic VT (torsades de pointes)", E.torsades(162), "On methadone, long QT; collapses.", "Irregular", "None", "None", "Wide, twisting", ["Pulseless: defibrillate (unsynchronized)", "Magnesium sulfate 1–2 g IV/IO"], rate="≈ 240/min")
    T("Ventricular fibrillation (coarse)", E.vf(0.45, 163), "Witnessed collapse at a mall; pulseless.", "Chaotic", "None", "None", "No identifiable QRS", ["Shock immediately, resume CPR", "Epinephrine after initial shocks; then an antiarrhythmic"], rate="Not measurable")
    T("Ventricular fibrillation (fine)", E.vf(0.13, 164), "Unwitnessed arrest, ~10 min down-time.", "Chaotic, low amplitude", "None", "None", "No identifiable QRS", ["Still shockable: defibrillate", "Confirm it isn't asystole (leads, gain)"], rate="Not measurable")
    T("VT degenerating into VF", E.vt_to_vf(165), "Patient with a pulse loses consciousness during the strip.", "Regular, then chaotic", "None", "None", "Wide, then no QRS", ["Now pulseless and shockable: defibrillate", "Begin the VF/pVT algorithm"], rate="VT ≈ 180/min → VF")
    T("Asystole", E.asystole(166), "Found unresponsive, cool to touch; CPR started.", "None", "None", "None", "None", ["Confirm in 2 leads; check leads and gain", "CPR + epinephrine ASAP"], rate="0, no electrical activity")
    st = E.p_asystole(167)
    T("P-wave asystole (ventricular standstill)", st, "Pulseless; monitor shows only small bumps.", "P–P regular; no QRS", "Present, no QRS follows", "None", "None", ["Treat as asystole: CPR, epinephrine", "Pacing is not recommended in arrest"], rate=f"Atrial {E.ar(st)}; ventricular 0")
    T("Agonal rhythm", E.idio(17, 168, kind="agonal"), "Arrest, 25 min of resuscitation, no ROSC.", "Very slow, irregular", "None", "None", "Very wide, low amplitude", ["Treat as PEA if pulseless", "Often terminal; consider TOR with medical direction"], rate="< 20/min")
    # ===== BLOCKS (17) =====
    for r, pr, sd, stem in ((65, 0.28, 169, "72-year-old on diltiazem."), (50, 0.30, 170, "Inferior STEMI, alert, BP 118/70."), (80, 0.24, 171, "Asymptomatic athlete.")):
        T("1st-degree AV block", E.avb1(r, pr, seed=sd), stem, "Regular", UP, f"{pr:.2f} s, constant", NARROW, ["Benign conduction delay: monitor", "Note AV-nodal blocking drugs; watch for progression in MI"])
    for n, pp, sd, stem in ((3, 0.92, 172, "Inferior MI, mildly lightheaded."), (4, 0.84, 173, "Athlete at rest."), (5, 0.76, 174, "Elderly patient on digoxin.")):
        st = E.wenck(n, pp, seed=sd)
        T("2nd-degree AV block type I (Wenckebach)", st, stem, "Regularly irregular, grouped beats", f"Atrial {E.ar(st)}; one per group blocked", "Lengthens, then a dropped beat", NARROW, ["Usually nodal and transient", "Atropine if symptomatic"], name=f"2nd-degree AV block type I (Wenckebach), {n}:{n-1}")
    for n, pp, sd, stem in ((3, 0.68, 175, "Anterior MI, BP 84/50, confused."), (4, 0.7, 176, "Syncope at home; now alert."), (5, 0.62, 177, "Exertional dizziness.")):
        st = E.mobitz2(n, pp, seed=sd)
        T("2nd-degree AV block type II (Mobitz II)", st, stem, "Irregular", f"Atrial {E.ar(st)}; some blocked", "0.18 s, constant", WIDE, ["Pads on; prepare to pace", "Atropine unlikely to help"], name=f"2nd-degree AV block type II (Mobitz II), {n}:{n-1}")
    for pp, kind, sd, stem in ((0.7, "n", 178, "Weak and dizzy, BP 98/60."), (0.72, "w", 179, "Fatigue and dyspnea, BP 88/52.")):
        st = E.block_ratio(2, pp, kind, sd)
        T("2nd-degree AV block, 2:1", st, stem, "Regular", f"Atrial {E.ar(st)}; 2 per QRS", "0.20 s on conducted beats", NARROW if kind == "n" else WIDE, ["The type can't be determined from 2:1 alone", "Narrow: atropine may help. Wide: pace."])
    for ratio, pp, sd, stem in ((3, 0.6, 180, "Syncope, HR in the 30s."), (4, 0.5, 181, "Gray and clammy, BP 74/40.")):
        st = E.block_ratio(ratio, pp, "w", sd)
        T("Advanced (high-grade) AV block", st, stem, "Regular", f"Atrial {E.ar(st)}; {ratio} per QRS", "0.20 s on conducted beats", WIDE, ["Treat like complete heart block", "Transcutaneous pacing; epinephrine or dopamine bridge"], name=f"Advanced (high-grade) AV block, {ratio}:1")
    for pr_, vr_, kind, sd, q0, stem in ((85, 34, "w", 182, 0.55, "Gray, diaphoretic 78-year-old, BP 70/40."), (80, 45, "n", 183, 0.35, "Inferior MI, alert, BP 104/66."), (100, 30, "w", 184, 0.8, "Found on the floor, GCS 11."), (70, 40, "n", 185, 0.4, "Lyme disease patient, fatigue.")):
        st = E.chb(pr_, vr_, kind, sd, q0=q0)
        T("3rd-degree (complete) AV block", st, stem, "R–R regular; P–P regular; unrelated", f"Atrial {E.ar(st)}; unrelated to QRS", "None, varies (AV dissociation)", NARROW if kind == "n" else WIDE, ["Unstable: transcutaneous pacing", "Bridge: epinephrine 2–10 mcg/min or dopamine"], name="3rd-degree (complete) AV block, " + ("junctional escape" if kind == "n" else "ventricular escape"))
    # ===== PACED (17) =====
    for r, sd, stem in ((70, 186, "Pacemaker for sick sinus syndrome."), (80, 187, "Pacemaker patient, routine transfer.")):
        T("Atrial paced rhythm", E.a_paced(r, sd), stem, "Regular", "Each P follows a spike", "0.18 s", NARROW, ["Normal atrial pacing", "Ask for the device card"], spikes="Atrial, before each P")
    for r, sd, stem in ((60, 188, "Pacemaker patient with chest pain."), (72, 189, "History of complete heart block; feels well.")):
        T("Ventricular paced rhythm", E.v_paced(r, sd), stem, "Regular", "Not seen", "None", "Wide, after each spike", ["Normal ventricular pacing", "A paced QRS hides STEMI: rely on symptoms and Sgarbossa"], spikes="Ventricular, before each QRS")
    for r, sd, stem in ((64, 190, "Pacemaker patient after a fall."), (75, 191, "Dual-chamber pacemaker, routine transport.")):
        T("AV sequential (dual-chamber) paced rhythm", E.ddd(r, sd), stem, "Regular", "Paced P after each atrial spike", "AV delay ≈ 0.18 s", "Wide, after the ventricular spike", ["Both chambers paced and captured", "Normal function"], spikes="Two per beat")
    for r, sd, stem in ((88, 192, "Pacemaker patient walking briskly."), (100, 193, "Anxious pacemaker patient.")):
        T("Atrial-sensed, ventricular paced rhythm", E.vdd(r, sd), stem, "Regular", "Native sinus P waves", "≈ 0.16 s (P to V spike)", "Wide, after each ventricular spike", ["The device tracks the sinus rate", "Normal function"], spikes="Ventricular only, after each P")
    T("Demand (VVI) pacing with native beats", E.vvi_demand(194), "Sinus rate slows; the pacemaker takes over.", "Irregular at the transition", "Present on native beats only", "0.16 s on native beats", "Narrow native, then wide paced", ["Demand pacing fires only when needed", "Normal sensing and capture"], spikes="Only after the pause")
    for pat, sd, stem in (((1, 1, 0, 1, 0, 0, 1, 1), 195, "Pacemaker patient, presyncope, BP 86/50."), ((1, 0, 1, 1, 1, 0, 1, 1), 196, "Pacemaker patient, recent fall onto the chest.")):
        T("Pacemaker failure to capture", E.fail_capture(72, pat, sd), stem, "Irregular (ventricular)", "Not seen", "None", "Wide when captured", ["Malfunction: lead, battery, threshold, hyperkalemia", "TCP if unstable; transport"], spikes="Regular, not all captured")
    T("Pacemaker failure to sense (undersensing)", E.undersense(197), "Pacemaker patient with palpitations.", "Irregular", "Native P waves present", "0.16 s on native beats", "Mostly native; some paced", ["Spikes ignore native beats: risk of R-on-T", "Monitor, transport, pads ready"], spikes="Fixed rate, some on QRS/T")
    st = E.S(198)
    for b in np.arange(0.15, DUR + 0.3, 0.68):
        st.P(b); st.Q(b + 0.16)
    for c in np.arange(0.5, DUR, 0.857):
        st.spike(c)
    T("Pacemaker failure to sense (undersensing)", st, "Pacemaker patient after an MRI elsewhere.", "Irregular spikes over a regular rhythm", "Native P waves present", "0.16 s", "Narrow native beats", ["Spikes fall regardless of native beats", "Monitor, transport, device check"], spikes="Fixed rate, ignoring native beats")
    T("Pacemaker failure to pace (oversensing)", E.oversense(199), "Pacemaker patient with a syncopal episode.", "Irregular, long pause", "None", "None", "Wide paced beats", ["The device sensed noise and withheld pacing", "Pads on; TCP if pauses recur"], spikes="Absent during the pause")
    T("Transcutaneous pacing with capture", E.tcp_capture(80, 200), "Pacing at 80/min, 90 mA.", "Regular", "Obscured by artifact", "None", "Wide, large T after each spike", ["Electrical capture: now check a FEMORAL pulse", "Give analgesia or sedation"], spikes="Large artifacts at the set rate")
    st = E.tcp_nocapture(201)
    T("Transcutaneous pacing without capture", st, "Pacing at 70/min, 40 mA; still hypotensive.", "Pacer spikes regular; escape beats unrelated", f"Atrial {E.ar(st)}", "None", "Wide escape beats only", ["Increase mA until each spike captures", "Check pad position"], rate=f"Ventricular {E.vr(st)}; pacer 70/min", spikes="Large artifacts without QRS")
    T("Pacer spikes without capture (asystole)", E.fail_capture_asystole(70, 202), "Pacemaker patient, unresponsive and pulseless.", "Spikes regular; no QRS", "None", "None", "None", ["This is cardiac arrest: start CPR", "Treat as asystole; pads ≥ 8 cm from the device"], rate="0, spikes only", spikes="Regular, no capture")

    from collections import Counter
    cnt = Counter(CAT[i["cat"]][0] for i in ITEMS)
    assert all(v == 17 for v in cnt.values()) and len(cnt) == 6, cnt
    return ITEMS
