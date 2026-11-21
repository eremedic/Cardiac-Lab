"""Builds lib/field-data.mjs: 100 "field" strips that look like they came off a monitor in the back
of a moving ambulance, on a real patient (see field_morph.py for the beat-to-beat morphology).

    pip install numpy
    python3 tools/generator/build_field.py

Each strip is drawn at random from the six rhythm families (17 or 16 from each), generated with its
own morphology and rate, and checked against the rules of its rhythm on the CLEAN tracing (areas.verify).
Only then is real-world artifact layered on top:

  * respiratory baseline wander and breathing-related amplitude change (every strip)
  * road vibration (every strip; light on flat-line rhythms)
  * shivering / muscle tremor (EMG) bursts
  * 60-cycle (inverter) interference
No bumps, electrode pops or movement swings: anything shaped like a beat could be mistaken for ectopy.

The data is served by the API (GET /api/areas/field), not as a public file, so it stays closed to students
until the instructor opens it from the scoreboard.
"""
import json, os, random, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import numpy as np
import ecg_web   # noqa: E402  (waveform encoder)
import areas     # noqa: E402
import area_hints  # noqa: E402
import field_morph as FM  # noqa: E402  (real-patient P/QRS/T variation, delta waves, R-on-T)
from practice_set import CAT  # noqa: E402

PUB = os.path.normpath(os.path.join(HERE, "..", "..", "public"))
OUT = os.path.normpath(os.path.join(HERE, "..", "..", "lib", "field-data.mjs"))
t, DUR = areas.t, areas.DUR
SEED = 20261119
QUIET = {"Asystole", "Ventricular fibrillation (fine)", "Pacer spikes without capture (asystole)", "Agonal rhythm"}
BLOCKS = {"1st-degree AV block", "2nd-degree AV block type I (Wenckebach)", "2nd-degree AV block type II (Mobitz II)",
          "2nd-degree AV block, 2:1", "Advanced (high-grade) AV block", "3rd-degree (complete) AV block"}


def env(c, w):
    """Smooth window centered at c, roughly w seconds wide."""
    return np.exp(-0.5 * ((t - c) / (w / 2.6)) ** 2)


def free_spot(rng, s, cat, half):
    """A time where an event of +/- half seconds won't sit on top of a P wave or QRS."""
    p_gap = 0.22 if cat in BLOCKS else 0.13
    for _ in range(60):
        c = float(rng.uniform(0.35, DUR - 0.35))
        if all(abs(c - p) > p_gap + half * 0.4 for p in s.p) and all(abs(c - q) > 0.09 + half * 0.25 for q in s.q):
            return c
    return None


def field_mess(s, rng, cat):
    y, notes = s.y.copy(), []
    quiet = cat in QUIET
    # breathing: wander + amplitude change with each breath
    fr = rng.uniform(0.22, 0.45)
    ph = rng.uniform(0, 6.3)
    am = rng.uniform(0.03, 0.06) if quiet else rng.uniform(0.05, 0.12)
    wa = rng.uniform(0.03, 0.06) if quiet else rng.uniform(0.05, 0.14)
    y = y * (1 + am * np.sin(2 * np.pi * fr * t + ph)) + wa * np.sin(2 * np.pi * fr * t + ph + 0.6) + 0.3 * wa * np.sin(4 * np.pi * fr * t + ph)
    # irregular drift (sweat, cable sway): a smoothed random walk
    walk = np.cumsum(rng.normal(0, 1, t.size)); walk = np.convolve(walk - walk.mean(), np.ones(1500) / 1500, mode="same")  # slow drift only, nothing P- or T-wave sized
    walk = walk / (np.abs(walk).max() or 1)
    y += walk * (rng.uniform(0.02, 0.04) if quiet else rng.uniform(0.03, 0.09))
    notes.append("baseline wander with breathing")
    # road vibration: a mix of 6-28 Hz components that swells and fades with the road surface
    vib = sum(rng.uniform(0.004, 0.012) * np.sin(2 * np.pi * rng.uniform(6, 28) * t + rng.uniform(0, 6.3)) for _ in range(6))
    road = 0.55 + 0.45 * np.sin(2 * np.pi * rng.uniform(0.15, 0.5) * t + rng.uniform(0, 6.3))
    y += vib * road * (0.35 if quiet else rng.uniform(0.5, 1.1))
    notes.append("road vibration")
    if not quiet:
        # No bumps, electrode pops or patient-movement swings: their sharp or rounded shapes can look like an extra
        # beat (a PVC, PAC or PJC) or a P/T wave on a strip whose answer has no ectopy. Only smooth or fuzzy artifact here.
        # shivering / muscle tremor
        if rng.random() < 0.35:
            c, w = rng.uniform(1, 5), rng.uniform(0.8, 2.0)
            emg = rng.normal(0, 1, t.size)
            emg = np.convolve(emg, np.ones(3) / 3, mode="same")
            y += (rng.uniform(0.015, 0.03) if cat in BLOCKS else rng.uniform(0.02, 0.05)) * emg * env(c, w)
            notes.append("muscle tremor (shivering)")
        # inverter / AC interference
        if rng.random() < 0.12:
            y += rng.uniform(0.008, 0.02) * np.sin(2 * np.pi * 60 * t)
            notes.append("60-cycle interference")
    s.y = y
    if len(notes) > 1:
        desc = ", ".join(notes[:-1]) + " and " + notes[-1]
    else:
        desc = notes[0]
    return desc[0].upper() + desc[1:] + "."


def main():
    main_data = open(os.path.join(PUB, "trainer-data.js")).read()
    main_data = json.loads(main_data[main_data.index("=") + 1:].rstrip().rstrip(";"))
    seen = {v["d"] for v in main_data["strips"].values()}
    for name in os.listdir(os.path.join(PUB, "areas")):
        if name.endswith(".json") and name != "index.json":
            seen |= {v["d"] for v in json.load(open(os.path.join(PUB, "areas", name)))["strips"].values()}
    pick = random.Random(SEED)
    plan = []
    for ai, (key, title, fam) in enumerate(areas.AREAS):
        take = 17 if ai < 4 else 16
        plan += [(key, fn, a) for fn, a in pick.sample(fam, take)]
    assert len(plan) == 100
    pick.shuffle(plan)
    FM.install()
    flags = []
    for fam, fn, args in plan:
        delta = fn.__name__ in ("b_nsr", "b_brady", "b_tach", "b_sinus_arr") and pick.random() < 0.5
        ront = fn.__name__ == "b_pvc" and args[0] in ("unifocal", "bigeminy", "trigeminy", "couplet", "multifocal") and pick.random() < 0.5
        flags.append((delta, ront))
    prints, items = set(), []
    for idx, (fam, fn, args) in enumerate(plan):
        base = SEED + idx * 1000
        FM.CUR["delta"], FM.CUR["ront"] = flags[idx]
        for attempt in range(400):
            rng = np.random.default_rng(base + attempt)
            try:
                s, info = fn(rng, *args)
                areas.verify(info["cat"], s)          # rules checked on the clean tracing
                if flags[idx][0]:
                    areas.need((FM.delta_pr(s) or 1) < 0.12, "pre-excitation needs a short PR")
                fp = areas.fingerprint(s)
                areas.need(fp not in prints, "duplicate")
                break
            except areas.Retry:
                continue
        else:
            raise RuntimeError(f"could not generate field #{idx} {fn.__name__}")
        prints.add(fp)
        rows = areas.make_item(info, s)
        name = info.get("name", info["cat"])
        noted = FM.notes(s)
        if flags[idx][0]:
            pr = FM.delta_pr(s)
            rows = [["PR interval", f"Short, about {areas.sec(pr)} to the start of the delta wave (pre-excitation)"] if k == "PR interval" else
                    (["QRS", v + "; slurred upstroke (delta wave) widens it slightly"] if k == "QRS" else [k, v]) for k, v in rows]
            name += " with pre-excitation (delta wave)"
        if flags[idx][1]:
            noted.insert(0, "R-on-T: a PVC lands on the T wave of the beat before it, the setup for VT or VF")
            name += " (R-on-T)"
        rows.append(["Also noted", noted[0][0].upper() + noted[0][1:] + ("; " + "; ".join(noted[1:]) if len(noted) > 1 else "") + "."])
        art = field_mess(s, np.random.default_rng(base + 777), info["cat"])
        rows.append(["Artifact", art])
        items.append({"fam": fam, "cat": info["cat"], "name": name, "st": s, "rows": rows, "action": info["action"]})
    rng = random.Random(f"{SEED}-opts")
    strips, out = {}, []
    for n, it in enumerate(items, 1):
        sid = f"f-{n:03d}"
        enc = ecg_web.encode(it["st"])
        assert enc["d"] not in seen, f"duplicate strip {sid}"
        seen.add(enc["d"])
        strips[sid] = enc
        grp = CAT[it["cat"]][0]
        pool = [c for c in CAT if CAT[c][0] == grp and c != it["cat"]]
        opts = rng.sample(pool, 3) + [it["cat"]]
        rng.shuffle(opts)
        hints = area_hints.hints_for(it)
        hints[0] = "Look past the artifact first: find a stretch where the baseline is steady. " + hints[0]
        assert not area_hints.names_answer(hints[0], it["cat"])
        out.append({"n": n, "strip": sid, "cat": it["cat"], "name": it["name"], "rows": it["rows"], "action": it["action"],
                    "options": opts, "hints": hints})
    cats = list(dict.fromkeys(it["cat"] for it in out))
    doc = {"key": "field", "title": "Field strips", "categories": cats, "items": out, "strips": strips}
    with open(OUT, "w") as f:
        f.write("// Generated by tools/generator/build_field.py. Do not edit by hand.\n")
        f.write("// 100 rule-checked strips with real-world artifact, served only when the instructor opens the field area.\n")
        f.write("export default " + json.dumps(doc, ensure_ascii=False, separators=(",", ":")) + ";\n")
    fams = {}
    for it in items:
        fams[it["fam"]] = fams.get(it["fam"], 0) + 1
    print(f"{len(out)} strips, {len(cats)} rhythm types, by family {fams}, {os.path.getsize(OUT) // 1024} KB -> {OUT}")
    print("delta waves:", sum(f[0] for f in flags), " R-on-T strips:", sum(f[1] for f in flags))


if __name__ == "__main__":
    main()
