import 'package:flutter/material.dart';
import '../../../../core/theme/app_theme.dart';
import '../../data/models/admin_models.dart';

/// One editable "IdP group → value" row of the SSO panel.
class SsoMapRowData {
  String group;
  String value;
  SsoMapRowData(this.group, this.value);
}

/// Default-role picker of the SSO panel ("None" + every role).
class SsoRoleDropdown extends StatelessWidget {
  final String label;
  final String noneLabel;
  final List<Role> roles;
  final String? value;
  final ValueChanged<String?> onChanged;
  const SsoRoleDropdown({
    super.key,
    required this.label,
    required this.noneLabel,
    required this.roles,
    required this.value,
    required this.onChanged,
  });

  @override
  Widget build(BuildContext context) => InputDecorator(
        decoration: InputDecoration(
          labelText: label,
          labelStyle: TextStyle(color: AppTheme.mutedText(context)),
          border: const OutlineInputBorder(),
        ),
        child: DropdownButtonHideUnderline(
          child: DropdownButton<String?>(
            isExpanded: true,
            dropdownColor: Theme.of(context).colorScheme.surface,
            value: roles.any((r) => r.name == value) ? value : null,
            hint: Text(noneLabel,
                style: TextStyle(color: AppTheme.mutedText(context))),
            style: TextStyle(color: Theme.of(context).colorScheme.onSurface),
            items: [
              DropdownMenuItem<String?>(value: null, child: Text(noneLabel)),
              ...roles.map((r) =>
                  DropdownMenuItem<String?>(value: r.name, child: Text(r.name))),
            ],
            onChanged: onChanged,
          ),
        ),
      );
}

/// "IdP group → role / department" mapping row.
class SsoMapRow extends StatelessWidget {
  final SsoMapRowData row;
  final String noneLabel;
  final String placeholder;
  final Map<String, String> options; // value -> label
  final VoidCallback onChanged;
  final VoidCallback onRemove;
  const SsoMapRow({
    super.key,
    required this.row,
    required this.noneLabel,
    required this.placeholder,
    required this.options,
    required this.onChanged,
    required this.onRemove,
  });

  @override
  Widget build(BuildContext context) {
    final onSurface = Theme.of(context).colorScheme.onSurface;
    final muted = AppTheme.mutedText(context);
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Row(
        children: [
          Expanded(
            child: TextFormField(
              initialValue: row.group,
              style: TextStyle(color: onSurface),
              decoration: InputDecoration(
                hintText: placeholder,
                hintStyle: TextStyle(color: muted),
                border: const OutlineInputBorder(),
                isDense: true,
              ),
              onChanged: (v) {
                row.group = v;
                onChanged();
              },
            ),
          ),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 8),
            child: Text('→', style: TextStyle(color: muted)),
          ),
          Expanded(
            child: DropdownButtonFormField<String>(
              initialValue: options.containsKey(row.value) ? row.value : null,
              isExpanded: true,
              dropdownColor: Theme.of(context).colorScheme.surface,
              style: TextStyle(color: onSurface),
              decoration: const InputDecoration(
                border: OutlineInputBorder(),
                isDense: true,
              ),
              hint: Text(noneLabel, style: TextStyle(color: muted)),
              items: options.entries
                  .map((e) =>
                      DropdownMenuItem<String>(value: e.key, child: Text(e.value)))
                  .toList(),
              onChanged: (v) {
                row.value = v ?? '';
                onChanged();
              },
            ),
          ),
          IconButton(
            icon: Icon(Icons.delete_outline_rounded, color: muted),
            onPressed: onRemove,
          ),
        ],
      ),
    );
  }
}

class SsoAddButton extends StatelessWidget {
  final String label;
  final VoidCallback onTap;
  const SsoAddButton({super.key, required this.label, required this.onTap});

  @override
  Widget build(BuildContext context) => Align(
        alignment: Alignment.centerLeft,
        child: TextButton.icon(
          onPressed: onTap,
          icon: const Icon(Icons.add_rounded, color: AppTheme.ponAccent, size: 18),
          label: Text(label, style: const TextStyle(color: AppTheme.ponAccent)),
        ),
      );
}

class SsoSectionTitle extends StatelessWidget {
  final String text;
  const SsoSectionTitle(this.text, {super.key});

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(bottom: 12),
        child: Text(text,
            style: TextStyle(
                color: Theme.of(context).colorScheme.onSurface,
                fontSize: 16,
                fontWeight: FontWeight.bold)),
      );
}

class SsoMutedText extends StatelessWidget {
  final String text;
  const SsoMutedText(this.text, {super.key});

  @override
  Widget build(BuildContext context) => Text(text,
      style: TextStyle(color: AppTheme.mutedText(context), fontSize: 13));
}
