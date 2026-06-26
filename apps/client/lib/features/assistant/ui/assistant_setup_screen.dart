import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/l10n/l10n_ext.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/utils/app_error.dart';
import '../../../core/utils/global_messenger.dart';
import '../../../core/widgets/pon_widgets.dart';
import '../../chat/data/chat_repository.dart';
import '../../home/domain/home_providers.dart';
import '../data/assistant_repository.dart';
import '../state/assistant_provider.dart';
import 'widgets/assistant_setup_steps.dart';

/// 4-step wizard that creates the member's personal assistant: name (+ cosmetic
/// emoji), persona/system prompt, AI model, then a confirm/create step. On
/// success it opens the new 1-1 assistant chat (same logic as
/// [AssistantEntryTile]).
class AssistantSetupScreen extends ConsumerStatefulWidget {
  const AssistantSetupScreen({super.key});

  @override
  ConsumerState<AssistantSetupScreen> createState() =>
      _AssistantSetupScreenState();
}

class _AssistantSetupScreenState extends ConsumerState<AssistantSetupScreen> {
  static const int _stepCount = 4;

  final _pageController = PageController();
  final _nameCtrl = TextEditingController();
  final _personaCtrl = TextEditingController();

  int _step = 0;
  String _emoji = '🤖';
  String? _providerId;
  bool _submitting = false;

  @override
  void initState() {
    super.initState();
    // Rebuild the bottom bar (enable/disable Next) as the name changes.
    _nameCtrl.addListener(_onChanged);
  }

  void _onChanged() => setState(() {});

  @override
  void dispose() {
    _nameCtrl.removeListener(_onChanged);
    _pageController.dispose();
    _nameCtrl.dispose();
    _personaCtrl.dispose();
    super.dispose();
  }

  bool get _canAdvance {
    switch (_step) {
      case 0:
        return _nameCtrl.text.trim().isNotEmpty;
      case 2:
        return _providerId != null;
      default:
        return true;
    }
  }

  bool get _isLastStep => _step == _stepCount - 1;

  void _goTo(int step) {
    setState(() => _step = step);
    _pageController.animateToPage(
      step,
      duration: const Duration(milliseconds: 250),
      curve: Curves.easeOut,
    );
  }

  void _next() {
    if (!_canAdvance) return;
    if (_isLastStep) {
      _submit();
    } else {
      _goTo(_step + 1);
    }
  }

  void _back() {
    if (_step == 0) {
      context.pop();
    } else {
      _goTo(_step - 1);
    }
  }

  String _selectedProviderLabel() {
    final providers = ref.read(assistantProvidersProvider).valueOrNull ??
        const <AssistantProvider>[];
    for (final p in providers) {
      if (p.id == _providerId) return p.label;
    }
    return '';
  }

  Future<void> _submit() async {
    if (_providerId == null || _submitting) return;
    setState(() => _submitting = true);
    final repo = ref.read(assistantRepositoryProvider);
    try {
      final info = await repo.setup(
        name: _nameCtrl.text.trim(),
        systemPrompt: _personaCtrl.text.trim(),
        providerId: _providerId!,
      );
      ref.invalidate(assistantProvider);
      if (!mounted) return;
      showInfoSnackBar(context.l10n.assistantSetupSuccess);
      await _openChat(info.botUserId);
    } catch (e) {
      showErrorSnackBar(friendlyError(e));
      if (mounted) setState(() => _submitting = false);
    }
  }

  Future<void> _openChat(String botUserId) async {
    try {
      final conv = await ref
          .read(chatRepositoryProvider)
          .getOrCreateConversation(botUserId);
      if (!mounted) return;
      final isWeb = MediaQuery.of(context).size.width >= kWebBreakpoint;
      if (isWeb) {
        ref.read(selectedConversationIdProvider.notifier).state = conv.id;
        context.go('/');
      } else {
        context.go('/chat/${conv.id}');
      }
    } catch (e) {
      showErrorSnackBar(friendlyError(e));
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(context.l10n.assistantSetupTitle)),
      body: SafeArea(
        child: Column(
          children: [
            _ProgressBar(step: _step, total: _stepCount),
            Expanded(
              child: PageView(
                controller: _pageController,
                physics: const NeverScrollableScrollPhysics(),
                children: [
                  AssistantNameStep(
                    nameController: _nameCtrl,
                    emoji: _emoji,
                    onEmojiSelected: (e) => setState(() => _emoji = e),
                  ),
                  AssistantPersonaStep(personaController: _personaCtrl),
                  AssistantModelStep(
                    selectedProviderId: _providerId,
                    onSelected: (id) => setState(() => _providerId = id),
                  ),
                  AssistantConfirmStep(
                    name: _nameCtrl.text.trim(),
                    emoji: _emoji,
                    persona: _personaCtrl.text.trim(),
                    modelLabel: _selectedProviderLabel(),
                  ),
                ],
              ),
            ),
            _BottomBar(
              isLastStep: _isLastStep,
              submitting: _submitting,
              canAdvance: _canAdvance,
              onBack: _back,
              onNext: _next,
            ),
          ],
        ),
      ),
    );
  }
}

class _ProgressBar extends StatelessWidget {
  final int step;
  final int total;

  const _ProgressBar({required this.step, required this.total});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
      child: Row(
        children: List.generate(total, (i) {
          final active = i <= step;
          return Expanded(
            child: Padding(
              padding: EdgeInsets.only(right: i == total - 1 ? 0 : 6),
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 250),
                height: 4,
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(2),
                  color: active
                      ? AppTheme.ponCyan
                      : Theme.of(context)
                          .colorScheme
                          .onSurface
                          .withValues(alpha: 0.15),
                ),
              ),
            ),
          );
        }),
      ),
    );
  }
}

class _BottomBar extends StatelessWidget {
  final bool isLastStep;
  final bool submitting;
  final bool canAdvance;
  final VoidCallback onBack;
  final VoidCallback onNext;

  const _BottomBar({
    required this.isLastStep,
    required this.submitting,
    required this.canAdvance,
    required this.onBack,
    required this.onNext,
  });

  @override
  Widget build(BuildContext context) {
    final label = isLastStep
        ? (submitting
            ? context.l10n.assistantSetupCreating
            : context.l10n.assistantSetupCreateButton)
        : MaterialLocalizations.of(context).continueButtonLabel;
    return Padding(
      padding: const EdgeInsets.all(16),
      child: Row(
        children: [
          TextButton(
            onPressed: submitting ? null : onBack,
            child: Text(MaterialLocalizations.of(context).backButtonTooltip),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: PonButton(
              onPressed: (canAdvance && !submitting) ? onNext : null,
              isLoading: submitting,
              child: Text(label),
            ),
          ),
        ],
      ),
    );
  }
}
