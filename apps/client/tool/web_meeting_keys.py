#!/usr/bin/env python3
"""Print an add_arb_keys.py spec for web `meeting.*` i18n keys (same wording).

Usage: python3 tool/web_meeting_keys.py errNotFound errFull ... | python3 tool/add_arb_keys.py
Web key `meeting.<k>` becomes ARB key `meeting<K>`. Placeholders come from the
English text; `count|max|n|minutes|hours` are int, the rest String. Flutter's
ICU parser has no `#`, so inside a plural `#` becomes `{<plural arg>}`.
Exits 1 when a key is missing from any locale.
"""
import json
import os
import re
import sys

LOCALES = ["en", "vi", "zh", "ja", "ko", "es", "fr"]
WEB = os.path.join(os.path.dirname(__file__), "..", "..", "web", "messages")
INT_NAMES = {"count", "max", "n", "minutes", "hours"}


def load(loc):
    with open(os.path.join(WEB, f"{loc}.json"), encoding="utf-8") as fh:
        return json.load(fh)["meeting"]


def flutterize(text):
    m = re.match(r"^\{(\w+), *plural,", text)
    return text.replace("#", "{" + m.group(1) + "}") if m else text


def main(keys):
    msgs = {loc: load(loc) for loc in LOCALES}
    spec, missing = {}, []
    for key in keys:
        absent = [loc for loc in LOCALES if not isinstance(msgs[loc].get(key), str)]
        if absent:
            missing.append(f"{key}: {','.join(absent)}")
            continue
        en = msgs["en"][key]
        names = list(dict.fromkeys(re.findall(r"\{(\w+)[,}]", en)))
        entry = {"translations": {loc: flutterize(msgs[loc][key]) for loc in LOCALES}}
        if names:
            entry["placeholders"] = {
                n: "int" if n in INT_NAMES else "String" for n in names
            }
        spec["meeting" + key[0].upper() + key[1:]] = entry
    if missing:
        print("missing in web messages:\n  " + "\n  ".join(missing), file=sys.stderr)
        sys.exit(1)
    json.dump(spec, sys.stdout, ensure_ascii=False, indent=1)


if __name__ == "__main__":
    main(sys.argv[1:])
