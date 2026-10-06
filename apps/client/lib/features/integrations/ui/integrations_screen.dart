import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../../core/l10n/l10n_ext.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/utils/global_messenger.dart';
import '../../../core/widgets/pon_widgets.dart';
import '../../admin/data/models/admin_models.dart';
import '../../admin/state/capabilities_provider.dart';
import '../data/models/connector_models.dart';
import '../state/integrations_provider.dart';
import '../state/oauth_flow_provider.dart';
import '../utils/connector_error.dart';
import 'widgets/connector_card.dart';
import 'widgets/connector_permissions_sheet.dart';
import 'widgets/custom_mcp_list.dart';
import 'widgets/custom_mcp_sheet.dart';
import 'widgets/directory_section.dart';
import 'widgets/disconnect_dialog.dart';

/// Integrations gallery — mirrors web `/integrations`. Lists catalog connectors
/// with live status, opens OAuth in the system browser (the result is reported
/// when the app resumes — see [OAuthFlowNotifier]), disconnects, and manages
/// custom MCP servers.
class IntegrationsScreen extends ConsumerStatefulWidget {
  const IntegrationsScreen({super.key});

  @override
  ConsumerState<IntegrationsScreen> createState() =>
      _IntegrationsScreenState();
}

class _IntegrationsScreenState extends ConsumerState<IntegrationsScreen> {
  /// Catalog id whose authorize URL is being fetched.
  String? _starting;

  Future<void> _connect(CatalogEntry entry) async {
    setState(() => _starting = entry.id);
    final l10n = context.l10n;
    try {
      final url =
          await ref.read(integrationsProvider.notifier).startOAuth(entry.id);
      ref.read(oauthFlowProvider.notifier).begin(entry.id, entry.name);
      final ok =
          await launchUrl(Uri.parse(url), mode: LaunchMode.externalApplication);
      if (!ok) {
        ref.read(oauthFlowProvider.notifier).clear();
        showErrorSnackBar(l10n.connectorOpenFailed);
      }
    } catch (e) {
      showErrorSnackBar(connectorErrorMessage(l10n, e));
    } finally {
      if (mounted) setState(() => _starting = null);
    }
  }

  Future<void> _disconnect(ConnectorItem item) async {
    final conn = item.connection;
    if (conn == null) return;
    final l10n = context.l10n;
    final confirmed = await confirmDisconnect(context, item.entry.name,
        workspace: conn.isWorkspace);
    if (!confirmed) return;
    try {
      await ref.read(integrationsProvider.notifier).disconnect(conn.id);
      showInfoSnackBar(l10n.connectorDisconnected(item.entry.name));
    } catch (e) {
      showErrorSnackBar(connectorErrorMessage(l10n, e));
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final itemsAsync = ref.watch(integrationsProvider);
    final flow = ref.watch(oauthFlowProvider);
    final canAddCustom = ref.watch(hasCapabilityProvider(Cap.addCustomMcp));
    final canWorkspace =
        ref.watch(hasCapabilityProvider(Cap.connectWorkspaceConnector));

    return Scaffold(
      appBar: AppBar(
        title: Text(
          l10n.integrationsTitle,
          style: TextStyle(
              color: Theme.of(context).colorScheme.onSurface,
              fontWeight: FontWeight.w600),
        ),
        actions: [
          if (canAddCustom)
            IconButton(
              icon: Icon(Icons.add_link_rounded,
                  color: AppTheme.mutedText(context)),
              tooltip: l10n.customMcpTitle,
              onPressed: () => CustomMcpSheet.show(context),
            ),
        ],
      ),
      body: itemsAsync.when(
        skipLoadingOnReload: true,
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => _ErrorState(
          message: connectorErrorMessage(l10n, e),
          onRetry: () => ref.read(integrationsProvider.notifier).refresh(),
        ),
        data: (items) => RefreshIndicator(
          onRefresh: () async {
            ref.invalidate(customMcpProvider);
            await ref.read(directoryProvider.notifier).refresh();
            await ref.read(integrationsProvider.notifier).refresh();
          },
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
              ...items.map((item) {
                final conn = item.connection;
                // A shared workspace connection may only be removed (or
                // re-scoped) by holders of CONNECT_WORKSPACE_CONNECTOR.
                final mayManage =
                    conn != null && (!conn.isWorkspace || canWorkspace);
                return Padding(
                  padding: const EdgeInsets.only(bottom: 14),
                  child: ConnectorCard(
                    item: item,
                    busy: _starting == item.entry.id ||
                        flow?.slug == item.entry.id,
                    onConnect: () => _connect(item.entry),
                    onManage: mayManage ? () => _disconnect(item) : null,
                    onPermissions: mayManage
                        ? () => ConnectorPermissionsSheet.show(context, item)
                        : null,
                  ),
                );
              }),
              const SizedBox(height: 8),
              const CustomMcpList(),
              if (canAddCustom) ...[
                const SizedBox(height: 8),
                _CustomMcpCta(onTap: () => CustomMcpSheet.show(context)),
              ],
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
          border: Border.all(color: AppTheme.hairline(context)),
        ),
        child: Row(
          children: [
            Icon(Icons.dashboard_customize_rounded,
                color: AppTheme.accent(context)),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    l10n.customMcpTitle,
                    style: TextStyle(
                      color: Theme.of(context).colorScheme.onSurface,
                      fontWeight: FontWeight.w600,
                      fontSize: 16,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    l10n.customMcpSubtitle,
                    style: TextStyle(
                      color: AppTheme.mutedText(context),
                      fontSize: 12,
                    ),
                  ),
                ],
              ),
            ),
            Icon(Icons.chevron_right_rounded,
                color: AppTheme.mutedText(context)),
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
