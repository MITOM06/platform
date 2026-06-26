import 'package:flutter/material.dart';
import '../../../../core/l10n/l10n_ext.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/widgets/pon_widgets.dart';
import '../../data/models/connector_models.dart';

/// Neon card for one MCP directory entry — mirrors the web `DirectoryCard`:
/// monogram badge, name + tier/auth meta, description, 1-click Connect/Manage,
/// and admin edit/delete actions when [isAdmin].
class DirectoryCard extends StatelessWidget {
  final DirectoryItem item;
  final bool busy;
  final bool isAdmin;
  final VoidCallback onConnect;
  final VoidCallback onManage;
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
      glowColor: connected ? AppTheme.onlineGreen : AppTheme.ponCyan,
      glowStrength: connected ? 5 : 2,
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
                        style: const TextStyle(
                          color: Colors.white,
                          fontWeight: FontWeight.bold,
                          fontSize: 16,
                        ),
                        overflow: TextOverflow.ellipsis,
                      ),
                      const SizedBox(height: 2),
                      Text(
                        '${_tierLabel(context)} · ${directoryAuthModeToString(entry.authMode)}',
                        style: TextStyle(
                          color: Colors.white.withValues(alpha: 0.4),
                          fontSize: 10.5,
                          fontFamily: 'monospace',
                        ),
                      ),
                    ],
                  ),
                ),
                if (isAdmin) ...[
                  IconButton(
                    visualDensity: VisualDensity.compact,
                    icon: const Icon(Icons.edit_outlined,
                        size: 18, color: Colors.white54),
                    tooltip: l10n.directoryEdit,
                    onPressed: onEdit,
                  ),
                  if (!entry.builtin)
                    IconButton(
                      visualDensity: VisualDensity.compact,
                      icon: const Icon(Icons.delete_outline,
                          size: 18, color: Colors.white54),
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
                color: Colors.white.withValues(alpha: 0.6),
                fontSize: 13,
                height: 1.3,
              ),
            ),
            const SizedBox(height: 14),
            _ActionRow(
              connected: connected,
              busy: busy,
              accountLabel: item.connection?.accountLabel,
              onConnect: onConnect,
              onManage: onManage,
            ),
          ],
        ),
      ),
    );
  }

  String _tierLabel(BuildContext context) {
    final l10n = context.l10n;
    switch (item.entry.tier) {
      case DirectoryTier.workspace:
        return l10n.tierWorkspace;
      case DirectoryTier.personal:
        return l10n.tierPersonal;
      case DirectoryTier.both:
        return l10n.tierBoth;
    }
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
        color: AppTheme.darkBackground,
        borderRadius: BorderRadius.circular(11),
        border: Border.all(color: AppTheme.darkBorder),
      ),
      child: Text(
        letter,
        style: const TextStyle(
          color: AppTheme.ponCyan,
          fontSize: 18,
          fontWeight: FontWeight.bold,
        ),
      ),
    );
  }
}

class _ActionRow extends StatelessWidget {
  final bool connected;
  final bool busy;
  final String? accountLabel;
  final VoidCallback onConnect;
  final VoidCallback onManage;

  const _ActionRow({
    required this.connected,
    required this.busy,
    required this.accountLabel,
    required this.onConnect,
    required this.onManage,
  });

  @override
  Widget build(BuildContext context) {
    final meta = (accountLabel != null && accountLabel!.isNotEmpty)
        ? 'remote-mcp · $accountLabel'
        : 'remote-mcp';
    return Row(
      children: [
        Expanded(
          child: Text(
            meta,
            style: TextStyle(
              color: Colors.white.withValues(alpha: 0.35),
              fontSize: 11,
              fontFamily: 'monospace',
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
          TextButton(
            onPressed: onManage,
            child: Text(context.l10n.connectorManage,
                style: const TextStyle(color: AppTheme.ponCyan)),
          )
        else
          Flexible(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 120),
              child: PonButton(
                onPressed: onConnect,
                child: Text(context.l10n.connectorConnect,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(fontSize: 13)),
              ),
            ),
          ),
      ],
    );
  }
}
