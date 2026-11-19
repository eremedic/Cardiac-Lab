"""Builds lib/field-data.mjs: 100 "field" strips that look like they came off a monitor in the back
of a moving ambulance.

    pip install numpy
    python3 tools/generator/build_field.py

Each strip is drawn at random from the six rhythm families (17 or 16 from each), generated with its
own morphology and rate, and checked against the rules of its rhythm on the CLEAN tracing (areas.verify).
Only then is real-world artifact layered on top:

  * respiratory baseline wander and breathing-related amplitude change (every strip)
  * road vibration (every strip; light on flat-line rhythms)
  * bumps and potholes: sharp motion transients with a ringing recovery
  * shivering / muscle tremor (EMG) bursts
  * patient movement: a slow, large swing for a second or so
  * electrode "pops" from a loose or tugged lead
  * 60-cycle (inverter) interference

Bumps, movement and pops are placed away from P waves and QRS complexes, so the features that define the
rhythm stay readable; on AV blocks they keep an extra-wide berth around every P wave. Flat-line and fine-VF
strips get only light wander and vibration, so they aren't mistaken for something else.
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
    wa = rng.uniform(0.03, 0.07) if quiet else rng.uniform(0.12, 0.28)
    y = y * (1 + am * np.sin(2 * np.pi * fr * t + ph)) + wa * np.sin(2 * np.pi * fr * t + ph + 0.6) + 0.3 * wa * np.sin(4 * np.pi * fr * t + ph)
    # irregular drift (sweat, cable sway): a smoothed random walk
    walk = np.cumsum(rng.normal(0, 1, t.size)); walk = np.convolve(walk - walk.mean(), np.ones(400) / 400, mode="same")
    walk = walk / (np.abs(walk).max() or 1)
    y += walk * (rng.uniform(0.02, 0.05) if quiet else rng.uniform(0.08, 0.2))
    notes.append("baseline wander with breathing")
    # road vibration: a mix of 6-28 Hz components that swells and fades with the road surface
    vib = sum(rng.uniform(0.004, 0.012) * np.sin(2 * np.pi * rng.uniform(6, 28) * t + rng.uniform(0, 6.3)) for _ in range(6))
    road = 0.55 + 0.45 * np.sin(2 * np.pi * rng.uniform(0.15, 0.5) * t + rng.uniform(0, 6.3))
    y += vib * road * (0.45 if quiet else rng.uniform(1.4, 2.6))
    notes.append("road vibration")
    if not quiet:
        # bumps / potholes
        nb = int(rng.choice([1, 1, 2, 2, 3, 3]))
        hits = 0
        for _ in range(nb):
            c = free_spot(rng, s, cat, 0.35)
            if c is None:
                continue
            a = rng.uniform(0.3, 0.8) * rng.choice([-1, 1])
            tau, f = rng.uniform(0.09, 0.22), rng.uniform(3.5, 7)
            m = t >= c
            d = t[m] - c
            y[m] += a * np.exp(-d / tau) * np.cos(2 * np.pi * f * d) + 0.25 * a * np.exp(-d / 0.015)
            hits += 1
        if hits:
            notes.append(f"{hits} motion spike{'s' if hits > 1 else ''} from bumps in the road")
        # shivering / muscle tremor
        if rng.random() < 0.65:
            c, w = rng.uniform(1, 5), rng.uniform(1.0, 3.0)
            emg = rng.normal(0, 1, t.size)
            emg = np.convolve(emg, np.ones(3) / 3, mode="same")
            y += (rng.uniform(0.025, 0.045) if cat in BLOCKS else rng.uniform(0.04, 0.085)) * emg * env(c, w)
            notes.append("muscle tremor (shivering)")
        # patient moving
        if rng.random() < 0.4:
            c = free_spot(rng, s, cat, 0.6)
            if c is not None:
                y += rng.uniform(0.18, 0.38) * np.sin(2 * np.pi * rng.uniform(0.9, 1.6) * (t - c)) * env(c, 1.2)
                notes.append("patient movement")
        # loose electrode
        if rng.random() < 0.18:
            c = free_spot(rng, s, cat, 0.4)
            if c is not None:
                m = t >= c
                y[m] += rng.uniform(0.3, 0.55) * rng.choice([-1, 1]) * np.exp(-(t[m] - c) / rng.uniform(0.25, 0.5))
                notes.append("an electrode pop")
        # inverter / AC interference
        if rng.random() < 0.2:
            y += rng.uniform(0.012, 0.03) * np.sin(2 * np.pi * 60 * t)
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
    prints, items = set(), []
    for idx, (fam, fn, args) in enumerate(plan):
        base = SEED + idx * 1000
        for attempt in range(400):
            rng = np.random.default_rng(base + attempt)
            try:
                s, info = fn(rng, *args)
                areas.verify(info["cat"], s)          # rules checked on the clean tracing
                fp = areas.fingerprint(s)
                areas.need(fp not in prints, "duplicate")
                break
            except areas.Retry:
                continue
        else:
            raise RuntimeError(f"could not generate field #{idx} {fn.__name__}")
        prints.add(fp)
        rows = areas.make_item(info, s)
        art = field_mess(s, np.random.default_rng(base + 777), info["cat"])
        rows.append(["Artifact", art])
        items.append({"fam": fam, "cat": info["cat"], "name": info.get("name", info["cat"]), "st": s, "rows": rows, "action": info["action"]})
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


if __name__ == "__main__":
    main()
