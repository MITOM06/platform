import 'package:flutter/material.dart';
import '../../../../core/l10n/l10n_ext.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/widgets/pon_widgets.dart';
import '../../data/ai_context_models.dart';

class IdentitySection extends StatelessWidget {
  final String? role;
  final List<String> departmentNames;
  final AiUserContext context;

  const IdentitySection({
    super.key,
    required this.role,
    required this.departmentNames,
    required this.context,
  });

  @override
  Widget build(BuildContext ctx) {
    final l = ctx.l10n;
    Widget row(String label, String value) => Padding(
          padding: const EdgeInsets.symmetric(vertical: 4),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Text(label,
                    style: const TextStyle(fontSize: 12, color: Colors.grey)),
              ),
              Expanded(
                flex: 2,
                child: Text(value, textAlign: TextAlign.right),
              ),
            ],
          ),
        );
    return PonCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(l.aiContextIdentityTitle,
              style: const TextStyle(fontWeight: FontWeight.bold)),
          const SizedBox(height: 8),
          row(l.aiContextLabelRole, role ?? l.aiContextRoleUnknown),
          row(
            l.aiContextLabelDepartment,
            departmentNames.isEmpty
                ? l.aiContextNoDepartment
                : departmentNames.join(', '),
          ),
          row(
            l.aiContextLabelJobTitle,
            context.jobTitle.isEmpty ? l.aiContextNotSet : context.jobTitle,
          ),
          row(
            l.aiContextLabelProjects,
            context.projects.isEmpty
                ? l.aiContextNotSet
                : context.projects.join(', '),
          ),
          const SizedBox(height: 8),
          Text(
            l.aiContextIdentityManaged,
            style: TextStyle(
              fontSize: 11,
              color: AppTheme.offlineGrey.withValues(alpha: 0.8),
            ),
          ),
        ],
      ),
    );
  }
}
