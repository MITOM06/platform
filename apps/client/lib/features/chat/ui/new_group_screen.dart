import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/l10n/l10n_ext.dart';
import '../../../core/utils/app_error.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/pon_widgets.dart';
import '../../friends/domain/friends_provider.dart';
import '../../admin/data/models/admin_models.dart';
import '../../admin/state/admin_providers.dart';
import '../../admin/state/capabilities_provider.dart';
import '../data/chat_repository.dart';
import '../domain/chat_provider.dart';
import 'widgets/conversation_avatar.dart';

/// Pick a name + tick friends to create a group conversation. Calls the
/// existing `POST /api/conversations/group` endpoint via [ChatRepository].
class NewGroupScreen extends ConsumerStatefulWidget {
  const NewGroupScreen({super.key});

  @override
  ConsumerState<NewGroupScreen> createState() => _NewGroupScreenState();
}

class _NewGroupScreenState extends ConsumerState<NewGroupScreen> {
  final _nameCtrl = TextEditingController();
  final Set<String> _selected = {};
  bool _busy = false;
  String? _departmentId; // P6: optional owning department (admins only)

  @override
  void dispose() {
    _nameCtrl.dispose();
    super.dispose();
  }

  Future<void> _create() async {
    final name = _nameCtrl.text.trim();
    final messenger = ScaffoldMessenger.of(context);
    final l10n = context.l10n;
    if (name.isEmpty) {
      messenger.showSnackBar(
        SnackBar(content: Text(l10n.valGroupNameRequired)),
      );
      return;
    }
    // Group needs the creator + at least 2 others to be meaningful; the backend
    // requires >= 2 members total, so require at least 2 selected friends.
    if (_selected.length < 2) {
      messenger.showSnackBar(
        SnackBar(content: Text(l10n.valSelectMembers)),
      );
      return;
    }
    setState(() => _busy = true);
    try {
      final conv = await ref
          .read(chatRepositoryProvider)
          .createGroup(name, _selected.toList(), departmentId: _departmentId);
      ref.read(conversationsNotifierProvider.notifier).refresh();
      if (mounted) context.go('/chat/${conv.id}');
    } catch (e) {
      messenger.showSnackBar(
        SnackBar(content: Text(friendlyError(e))),
      );
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final friendsAsync = ref.watch(friendsListProvider);
    final canDepts = ref.watch(hasCapabilityProvider(Cap.manageDepartments));
    final List<Department> departments = canDepts
        ? (ref.watch(departmentsProvider).valueOrNull ?? const <Department>[])
        : const <Department>[];

    return Scaffold(
      appBar: AppBar(
        title: Text(context.l10n.createGroup),
        actions: [
          TextButton(
            onPressed: _busy ? null : _create,
            child: Text(context.l10n.actionSave),
          ),
        ],
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
            child: PonTextField(
              controller: _nameCtrl,
              labelText: context.l10n.groupName,
              prefixIcon: Icons.groups_rounded,
            ),
          ),
          if (departments.isNotEmpty)
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
              child: DropdownButtonFormField<String?>(
                initialValue: _departmentId,
                isExpanded: true,
                decoration: InputDecoration(
                  labelText: context.l10n.newConvDepartment,
                  prefixIcon: const Icon(Icons.apartment_outlined),
                ),
                items: [
                  DropdownMenuItem(
                    value: null,
                    child: Text(context.l10n.newConvNoDepartment),
                  ),
                  ...departments.map(
                    (d) => DropdownMenuItem(
                      value: d.id,
                      child: Text(d.name, overflow: TextOverflow.ellipsis),
                    ),
                  ),
                ],
                onChanged: (v) => setState(() => _departmentId = v),
              ),
            ),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
            child: Align(
              alignment: Alignment.centerLeft,
              child: Text(
                context.l10n.selectMembers,
                style: TextStyle(
                  color: Theme.of(context)
                      .colorScheme
                      .onSurface
                      .withValues(alpha: 0.6),
                  fontWeight: FontWeight.w600,
                  fontSize: 13,
                ),
              ),
            ),
          ),
          Expanded(
            child: friendsAsync.when(
              loading: () => const Center(child: CircularProgressIndicator()),
              error: (e, _) => Center(
                child: Text(friendlyError(e)),
              ),
              data: (friends) {
                if (friends.isEmpty) {
                  return Center(child: Text(context.l10n.noFriends));
                }
                return ListView.builder(
                  itemCount: friends.length,
                  itemBuilder: (context, index) {
                    final friend = friends[index];
                    final checked = _selected.contains(friend.id);
                    return CheckboxListTile(
                      value: checked,
                      onChanged: (v) => setState(() {
                        if (v == true) {
                          _selected.add(friend.id);
                        } else {
                          _selected.remove(friend.id);
                        }
                      }),
                      secondary: ConversationAvatar(
                        avatarUrl: friend.avatarUrl,
                        fallbackLetter: friend.displayName.isNotEmpty
                            ? friend.displayName[0].toUpperCase()
                            : '?',
                        size: 40,
                      ),
                      title: Text(friend.displayName),
                      subtitle: Text(
                        friend.email,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                      activeColor: AppTheme.ponCyan,
                    );
                  },
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}
