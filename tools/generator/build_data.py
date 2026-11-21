"""Regenerates static/trainer.json (the 102 practice strips and 20 megacode cases).

    pip install numpy matplotlib pillow
    python3 tools/generator/build_data.py

Edit practice_set.py (strips, interpretations, feedback text) or megacode_cases.py
(cases, options, rationales), then run this script and commit the new data file.
"""
import os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import ecg_web  # noqa: E402

ecg_web.build()
src = os.path.join(HERE, "trainer_data.js")
dst = os.path.normpath(os.path.join(HERE, "..", "..", "static", "trainer.json"))
# ecg_web writes "window.TRAINER=<json>;"; the site loads plain JSON.
text = open(src, encoding="utf-8").read().strip()
assert text.startswith("window.TRAINER=")
text = text[len("window.TRAINER="):].rstrip(";")
open(dst, "w", encoding="utf-8").write(text)
os.remove(src)
print("Wrote", dst)
