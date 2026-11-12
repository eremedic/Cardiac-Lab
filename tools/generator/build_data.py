"""Regenerates public/trainer-data.js (the 102 practice strips and 20 megacode cases).

    pip install numpy matplotlib pillow
    python3 tools/generator/build_data.py

Edit practice_set.py (strips, interpretations, feedback text) or megacode_cases.py
(cases, options, rationales), then run this script and commit the new data file.
"""
import os, shutil, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import ecg_web  # noqa: E402

ecg_web.build()
src = os.path.join(HERE, "trainer_data.js")
dst = os.path.normpath(os.path.join(HERE, "..", "..", "public", "trainer-data.js"))
shutil.move(src, dst)
print("Wrote", dst)
