"""Builds trainer data: 100 practice strips + 20 megacode cases, as compact waveform data."""
import json, os, random
import numpy as np
import ecg2 as E

# --- spikes stored separately so the browser can draw them razor-sharp ---
def _spike(self, c, a=0.95):
    if 0 <= c < E.DUR:
        self.spk.append((c, a))
def _tcp(self, c):
    m = E.t > c
    self.y[m] += -0.55 * np.exp(-(E.t[m] - c) / 0.05)
    if 0 <= c < E.DUR:
        self.spk.append((c, 1.35))
E.S.spike = _spike
E.S.tcp_art = _tcp

HERE = os.path.dirname(os.path.abspath(__file__))
STRIPS = {}


def encode(st):
    y = np.clip(st.y[::2], -0.88, 1.48)  # 500 Hz
    v = np.round(y * 100).astype(int)
    out, prev = [], None
    for x in v:
        if prev is None or abs(x - prev) > 40:
            out.append(f"|{x}|")
        else:
            out.append(chr(int(x - prev) + 80))
        prev = x
    return {"d": "".join(out), "s": [[int(round(c * 1000)), int(round(a * 100))] for c, a in st.spk]}


def add_strip(key, st):
    STRIPS[key] = encode(st)
    return key


import practice_set as PS
CAT, GROUP_EXTRA = PS.CAT, PS.GROUP_EXTRA


def options_for(cat, rng):
    grp = CAT[cat][0]
    pool = [c for c, v in CAT.items() if v[0] == grp and c != cat] + [c for c in GROUP_EXTRA[grp] if c != cat]
    pool = list(dict.fromkeys(pool))
    opts = rng.sample(pool, 3) + [cat]
    rng.shuffle(opts)
    return opts


# ---------------- megacode ----------------
M = {
 "vf": lambda s: E.vf(0.45, s), "vf_fine": lambda s: E.vf(0.13, s), "vt": lambda s: E.vt(170, s), "vt_fast": lambda s: E.vt(200, s),
 "torsades": lambda s: E.torsades(s), "asystole": lambda s: E.asystole(s), "nsr": lambda s: E.sinus(84, seed=s),
 "stach": lambda s: E.sinus(118, pr=0.14, kind="nq", seed=s), "pea_fast": lambda s: E.sinus(128, pr=0.13, kind="nq", seed=s),
 "brady": lambda s: E.sinus(44, seed=s), "idio": lambda s: E.idio(34, s), "agonal": lambda s: E.idio(16, s, kind="agonal"),
 "chb": lambda s: E.chb(85, 34, "w", s), "chb_n": lambda s: E.chb(80, 44, "n", s, q0=0.35), "mobitz2": lambda s: E.mobitz2(3, 0.68, seed=s),
 "wenck": lambda s: E.wenck(4, 0.86, seed=s), "avb1": lambda s: E.avb1(72, 0.26, seed=s), "tcp_no": lambda s: E.tcp_nocapture(s),
 "tcp_cap": lambda s: E.tcp_capture(80, s), "ftc": lambda s: E.fail_capture(72, (1, 0, 0, 1, 0, 1, 0, 0), s), "ftc_asys": lambda s: E.fail_capture_asystole(70, s),
 "vpaced": lambda s: E.v_paced(70, s), "aivr": lambda s: E.idio(66, s), "cpr": lambda s: E.cpr_artifact(s), "vt_vf": lambda s: E.vt_to_vf(s),
 "pvcs": lambda s: E.with_pvcs("NNNVNNN", seed=s),
}
LABEL = {"vf": "Coarse VF", "vf_fine": "Fine VF", "vt": "Monomorphic VT", "vt_fast": "Monomorphic VT", "torsades": "Torsades de pointes", "asystole": "Asystole",
 "nsr": "Sinus rhythm", "stach": "Sinus tachycardia", "pea_fast": "Sinus tachycardia (organized rhythm)", "brady": "Sinus bradycardia", "idio": "Idioventricular rhythm",
 "agonal": "Agonal rhythm", "chb": "3rd-degree AV block, wide escape", "chb_n": "3rd-degree AV block, junctional escape", "mobitz2": "2nd-degree AV block type II",
 "wenck": "2nd-degree AV block type I (Wenckebach)", "avb1": "Sinus rhythm with 1st-degree AV block", "tcp_no": "TCP without capture", "tcp_cap": "TCP with electrical capture",
 "ftc": "Pacemaker failure to capture", "ftc_asys": "Pacer spikes, no capture (asystole)", "vpaced": "Ventricular paced rhythm", "aivr": "AIVR", "cpr": "CPR artifact",
 "vt_vf": "VT degenerating into VF", "pvcs": "Sinus rhythm with a PVC"}

from megacode_cases import CASES  # noqa: E402


def build():
    ITEMS = PS.build()
    NP = len(ITEMS)
    rng = random.Random(2026)
    order = list(range(NP)); rng.shuffle(order)
    practice = []
    for n, i in enumerate(order, 1):
        it = ITEMS[i]
        key = add_strip(f"p{n}", it["st"])
        practice.append({"n": n, "strip": key, "cat": it["cat"], "name": it["name"], "stem": it["stem"], "rows": it["rows"], "action": it["action"], "options": options_for(it["cat"], rng)})
    cases = []
    seed = 500
    for ci, c in enumerate(CASES, 1):
        stages = []
        for st in c["stages"]:
            seed += 1
            sobj = M[st["strip"]](seed)
            key = add_strip(f"m{ci}_{len(stages)}", sobj)
            r, reg = E.rate(sobj.q)
            hr = None if (r is None or st["strip"] in ("cpr", "vf", "vf_fine", "asystole", "ftc_asys", "agonal")) else r
            stages.append({"strip": key, "rhythm": LABEL[st["strip"]], "vitals": st["vitals"], "hr": hr, "prompt": st["prompt"],
                           "options": [{"t": o[0], "ok": o[1], "why": o[2]} for o in st["options"]]})
        cases.append({"n": ci, "title": c["title"], "scenario": c["scenario"], "focus": c["focus"], "stages": stages})
    cats = {k: {"group": v[0], "key": v[1], "clue": v[2]} for k, v in CAT.items()}
    # uniqueness: no two practice strips share a waveform, and no two share name + rate
    wav = [STRIPS[q["strip"]]["d"] for q in practice]
    assert len(set(wav)) == len(wav), "duplicate waveform"
    sig = [(q["name"], q["rows"][0][1], q["stem"]) for q in practice]
    assert len(set(sig)) == len(sig), "duplicate item"
    groups = [[k, v] for k, v in PS.GROUP_LABEL.items()]
    data = {"practice": practice, "cases": cases, "cats": cats, "groups": groups, "strips": STRIPS}
    s = json.dumps(data, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/")
    open(os.path.join(HERE, "trainer_data.js"), "w").write("window.TRAINER=" + s + ";")
    print("practice", len(practice), {g: sum(1 for q in practice if CAT[q["cat"]][0]==g) for g in PS.GROUP_LABEL}, "cases", len(cases), "questions", sum(len(c["stages"]) for c in cases), "bytes", len(s))


if __name__ == "__main__":
    build()
