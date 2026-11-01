import 'package:flutter/material.dart';
import '../../../../core/l10n/l10n_ext.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/widgets/pon_widgets.dart';
import '../../data/models/connector_models.dart';
import '../../utils/connector_labels.dart';
import 'provider_logo.dart';

/// Gallery card for a single connector — mirrors the web `ConnectorCard`:
/// icon, name + status pill, description, localized scope chips, and a
/// Connect / Reconnect / Manage action.
class ConnectorCard extends StatelessWidget {
  final ConnectorItem item;
  final bool busy;
  final VoidCallback onConnect;

  /// Null when the caller may not disconnect this connection (a workspace
  /// connection without CONNECT_WORKSPACE_CONNECTOR).
  final VoidCallback? onManage;

  /// Null when the caller may not change this connection's AI permissions.
  final VoidCallback? onPermissions;

  const ConnectorCard({
    super.key,
    required this.item,
    required this.busy,
    required this.onConnect,
    required this.onManage,
    required this.onPermissions,
  });

  @override
  Widget build(BuildContext context) {
    final entry = item.entry;
    final connected = item.isConnected;
    final available = entry.available;
    // Left out of the workspace allow-list: connecting would 403, so say so up front.
    final notAllowed = available &&
        !entry.allowedByWorkspace &&
        !connected &&
        !item.needsReconnect;
    final scopes = scopeLabels(context.l10n, entry.scopes);

    return PonCard(
      borderRadius: 16,
      child: Padding(
        padding: const EdgeInsets.all(18),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _IconBadge(icon: entry.icon),
            const SizedBox(height: 12),
            Row(
              children: [
                Flexible(
                  child: Text(
                    entry.name,
                    style: TextStyle(
                      color: Theme.of(context).colorScheme.onSurface,
                      fontWeight: FontWeight.w600,
                      fontSize: 16,
                    ),
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
                const SizedBox(width: 8),
                _StatusPill(
                  connected: connected,
                  needsReconnect: item.needsReconnect,
                  available: available,
                  notAllowed: notAllowed,
                ),
              ],
            ),
            const SizedBox(height: 6),
            Text(
              entry.description,
              style: TextStyle(
                color: AppTheme.mutedText(context),
                fontSize: 12,
                height: 1.3,
              ),
            ),
            if (scopes.isNotEmpty) ...[
              const SizedBox(height: 12),
              Wrap(
                spacing: 6,
                runSpacing: 6,
                children: scopes.map((s) => _ScopeChip(label: s)).toList(),
              ),
            ],
            const SizedBox(height: 14),
            _ActionRow(
              item: item,
              busy: busy,
              connected: connected,
              available: available && !notAllowed,
              onConnect: onConnect,
              onManage: onManage,
              onPermissions: onPermissions,
            ),
            if (notAllowed) ...[
              const SizedBox(height: 8),
              Text(
                context.l10n.connectorNotAllowedHint,
                style: TextStyle(
                  color: AppTheme.mutedText(context),
                  fontSize: 12,
                  height: 1.3,
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _IconBadge extends StatelessWidget {
  final String icon;
  const _IconBadge({required this.icon});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 44,
      height: 44,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppTheme.hairline(context)),
      ),
      child: ProviderLogo(
        icon: icon,
        name: icon,
        monogramColor: AppTheme.mutedText(context),
      ),
    );
  }
}

class _StatusPill extends StatelessWidget {
  final bool connected;
  final bool needsReconnect;
  final bool available;
  final bool notAllowed;
  const _StatusPill({
    required this.connected,
    required this.needsReconnect,
    required this.available,
    required this.notAllowed,
  });

  @override
  Widget build(BuildContext context) {
    final Color color;
    final String label;
    if (connected) {
      color = AppTheme.onlineGreen;
      label = context.l10n.connectorStatusConnected;
    } else if (needsReconnect) {
      color = AppTheme.warning;
      label = context.l10n.connectorStatusReconnect;
    } else if (notAllowed) {
      color = AppTheme.warning;
      label = context.l10n.connectorStatusNotAllowed;
    } else if (available) {
      color = AppTheme.accent(context);
      label = context.l10n.connectorStatusAvailable;
    } else {
      color = AppTheme.offlineGrey;
      label = context.l10n.connectorStatusComingSoon;
    }
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 3),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: color.withValues(alpha: 0.35)),
      ),
      child: Text(
        label,
        style: TextStyle(
          color: color,
          fontSize: 11,
          fontWeight: FontWeight.w500,
        ),
      ),
    );
  }
}

class _ScopeChip extends StatelessWidget {
  final String label;
  const _ScopeChip({required this.label});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
      decoration: BoxDecoration(
        color: AppTheme.accent(context).withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(6),
        border: Border.all(color: AppTheme.accent(context).withValues(alpha: 0.2)),
      ),
      child: Text(
        label,
        style: TextStyle(
          color: AppTheme.accentTintFg(context),
          fontSize: 11,
        ),
      ),
    );
  }
}

class _ActionRow extends StatelessWidget {
  final ConnectorItem item;
  final bool busy;
  final bool connected;
  final bool available;
  final VoidCallback onConnect;
  final VoidCallback? onManage;
  final VoidCallback? onPermissions;

  const _ActionRow({
    required this.item,
    required this.busy,
    required this.connected,
    required this.available,
    required this.onConnect,
    required this.onManage,
    required this.onPermissions,
  });

  @override
  Widget build(BuildContext context) {
    final meta = connectionMetaLabel(context.l10n, item.connection) ?? '';
    final reconnect = item.needsReconnect;
    return Row(
      children: [
        Expanded(
          child: Text(
            meta,
            style: TextStyle(
              color: AppTheme.mutedText(context),
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
        else if (connected) ...[
          if (onPermissions != null)
            IconButton(
              onPressed: onPermissions,
              visualDensity: VisualDensity.compact,
              tooltip: context.l10n.permManage,
              icon: Icon(Icons.tune_rounded,
                  color: AppTheme.mutedText(context), size: 20),
            ),
          if (onManage != null)
            TextButton(
              onPressed: onManage,
              child: Text(context.l10n.connectorManage,
                  style: TextStyle(color: AppTheme.accent(context))),
            ),
        ]
        else if (available || reconnect)
          Flexible(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 140),
              child: PonButton(
                onPressed: onConnect,
                child: Text(
                    reconnect
                        ? context.l10n.connectorReconnect
                        : context.l10n.connectorConnect,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(fontSize: 14)),
              ),
            ),
          )
        else
          Text(
            context.l10n.connectorStatusComingSoon,
            style: TextStyle(
              color: AppTheme.mutedText(context),
              fontSize: 12,
            ),
          ),
      ],
    );
  }
}
