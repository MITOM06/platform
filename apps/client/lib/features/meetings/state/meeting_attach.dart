// What the meeting chat's attach button needs from the outside world: a file
// picker and the upload call. Providers so tests inject fakes.

import 'package:file_picker/file_picker.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../chat/data/chat_repository.dart';

/// Bigger files are refused before the upload (same cap as web).
const kMeetingFileMaxBytes = 30 * 1024 * 1024;

typedef PickedMeetingFile = ({List<int> bytes, String name});
typedef MeetingFilePicker = Future<PickedMeetingFile?> Function();
typedef MeetingUploader = Future<({String url, String name, int size})>
    Function(List<int> bytes, String filename);

Future<PickedMeetingFile?> _pick() async {
  final result = await FilePicker.platform.pickFiles(withData: true);
  final file = result?.files.firstOrNull;
  final bytes = file?.bytes;
  return file == null || bytes == null ? null : (bytes: bytes, name: file.name);
}

final meetingFilePickerProvider = Provider<MeetingFilePicker>((ref) => _pick);

final meetingUploaderProvider = Provider<MeetingUploader>(
    (ref) => ref.read(chatRepositoryProvider).uploadDocument);
