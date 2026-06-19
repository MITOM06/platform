import 'package:flutter/material.dart';
import '../../../../core/l10n/l10n_ext.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/widgets/pon_widgets.dart';
import '../../data/models/connector_models.dart';

/// Neon gallery card for a single connector — mirrors the web `ConnectorCard`
/// and the mockup: icon, name + status pill, description, scope chips, and a
/// Connect / Manage action.
class ConnectorCard extends StatelessWidget {
  final ConnectorItem item;
  final bool busy;
  final VoidCallback onConnect;
  final VoidCallback onManage;

  const ConnectorCard({
    super.key,
    required this.item,
    required this.busy,
    required this.onConnect,
    required this.onManage,
  });

  @override
  Widget build(BuildContext context) {
    final entry = item.entry;
    final connected = item.isConnected;
    final available = entry.available;

    return PonCard(
      glowColor: connected ? AppTheme.onlineGreen : AppTheme.ponCyan,
      glowStrength: connected ? 5 : 2,
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
                    style: const TextStyle(
                      color: Colors.white,
                      fontWeight: FontWeight.bold,
                      fontSize: 16,
                    ),
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
                const SizedBox(width: 8),
                _StatusPill(connected: connected, available: available),
              ],
            ),
            const SizedBox(height: 6),
            Text(
              entry.description,
              style: TextStyle(
                color: Colors.white.withValues(alpha: 0.6),
                fontSize: 13,
                height: 1.3,
              ),
            ),
            if (entry.scopes.isNotEmpty) ...[
              const SizedBox(height: 12),
              Wrap(
                spacing: 6,
                runSpacing: 6,
                children:
                    entry.scopes.map((s) => _ScopeChip(label: s)).toList(),
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
        color: AppTheme.darkBackground,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppTheme.darkBorder),
      ),
      child: Text(icon, style: const TextStyle(fontSize: 22)),
    );
  }
}

class _StatusPill extends StatelessWidget {
  final bool connected;
  final bool available;
  const _StatusPill({required this.connected, required this.available});

  @override
  Widget build(BuildContext context) {
    final Color color;
    final String label;
    if (connected) {
      color = AppTheme.onlineGreen;
      label = context.l10n.connectorStatusConnected;
    } else if (available) {
      color = AppTheme.ponCyan;
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
        label.toUpperCase(),
        style: TextStyle(
          color: color,
          fontSize: 9.5,
          fontWeight: FontWeight.w700,
          letterSpacing: 0.6,
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
        color: AppTheme.ponCyan.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(6),
        border: Border.all(color: AppTheme.ponCyan.withValues(alpha: 0.2)),
      ),
      child: Text(
        label,
        style: const TextStyle(
          color: AppTheme.ponCyan,
          fontSize: 10.5,
          fontFamily: 'monospace',
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
  final VoidCallback onManage;

  const _ActionRow({
    required this.item,
    required this.busy,
    required this.connected,
    required this.available,
    required this.onConnect,
    required this.onManage,
  });

  @override
  Widget build(BuildContext context) {
    final meta = _metaLabel(context);
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
        else if (available)
          SizedBox(
            width: 120,
            child: PonButton(
              onPressed: onConnect,
              child: Text(context.l10n.connectorConnect,
                  style: const TextStyle(fontSize: 13)),
            ),
          )
        else
          Text(
            context.l10n.connectorStatusComingSoon,
            style: TextStyle(
              color: Colors.white.withValues(alpha: 0.3),
              fontSize: 12,
            ),
          ),
      ],
    );
  }

  String _metaLabel(BuildContext context) {
    final conn = item.connection;
    if (conn != null && conn.accountLabel != null &&
        conn.accountLabel!.isNotEmpty) {
      return 'remote-mcp · ${conn.accountLabel}';
    }
    return 'remote-mcp';
  }
}
