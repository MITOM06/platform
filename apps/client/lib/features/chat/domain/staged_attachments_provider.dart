import 'dart:convert';
import 'dart:typed_data';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image/image.dart' as img;
import 'package:image_picker/image_picker.dart';

import '../data/chat_repository.dart';
import 'chat_provider.dart';

/// One attachment staged in the composer but not yet uploaded/sent. Mirrors the
/// web `PendingAttachment`: images/videos are previewed from their local path;
/// a document replaces the strip (single-shot). `isHD` toggles SD JPEG
/// re-encoding for images before upload.
class StagedAttachment {
  final String id;
  final String type; // 'image' | 'video' | 'file'
  final XFile? file; // image / video (local path for preview + upload)
  final List<int>? docBytes; // document only
  final String? docName; // document only
  final bool isHD;

  const StagedAttachment({
    required this.id,
    required this.type,
    this.file,
    this.docBytes,
    this.docName,
    this.isHD = true,
  });

  StagedAttachment copyWith({bool? isHD}) => StagedAttachment(
        id: id,
        type: type,
        file: file,
        docBytes: docBytes,
        docName: docName,
        isHD: isHD ?? this.isHD,
      );
}

/// Owns the "stage first, upload on Send" attachment flow for one conversation.
/// Mirrors the web `useStagedAttachments` hook — images/videos append and are
/// previewed locally; a document replaces the strip. [flush] uploads every
/// staged item and sends it (images batched into a single message), throwing on
/// the first failure so the caller can surface a localized error; the strip is
/// only cleared on full success.
class StagedAttachmentsNotifier extends StateNotifier<List<StagedAttachment>> {
  final Ref ref;
  final String conversationId;
  int _seq = 0;

  StagedAttachmentsNotifier(this.ref, this.conversationId) : super(const []);

  String _nextId() => 'staged_${_seq++}';

  void addImages(List<XFile> files) {
    if (files.isEmpty) return;
    final items = files
        .map((f) => StagedAttachment(id: _nextId(), type: 'image', file: f))
        .toList();
    // A staged document doesn't mix with media — replace it.
    state = (state.isNotEmpty && state.first.type == 'file')
        ? items
        : [...state, ...items];
  }

  void addVideo(XFile file) {
    final item = StagedAttachment(id: _nextId(), type: 'video', file: file);
    state = (state.isNotEmpty && state.first.type == 'file')
        ? [item]
        : [...state, item];
  }

  /// Documents are single-shot — staging one clears any staged media.
  void addDocument(List<int> bytes, String name) {
    state = [
      StagedAttachment(
          id: _nextId(), type: 'file', docBytes: bytes, docName: name),
    ];
  }

  void remove(String id) =>
      state = state.where((a) => a.id != id).toList();

  void toggleHD(String id) => state = [
        for (final a in state) a.id == id ? a.copyWith(isHD: !a.isHD) : a,
      ];

  void clear() => state = const [];

  bool get isEmpty => state.isEmpty;

  /// Re-encode an image to JPEG at a lower quality for the SD path. Falls back
  /// to the original bytes if it can't be decoded/encoded (mirrors web).
  Future<List<int>> _bytesForImage(StagedAttachment att) async {
    final bytes = await att.file!.readAsBytes();
    if (att.isHD) return bytes;
    try {
      final decoded = img.decodeImage(bytes);
      if (decoded == null) return bytes;
      return img.encodeJpg(decoded, quality: 70);
    } catch (_) {
      return bytes;
    }
  }

  /// Upload + send every staged attachment. Throws on the first failure.
  Future<void> flush() async {
    final items = state;
    if (items.isEmpty) return;
    final repo = ref.read(chatRepositoryProvider);
    final chat = ref.read(chatNotifierProvider(conversationId).notifier);
    final images = <String>[];

    for (final att in items) {
      if (att.type == 'file') {
        final uploaded =
            await repo.uploadDocument(att.docBytes!, att.docName!);
        await chat.sendMessage(
          jsonEncode(
              {'url': uploaded.url, 'name': uploaded.name, 'size': uploaded.size}),
          type: 'file',
        );
      } else if (att.type == 'video') {
        final url = await repo.uploadFile(att.file!);
        await chat.sendMessage(url, type: 'video');
      } else {
        final url = att.isHD
            ? await repo.uploadFile(att.file!)
            : await repo.uploadFile(XFile.fromData(
                Uint8List.fromList(await _bytesForImage(att)),
                name: '${att.file!.name.split('.').first}.jpg',
                mimeType: 'image/jpeg',
              ));
        images.add(url);
      }
    }

    if (images.length == 1) {
      await chat.sendMessage(images.first, type: 'image');
    } else if (images.length > 1) {
      await chat.sendMessage(jsonEncode(images), type: 'image');
    }

    clear();
  }
}

final stagedAttachmentsProvider = StateNotifierProvider.family<
    StagedAttachmentsNotifier, List<StagedAttachment>, String>(
  (ref, conversationId) => StagedAttachmentsNotifier(ref, conversationId),
);
