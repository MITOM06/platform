import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../../../core/l10n/l10n_ext.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/utils/app_error.dart';
import '../../domain/ai_quota_provider.dart';

/// The caller's real monthly AI allowance (`GET /usage/quota`): used / limit,
/// a progress bar and the reset date. Independent of the chart's date range —
/// the quota is always the current UTC month.
class AiQuotaCard extends ConsumerWidget {
  const AiQuotaCard({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(aiQuotaProvider);
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surface,
        borderRadius: BorderRadius.circular(AppTheme.radiusCard),
        border: Border.all(color: AppTheme.hairline(context)),
      ),
      child: async.when(
        loading: () => const SizedBox(
          height: 56,
          child: Center(child: CircularProgressIndicator(strokeWidth: 2)),
        ),
        error: (e, _) => Row(
          children: [
            Expanded(
              child: Text(friendlyError(e),
                  style: TextStyle(color: Theme.of(context).colorScheme.error)),
            ),
            TextButton(
              onPressed: () => ref.invalidate(aiQuotaProvider),
              child: Text(context.l10n.actionRetry),
            ),
          ],
        ),
        data: (q) => _QuotaBody(quota: q),
      ),
    );
  }
}

class _QuotaBody extends StatelessWidget {
  final AiQuota quota;
  const _QuotaBody({required this.quota});

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final locale = Localizations.localeOf(context).toLanguageTag();
    final compact = NumberFormat.compact(locale: locale);
    final fraction = quota.fraction;
    final scheme = Theme.of(context).colorScheme;
    final barColor = (quota.blocked || fraction >= 0.9)
        ? scheme.error
        : fraction >= 0.7
            ? AppTheme.warning
            : scheme.primary;
    final muted = AppTheme.mutedText(context);
    final resets = quota.periodEnd;
    final String status;
    if (quota.blocked) {
      status = l10n.tokenUsageQuotaBlocked;
    } else if (quota.exceeded) {
      status = l10n.tokenUsageQuotaExceeded;
    } else {
      status = l10n.tokenUsagePercentUsed(
          NumberFormat('0.0', locale).format(fraction * 100));
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Icon(Icons.data_usage_rounded, size: 16, color: barColor),
            const SizedBox(width: 6),
            Text(l10n.tokenUsageQuota,
                style: TextStyle(
                    fontSize: 14, fontWeight: FontWeight.w600, color: muted)),
            const Spacer(),
            if (!quota.blocked)
              Text(
                '${compact.format(quota.used)} / ${compact.format(quota.limit)}',
                style: TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w600,
                  color: scheme.onSurface,
                ),
              ),
          ],
        ),
        const SizedBox(height: 8),
        ClipRRect(
          borderRadius: BorderRadius.circular(4),
          child: LinearProgressIndicator(
            value: fraction,
            minHeight: 8,
            backgroundColor: AppTheme.hairline(context),
            valueColor: AlwaysStoppedAnimation<Color>(barColor),
          ),
        ),
        const SizedBox(height: 6),
        Text(status,
            style: TextStyle(
                fontSize: 12,
                color: quota.blocked || quota.exceeded ? scheme.error : muted)),
        if (resets != null)
          Padding(
            padding: const EdgeInsets.only(top: 2),
            child: Text(
              l10n.tokenUsageQuotaResets(
                  DateFormat.yMMMd(locale).format(resets.toLocal())),
              style: TextStyle(fontSize: 11, color: muted),
            ),
          ),
      ],
    );
  }
}
