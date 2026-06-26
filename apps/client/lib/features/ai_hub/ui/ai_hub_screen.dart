import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/l10n/l10n_ext.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/pon_widgets.dart';
import '../../chat/data/chat_repository.dart';
import '../../chat/domain/chat_state.dart' show kAiBotUserId;
import 'widgets/ai_hub_tile.dart';

/// Opens (or creates) the conversation with the PON AI bot and navigates to it.
///
/// Shared entry point for the AI chat: reused by [AiHubScreen]'s hero CTA and
/// any other surface that previously called `_startAiChat`. Mirrors the web
/// `handleOpenAiChat` (create-or-get + navigate). Returns once navigation is
/// issued; on failure it silently no-ops (caller may surface an error state).
Future<void> startAiChat(BuildContext context, WidgetRef ref) async {
  try {
    final repo = ref.read(chatRepositoryProvider);
    final conv = await repo.getOrCreateConversation(kAiBotUserId);
    if (context.mounted) context.go('/chat/${conv.id}');
  } catch (_) {
    // Swallow: the Hub keeps the user on-screen. A transient failure can be
    // retried by tapping again.
  }
}

/// AI Hub — a global landing screen aggregating every AI surface: a primary
/// "Start chat with PON AI" hero action plus a grid of cards linking to AI
/// Memory, Connectors (integrations), Skills and Token Usage. Mirrors the web
/// `app/(main)/ai-hub/page.tsx`.
class AiHubScreen extends ConsumerStatefulWidget {
  const AiHubScreen({super.key});

  @override
  ConsumerState<AiHubScreen> createState() => _AiHubScreenState();
}

class _AiHubScreenState extends ConsumerState<AiHubScreen> {
  bool _startingChat = false;

  Future<void> _onStartChat() async {
    if (_startingChat) return;
    setState(() => _startingChat = true);
    await startAiChat(context, ref);
    if (mounted) setState(() => _startingChat = false);
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return Scaffold(
      appBar: AppBar(
        title: Text(l10n.aiHubTitle),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new_rounded, size: 20),
          onPressed: () => context.pop(),
        ),
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          physics: const BouncingScrollPhysics(),
          padding: const EdgeInsets.all(20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(
                l10n.aiHubSubtitle,
                style: TextStyle(
                  color: Colors.white.withValues(alpha: 0.6),
                  fontSize: 14,
                ),
              ),
              const SizedBox(height: 16),
              _HeroCard(loading: _startingChat, onTap: _onStartChat),
              const SizedBox(height: 20),
              _HubGrid(),
            ],
          ),
        ),
      ),
    );
  }
}

/// Primary "Start chat with PON AI" call-to-action.
class _HeroCard extends StatelessWidget {
  final bool loading;
  final VoidCallback onTap;
  const _HeroCard({required this.loading, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return PonCard(
      glowColor: AppTheme.ponPink,
      glowStrength: 6,
      child: Material(
        color: Colors.transparent,
        borderRadius: BorderRadius.circular(24),
        child: InkWell(
          borderRadius: BorderRadius.circular(24),
          onTap: loading ? null : onTap,
          child: Padding(
            padding: const EdgeInsets.all(20),
            child: Row(
              children: [
                Container(
                  width: 56,
                  height: 56,
                  decoration: const BoxDecoration(
                    shape: BoxShape.circle,
                    gradient: LinearGradient(
                      colors: [AppTheme.ponPink, AppTheme.ponPeach],
                    ),
                  ),
                  child: const Icon(Icons.auto_awesome_rounded,
                      color: Colors.white, size: 28),
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        l10n.aiHubStartChat,
                        style: const TextStyle(
                          color: Colors.white,
                          fontWeight: FontWeight.bold,
                          fontSize: 16,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        l10n.startChatWithAI,
                        style: TextStyle(
                          color: Colors.white.withValues(alpha: 0.6),
                          fontSize: 12.5,
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 8),
                if (loading)
                  const SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(
                        strokeWidth: 2, color: AppTheme.ponPink),
                  )
                else
                  const Icon(Icons.arrow_forward_ios_rounded,
                      color: AppTheme.ponPink, size: 18),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// Grid of AI surface tiles (Memory, Connectors, Skills, Usage).
class _HubGrid extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final tiles = <AiHubTile>[
      AiHubTile(
        icon: Icons.psychology_rounded,
        title: l10n.aiHubMemory,
        subtitle: l10n.aiMemoryTitle,
        accent: AppTheme.ponCyan,
        onTap: () => context.push('/ai-memories'),
      ),
      AiHubTile(
        icon: Icons.hub_rounded,
        title: l10n.aiHubIntegrations,
        subtitle: l10n.integrationsTitle,
        accent: AppTheme.ponPeach,
        onTap: () => context.push('/integrations'),
      ),
      AiHubTile(
        icon: Icons.bolt_rounded,
        title: l10n.aiHubSkills,
        subtitle: l10n.skillsTitle,
        accent: AppTheme.ponPink,
        onTap: () => context.push('/skills'),
      ),
      AiHubTile(
        icon: Icons.data_usage_rounded,
        title: l10n.aiHubTokenUsage,
        subtitle: l10n.tokenUsage,
        accent: AppTheme.ponCyan,
        onTap: () => context.push('/token-usage'),
      ),
    ];

    // On narrow phones the fixed tiles overflow vertically; lower the aspect
    // ratio so tiles get taller and the icon + title + subtitle always fit.
    final width = MediaQuery.sizeOf(context).width;
    final aspectRatio = width < 360 ? 1.0 : (width < 420 ? 1.1 : 1.25);

    return GridView.count(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      crossAxisCount: 2,
      crossAxisSpacing: 14,
      mainAxisSpacing: 14,
      childAspectRatio: aspectRatio,
      children: tiles,
    );
  }
}
