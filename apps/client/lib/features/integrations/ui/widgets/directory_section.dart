import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../../../core/l10n/l10n_ext.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/utils/global_messenger.dart';
import '../../../../core/widgets/pon_widgets.dart';
import '../../../admin/data/models/admin_models.dart';
import '../../../admin/state/capabilities_provider.dart';
import '../../data/models/connector_models.dart';
import '../../state/integrations_provider.dart';
import '../../state/oauth_flow_provider.dart';
import '../../utils/connector_error.dart';
import 'directory_admin_sheet.dart';
import 'directory_card.dart';
import 'disconnect_dialog.dart';

/// The dynamic MCP directory section on the integrations screen: a searchable
/// 1-click connect grid backed by the DB-driven directory. OAuth entries open
/// the system browser (the result is reported when the app resumes — see
/// [OAuthFlowNotifier]); apikey entries prompt for a key; "none" entries
/// connect instantly. Admins (MANAGE_WORKSPACE) can add/edit/delete entries.
/// Mirrors the web `DirectorySection`.
class DirectorySection extends ConsumerStatefulWidget {
  const DirectorySection({super.key});

  @override
  ConsumerState<DirectorySection> createState() => _DirectorySectionState();
}

class _DirectorySectionState extends ConsumerState<DirectorySection> {
  /// Slug whose connect request is in flight (before the browser opens).
  String? _busySlug;
  String _query = '';
  final _searchCtrl = TextEditingController();

  @override
  void dispose() {
    _searchCtrl.dispose();
    super.dispose();
  }

  Future<void> _connect(DirectoryEntry entry) async {
    setState(() => _busySlug = entry.slug);
    final l10n = context.l10n;
    try {
      final result =
          await ref.read(directoryProvider.notifier).startOAuth(entry.slug);
      if (!mounted) return;
      setState(() => _busySlug = null);
      if (result.mode == 'oauth' && result.authorizeUrl != null) {
        ref.read(oauthFlowProvider.notifier).begin(entry.slug, entry.name);
        final ok = await launchUrl(
          Uri.parse(result.authorizeUrl!),
          mode: LaunchMode.externalApplication,
        );
        if (!ok) {
          ref.read(oauthFlowProvider.notifier).clear();
          showErrorSnackBar(l10n.connectorOpenFailed);
        }
      } else if (result.mode == 'apikey') {
        await _promptKey(entry);
      } else {
        await ref.read(connectionsProvider.notifier).refresh();
        showInfoSnackBar(l10n.directoryConnected(entry.name));
      }
    } catch (e) {
      showErrorSnackBar(connectorErrorMessage(l10n, e));
      if (mounted) setState(() => _busySlug = null);
    }
  }

  Future<void> _promptKey(DirectoryEntry entry) async {
    final ctrl = TextEditingController();
    final l10n = context.l10n;
    final credential = await showDialog<String>(
      context: context,
      builder: (_) => AlertDialog(
        backgroundColor: Theme.of(context).colorScheme.surface,
        title: Text(l10n.directoryKeyTitle(entry.name),
            style: TextStyle(color: Theme.of(context).colorScheme.onSurface)),
        content: PonTextField(
          controller: ctrl,
          labelText: l10n.directoryKeyLabel,
          prefixIcon: Icons.key_rounded,
          obscureText: true,
          enableVisibilityToggle: true,
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: Text(l10n.directoryCancel),
          ),
          TextButton(
            onPressed: () => Navigator.pop(context, ctrl.text.trim()),
            child: Text(l10n.connectorConnect,
                style: TextStyle(color: AppTheme.accent(context))),
          ),
        ],
      ),
    );
    ctrl.dispose();
    if (credential == null || credential.isEmpty) return;
    try {
      await ref.read(directoryProvider.notifier).connectKey(entry.slug, credential);
      showInfoSnackBar(l10n.directoryConnected(entry.name));
    } catch (e) {
      showErrorSnackBar(connectorErrorMessage(l10n, e));
    }
  }

  Future<void> _manage(DirectoryItem item) async {
    final conn = item.connection;
    if (conn == null) return;
    final l10n = context.l10n;
    final confirmed = await confirmDisconnect(context, item.entry.name,
        workspace: conn.isWorkspace);
    if (!confirmed) return;
    try {
      await ref.read(directoryProvider.notifier).disconnect(conn.id);
      showInfoSnackBar(l10n.connectorDisconnected(item.entry.name));
    } catch (e) {
      showErrorSnackBar(connectorErrorMessage(l10n, e));
    }
  }

  Future<void> _delete(DirectoryEntry entry) async {
    final l10n = context.l10n;
    final confirmed = await confirmDisconnect(
      context,
      entry.name,
      message: l10n.directoryDeleteConfirm,
      actionLabel: l10n.directoryDelete,
    );
    if (!confirmed) return;
    try {
      await ref.read(directoryProvider.notifier).deleteEntry(entry.id);
      showInfoSnackBar(l10n.directoryDeleteSuccess);
    } catch (e) {
      showErrorSnackBar(connectorErrorMessage(l10n, e));
    }
  }

  List<DirectoryItem> _filter(List<DirectoryItem> items) {
    final q = _query.trim().toLowerCase();
    if (q.isEmpty) return items;
    return items
        .where((i) =>
            i.entry.name.toLowerCase().contains(q) ||
            i.entry.description.toLowerCase().contains(q) ||
            i.entry.slug.toLowerCase().contains(q))
        .toList();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final isAdmin = ref.watch(hasCapabilityProvider(Cap.manageWorkspace));
    final canWorkspace =
        ref.watch(hasCapabilityProvider(Cap.connectWorkspaceConnector));
    final flow = ref.watch(oauthFlowProvider);
    final itemsAsync = ref.watch(directoryProvider);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Expanded(
              child: Text(
                l10n.sectionDirectoryTitle,
                style: TextStyle(
                  color: Theme.of(context).colorScheme.onSurface,
                  fontWeight: FontWeight.w600,
                  fontSize: 18,
                ),
              ),
            ),
            if (isAdmin)
              TextButton.icon(
                onPressed: () => DirectoryAdminSheet.show(context),
                icon: Icon(Icons.add_rounded, size: 18, color: AppTheme.accent(context)),
                label: Text(l10n.directoryAdd,
                    style: TextStyle(color: AppTheme.accent(context))),
              ),
          ],
        ),
        Text(
          l10n.sectionDirectoryDesc,
          style: TextStyle(
            color: AppTheme.mutedText(context),
            fontSize: 12,
            height: 1.3,
          ),
        ),
        const SizedBox(height: 12),
        PonTextField(
          controller: _searchCtrl,
          onChanged: (v) => setState(() => _query = v),
          labelText: l10n.directorySearch,
          prefixIcon: Icons.search_rounded,
        ),
        const SizedBox(height: 14),
        itemsAsync.when(
          skipLoadingOnReload: true,
          loading: () => const Padding(
            padding: EdgeInsets.symmetric(vertical: 24),
            child: Center(child: CircularProgressIndicator()),
          ),
          error: (e, _) => Padding(
            padding: const EdgeInsets.symmetric(vertical: 16),
            child: Text(connectorErrorMessage(l10n, e),
                style: TextStyle(color: AppTheme.mutedText(context))),
          ),
          data: (items) {
            final filtered = _filter(items);
            if (filtered.isEmpty) {
              return Padding(
                padding: const EdgeInsets.symmetric(vertical: 24),
                child: Center(
                  child: Text(l10n.directoryEmpty,
                      style: TextStyle(color: AppTheme.mutedText(context))),
                ),
              );
            }
            return Column(
              children: [
                for (final item in filtered)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 14),
                    child: DirectoryCard(
                      item: item,
                      busy: _busySlug == item.entry.slug ||
                          flow?.slug == item.entry.slug,
                      isAdmin: isAdmin,
                      onConnect: () => _connect(item.entry),
                      onManage: (item.connection != null &&
                              (!item.connection!.isWorkspace || canWorkspace))
                          ? () => _manage(item)
                          : null,
                      onEdit: () =>
                          DirectoryAdminSheet.show(context, entry: item.entry),
                      onDelete: () => _delete(item.entry),
                    ),
                  ),
              ],
            );
          },
        ),
      ],
    );
  }
}
