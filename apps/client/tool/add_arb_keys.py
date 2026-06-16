#!/usr/bin/env python3
"""Append i18n keys to all 7 ARB files via text insertion before the final
closing brace, preserving existing formatting/ordering (minimal diff).

Reads a JSON spec on stdin:
{
  "keyName": {
    "placeholders": {"foo": "String"},   # optional
    "translations": {"en": "...", "vi": "...", ...}   # all 7 locales
  }, ...
}
Idempotent: a key already present in a locale file is skipped for that file.
"""
import json
import sys
import os
import re

LOCALES = ["en", "vi", "zh", "ja", "ko", "es", "fr"]
BASE = os.path.join(os.path.dirname(__file__), "..", "lib", "l10n")

spec = json.load(sys.stdin)


def esc(s: str) -> str:
    return json.dumps(s, ensure_ascii=False)


for loc in LOCALES:
    path = os.path.join(BASE, f"app_{loc}.arb")
    with open(path, "r", encoding="utf-8") as fh:
        text = fh.read()

    additions = []
    for key, info in spec.items():
        if re.search(r'"' + re.escape(key) + r'"\s*:', text):
            continue
        val = info["translations"].get(loc, info["translations"]["en"])
        line = f'  {esc(key)}: {esc(val)}'
        ph = info.get("placeholders")
        if ph:
            ph_obj = ", ".join(
                f'{esc(n)}: {{ "type": {esc(t)} }}' for n, t in ph.items()
            )
            line += f',\n  {esc("@" + key)}: {{\n    "placeholders": {{ {ph_obj} }}\n  }}'
        additions.append(line)

    if not additions:
        print(f"no change {loc}")
        continue

    # Insert before the final closing brace. Add a trailing comma to the last
    # existing entry.
    idx = text.rstrip().rfind("}")
    head = text[:idx].rstrip()
    if not head.rstrip().endswith(","):
        head += ","
    block = ",\n".join(additions)
    new_text = head + "\n" + block + "\n}\n"
    json.loads(new_text)  # validate
    with open(path, "w", encoding="utf-8") as fh:
        fh.write(new_text)
    print(f"updated {loc} (+{len(additions)})")
