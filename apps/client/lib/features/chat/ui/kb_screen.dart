import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/l10n/l10n_ext.dart';
import '../../../core/theme/app_theme.dart';
import '../data/chat_repository.dart';
import '../domain/kb_document_model.dart';
import '../domain/kb_provider.dart';

class KbScreen extends ConsumerWidget {
  final String conversationId;

  const KbScreen({super.key, required this.conversationId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final docsAsync = ref.watch(kbDocumentsProvider(conversationId));

    return Scaffold(
      appBar: AppBar(
        title: Text(context.l10n.kbTitle),
        backgroundColor: AppTheme.darkBackground,
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: () => _pickAndUpload(context, ref),
        backgroundColor: AppTheme.ponCyan,
        child: const Icon(Icons.upload_file, color: Colors.black),
      ),
      body: docsAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text('Error: $e')),
        data: (docs) => docs.isEmpty
            ? _EmptyState()
            : ListView.separated(
                padding: const EdgeInsets.symmetric(vertical: 8),
                itemCount: docs.length,
                separatorBuilder: (_, __) => const Divider(height: 1),
                itemBuilder: (ctx, i) => _DocumentTile(
                  doc: docs[i],
                  onDelete: () => _confirmDelete(context, ref, docs[i]),
                ),
              ),
      ),
    );
  }

  Future<void> _pickAndUpload(BuildContext context, WidgetRef ref) async {
    final result = await FilePicker.platform.pickFiles(
      type: FileType.custom,
      allowedExtensions: ['pdf', 'docx', 'doc', 'txt'],
      withData: true,
    );
    if (result == null || result.files.isEmpty) return;

    final file = result.files.first;
    if (file.bytes == null) return;

    try {
      final chatRepo = ref.read(chatRepositoryProvider);
      final uploaded = await chatRepo.uploadDocument(file.bytes!, file.name);
      final mimeType = _mimeForExtension(file.extension ?? '');

      await ref
          .read(kbDocumentsProvider(conversationId).notifier)
          .upload(conversationId, uploaded.url, file.name, mimeType);
    } catch (e) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Upload failed: $e')),
        );
      }
    }
  }

  Future<void> _confirmDelete(
      BuildContext context, WidgetRef ref, KbDocumentModel doc) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(context.l10n.kbDeleteConfirm),
        content: Text(doc.fileName),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: Text(context.l10n.actionCancel),
          ),
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(true),
            child: Text(context.l10n.actionDelete,
                style: const TextStyle(color: Colors.red)),
          ),
        ],
      ),
    );
    if (confirmed == true) {
      try {
        await ref
            .read(kbDocumentsProvider(conversationId).notifier)
            .delete(doc.documentId);
      } catch (e) {
        if (context.mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('Delete failed: $e')),
          );
        }
      }
    }
  }

  String _mimeForExtension(String ext) {
    switch (ext.toLowerCase()) {
      case 'pdf':
        return 'application/pdf';
      case 'docx':
        return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      case 'doc':
        return 'application/msword';
      case 'txt':
        return 'text/plain';
      default:
        return 'application/octet-stream';
    }
  }
}

class _EmptyState extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.folder_open,
              size: 64, color: Colors.white.withValues(alpha: 0.2)),
          const SizedBox(height: 16),
          Text(
            context.l10n.kbEmptyState,
            style: TextStyle(
              color: Colors.white.withValues(alpha: 0.4),
              fontSize: 15,
            ),
            textAlign: TextAlign.center,
          ),
        ],
      ),
    );
  }
}

class _DocumentTile extends StatelessWidget {
  final KbDocumentModel doc;
  final VoidCallback onDelete;

  const _DocumentTile({required this.doc, required this.onDelete});

  @override
  Widget build(BuildContext context) {
    return ListTile(
      leading: const Icon(Icons.description_outlined, color: AppTheme.ponCyan),
      title: Text(
        doc.fileName,
        style: const TextStyle(color: Colors.white, fontSize: 14),
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
      ),
      subtitle: Row(
        children: [
          _StatusChip(doc: doc),
          if (doc.isReady) ...[
            const SizedBox(width: 8),
            Text(
              '${doc.chunkCount} ${context.l10n.kbChunks}',
              style: TextStyle(
                  fontSize: 11, color: Colors.white.withValues(alpha: 0.4)),
            ),
          ],
        ],
      ),
      trailing: IconButton(
        icon: const Icon(Icons.delete_outline, color: Colors.red, size: 20),
        onPressed: onDelete,
      ),
    );
  }
}

class _StatusChip extends StatelessWidget {
  final KbDocumentModel doc;

  const _StatusChip({required this.doc});

  @override
  Widget build(BuildContext context) {
    Color color;
    Widget child;

    if (doc.isProcessing) {
      color = Colors.amber;
      child = Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          const SizedBox(
            width: 10,
            height: 10,
            child: CircularProgressIndicator(strokeWidth: 1.5, color: Colors.amber),
          ),
          const SizedBox(width: 4),
          Text(context.l10n.kbProcessing,
              style: const TextStyle(fontSize: 10, color: Colors.amber)),
        ],
      );
    } else if (doc.isReady) {
      color = Colors.green;
      child = Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(Icons.check_circle, size: 10, color: Colors.green),
          const SizedBox(width: 4),
          Text(context.l10n.kbReady,
              style: const TextStyle(fontSize: 10, color: Colors.green)),
        ],
      );
    } else {
      color = Colors.red;
      child = Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(Icons.error_outline, size: 10, color: Colors.red),
          const SizedBox(width: 4),
          Text(context.l10n.kbError,
              style: const TextStyle(fontSize: 10, color: Colors.red)),
        ],
      );
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      decoration: BoxDecoration(
        border: Border.all(color: color.withValues(alpha: 0.5), width: 0.5),
        borderRadius: BorderRadius.circular(4),
      ),
      child: child,
    );
  }
}
