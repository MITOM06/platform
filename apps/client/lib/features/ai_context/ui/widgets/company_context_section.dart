import 'package:flutter/material.dart';
import '../../../../core/l10n/l10n_ext.dart';
import '../../../../core/widgets/pon_widgets.dart';
import '../../data/ai_context_models.dart';

class CompanyContextSection extends StatelessWidget {
  final List<AiContextEntry> entries;
  const CompanyContextSection({super.key, required this.entries});

  String _tierLabel(BuildContext context, String? cap) {
    final l = context.l10n;
    switch (tierFromCapability(cap)) {
      case ContextTier.confidential:
        return l.aiContextTierConfidential;
      case ContextTier.internal:
        return l.aiContextTierInternal;
      case ContextTier.public:
        return l.aiContextTierPublic;
    }
  }

  Widget _group(BuildContext context, String title, List<AiContextEntry> items) {
    return PonCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: const TextStyle(fontWeight: FontWeight.bold)),
          const SizedBox(height: 8),
          ...items.map(
            (e) => Padding(
              padding: const EdgeInsets.symmetric(vertical: 4),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(e.label,
                            style: const TextStyle(fontWeight: FontWeight.w600)),
                      ),
                      Chip(
                        label: Text(_tierLabel(context, e.requiredCapability),
                            style: const TextStyle(fontSize: 10)),
                        visualDensity: VisualDensity.compact,
                        materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
                      ),
                    ],
                  ),
                  Text(e.text,
                      style: const TextStyle(fontSize: 12, color: Colors.grey)),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final company = entries.where((e) => e.scope == 'company').toList();
    final dept = entries.where((e) => e.scope == 'department').toList();
    if (company.isEmpty && dept.isEmpty) return const SizedBox.shrink();
    return Column(
      children: [
        if (company.isNotEmpty) _group(context, l.aiContextCompanyTitle, company),
        if (dept.isNotEmpty) _group(context, l.aiContextDepartmentTitle, dept),
      ],
    );
  }
}
