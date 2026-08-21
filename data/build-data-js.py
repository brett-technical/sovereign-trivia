#!/usr/bin/env python3
"""Generate assets/js/data.js from data/countries.json.

The app runs from file://, where fetch() of a local JSON file is blocked by
CORS. The corpus therefore ships as a plain script assigning a global. Run this
after any edit to countries.json:

    python data/build-data-js.py
"""
import json, pathlib, sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
src  = ROOT / "data" / "countries.json"
dest = ROOT / "assets" / "js" / "data.js"

countries = json.loads(src.read_text(encoding="utf-8"))

required = ("region","country","capital","languages","currency","population",
            "industries","accepted_capitals","iso2")
for c in countries:
    missing = [k for k in required if k not in c or not c[k]]
    if missing:
        sys.exit(f"ERROR: {c.get('country','?')} missing {missing}")

payload = json.dumps(countries, ensure_ascii=False, separators=(",", ":"))
dest.write_text(
    "/* GENERATED FILE — do not edit by hand.\n"
    "   Source: data/countries.json · Regenerate: python data/build-data-js.py\n"
    f"   {len(countries)} sovereign entities, 5 facts each. */\n"
    f"window.COUNTRY_DATA = {payload};\n",
    encoding="utf-8")

print(f"wrote {dest.relative_to(ROOT)} — {len(countries)} countries, "
      f"{dest.stat().st_size/1024:.1f} KB")
