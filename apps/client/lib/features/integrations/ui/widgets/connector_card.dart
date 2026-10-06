import 'package:flutter/material.dart';
import '../../../../core/l10n/l10n_ext.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/widgets/pon_widgets.dart';
import '../../data/models/connector_models.dart';
import '../../utils/connector_labels.dart';

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
              available: available,
              onConnect: onConnect,
              onManage: onManage,
              onPermissions: onPermissions,
            ),
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
      child: _ConnectorLogo(id: icon),
    );
  }
}

/// Renders a brand logo for a provider id using the official favicon CDN.
/// Falls back to the provider's initial letter if the image can't load
/// (e.g. offline).
class _ConnectorLogo extends StatelessWidget {
  final String id;
  const _ConnectorLogo({required this.id});

  static const _logos = {
    'notion': 'https://www.notion.so/front-static/favicon.ico',
    'gmail': 'https://ssl.gstatic.com/ui/v1/icons/mail/rfr/gmail.ico',
    'calendar':
        'https://calendar.google.com/googlecalendar/images/favicon_v2018_256.png',
    'drive':
        'https://ssl.gstatic.com/images/branding/product/1x/drive_2020q4_32dp.png',
  };

  @override
  Widget build(BuildContext context) {
    final url = _logos[id];
    if (url == null) {
      return _initials(context);
    }
    return Image.network(
      url,
      width: 26,
      height: 26,
      fit: BoxFit.contain,
      errorBuilder: (_, __, ___) => _initials(context),
    );
  }

  Widget _initials(BuildContext context) => Text(
        id.isNotEmpty ? id[0].toUpperCase() : '?',
        style: TextStyle(
          color: AppTheme.mutedText(context),
          fontSize: 18,
          fontWeight: FontWeight.w600,
        ),
      );
}

class _StatusPill extends StatelessWidget {
  final bool connected;
  final bool needsReconnect;
  final bool available;
  const _StatusPill({
    required this.connected,
    required this.needsReconnect,
    required this.available,
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
