#!/usr/bin/env python3
"""Generate PON's call tones — original, synthesized audio (no third-party
files, no licence to track). Writes the SAME two WAVs into both apps:

  ringtone.wav  incoming-call ring: two-note chime twice, then a pause (3 s loop)
  ringback.wav  outgoing "tút… tút…": 425 Hz, 1 s on / 4 s off (VN/ITU ringback)

Re-run after changing a constant:  python3 apps/client/tool/gen_call_tones.py
"""
import math
import os
import struct
import wave

RATE = 16000  # mono 16-bit, plenty for tones and keeps files ~100-160 KB
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
OUT_DIRS = [
    os.path.join(ROOT, "apps", "client", "assets", "sounds"),
    os.path.join(ROOT, "apps", "web", "public", "sounds"),
]


def tone(freq, secs, vol=0.35, fade=0.01):
    """Steady sine with short fade in/out (no clicks at loop boundaries)."""
    n = int(RATE * secs)
    f = int(RATE * fade)
    return [
        vol * min(1.0, i / f, (n - i) / f) * math.sin(2 * math.pi * freq * i / RATE)
        for i in range(n)
    ]


def chime(freq, secs, vol=0.45):
    """Bell-like note: fundamental + octave, exponential decay."""
    n = int(RATE * secs)
    out = []
    for i in range(n):
        t = i / RATE
        env = math.exp(-3.0 * t) * min(1.0, i / (RATE * 0.005))
        s = math.sin(2 * math.pi * freq * t) + 0.35 * math.sin(2 * math.pi * 2 * freq * t)
        out.append(vol * env * s / 1.35)
    return out


def silence(secs):
    return [0.0] * int(RATE * secs)


def write(name, samples):
    data = b"".join(
        struct.pack("<h", int(max(-1.0, min(1.0, s)) * 32767)) for s in samples
    )
    for d in OUT_DIRS:
        os.makedirs(d, exist_ok=True)
        path = os.path.join(d, name)
        with wave.open(path, "wb") as w:
            w.setnchannels(1)
            w.setsampwidth(2)
            w.setframerate(RATE)
            w.writeframes(data)
        print("wrote", os.path.relpath(path, ROOT), f"{len(data) // 1024} KB")


RINGTONE = (
    chime(880.0, 0.35) + chime(659.25, 0.55) + chime(880.0, 0.35) + chime(659.25, 0.75)
    + silence(1.0)
)
RINGBACK = tone(425.0, 1.0) + silence(4.0)

if __name__ == "__main__":
    write("ringtone.wav", RINGTONE)
    write("ringback.wav", RINGBACK)
