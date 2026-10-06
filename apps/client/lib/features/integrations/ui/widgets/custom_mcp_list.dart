import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/l10n/l10n_ext.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/utils/global_messenger.dart';
import '../../../../core/widgets/pon_widgets.dart';
import '../../data/models/custom_mcp_models.dart';
import '../../state/integrations_provider.dart';
import '../../utils/connector_error.dart';
import 'disconnect_dialog.dart';

/// The caller's custom MCP servers with a delete action (`GET/DELETE
/// /custom-mcp`). Shown whenever the caller owns any — even after losing
/// ADD_CUSTOM_MCP, so they can still clean up; nothing renders when the list
/// is empty. Mirrors the web `CustomMcpPanel` list.
class CustomMcpList extends ConsumerWidget {
  const CustomMcpList({super.key});

  Future<void> _delete(
      BuildContext context, WidgetRef ref, CustomMcpServer server) async {
    final l10n = context.l10n;
    final name = server.name.isNotEmpty ? server.name : l10n.connectorCustomName;
    final ok = await confirmDisconnect(
      context,
      name,
      message: l10n.customMcpDeleteConfirm,
      actionLabel: l10n.customMcpDelete,
    );
    if (!ok) return;
    try {
      await ref.read(customMcpProvider.notifier).remove(server.id);
      showInfoSnackBar(l10n.customMcpDeleted(name));
    } catch (e) {
      showErrorSnackBar(connectorErrorMessage(l10n, e));
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = context.l10n;
    final async = ref.watch(customMcpProvider);
    return async.when(
      skipLoadingOnReload: true,
      loading: () => const SizedBox.shrink(),
      error: (e, _) => Padding(
        padding: const EdgeInsets.only(bottom: 12),
        child: Row(
          children: [
            Expanded(
              child: Text(connectorErrorMessage(l10n, e),
                  style: TextStyle(
                      color: AppTheme.mutedText(context), fontSize: 12)),
            ),
            TextButton(
              onPressed: () => ref.invalidate(customMcpProvider),
              child: Text(l10n.actionRetry),
            ),
          ],
        ),
      ),
      data: (servers) {
        if (servers.isEmpty) return const SizedBox.shrink();
        return Padding(
          padding: const EdgeInsets.only(bottom: 12),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                l10n.customMcpListTitle,
                style: TextStyle(
                  color: Theme.of(context).colorScheme.onSurface,
                  fontWeight: FontWeight.w600,
                  fontSize: 16,
                ),
              ),
              const SizedBox(height: 10),
              for (final s in servers)
                Padding(
                  padding: const EdgeInsets.only(bottom: 10),
                  child: _CustomMcpRow(
                    server: s,
                    onDelete: () => _delete(context, ref, s),
                  ),
                ),
            ],
          ),
        );
      },
    );
  }
}

class _CustomMcpRow extends StatelessWidget {
  final CustomMcpServer server;
  final VoidCallback onDelete;
  const _CustomMcpRow({required this.server, required this.onDelete});

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final subtitle = [
      if (server.host.isNotEmpty) server.host,
      l10n.customMcpToolsFound(server.toolCount),
    ].join(' · ');
    return PonCard(
      child: ListTile(
        leading: Icon(Icons.dashboard_customize_rounded,
            color: AppTheme.mutedText(context)),
        title: Text(
          server.name.isNotEmpty ? server.name : l10n.connectorCustomName,
          style: TextStyle(color: Theme.of(context).colorScheme.onSurface),
          overflow: TextOverflow.ellipsis,
        ),
        subtitle: Text(subtitle,
            style: TextStyle(color: AppTheme.mutedText(context), fontSize: 12),
            overflow: TextOverflow.ellipsis),
        trailing: IconButton(
          icon: Icon(Icons.delete_outline_rounded,
              color: Theme.of(context).colorScheme.error),
          tooltip: l10n.customMcpDelete,
          onPressed: onDelete,
        ),
      ),
    );
  }
}
