import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/l10n/l10n_ext.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/utils/global_messenger.dart';
import '../../../../core/widgets/pon_widgets.dart';
import '../../../auth/utils/auth_error.dart';
import '../../data/models/admin_models.dart';
import '../../state/admin_providers.dart';
import '../../state/capabilities_provider.dart';

/// Bottom sheet to invite a member by email. The role picker shows only when
/// the caller can read roles (`MANAGE_ROLES`) — otherwise the server defaults
/// to the preset Member role — and hides the Owner role unless the caller is
/// an Owner. Departments show only with `MANAGE_DEPARTMENTS`. Mirrors the web
/// `InviteMemberDialog`.
class InviteMemberSheet extends ConsumerStatefulWidget {
  const InviteMemberSheet({super.key});

  static Future<void> show(BuildContext context) => showModalBottomSheet<void>(
        context: context,
        isScrollControlled: true,
        useSafeArea: true,
        backgroundColor: Theme.of(context).colorScheme.surface,
        shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
        ),
        builder: (_) => const InviteMemberSheet(),
      );

  @override
  ConsumerState<InviteMemberSheet> createState() => _InviteMemberSheetState();
}

class _InviteMemberSheetState extends ConsumerState<InviteMemberSheet> {
  final _formKey = GlobalKey<FormState>();
  final _emailController = TextEditingController();
  final Set<String> _departmentIds = {};
  String? _roleId;
  bool _roleTouched = false;
  bool _submitting = false;

  @override
  void dispose() {
    _emailController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    final l10n = context.l10n;
    final locale = Localizations.localeOf(context).languageCode;
    setState(() => _submitting = true);
    try {
      final result = await ref.read(invitationsProvider.notifier).create(
            email: _emailController.text.trim(),
            roleId: _roleId,
            departmentIds: _departmentIds.toList(),
            locale: locale,
          );
      if (result.emailSent) {
        showInfoSnackBar(l10n.adminInviteSent);
      } else {
        showErrorSnackBar(l10n.adminInviteEmailFailed);
      }
      if (mounted) Navigator.of(context).pop();
    } catch (e) {
      if (mounted) showErrorSnackBar(authErrorMessage(context, e));
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final onSurface = Theme.of(context).colorScheme.onSurface;
    final muted = AppTheme.mutedText(context);
    final canRoles = ref.watch(hasCapabilityProvider(Cap.manageRoles));
    final canDepts = ref.watch(hasCapabilityProvider(Cap.manageDepartments));
    final isOwner = ref.watch(capabilitiesProvider).valueOrNull?.role == 'Owner';
    final roles = canRoles
        ? (ref.watch(rolesProvider).valueOrNull ?? const <Role>[])
            .where((r) => isOwner || !r.isOwner)
            .toList()
        : const <Role>[];
    final depts = canDepts
        ? ref.watch(departmentsProvider).valueOrNull ?? const <Department>[]
        : const <Department>[];

    // Default the picker to the preset Member role once roles have loaded.
    if (!_roleTouched && _roleId == null) {
      _roleId = roles.where((r) => r.name == 'Member').firstOrNull?.id;
    }

    return Padding(
      padding: EdgeInsets.only(
        left: 20,
        right: 20,
        top: 20,
        bottom: MediaQuery.of(context).viewInsets.bottom + 20,
      ),
      child: Form(
        key: _formKey,
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(l10n.adminInviteTitle,
                  style: Theme.of(context).textTheme.titleLarge?.copyWith(
                      color: onSurface, fontWeight: FontWeight.w600)),
              const SizedBox(height: 16),
              PonTextField(
                controller: _emailController,
                labelText: l10n.adminInviteEmail,
                prefixIcon: Icons.email_rounded,
                keyboardType: TextInputType.emailAddress,
                textInputAction: TextInputAction.done,
                validator: (v) {
                  final value = v?.trim() ?? '';
                  if (value.isEmpty) return l10n.valEmailRequired;
                  if (!RegExp(r'^[^@\s]+@[^@\s]+\.[^@\s]+$').hasMatch(value)) {
                    return l10n.valEmailInvalid;
                  }
                  return null;
                },
              ),
              if (canRoles && roles.isNotEmpty) ...[
                const SizedBox(height: 16),
                DropdownButtonFormField<String>(
                  initialValue: _roleId,
                  isExpanded: true,
                  dropdownColor: Theme.of(context).colorScheme.surface,
                  style: TextStyle(color: onSurface),
                  decoration: InputDecoration(
                    labelText: l10n.adminInviteRole,
                    labelStyle: TextStyle(color: muted),
                  ),
                  items: [
                    for (final r in roles)
                      DropdownMenuItem(
                        value: r.id,
                        child: Text(r.name, overflow: TextOverflow.ellipsis),
                      ),
                  ],
                  onChanged: (v) => setState(() {
                    _roleTouched = true;
                    _roleId = v;
                  }),
                ),
              ],
              if (canDepts && depts.isNotEmpty) ...[
                const SizedBox(height: 16),
                Text(l10n.adminInviteDepartments,
                    style: TextStyle(color: muted)),
                const SizedBox(height: 8),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: [
                    for (final d in depts)
                      FilterChip(
                        label: Text(d.name),
                        selected: _departmentIds.contains(d.id),
                        selectedColor:
                            AppTheme.ponAccent.withValues(alpha: 0.2),
                        onSelected: (sel) => setState(() {
                          sel
                              ? _departmentIds.add(d.id)
                              : _departmentIds.remove(d.id);
                        }),
                      ),
                  ],
                ),
              ],
              const SizedBox(height: 24),
              PonButton(
                onPressed: _submitting ? null : _submit,
                isLoading: _submitting,
                child: Text(l10n.adminInviteSubmit),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
