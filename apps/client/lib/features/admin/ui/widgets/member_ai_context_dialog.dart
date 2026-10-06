import 'package:flutter/material.dart';
import '../../../../core/l10n/l10n_ext.dart';
import '../../../../core/theme/app_theme.dart';

/// What the admin saved in [MemberAiContextDialog].
class MemberAiContextResult {
  final String jobTitle;
  final List<String> projects;
  const MemberAiContextResult({required this.jobTitle, required this.projects});
}

/// Edit a member's admin-set ("hard") AI context: job title + projects (one per
/// line). Seeded from the member's stored context; owns and disposes its
/// controllers.
class MemberAiContextDialog extends StatefulWidget {
  final String displayName;
  final String jobTitle;
  final List<String> projects;

  const MemberAiContextDialog({
    super.key,
    required this.displayName,
    required this.jobTitle,
    required this.projects,
  });

  static Future<MemberAiContextResult?> show(
    BuildContext context, {
    required String displayName,
    required String jobTitle,
    required List<String> projects,
  }) =>
      showDialog<MemberAiContextResult>(
        context: context,
        builder: (_) => MemberAiContextDialog(
          displayName: displayName,
          jobTitle: jobTitle,
          projects: projects,
        ),
      );

  @override
  State<MemberAiContextDialog> createState() => _MemberAiContextDialogState();
}

class _MemberAiContextDialogState extends State<MemberAiContextDialog> {
  late final TextEditingController _job =
      TextEditingController(text: widget.jobTitle);
  late final TextEditingController _projects =
      TextEditingController(text: widget.projects.join('\n'));

  @override
  void dispose() {
    _job.dispose();
    _projects.dispose();
    super.dispose();
  }

  void _save() {
    final projects = _projects.text
        .split('\n')
        .map((p) => p.trim())
        .where((p) => p.isNotEmpty)
        .toList();
    Navigator.pop(
      context,
      MemberAiContextResult(jobTitle: _job.text.trim(), projects: projects),
    );
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final onSurface = Theme.of(context).colorScheme.onSurface;
    final muted = AppTheme.mutedText(context);
    return AlertDialog(
      title: Text(l10n.adminEditAiContext, style: TextStyle(color: onSurface)),
      content: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(widget.displayName,
                style: TextStyle(color: muted, fontSize: 12)),
            const SizedBox(height: 12),
            TextField(
              controller: _job,
              maxLength: 200,
              style: TextStyle(color: onSurface),
              decoration: InputDecoration(
                labelText: l10n.adminAiContextJobTitle,
                labelStyle: TextStyle(color: muted),
              ),
            ),
            const SizedBox(height: 8),
            TextField(
              controller: _projects,
              maxLines: 4,
              style: TextStyle(color: onSurface),
              decoration: InputDecoration(
                labelText: l10n.adminAiContextProjects,
                hintText: l10n.adminAiContextProjectsHint,
                labelStyle: TextStyle(color: muted),
              ),
            ),
          ],
        ),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context),
          child: Text(l10n.adminCancel),
        ),
        TextButton(
          onPressed: _save,
          child: Text(l10n.adminSave,
              style: TextStyle(color: AppTheme.accent(context))),
        ),
      ],
    );
  }
}
