import 'package:flutter/material.dart';
import '../../../../core/l10n/l10n_ext.dart';

/// Audit log placeholder. The backend (AuditLog + GET /admin/audit) ships in P0
/// Part 5; until then this renders "coming soon". Mirrors the web
/// `AuditLogPanel`.
class AuditPanel extends StatelessWidget {
  const AuditPanel({super.key});

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
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
            Text(l10n.adminAuditComingSoon,
                textAlign: TextAlign.center,
                style: TextStyle(color: Colors.white.withValues(alpha: 0.55))),
          ],
        ),
      ),
    );
  }
}
