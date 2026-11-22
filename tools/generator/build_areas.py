"""Builds static/areas/<area>.json: 50 unique, rule-checked strips per rhythm family.

    pip install numpy matplotlib pillow
    python3 tools/generator/build_areas.py

Each file holds the area's items (rhythm, interpretation, field action, answer choices)
and the waveform data for its strips. The build stops if any strip repeats another
strip in any area or in the main 102-strip set (static/trainer.json).
"""
import json, os, random, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import ecg_web  # noqa: E402  (also provides the waveform encoder)
import areas    # noqa: E402
import area_hints  # noqa: E402

PUB = os.path.normpath(os.path.join(HERE, "..", "..", "static"))
OUT = os.path.join(PUB, "areas")
os.makedirs(OUT, exist_ok=True)


def main():
    main_data = open(os.path.join(PUB, "trainer-data.js")).read()
    main_data = json.loads(main_data[main_data.index("=") + 1:].rstrip().rstrip(";"))
    seen = {v["d"] for v in main_data["strips"].values()}
    built = areas.generate()
    index = []
    for key, (title, items) in built.items():
        cats = list(dict.fromkeys(it["cat"] for it in items))
        rng = random.Random(f"{key}-order")
        order = list(range(len(items))); rng.shuffle(order)
        strips, out_items = {}, []
        for n, i in enumerate(order, 1):
            it = items[i]
            sid = f"a-{key}-{n:02d}"
            enc = ecg_web.encode(it["st"])
            assert enc["d"] not in seen, f"duplicate strip {sid}"
            seen.add(enc["d"])
            strips[sid] = enc
            others = [c for c in cats if c != it["cat"]]
            opts = rng.sample(others, min(3, len(others))) + [it["cat"]]
            rng.shuffle(opts)
            out_items.append({"n": n, "strip": sid, "cat": it["cat"], "name": it["name"], "rows": it["rows"], "action": it["action"], "options": opts,
                              "hints": area_hints.hints_for(it)})
        doc = {"key": key, "title": title, "categories": cats, "items": out_items, "strips": strips}
        with open(os.path.join(OUT, f"{key}.json"), "w") as f:
            json.dump(doc, f, ensure_ascii=False, separators=(",", ":"))
        index.append({"key": key, "title": title, "count": len(out_items), "categories": cats})
        print(f"{key}: {len(out_items)} strips, {len(cats)} rhythm types, {os.path.getsize(os.path.join(OUT, key + '.json')) // 1024} KB")
    with open(os.path.join(OUT, "index.json"), "w") as f:
        json.dump(index, f, ensure_ascii=False, indent=1)
    print("all strips unique:", len(seen))


if __name__ == "__main__":
    main()
