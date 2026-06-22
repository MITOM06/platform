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
import 'directory_admin_sheet.dart';
import 'directory_card.dart';

/// The dynamic MCP directory section on the integrations screen: a searchable
/// 1-click connect grid backed by the DB-driven directory. OAuth entries open
/// the system browser; apikey entries prompt for a key; "none" entries connect
/// instantly. Admins (MANAGE_WORKSPACE) can add/edit/delete entries. Mirrors the
/// web `DirectorySection`.
class DirectorySection extends ConsumerStatefulWidget {
  const DirectorySection({super.key});

  @override
  ConsumerState<DirectorySection> createState() => _DirectorySectionState();
}

class _DirectorySectionState extends ConsumerState<DirectorySection>
    with WidgetsBindingObserver {
  String? _busySlug;
  String _query = '';
  final _searchCtrl = TextEditingController();

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _searchCtrl.dispose();
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    // After the OAuth browser redirect the user returns to the app; refresh so
    // a freshly-completed connection appears.
    if (state == AppLifecycleState.resumed && _busySlug != null) {
      _busySlug = null;
      ref.read(directoryProvider.notifier).refresh();
    }
  }

  Future<void> _connect(DirectoryEntry entry) async {
    setState(() => _busySlug = entry.slug);
    try {
      final result =
          await ref.read(directoryProvider.notifier).startOAuth(entry.slug);
      if (!mounted) return;
      if (result.mode == 'oauth' && result.authorizeUrl != null) {
        final ok = await launchUrl(
          Uri.parse(result.authorizeUrl!),
          mode: LaunchMode.externalApplication,
        );
        if (!ok && mounted) {
          showErrorSnackBar(context.l10n.connectorOpenFailed);
          setState(() => _busySlug = null);
        }
      } else if (result.mode == 'apikey') {
        setState(() => _busySlug = null);
        await _promptKey(entry);
      } else {
        setState(() => _busySlug = null);
        showInfoSnackBar(context.l10n.directoryConnected(entry.name));
      }
    } catch (e) {
      if (mounted) {
        showErrorSnackBar('$e');
        setState(() => _busySlug = null);
      }
    }
  }

  Future<void> _promptKey(DirectoryEntry entry) async {
    final ctrl = TextEditingController();
    final l10n = context.l10n;
    final credential = await showDialog<String>(
      context: context,
      builder: (_) => AlertDialog(
        backgroundColor: AppTheme.darkSurface,
        title: Text(l10n.directoryKeyTitle(entry.name),
            style: const TextStyle(color: Colors.white)),
        content: PonTextField(
          controller: ctrl,
          labelText: l10n.directoryKeyLabel,
          prefixIcon: Icons.key_outlined,
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
                style: const TextStyle(color: AppTheme.ponCyan)),
          ),
        ],
      ),
    );
    ctrl.dispose();
    if (credential == null || credential.isEmpty) return;
    try {
      await ref.read(directoryProvider.notifier).connectKey(entry.slug, credential);
      if (mounted) showInfoSnackBar(context.l10n.directoryConnected(entry.name));
    } catch (e) {
      if (mounted) showErrorSnackBar('$e');
    }
  }

  Future<void> _manage(DirectoryItem item) async {
    final conn = item.connection;
    if (conn == null) return;
    final l10n = context.l10n;
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        backgroundColor: AppTheme.darkSurface,
        title: Text(item.entry.name, style: const TextStyle(color: Colors.white)),
        content: Text(l10n.connectorDisconnectConfirm,
            style: const TextStyle(color: Colors.white70)),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: Text(l10n.actionCancel),
          ),
          TextButton(
            onPressed: () => Navigator.pop(context, true),
            child: Text(l10n.connectorDisconnect,
                style: const TextStyle(color: Colors.red)),
          ),
        ],
      ),
    );
    if (confirmed != true) return;
    try {
      await ref.read(directoryProvider.notifier).disconnect(conn.id);
    } catch (e) {
      if (mounted) showErrorSnackBar('$e');
    }
  }

  Future<void> _delete(DirectoryEntry entry) async {
    try {
      await ref.read(directoryProvider.notifier).deleteEntry(entry.id);
      if (mounted) showInfoSnackBar(context.l10n.directoryDeleteSuccess);
    } catch (e) {
      if (mounted) showErrorSnackBar('$e');
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
    final itemsAsync = ref.watch(directoryProvider);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Expanded(
              child: Text(
                l10n.sectionDirectoryTitle,
                style: const TextStyle(
                  color: Colors.white,
                  fontWeight: FontWeight.bold,
                  fontSize: 18,
                ),
              ),
            ),
            if (isAdmin)
              TextButton.icon(
                onPressed: () => DirectoryAdminSheet.show(context),
                icon: const Icon(Icons.add, size: 18, color: AppTheme.ponCyan),
                label: Text(l10n.directoryAdd,
                    style: const TextStyle(color: AppTheme.ponCyan)),
              ),
          ],
        ),
        Text(
          l10n.sectionDirectoryDesc,
          style: TextStyle(
            color: Colors.white.withValues(alpha: 0.55),
            fontSize: 13,
            height: 1.3,
          ),
        ),
        const SizedBox(height: 12),
        PonTextField(
          controller: _searchCtrl,
          onChanged: (v) => setState(() => _query = v),
          labelText: l10n.directorySearch,
          prefixIcon: Icons.search,
        ),
        const SizedBox(height: 14),
        itemsAsync.when(
          loading: () => const Padding(
            padding: EdgeInsets.symmetric(vertical: 24),
            child: Center(child: CircularProgressIndicator()),
          ),
          error: (e, _) => Padding(
            padding: const EdgeInsets.symmetric(vertical: 16),
            child: Text('$e',
                style: TextStyle(color: Colors.white.withValues(alpha: 0.5))),
          ),
          data: (items) {
            final filtered = _filter(items);
            if (filtered.isEmpty) {
              return Padding(
                padding: const EdgeInsets.symmetric(vertical: 24),
                child: Center(
                  child: Text(l10n.directoryEmpty,
                      style: TextStyle(color: Colors.white.withValues(alpha: 0.5))),
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
                      busy: _busySlug == item.entry.slug,
                      isAdmin: isAdmin,
                      onConnect: () => _connect(item.entry),
                      onManage: () => _manage(item),
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
