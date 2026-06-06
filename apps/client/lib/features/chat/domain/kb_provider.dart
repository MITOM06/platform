import 'dart:async';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../data/kb_repository.dart';
import '../data/stomp_service.dart';
import 'kb_document_model.dart';

class KbNotifier extends FamilyAsyncNotifier<List<KbDocumentModel>, String> {
  StreamSubscription<Map<String, dynamic>>? _kbStatusSub;

  @override
  Future<List<KbDocumentModel>> build(String conversationId) async {
    final docs = await ref.read(kbRepositoryProvider).getDocuments(conversationId);

    _kbStatusSub?.cancel();
    final stomp = ref.read(stompServiceProvider.notifier);
    _kbStatusSub = stomp.kbStatusEvents.listen((event) {
      _onKbStatusUpdate(event);
    });

    ref.onDispose(() => _kbStatusSub?.cancel());

    return docs;
  }

  void _onKbStatusUpdate(Map<String, dynamic> event) {
    final documentId = event['documentId'] as String?;
    final newStatus = event['status'] as String?;
    if (documentId == null || newStatus == null) return;

    final current = state.valueOrNull;
    if (current == null) return;

    final idx = current.indexWhere((d) => d.documentId == documentId);
    if (idx == -1) return;

    final chunkCount = (event['chunkCount'] as num?)?.toInt();
    final updated = List<KbDocumentModel>.from(current);
    updated[idx] = current[idx].copyWith(
      status: newStatus,
      chunkCount: chunkCount ?? current[idx].chunkCount,
    );
    state = AsyncData(updated);
  }

  Future<void> upload(String conversationId, String fileUrl, String fileName, String mimeType) async {
    final current = state.valueOrNull ?? [];
    final repo = ref.read(kbRepositoryProvider);

    final doc = await repo.uploadDocument(
      conversationId: conversationId,
      fileUrl: fileUrl,
      fileName: fileName,
      mimeType: mimeType,
    );
    state = AsyncData([doc, ...current]);
  }

  Future<void> delete(String documentId) async {
    await ref.read(kbRepositoryProvider).deleteDocument(documentId);
    final current = state.valueOrNull ?? [];
    state = AsyncData(current.where((d) => d.documentId != documentId).toList());
  }
}

final kbDocumentsProvider =
    AsyncNotifierProvider.family<KbNotifier, List<KbDocumentModel>, String>(
  KbNotifier.new,
);
