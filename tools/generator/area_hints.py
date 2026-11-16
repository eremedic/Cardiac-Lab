"""'Call the cardiologist' hints for the six rhythm practice areas.

Three hints per strip, each stronger than the last, and none naming the answer:
  1. where to look (by rhythm type)
  2. this strip's own measurements (rate, regularity, PR, QRS, pacer spikes)
  3. the tell (from practice_set.CAT, or an override below where that names the rhythm)
"""
import re
from practice_set import CAT

LOOK = {
    "Normal sinus rhythm": "Go step by step: rate, regularity, a P before every QRS, the PR interval, then QRS width. Is anything outside normal limits?",
    "Sinus bradycardia": "Count the rate first, then check that every beat still looks like a normal sinus beat.",
    "Sinus tachycardia": "Count the rate, then look for an upright P wave in front of every QRS, even if it's close to the T wave.",
    "Sinus arrhythmia": "Measure several R–R intervals in a row. Do they change, and if so, gradually or suddenly?",
    "Sinus arrest (pause)": "Find the gap. Then measure it against the normal P–P interval.",
    "Sinoatrial (SA) exit block": "Find the gap and use calipers (or paper) to march the P waves through it.",
    "Premature atrial contractions (PACs)": "Find the beat that comes early, then compare its P wave with the others.",
    "Wandering atrial pacemaker": "Compare the P waves to each other, beat by beat, then count the rate.",
    "Multifocal atrial tachycardia (MAT)": "Count the rate, then compare the shapes of the P waves before each QRS.",
    "Supraventricular tachycardia (SVT)": "Count the rate and check regularity. Then try to find a P wave anywhere.",
    "Atrial flutter": "Look at the baseline between the QRS complexes rather than at the QRS.",
    "Atrial fibrillation": "Measure the R–R intervals, then look for P waves before each QRS.",
    "Junctional rhythm": "Look for P waves: are they upright, inverted, missing or after the QRS? Then count the rate.",
    "Junctional bradycardia": "Look at the P waves (or where they should be), then count the rate carefully.",
    "Accelerated junctional rhythm": "Check the P waves first, then compare the rate with the junction's usual 40–60.",
    "Junctional tachycardia": "Look just in front of each QRS for the P wave's direction, then count the rate.",
    "Premature junctional contractions (PJCs)": "Find the early beat. Is the QRS narrow, and what does its P wave look like?",
    "Junctional escape beat": "Find the odd beat. Does it come early or late, and does it have a P wave?",
    "Sinus rhythm with unifocal PVCs": "Find the beats that look different. Are they early, wide, and do they all look alike?",
    "Ventricular bigeminy": "Look at the pattern of normal and abnormal beats across the whole strip.",
    "Ventricular trigeminy": "Look at the pattern of normal and abnormal beats across the whole strip.",
    "PVC couplet": "Find the abnormal beats and count how many come in a row.",
    "Multifocal PVCs": "Find the abnormal beats, then compare their shapes with each other.",
    "Non-sustained VT (run of VT)": "Look for a stretch of the strip that's different from the rest, and count the beats in it.",
    "Idioventricular rhythm": "Measure the QRS width, look for P waves, then count the rate.",
    "Accelerated idioventricular rhythm (AIVR)": "Measure the QRS width, look for P waves, then count the rate.",
    "Monomorphic ventricular tachycardia": "Measure the QRS width and the rate, then compare the complexes with each other.",
    "Polymorphic VT (torsades de pointes)": "Look at the height of the complexes across the whole strip.",
    "Ventricular fibrillation (coarse)": "Try to find a single organized P, QRS or T wave.",
    "Ventricular fibrillation (fine)": "Turn your attention to the baseline: is it truly flat?",
    "Asystole": "Look for any organized activity at all, P waves included.",
    "Agonal rhythm": "Measure how far apart the complexes are and how wide they are.",
    "1st-degree AV block": "Measure the PR interval on several beats.",
    "2nd-degree AV block type I (Wenckebach)": "Measure the PR interval on each beat in a group, right up to the beat that's missing.",
    "2nd-degree AV block type II (Mobitz II)": "Find a P wave without a QRS, then measure the PR on the beats before it.",
    "2nd-degree AV block, 2:1": "March out the P waves, including any hidden in T waves. How many P waves per QRS?",
    "Advanced (high-grade) AV block": "March out the P waves and count how many come before each QRS.",
    "3rd-degree (complete) AV block": "March out the P waves and the QRS complexes separately. Is there any fixed relationship?",
    "Atrial paced rhythm": "Find the pacer spikes and see what comes right after them.",
    "Ventricular paced rhythm": "Find the pacer spikes and see what comes right after them.",
    "AV sequential (dual-chamber) paced rhythm": "Count the pacer spikes in each beat.",
    "Atrial-sensed, ventricular paced rhythm": "Look at what comes before each pacer spike.",
    "Demand (VVI) pacing with native beats": "Compare the beginning of the strip with the end. When do the spikes start?",
    "Pacemaker failure to capture": "Check what follows every single pacer spike.",
    "Pacemaker failure to sense (undersensing)": "Look at where the pacer spikes land relative to the patient's own beats.",
    "Pacemaker failure to pace (oversensing)": "Measure the spacing between pacer spikes across the whole strip.",
    "Transcutaneous pacing with capture": "Look at what follows each large artifact.",
    "Transcutaneous pacing without capture": "Look at what follows each large artifact, and whether the QRS complexes line up with them.",
    "Pacer spikes without capture (asystole)": "Look past the spikes: is there any cardiac activity at all?",
}

# Tells that would otherwise name or abbreviate the answer.
TELL_OVERRIDE = {
    "Sinus tachycardia": "Every beat is a normal sinus beat with an upright P wave; only the rate is high, and still under 150.",
    "Ventricular fibrillation (fine)": "Small, chaotic waves with nothing organized are still shockable. A truly flat line would look different.",
    "Accelerated idioventricular rhythm (AIVR)": "Wide, no P waves, regular, but faster than the ventricles' usual 20–40 escape rate.",
    "PVC couplet": "Two consecutive wide beats, then back to normal.",
    "Non-sustained VT (run of VT)": "A burst of wide, fast beats starts and stops within the strip.",
}

ABBREV = {
    "Ventricular fibrillation (coarse)": ["vf"], "Ventricular fibrillation (fine)": ["vf"], "Monomorphic ventricular tachycardia": ["vt"],
    "Polymorphic VT (torsades de pointes)": ["torsades"], "Non-sustained VT (run of VT)": ["nsvt", "run of vt"], "Atrial fibrillation": ["afib", "a-fib"],
    "Supraventricular tachycardia (SVT)": ["svt"], "Multifocal atrial tachycardia (MAT)": ["mat "], "Premature atrial contractions (PACs)": ["pac"],
    "Premature junctional contractions (PJCs)": ["pjc"], "Accelerated idioventricular rhythm (AIVR)": ["aivr"], "Sinoatrial (SA) exit block": ["exit block"],
    "2nd-degree AV block type I (Wenckebach)": ["wenckebach"], "2nd-degree AV block type II (Mobitz II)": ["mobitz"],
}


def names_answer(text, cat):
    low = " " + text.lower() + " "
    full = re.sub(r"\s*\(.*\)", "", cat).lower()
    if full in low:
        return True
    return any(a in low for a in ABBREV.get(cat, []))


def hints_for(item):
    rows = {k: v for k, v in item["rows"]}
    parts = [f"rate {rows['Rate']}", f"rhythm {rows['Rhythm'][0].lower() + rows['Rhythm'][1:]}", f"PR {rows['PR interval'][0].lower() + rows['PR interval'][1:]}",
             f"QRS {rows['QRS'][0].lower() + rows['QRS'][1:]}"]
    if "Pacer spikes" in rows:
        parts.append(f"pacer spikes {rows['Pacer spikes'][0].lower() + rows['Pacer spikes'][1:]}")
    h2 = "Here's what I measure on this one: " + "; ".join(parts) + "."
    h3 = TELL_OVERRIDE.get(item["cat"], CAT[item["cat"]][2])
    hints = [LOOK[item["cat"]], h2, h3]
    for h in hints:
        assert not names_answer(h, item["cat"]), (item["cat"], h)
    return hints
