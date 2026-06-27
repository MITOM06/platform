import 'package:flutter/material.dart';
import 'package:platform_client/l10n/app_localizations.dart';
import '../../../core/l10n/l10n_ext.dart';
import '../../../core/theme/app_theme.dart';
import '../domain/faq_data.dart';
import 'widgets/faq_item.dart';

/// In-app Help Center / FAQ screen. Renders [kFaqData] grouped by category with
/// a live search field that filters questions and answers. Mirrors the web help
/// page; all copy comes from `context.l10n`.
class HelpScreen extends StatefulWidget {
  const HelpScreen({super.key});

  @override
  State<HelpScreen> createState() => _HelpScreenState();
}

class _HelpScreenState extends State<HelpScreen> {
  final _searchController = TextEditingController();
  String _query = '';

  /// Glow colors cycled across category sections, matching the legal screen.
  static const _glowColors = [
    AppTheme.ponCyan,
    AppTheme.ponPeach,
    AppTheme.ponPink,
  ];

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  bool _matches(String text) =>
      text.toLowerCase().contains(_query.trim().toLowerCase());

  /// Filters the static FAQ data against the current query. A category with no
  /// matching items is dropped entirely.
  List<_FilteredCategory> _filtered(AppLocalizations l) {
    final result = <_FilteredCategory>[];
    for (final category in kFaqData) {
      final items = _query.trim().isEmpty
          ? category.items
          : category.items
              .where((i) => _matches(i.question(l)) || _matches(i.answer(l)))
              .toList();
      if (items.isNotEmpty) {
        result.add(_FilteredCategory(category, items));
      }
    }
    return result;
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final l = context.l10n;
    final filtered = _filtered(l);

    return Scaffold(
      appBar: AppBar(
        title: Text(l.helpTitle),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new_rounded, size: 20),
          onPressed: () => Navigator.of(context).pop(),
        ),
      ),
      body: Stack(
        children: [
          if (isDark) ...[
            Positioned(
              top: -100,
              left: -100,
              child: Container(
                width: 300,
                height: 300,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  gradient: RadialGradient(colors: [
                    AppTheme.ponCyan.withValues(alpha: 0.08),
                    Colors.transparent,
                  ]),
                ),
              ),
            ),
            Positioned(
              bottom: -100,
              right: -100,
              child: Container(
                width: 300,
                height: 300,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  gradient: RadialGradient(colors: [
                    AppTheme.ponPeach.withValues(alpha: 0.08),
                    Colors.transparent,
                  ]),
                ),
              ),
            ),
          ],
          Column(
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(20, 16, 20, 8),
                child: _SearchField(
                  controller: _searchController,
                  hint: l.helpSearchHint,
                  isDark: isDark,
                  onChanged: (v) => setState(() => _query = v),
                ),
              ),
              Expanded(
                child: filtered.isEmpty
                    ? _EmptyState(message: l.helpNoResults, isDark: isDark)
                    : ListView(
                        physics: const BouncingScrollPhysics(),
                        padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
                        children: [
                          for (var i = 0; i < filtered.length; i++)
                            ..._buildCategory(filtered[i], i, l, isDark),
                        ],
                      ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  List<Widget> _buildCategory(
    _FilteredCategory fc,
    int index,
    AppLocalizations l,
    bool isDark,
  ) {
    final glow = _glowColors[index % _glowColors.length];
    final accent = isDark ? glow : Theme.of(context).colorScheme.primary;
    return [
      Padding(
        padding: EdgeInsets.only(top: index == 0 ? 4 : 20, bottom: 12),
        child: Row(
          children: [
            Icon(fc.category.icon, color: accent, size: 18),
            const SizedBox(width: 8),
            Text(
              fc.category.title(l),
              style: TextStyle(
                color: isDark ? Colors.white : Colors.black87,
                fontWeight: FontWeight.bold,
                fontSize: 16,
              ),
            ),
          ],
        ),
      ),
      for (var j = 0; j < fc.items.length; j++)
        FaqItemTile(
          question: fc.items[j].question(l),
          answer: fc.items[j].answer(l),
          glowColor: _glowColors[j % _glowColors.length],
        ),
    ];
  }
}

/// A category paired with its post-filter item list.
class _FilteredCategory {
  final FaqCategory category;
  final List<FaqItem> items;
  const _FilteredCategory(this.category, this.items);
}

class _SearchField extends StatelessWidget {
  final TextEditingController controller;
  final String hint;
  final bool isDark;
  final ValueChanged<String> onChanged;

  const _SearchField({
    required this.controller,
    required this.hint,
    required this.isDark,
    required this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    return TextField(
      controller: controller,
      onChanged: onChanged,
      textInputAction: TextInputAction.search,
      decoration: InputDecoration(
        hintText: hint,
        prefixIcon: const Icon(Icons.search_rounded, size: 20),
        suffixIcon: controller.text.isEmpty
            ? null
            : IconButton(
                icon: const Icon(Icons.close_rounded, size: 18),
                onPressed: () {
                  controller.clear();
                  onChanged('');
                },
              ),
        filled: true,
        fillColor: (isDark ? Colors.white : Colors.black)
            .withValues(alpha: 0.04),
        contentPadding:
            const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(16),
          borderSide: BorderSide(
            color: (isDark ? Colors.white : Colors.black)
                .withValues(alpha: 0.12),
          ),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(16),
          borderSide: BorderSide(
            color: (isDark ? Colors.white : Colors.black)
                .withValues(alpha: 0.12),
          ),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(16),
          borderSide: const BorderSide(color: AppTheme.ponCyan, width: 1.5),
        ),
      ),
    );
  }
}

class _EmptyState extends StatelessWidget {
  final String message;
  final bool isDark;

  const _EmptyState({required this.message, required this.isDark});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            Icons.search_off_rounded,
            size: 48,
            color: isDark ? Colors.white24 : Colors.black26,
          ),
          const SizedBox(height: 12),
          Text(
            message,
            style: TextStyle(
              color: isDark ? Colors.white54 : Colors.black54,
              fontSize: 15,
            ),
          ),
        ],
      ),
    );
  }
}
