import 'package:flutter/material.dart';
import '../../../core/l10n/l10n_ext.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/pon_widgets.dart';

/// Native "Privacy & Terms" screen. Renders legal content (data collection,
/// usage, security, user rights, terms) in-app instead of opening a browser.
/// Mirrors the web app's legal page; all copy comes from `context.l10n`.
class LegalScreen extends StatelessWidget {
  const LegalScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    final sections = [
      (
        title: context.l10n.legalDataCollectionTitle,
        content: context.l10n.legalDataCollectionContent,
        color: AppTheme.ponAccent,
      ),
      (
        title: context.l10n.legalDataUsageTitle,
        content: context.l10n.legalDataUsageContent,
        color: AppTheme.ponAccent,
      ),
      (
        title: context.l10n.legalSecurityTitle,
        content: context.l10n.legalSecurityContent,
        color: AppTheme.ponAccent,
      ),
      (
        title: context.l10n.legalUserRightsTitle,
        content: context.l10n.legalUserRightsContent,
        color: AppTheme.ponAccent,
      ),
      (
        title: context.l10n.legalTermsTitle,
        content: context.l10n.legalTermsContent,
        color: AppTheme.ponAccent,
      ),
    ];

    return Scaffold(
      appBar: AppBar(
        title: Text(context.l10n.legalScreenTitle),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new_rounded, size: 20),
          onPressed: () => Navigator.of(context).pop(),
        ),
      ),
      body: Stack(
        children: [
          if (isDark) ...[
          ],
          SingleChildScrollView(
            physics: const BouncingScrollPhysics(),
            padding: const EdgeInsets.all(24),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  context.l10n.legalLastUpdated,
                  style: TextStyle(
                    color: AppTheme.mutedText(context),
                    fontSize: 12,
                  ),
                ),
                const SizedBox(height: 20),
                ...sections.map(
                  (s) => Padding(
                    padding: const EdgeInsets.only(bottom: 16),
                    child: PonCard(
                      child: Padding(
                        padding: const EdgeInsets.all(20),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              s.title,
                              style: TextStyle(
                                color: isDark
                                    ? s.color
                                    : Theme.of(context).colorScheme.primary,
                                fontWeight: FontWeight.bold,
                                fontSize: 15,
                              ),
                            ),
                            const SizedBox(height: 10),
                            Text(
                              s.content,
                              style: TextStyle(
                                color: Theme.of(context).colorScheme.onSurface,
                                fontSize: 14,
                                height: 1.6,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: 24),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
