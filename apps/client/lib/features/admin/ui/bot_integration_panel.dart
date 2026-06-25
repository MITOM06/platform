import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/l10n/l10n_ext.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/utils/global_messenger.dart';
import '../../../core/widgets/pon_widgets.dart';
import '../data/bot_admin_repository.dart';

/// Admin panel to manage Bot Factory integration tokens. Mirrors the web
/// `BotIntegrationPanel` — lists registered external bots, issues a one-time
/// integration token (+ MCP URL) per bot, and revokes the active bridge
/// session. Gated by `MANAGE_WORKSPACE` (the admin screen filters this section).
class BotIntegrationPanel extends ConsumerWidget {
  const BotIntegrationPanel({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = context.l10n;
    final botsAsync = ref.watch(externalBotsProvider);

    return botsAsync.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (e, _) => Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Text(
            '$e',
            textAlign: TextAlign.center,
            style: TextStyle(color: Colors.white.withValues(alpha: 0.6)),
          ),
        ),
      ),
      data: (bots) {
        if (bots.isEmpty) {
          return Center(
            child: Padding(
              padding: const EdgeInsets.all(24),
              child: Text(
                l10n.botAdminNoBotsRegistered,
                textAlign: TextAlign.center,
                style: TextStyle(color: Colors.white.withValues(alpha: 0.6)),
              ),
            ),
          );
        }
        return RefreshIndicator(
          onRefresh: () async => ref.invalidate(externalBotsProvider),
          child: ListView.separated(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
            itemCount: bots.length,
            separatorBuilder: (_, __) => const SizedBox(height: 12),
            itemBuilder: (_, i) => _BotRow(bot: bots[i]),
          ),
        );
      },
    );
  }
}

/// One registered bot: shows identity + the active session's lastUsed state,
/// with Generate-token and Revoke actions.
class _BotRow extends ConsumerStatefulWidget {
  final ExternalBot bot;
  const _BotRow({required this.bot});

  @override
  ConsumerState<_BotRow> createState() => _BotRowState();
}

class _BotRowState extends ConsumerState<_BotRow> {
  bool _busy = false;

  Future<void> _generate() async {
    final l10n = context.l10n;
    setState(() => _busy = true);
    try {
      final issued = await ref
          .read(botAdminRepositoryProvider)
          .issue(widget.bot.ownerUserId, widget.bot.botUserId);
      if (!mounted) return;
      ref.invalidate(botSessionsProvider(widget.bot.ownerUserId));
      await showDialog<void>(
        context: context,
        barrierDismissible: false,
        builder: (_) => _TokenDialog(issued: issued),
      );
    } catch (_) {
      if (mounted) showErrorSnackBar(l10n.adminToastError);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _revoke() async {
    final l10n = context.l10n;
    setState(() => _busy = true);
    try {
      await ref
          .read(botAdminRepositoryProvider)
          .revoke(widget.bot.ownerUserId, widget.bot.botUserId);
      if (!mounted) return;
      ref.invalidate(botSessionsProvider(widget.bot.ownerUserId));
      showInfoSnackBar(l10n.adminToastSaved);
    } catch (_) {
      if (mounted) showErrorSnackBar(l10n.adminToastError);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final bot = widget.bot;
    final sessionsAsync = ref.watch(botSessionsProvider(bot.ownerUserId));
    final session = sessionsAsync.maybeWhen(
      data: (list) => list.where((s) => s.botUserId == bot.botUserId).firstOrNull,
      orElse: () => null,
    );
    final hasSession = session != null;

    return PonCard(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                _Avatar(name: bot.name, url: bot.avatarUrl),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        bot.name.isEmpty ? bot.botUserId : bot.name,
                        style: const TextStyle(
                          color: Colors.white,
                          fontWeight: FontWeight.w600,
                          fontSize: 15,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        bot.botUserId,
                        style: TextStyle(
                          color: Colors.white.withValues(alpha: 0.5),
                          fontSize: 12,
                        ),
                      ),
                    ],
                  ),
                ),
                if (!bot.enabled)
                  Icon(Icons.block,
                      size: 18, color: Colors.white.withValues(alpha: 0.4)),
              ],
            ),
            const SizedBox(height: 12),
            _LastUsed(
              loading: sessionsAsync.isLoading,
              lastUsedAt: session?.lastUsedAt,
              hasSession: hasSession,
            ),
            const SizedBox(height: 14),
            Row(
              children: [
                Expanded(
                  child: PonButton(
                    isLoading: _busy,
                    onPressed: _busy ? null : _generate,
                    child: Text(l10n.botAdminGenerateToken),
                  ),
                ),
                if (hasSession) ...[
                  const SizedBox(width: 10),
                  _RevokeButton(onPressed: _busy ? null : _revoke),
                ],
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _Avatar extends StatelessWidget {
  final String name;
  final String? url;
  const _Avatar({required this.name, this.url});

  @override
  Widget build(BuildContext context) {
    final initial = name.trim().isEmpty ? '?' : name.trim()[0].toUpperCase();
    return CircleAvatar(
      radius: 20,
      backgroundColor: AppTheme.ponCyan.withValues(alpha: 0.15),
      backgroundImage:
          (url != null && url!.isNotEmpty) ? NetworkImage(url!) : null,
      child: (url == null || url!.isEmpty)
          ? Text(initial,
              style: const TextStyle(
                  color: AppTheme.ponCyan, fontWeight: FontWeight.bold))
          : null,
    );
  }
}

class _LastUsed extends StatelessWidget {
  final bool loading;
  final DateTime? lastUsedAt;
  final bool hasSession;
  const _LastUsed({
    required this.loading,
    required this.lastUsedAt,
    required this.hasSession,
  });

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    String value;
    if (loading) {
      value = '…';
    } else if (!hasSession || lastUsedAt == null) {
      value = l10n.botAdminNeverUsed;
    } else {
      value = lastUsedAt!.toLocal().toString().split('.').first;
    }
    return Row(
      children: [
        Icon(Icons.schedule,
            size: 14, color: Colors.white.withValues(alpha: 0.45)),
        const SizedBox(width: 6),
        Text(
          '${l10n.botAdminLastUsed}: $value',
          style: TextStyle(
              color: Colors.white.withValues(alpha: 0.6), fontSize: 12),
        ),
      ],
    );
  }
}

class _RevokeButton extends StatelessWidget {
  final VoidCallback? onPressed;
  const _RevokeButton({required this.onPressed});

  @override
  Widget build(BuildContext context) {
    return OutlinedButton(
      onPressed: onPressed,
      style: OutlinedButton.styleFrom(
        foregroundColor: AppTheme.ponPink,
        side: BorderSide(color: AppTheme.ponPink.withValues(alpha: 0.7)),
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
        shape:
            RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
      ),
      child: Text(context.l10n.botAdminRevokeToken),
    );
  }
}

/// One-time token + MCP URL dialog. The token is held only in this widget's
/// build scope and discarded when the dialog closes — never persisted.
class _TokenDialog extends StatelessWidget {
  final IssuedToken issued;
  const _TokenDialog({required this.issued});

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return AlertDialog(
      backgroundColor: AppTheme.darkBackground,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: const BorderSide(color: AppTheme.darkBorder),
      ),
      title: Text(l10n.botAdminGenerateToken,
          style: const TextStyle(color: Colors.white)),
      content: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: AppTheme.ponPeach.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(10),
                border: Border.all(
                    color: AppTheme.ponPeach.withValues(alpha: 0.4)),
              ),
              child: Row(
                children: [
                  const Icon(Icons.warning_amber_rounded,
                      color: AppTheme.ponPeach, size: 18),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      l10n.botAdminTokenWarning,
                      style: const TextStyle(
                          color: AppTheme.ponPeach, fontSize: 12),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),
            _CopyField(label: l10n.botAdminToken, value: issued.token),
            const SizedBox(height: 12),
            _CopyField(label: l10n.botAdminMcpUrl, value: issued.mcpUrl),
          ],
        ),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(context).pop(),
          child: Text(l10n.actionCancel,
              style: const TextStyle(color: AppTheme.ponCyan)),
        ),
      ],
    );
  }
}

class _CopyField extends StatelessWidget {
  final String label;
  final String value;
  const _CopyField({required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label,
            style: TextStyle(
                color: Colors.white.withValues(alpha: 0.6), fontSize: 12)),
        const SizedBox(height: 4),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
          decoration: BoxDecoration(
            color: Colors.black.withValues(alpha: 0.35),
            borderRadius: BorderRadius.circular(10),
            border: Border.all(color: AppTheme.darkBorder),
          ),
          child: Row(
            children: [
              Expanded(
                child: SelectableText(
                  value,
                  maxLines: 3,
                  style: const TextStyle(
                      color: Colors.white,
                      fontSize: 12,
                      fontFamily: 'monospace'),
                ),
              ),
              IconButton(
                tooltip: l10n.botAdminCopyToken,
                icon: const Icon(Icons.copy, size: 18, color: AppTheme.ponCyan),
                onPressed: () async {
                  await Clipboard.setData(ClipboardData(text: value));
                  showInfoSnackBar(l10n.botAdminCopyToken);
                },
              ),
            ],
          ),
        ),
      ],
    );
  }
}
