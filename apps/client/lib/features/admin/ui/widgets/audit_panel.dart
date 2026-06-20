import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/l10n/l10n_ext.dart';
import '../../../../core/theme/app_theme.dart';
import '../../data/models/admin_models.dart';
import '../../state/admin_providers.dart';

const _limit = 20;

/// Audit log — paginated trail of privileged actions (GET /admin/audit), backed
/// by P0 Part 5. Mirrors the web `AuditLogPanel`.
class AuditPanel extends ConsumerStatefulWidget {
  const AuditPanel({super.key});

  @override
  ConsumerState<AuditPanel> createState() => _AuditPanelState();
}

class _AuditPanelState extends ConsumerState<AuditPanel> {
  int _page = 0;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final async = ref.watch(auditLogProvider(_page));

    return async.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (e, _) => Center(
        child: Text('$e',
            style: TextStyle(color: Colors.white.withValues(alpha: 0.6))),
      ),
      data: (result) {
        if (result.total == 0) {
          return Center(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(Icons.fact_check_outlined,
                    size: 56, color: Colors.white.withValues(alpha: 0.25)),
                const SizedBox(height: 14),
                Text(l10n.adminAuditTitle,
                    style: const TextStyle(
                        color: Colors.white,
                        fontSize: 16,
                        fontWeight: FontWeight.bold)),
                const SizedBox(height: 8),
                Text(l10n.adminAuditEmpty,
                    style:
                        TextStyle(color: Colors.white.withValues(alpha: 0.55))),
              ],
            ),
          );
        }

        final pages = (result.total / _limit).ceil();
        return Column(
          children: [
            Expanded(
              child: ListView.separated(
                padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
                itemCount: result.items.length,
                separatorBuilder: (_, __) => const SizedBox(height: 8),
                itemBuilder: (_, i) => _AuditTile(entry: result.items[i]),
              ),
            ),
            _Pager(
              page: _page,
              pages: pages,
              from: _page * _limit + 1,
              to: _page * _limit + result.items.length,
              total: result.total,
              onPrev:
                  _page == 0 ? null : () => setState(() => _page -= 1),
              onNext: _page >= pages - 1
                  ? null
                  : () => setState(() => _page += 1),
            ),
          ],
        );
      },
    );
  }
}

class _AuditTile extends StatelessWidget {
  final AuditLogEntry entry;
  const _AuditTile({required this.entry});

  @override
  Widget build(BuildContext context) {
    final when = entry.createdAt;
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppTheme.darkSurface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppTheme.darkBorder),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: AppTheme.ponCyan.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Text(entry.action,
                    style: const TextStyle(
                        color: AppTheme.ponCyan,
                        fontSize: 11,
                        fontFamily: 'monospace')),
              ),
              const Spacer(),
              if (when != null)
                Text(
                  '${when.toLocal()}'.split('.').first,
                  style: const TextStyle(color: Colors.white38, fontSize: 11),
                ),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            entry.actorName ?? entry.actorId,
            style: const TextStyle(color: Colors.white, fontSize: 14),
          ),
          Text(
            '${entry.targetType}'
            '${entry.targetId != null ? ' (${entry.targetId})' : ''}',
            style: const TextStyle(color: Colors.white54, fontSize: 12),
          ),
        ],
      ),
    );
  }
}

class _Pager extends StatelessWidget {
  final int page;
  final int pages;
  final int from;
  final int to;
  final int total;
  final VoidCallback? onPrev;
  final VoidCallback? onNext;
  const _Pager({
    required this.page,
    required this.pages,
    required this.from,
    required this.to,
    required this.total,
    this.onPrev,
    this.onNext,
  });

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 4, 16, 16),
      child: Row(
        children: [
          Text('$from–$to / $total',
              style: TextStyle(
                  color: Colors.white.withValues(alpha: 0.55), fontSize: 12)),
          const Spacer(),
          TextButton.icon(
            onPressed: onPrev,
            icon: const Icon(Icons.chevron_left, size: 18),
            label: Text(l10n.adminAuditPrev),
          ),
          TextButton.icon(
            onPressed: onNext,
            icon: const Icon(Icons.chevron_right, size: 18),
            label: Text(l10n.adminAuditNext),
          ),
        ],
      ),
    );
  }
}
