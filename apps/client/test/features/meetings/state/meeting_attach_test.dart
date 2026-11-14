// meeting_attach.dart: the default picker reads bytes lazily (memory on web,
// the file on disk on native) and the uploader goes through chat-service.

import 'dart:io';
import 'dart:typed_data';

import 'package:file_picker/file_picker.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:platform_client/features/chat/data/chat_repository.dart';
import 'package:platform_client/features/meetings/state/meeting_attach.dart';

import '../../chat/data/recording_adapter.dart';

class _Picker extends FilePicker {
  _Picker(this.result);
  final FilePickerResult? result;
  bool? withData;

  @override
  Future<FilePickerResult?> pickFiles({
    String? dialogTitle,
    String? initialDirectory,
    FileType type = FileType.any,
    List<String>? allowedExtensions,
    Function(FilePickerStatus)? onFileLoading,
    bool allowCompression = true,
    int compressionQuality = 30,
    bool allowMultiple = false,
    bool withData = false,
    bool withReadStream = false,
    bool lockParentWindow = false,
    bool readSequential = false,
  }) async {
    this.withData = withData;
    return result;
  }
}

void main() {
  late ProviderContainer c;
  setUp(() => c = ProviderContainer());
  tearDown(() => c.dispose());

  test('cap is 30 MB', () {
    expect(kMeetingFileMaxBytes, 30 * 1024 * 1024);
  });

  test('cancelled pick → null; native picks do not preload bytes', () async {
    final picker = _Picker(null);
    FilePicker.platform = picker;
    expect(await c.read(meetingFilePickerProvider)(), isNull);
    expect(picker.withData, isFalse);
  });

  test('in-memory bytes are returned as is', () async {
    FilePicker.platform = _Picker(FilePickerResult([
      PlatformFile(name: 'a.pdf', size: 3, bytes: Uint8List.fromList([1, 2, 3])),
    ]));
    final f = (await c.read(meetingFilePickerProvider)())!;
    expect(f.name, 'a.pdf');
    expect(f.size, 3);
    expect(await f.read(), [1, 2, 3]);
  });

  test('a file on disk is read only when asked', () async {
    final dir = await Directory.systemTemp.createTemp('pon_attach');
    addTearDown(() => dir.delete(recursive: true));
    final file = File('${dir.path}/notes.txt')..writeAsBytesSync([7, 8]);
    FilePicker.platform = _Picker(FilePickerResult([
      PlatformFile(name: 'notes.txt', size: 2, path: file.path),
    ]));
    final f = (await c.read(meetingFilePickerProvider)())!;
    expect(f.size, 2);
    expect(await f.read(), [7, 8]);
  });

  test('neither bytes nor path → StateError on read', () async {
    FilePicker.platform = _Picker(FilePickerResult([
      PlatformFile(name: 'ghost', size: 0),
    ]));
    final f = (await c.read(meetingFilePickerProvider)())!;
    expect(f.read, throwsStateError);
  });

  test('an empty result list → null', () async {
    FilePicker.platform = _Picker(const FilePickerResult([]));
    expect(await c.read(meetingFilePickerProvider)(), isNull);
  });

  test('uploader posts through the chat repository', () async {
    final http = RecordingAdapter()
      ..on('POST', '/api/uploads', {'url': '/u/1', 'filename': 'a.pdf', 'size': 3});
    final c2 = ProviderContainer(overrides: [
      chatRepositoryProvider.overrideWithValue(ChatRepository(recordingDio(http))),
    ]);
    addTearDown(c2.dispose);
    final r = await c2.read(meetingUploaderProvider)([1, 2, 3], 'a.pdf');
    expect(r.url, '/u/1');
    expect(r.name, 'a.pdf');
    expect(r.size, 3);
    expect(http.last.path, '/api/uploads');
  });
}
