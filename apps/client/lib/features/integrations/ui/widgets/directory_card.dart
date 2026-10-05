import 'package:flutter/material.dart';
import '../../../../core/l10n/l10n_ext.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/widgets/pon_widgets.dart';
import '../../data/models/connector_models.dart';
import '../../utils/connector_labels.dart';

/// Card for one MCP directory entry — mirrors the web `DirectoryCard`:
/// monogram badge, name + localized tier/auth meta, description, 1-click
/// Connect / Reconnect / Manage, and admin edit/delete actions when [isAdmin].
class DirectoryCard extends StatelessWidget {
  final DirectoryItem item;
  final bool busy;
  final bool isAdmin;
  final VoidCallback onConnect;

  /// Null when the caller may not disconnect this connection.
  final VoidCallback? onManage;
  final VoidCallback? onEdit;
  final VoidCallback? onDelete;

  const DirectoryCard({
    super.key,
    required this.item,
    required this.busy,
    required this.isAdmin,
    required this.onConnect,
    required this.onManage,
    this.onEdit,
    this.onDelete,
  });

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final entry = item.entry;
    final connected = item.isConnected;

    return PonCard(
      borderRadius: 16,
      child: Padding(
        padding: const EdgeInsets.all(18),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _Monogram(name: entry.name),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        entry.name,
                        style: TextStyle(
                          color: Theme.of(context).colorScheme.onSurface,
                          fontWeight: FontWeight.w600,
                          fontSize: 16,
                        ),
                        overflow: TextOverflow.ellipsis,
                      ),
                      const SizedBox(height: 2),
                      Text(
                        '${directoryTierLabel(l10n, entry.tier)} · '
                        '${directoryAuthModeLabel(l10n, entry.authMode)}',
                        style: TextStyle(
                          color: AppTheme.mutedText(context),
                          fontSize: 12,
                        ),
                      ),
                    ],
                  ),
                ),
                if (isAdmin) ...[
                  IconButton(
                    visualDensity: VisualDensity.compact,
                    icon: Icon(Icons.edit_rounded,
                        size: 18, color: AppTheme.mutedText(context)),
                    tooltip: l10n.directoryEdit,
                    onPressed: onEdit,
                  ),
                  if (!entry.builtin)
                    IconButton(
                      visualDensity: VisualDensity.compact,
                      icon: Icon(Icons.delete_outline_rounded,
                          size: 18, color: AppTheme.mutedText(context)),
                      tooltip: l10n.directoryDelete,
                      onPressed: onDelete,
                    ),
                ],
              ],
            ),
            const SizedBox(height: 10),
            Text(
              entry.description,
              maxLines: 3,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                color: AppTheme.mutedText(context),
                fontSize: 12,
                height: 1.3,
              ),
            ),
            const SizedBox(height: 14),
            _ActionRow(
              connected: connected,
              needsReconnect: item.needsReconnect,
              available: entry.available,
              busy: busy,
              meta: connectionMetaLabel(l10n, item.connection),
              onConnect: onConnect,
              onManage: onManage,
            ),
          ],
        ),
      ),
    );
  }
}

class _Monogram extends StatelessWidget {
  final String name;
  const _Monogram({required this.name});

  @override
  Widget build(BuildContext context) {
    final letter = name.isEmpty ? '?' : name[0].toUpperCase();
    return Container(
      width: 42,
      height: 42,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surface,
        borderRadius: BorderRadius.circular(11),
        border: Border.all(color: AppTheme.hairline(context)),
      ),
      child: Text(
        letter,
        style: TextStyle(
          color: AppTheme.accent(context),
          fontSize: 18,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }
}

class _ActionRow extends StatelessWidget {
  final bool connected;
  final bool needsReconnect;
  final bool available;
  final bool busy;
  final String? meta;
  final VoidCallback onConnect;
  final VoidCallback? onManage;

  const _ActionRow({
    required this.connected,
    required this.needsReconnect,
    required this.available,
    required this.busy,
    required this.meta,
    required this.onConnect,
    required this.onManage,
  });

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final String? status = needsReconnect
        ? l10n.connectorStatusReconnect
        : (!connected && !available ? l10n.connectorStatusUnavailable : meta);
    return Row(
      children: [
        Expanded(
          child: Text(
            status ?? '',
            style: TextStyle(
              color: needsReconnect
                  ? AppTheme.warning
                  : AppTheme.mutedText(context),
              fontSize: 12,
            ),
            overflow: TextOverflow.ellipsis,
          ),
        ),
        const SizedBox(width: 8),
        if (busy)
          const SizedBox(
            width: 18,
            height: 18,
            child: CircularProgressIndicator(strokeWidth: 2),
          )
        else if (connected)
          (onManage == null
              ? const SizedBox.shrink()
              : TextButton(
                  onPressed: onManage,
                  child: Text(l10n.connectorManage,
                      style: TextStyle(color: AppTheme.accent(context))),
                ))
        else if (available)
          Flexible(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 140),
              child: PonButton(
                onPressed: onConnect,
                child: Text(
                    needsReconnect
                        ? l10n.connectorReconnect
                        : l10n.connectorConnect,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(fontSize: 14)),
              ),
            ),
          ),
      ],
    );
  }
}
