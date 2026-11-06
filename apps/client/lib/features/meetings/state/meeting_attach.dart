// What the meeting chat's attach button needs from the outside world: a file
// picker and the upload call. Providers so tests inject fakes.

import 'dart:io';

import 'package:file_picker/file_picker.dart';
import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../chat/data/chat_repository.dart';

/// Bigger files are refused before the upload (same cap as web).
const kMeetingFileMaxBytes = 30 * 1024 * 1024;

/// A picked file whose bytes are NOT loaded yet: check [size] first, then
/// call [read].
typedef PickedMeetingFile = ({
  String name,
  int size,
  Future<List<int>> Function() read
});
typedef MeetingFilePicker = Future<PickedMeetingFile?> Function();
typedef MeetingUploader = Future<({String url, String name, int size})>
    Function(List<int> bytes, String filename);

/// Native: no bytes in memory until [PickedMeetingFile.read] (a file on disk).
/// Web has no path, so the browser hands the bytes over with the pick.
Future<PickedMeetingFile?> _pick() async {
  final result = await FilePicker.platform.pickFiles(withData: kIsWeb);
  final file = result?.files.firstOrNull;
  if (file == null) return null;
  return (
    name: file.name,
    size: file.size,
    read: () async {
      final bytes = file.bytes;
      if (bytes != null) return bytes;
      final path = file.path;
      if (path == null) throw StateError('no file data');
      return File(path).readAsBytes();
    },
  );
}

final meetingFilePickerProvider = Provider<MeetingFilePicker>((ref) => _pick);

final meetingUploaderProvider = Provider<MeetingUploader>(
    (ref) => ref.read(chatRepositoryProvider).uploadDocument);
