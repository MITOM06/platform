import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/l10n/l10n_ext.dart';
import '../../../../core/theme/app_theme.dart';

/// Reusable presentation widgets for the workspace AI-settings panel
/// (TASK-12). Kept in a separate file so the panel stays under the 400-line
/// limit (.claude/rules/clean-code.md).

/// A connector allow-list, constrained to the workspace `connectorAllowList`
/// (the AI list can only narrow that outer boundary).
class AiConnectorChecklist extends StatelessWidget {
  final AsyncValue<List<dynamic>> catalogAsync;
  final List<String> allowList;
  final List<String> selected;
  final String emptyLabel;
  final ValueChanged<String> onToggle;
  const AiConnectorChecklist({
    super.key,
    required this.catalogAsync,
    required this.allowList,
    required this.selected,
    required this.emptyLabel,
    required this.onToggle,
  });

  @override
  Widget build(BuildContext context) {
    return catalogAsync.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (_, __) => AiMutedText(emptyLabel),
      data: (catalog) {
        // Outer boundary: only catalog connectors present in connectorAllowList.
        final entries =
            catalog.where((e) => allowList.contains(e.id as String)).toList();
        if (entries.isEmpty) return AiMutedText(emptyLabel);
        return Column(
          children: entries
              .map(
                (entry) => CheckboxListTile(
                  contentPadding: EdgeInsets.zero,
                  activeColor: AppTheme.ponCyan,
                  controlAffinity: ListTileControlAffinity.leading,
                  title: Text(entry.name as String,
                      style: const TextStyle(color: Colors.white)),
                  value: selected.contains(entry.id as String),
                  onChanged: (_) => onToggle(entry.id as String),
                ),
              )
              .toList(),
        );
      },
    );
  }
}

/// Tri-state control: null (inherit env) / true (on) / false (off).
class AiTriStateTile extends StatelessWidget {
  final String title;
  final String subtitle;
  final bool? value;
  final String inheritLabel;
  final ValueChanged<bool?> onChanged;
  const AiTriStateTile({
    super.key,
    required this.title,
    required this.subtitle,
    required this.value,
    required this.inheritLabel,
    required this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: const TextStyle(color: Colors.white)),
          const SizedBox(height: 2),
          Text(subtitle,
              style: TextStyle(
                  color: Colors.white.withValues(alpha: 0.55), fontSize: 13)),
          const SizedBox(height: 8),
          SegmentedButton<int>(
            showSelectedIcon: false,
            style: ButtonStyle(
              backgroundColor: WidgetStateProperty.resolveWith(
                (s) => s.contains(WidgetState.selected)
                    ? AppTheme.ponCyan.withValues(alpha: 0.18)
                    : Colors.transparent,
              ),
              foregroundColor: WidgetStateProperty.all(Colors.white),
            ),
            segments: [
              ButtonSegment(value: 0, label: Text(inheritLabel)),
              ButtonSegment(value: 1, label: Text(context.l10n.adminAiOn)),
              ButtonSegment(value: 2, label: Text(context.l10n.adminAiOff)),
            ],
            selected: {value == null ? 0 : (value == true ? 1 : 2)},
            onSelectionChanged: (set) {
              final v = set.first;
              onChanged(v == 0 ? null : v == 1);
            },
          ),
        ],
      ),
    );
  }
}

class AiDropItem {
  final String value;
  final String label;
  const AiDropItem(this.value, this.label);
}

class AiLabeledDropdown extends StatelessWidget {
  final String label;
  final String value;
  final List<AiDropItem> items;
  final ValueChanged<String> onChanged;
  const AiLabeledDropdown({
    super.key,
    required this.label,
    required this.value,
    required this.items,
    required this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    return InputDecorator(
      decoration: InputDecoration(
        labelText: label,
        labelStyle: TextStyle(color: Colors.white.withValues(alpha: 0.7)),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: AppTheme.darkBorder),
        ),
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
        contentPadding:
            const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
      ),
      child: DropdownButtonHideUnderline(
        child: DropdownButton<String>(
          isExpanded: true,
          dropdownColor: AppTheme.darkSurface,
          value: value,
          style: const TextStyle(color: Colors.white),
          items: items
              .map((it) => DropdownMenuItem(
                    value: it.value,
                    child: Text(it.label,
                        style: const TextStyle(color: Colors.white)),
                  ))
              .toList(),
          onChanged: (v) {
            if (v != null) onChanged(v);
          },
        ),
      ),
    );
  }
}

class AiSectionTitle extends StatelessWidget {
  final String text;
  const AiSectionTitle(this.text, {super.key});

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(bottom: 12),
        child: Text(
          text,
          style: const TextStyle(
            color: Colors.white,
            fontSize: 16,
            fontWeight: FontWeight.bold,
          ),
        ),
      );
}

class AiMutedText extends StatelessWidget {
  final String text;
  const AiMutedText(this.text, {super.key});

  @override
  Widget build(BuildContext context) => Text(
        text,
        style:
            TextStyle(color: Colors.white.withValues(alpha: 0.55), fontSize: 13),
      );
}

class AiErrorView extends StatelessWidget {
  final String message;
  const AiErrorView({super.key, required this.message});

  @override
  Widget build(BuildContext context) => Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Text(message,
              textAlign: TextAlign.center,
              style: TextStyle(color: Colors.white.withValues(alpha: 0.6))),
        ),
      );
}
