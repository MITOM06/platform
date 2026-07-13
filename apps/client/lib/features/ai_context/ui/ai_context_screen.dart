import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/l10n/l10n_ext.dart';
import '../domain/ai_context_providers.dart';
import 'widgets/company_context_section.dart';
import 'widgets/identity_section.dart';
import 'widgets/learned_facts_section.dart';
import 'widgets/response_style_section.dart';

class AiContextScreen extends ConsumerWidget {
  const AiContextScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = context.l10n;
    final async = ref.watch(myAiContextProvider);
    return Scaffold(
      appBar: AppBar(title: Text(l.aiContextTitle)),
      body: async.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (_, __) => Center(
          child: Text(
            l.listGenericError,
            style: const TextStyle(color: Colors.redAccent),
          ),
        ),
        data: (ctx) => ListView(
          padding: const EdgeInsets.all(12),
          children: [
            IdentitySection(
              role: ctx.role,
              departmentNames: ctx.departmentNames,
              context: ctx.context,
            ),
            const SizedBox(height: 12),
            ResponseStyleSection(context: ctx.context),
            const SizedBox(height: 12),
            const LearnedFactsSection(),
            const SizedBox(height: 12),
            CompanyContextSection(entries: ctx.entries),
          ],
        ),
      ),
    );
  }
}
