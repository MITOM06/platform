// Remembered microphone / camera / camera side / speaker choices for meetings
// — mirror of web `lib/meetings/devices.ts` for phones (one mic, front/back
// camera, loudspeaker/earpiece). Storage can be missing or throw — every
// access is guarded and falls back to "everything on, front camera".

import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';

const kDevicePrefsKey = 'pon.meet.devices';

class DevicePrefs {
  const DevicePrefs({
    this.micOn = true,
    this.camOn = true,
    this.frontCamera = true,
    this.speakerOn = true,
  });

  final bool micOn;
  final bool camOn;
  final bool frontCamera;
  final bool speakerOn;

  DevicePrefs copyWith(
          {bool? micOn, bool? camOn, bool? frontCamera, bool? speakerOn}) =>
      DevicePrefs(
        micOn: micOn ?? this.micOn,
        camOn: camOn ?? this.camOn,
        frontCamera: frontCamera ?? this.frontCamera,
        speakerOn: speakerOn ?? this.speakerOn,
      );

  Map<String, bool> toJson() => {
        'micOn': micOn,
        'camOn': camOn,
        'frontCamera': frontCamera,
        'speakerOn': speakerOn,
      };

  @override
  bool operator ==(Object other) =>
      other is DevicePrefs &&
      other.micOn == micOn &&
      other.camOn == camOn &&
      other.frontCamera == frontCamera &&
      other.speakerOn == speakerOn;

  @override
  int get hashCode => Object.hash(micOn, camOn, frontCamera, speakerOn);

  @override
  String toString() => 'DevicePrefs(${toJson()})';
}

/// Missing / broken data ⇒ defaults; a field of the wrong type ⇒ its default.
DevicePrefs parseDevicePrefs(String? raw) {
  if (raw == null || raw.isEmpty) return const DevicePrefs();
  Object? parsed;
  try {
    parsed = jsonDecode(raw);
  } catch (_) {
    return const DevicePrefs();
  }
  if (parsed is! Map) return const DevicePrefs();
  bool flag(String k) {
    final v = parsed is Map ? parsed[k] : null;
    return v is bool ? v : true;
  }

  return DevicePrefs(
    micOn: flag('micOn'),
    camOn: flag('camOn'),
    frontCamera: flag('frontCamera'),
    speakerOn: flag('speakerOn'),
  );
}

String encodeDevicePrefs(DevicePrefs p) => jsonEncode(p.toJson());

Future<DevicePrefs> loadDevicePrefs(SharedPreferences? prefs) async {
  try {
    return parseDevicePrefs(prefs?.getString(kDevicePrefsKey));
  } catch (_) {
    return const DevicePrefs();
  }
}

Future<void> saveDevicePrefs(DevicePrefs p, SharedPreferences? prefs) async {
  try {
    await prefs?.setString(kDevicePrefsKey, encodeDevicePrefs(p));
  } catch (_) {
    // blocked storage — the choice just isn't remembered
  }
}
