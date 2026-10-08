import 'package:flutter_test/flutter_test.dart';
import 'package:platform_client/features/meetings/domain/device_prefs.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  test('tolerates missing or broken data', () {
    expect(parseDevicePrefs(null), const DevicePrefs());
    expect(parseDevicePrefs('not json'), const DevicePrefs());
    expect(parseDevicePrefs('{"micOn":"yes","camOn":false}'), const DevicePrefs(camOn: false));
  });

  test('round-trips through SharedPreferences', () async {
    SharedPreferences.setMockInitialValues({});
    final prefs = await SharedPreferences.getInstance();
    const p = DevicePrefs(micOn: false, camOn: true, frontCamera: false, speakerOn: false);
    await saveDevicePrefs(p, prefs);
    expect(await loadDevicePrefs(prefs), p);
    expect(await loadDevicePrefs(null), const DevicePrefs());
  });
}
