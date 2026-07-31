import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../../core/l10n/l10n_ext.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/utils/global_messenger.dart';
import '../../../core/widgets/pon_widgets.dart';
import '../data/models/connector_models.dart';
import '../state/integrations_provider.dart';
import 'widgets/connector_card.dart';
import 'widgets/connector_permissions_sheet.dart';
import 'widgets/custom_mcp_sheet.dart';
import 'widgets/directory_section.dart';

/// Integrations gallery — mirrors web `/integrations`. Lists catalog connectors
/// with live status, opens OAuth in the system browser, disconnects, and lets
/// the user add a custom MCP server.
class IntegrationsScreen extends ConsumerStatefulWidget {
  const IntegrationsScreen({super.key});

  @override
  ConsumerState<IntegrationsScreen> createState() =>
      _IntegrationsScreenState();
}

class _IntegrationsScreenState extends ConsumerState<IntegrationsScreen>
    with WidgetsBindingObserver {
  String? _busyProvider;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    // The OAuth redirect lands in the browser; when the user returns to the
    // app we refresh so a freshly-completed connection appears.
    if (state == AppLifecycleState.resumed && _busyProvider != null) {
      _busyProvider = null;
      ref.read(integrationsProvider.notifier).refresh();
    }
  }

  Future<void> _connect(CatalogEntry entry) async {
    setState(() => _busyProvider = entry.id);
    try {
      final url =
          await ref.read(integrationsProvider.notifier).startOAuth(entry.id);
      final uri = Uri.parse(url);
      final ok =
          await launchUrl(uri, mode: LaunchMode.externalApplication);
      if (!ok && mounted) {
        showErrorSnackBar(context.l10n.connectorOpenFailed);
        setState(() => _busyProvider = null);
      }
    } catch (e) {
      if (mounted) {
        showErrorSnackBar('$e');
        setState(() => _busyProvider = null);
      }
    }
  }

  Future<void> _manage(ConnectorItem item) async {
    final conn = item.connection;
    if (conn == null) return;
    final l10n = context.l10n;
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        backgroundColor: Theme.of(context).colorScheme.surface,
        title: Text(item.entry.name,
            style: TextStyle(color: Theme.of(context).colorScheme.onSurface)),
        content: Text(
          l10n.connectorDisconnectConfirm,
          style: TextStyle(color: AppTheme.mutedText(context)),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: Text(l10n.actionCancel),
          ),
          TextButton(
            onPressed: () => Navigator.pop(context, true),
            child: Text(l10n.connectorDisconnect,
                style: TextStyle(color: Theme.of(context).colorScheme.error)),
          ),
        ],
      ),
    );
    if (confirmed != true) return;
    try {
      await ref.read(integrationsProvider.notifier).disconnect(conn.id);
    } catch (e) {
      if (mounted) showErrorSnackBar('$e');
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final itemsAsync = ref.watch(integrationsProvider);

    return Scaffold(
      backgroundColor: Theme.of(context).colorScheme.surface,
      appBar: AppBar(
        backgroundColor: Theme.of(context).colorScheme.surface,
        title: Text(
          l10n.integrationsTitle,
          style: TextStyle(
              color: Theme.of(context).colorScheme.onSurface, fontWeight: FontWeight.bold),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.add_link_rounded, color: AppTheme.ponAccent),
            tooltip: l10n.customMcpTitle,
            onPressed: () => CustomMcpSheet.show(context),
          ),
        ],
      ),
      body: itemsAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => _ErrorState(
          message: '$e',
          onRetry: () => ref.read(integrationsProvider.notifier).refresh(),
        ),
        data: (items) => RefreshIndicator(
          onRefresh: () =>
              ref.read(integrationsProvider.notifier).refresh(),
          child: ListView(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
            children: [
              Text(
                l10n.integrationsSubtitle,
                style: TextStyle(
                  color: AppTheme.mutedText(context),
                  fontSize: 14,
                  height: 1.4,
                ),
              ),
              const SizedBox(height: 20),
              const DirectorySection(),
              const SizedBox(height: 24),
              ...items.map(
                (item) => Padding(
                  padding: const EdgeInsets.only(bottom: 14),
                  child: ConnectorCard(
                    item: item,
                    busy: _busyProvider == item.entry.id,
                    onConnect: () => _connect(item.entry),
                    onManage: () => _manage(item),
                    onPermissions: () =>
                        ConnectorPermissionsSheet.show(context, item),
                  ),
                ),
              ),
              const SizedBox(height: 8),
              _CustomMcpCta(onTap: () => CustomMcpSheet.show(context)),
            ],
          ),
        ),
      ),
    );
  }
}

class _CustomMcpCta extends StatelessWidget {
  final VoidCallback onTap;
  const _CustomMcpCta({required this.onTap});

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(AppTheme.radiusCard),
      child: Container(
        padding: const EdgeInsets.all(18),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(AppTheme.radiusCard),
          border: Border.all(
            color: AppTheme.ponAccent.withValues(alpha: 0.4),
            width: 1.2,
          ),
        ),
        child: Row(
          children: [
            const Icon(Icons.dashboard_customize_rounded,
                color: AppTheme.ponAccent),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    l10n.customMcpTitle,
                    style: TextStyle(
                      color: Theme.of(context).colorScheme.onSurface,
                      fontWeight: FontWeight.bold,
                      fontSize: 15,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    l10n.customMcpSubtitle,
                    style: TextStyle(
                      color: AppTheme.mutedText(context),
                      fontSize: 12.5,
                    ),
                  ),
                ],
              ),
            ),
            Icon(Icons.chevron_right_rounded, color: AppTheme.mutedText(context)),
          ],
        ),
      ),
    );
  }
}

class _ErrorState extends StatelessWidget {
  final String message;
  final VoidCallback onRetry;
  const _ErrorState({required this.message, required this.onRetry});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.cloud_off_rounded,
                size: 56, color: AppTheme.mutedText(context)),
            const SizedBox(height: 12),
            Text(
              message,
              textAlign: TextAlign.center,
              style: TextStyle(color: AppTheme.mutedText(context)),
            ),
            const SizedBox(height: 16),
            SizedBox(
              width: 160,
              child: PonButton(
                onPressed: onRetry,
                child: Text(context.l10n.actionRetry),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
