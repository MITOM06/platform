import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/l10n/l10n_ext.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/pon_widgets.dart';
import '../../../l10n/app_localizations.dart';
import '../../auth/data/auth_repository.dart';
import '../../auth/domain/auth_state.dart';
import '../data/chat_repository.dart';
import '../domain/chat_state.dart' show kAiBotUserId;

class NewConversationScreen extends ConsumerStatefulWidget {
  const NewConversationScreen({super.key});

  @override
  ConsumerState<NewConversationScreen> createState() =>
      _NewConversationScreenState();
}

class _NewConversationScreenState
    extends ConsumerState<NewConversationScreen> {
  final _controller = TextEditingController();
  final _groupNameController = TextEditingController();
  final _formKey = GlobalKey<FormState>();
  bool _loading = false;
  bool _groupMode = false;
  String? _error;
  final List<UserModel> _selectedMembers = [];

  @override
  void dispose() {
    _controller.dispose();
    _groupNameController.dispose();
    super.dispose();
  }

  /// Resolve an email to a user via the auth-service search.
  Future<UserModel?> _resolveUser(String input) async {
    if (!input.contains('@')) return null;
    final users = await ref.read(authRepositoryProvider).searchUsers(input);
    final matches =
        users.where((u) => u.email.toLowerCase() == input.toLowerCase());
    return matches.isNotEmpty ? matches.first : null;
  }

  Future<void> _addMember() async {
    final input = _controller.text.trim();
    if (input.isEmpty) return;
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final user = await _resolveUser(input);
      if (!mounted) return;
      if (user == null) {
        setState(() => _error = context.l10n.errUserNotFoundEmail);
        return;
      }
      if (!_selectedMembers.any((m) => m.id == user.id)) {
        setState(() => _selectedMembers.add(user));
      }
      _controller.clear();
    } catch (_) {
      if (!mounted) return;
      setState(() => _error = context.l10n.errUserNotFoundOrConn);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _submitDirect() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final input = _controller.text.trim();
      String participantId = input;
      if (input.contains('@')) {
        final user = await _resolveUser(input);
        if (user == null) {
          setState(() {
            _error = context.l10n.errUserNotFoundEmail;
            _loading = false;
          });
          return;
        }
        participantId = user.id;
      }
      final repo = ref.read(chatRepositoryProvider);
      final conv = await repo.getOrCreateConversation(participantId);
      if (mounted) context.go('/chat/${conv.id}');
    } catch (_) {
      if (mounted) {
        setState(() {
          _error = context.l10n.errUserNotFoundOrConn;
          _loading = false;
        });
      }
    }
  }

  Future<void> _submitGroup() async {
    final name = _groupNameController.text.trim();
    if (name.isEmpty) {
      setState(() => _error = context.l10n.valGroupNameRequired);
      return;
    }
    if (_selectedMembers.length < 2) {
      setState(() => _error = context.l10n.valSelectMembers);
      return;
    }
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final conv = await ref.read(chatRepositoryProvider).createGroup(
            name,
            _selectedMembers.map((m) => m.id).toList(),
          );
      if (mounted) context.go('/chat/${conv.id}');
    } catch (_) {
      if (mounted) {
        setState(() {
          _error = context.l10n.errUserNotFoundOrConn;
          _loading = false;
        });
      }
    }
  }

  Future<void> _startAiChat() async {
    setState(() => _loading = true);
    try {
      final repo = ref.read(chatRepositoryProvider);
      final conv = await repo.getOrCreateConversation(kAiBotUserId);
      if (!mounted) return;
      context.go('/chat/${conv.id}');
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return Scaffold(
      appBar: AppBar(
        title: Text(_groupMode ? l10n.createGroup : l10n.newConversationTitle),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new_rounded, size: 20),
          onPressed: () => context.pop(),
        ),
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          physics: const BouncingScrollPhysics(),
          padding: const EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // AI Bot quick-start
              _AiBotTile(loading: _loading, onTap: _startAiChat),
              const SizedBox(height: 16),
              // Mode toggle
              SegmentedButton<bool>(
                segments: [
                  ButtonSegment(value: false, label: Text(l10n.newDirect)),
                  ButtonSegment(value: true, label: Text(l10n.newGroup)),
                ],
                selected: {_groupMode},
                onSelectionChanged: (s) => setState(() {
                  _groupMode = s.first;
                  _error = null;
                }),
              ),
              const SizedBox(height: 24),
              PonCard(
                glowColor: AppTheme.ponCyan,
                glowStrength: 4,
                child: Padding(
                  padding: const EdgeInsets.all(20.0),
                  child: _groupMode ? _buildGroupForm(l10n) : _buildDirectForm(l10n),
                ),
              ),
              if (_error != null) ...[
                const SizedBox(height: 16),
                Row(
                  children: [
                    const Icon(Icons.error_outline_rounded,
                        color: Colors.redAccent, size: 16),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        _error!,
                        style: const TextStyle(
                          color: Colors.redAccent,
                          fontSize: 13,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ),
                  ],
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildDirectForm(AppLocalizations l10n) {
    return Form(
      key: _formKey,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            l10n.startConversationHeading,
            style: const TextStyle(
                fontSize: 16, fontWeight: FontWeight.bold, color: Colors.white),
          ),
          const SizedBox(height: 16),
          PonTextField(
            controller: _controller,
            labelText: l10n.fieldRecipient,
            prefixIcon: Icons.person_outline_rounded,
            focusColor: AppTheme.ponCyan,
            textInputAction: TextInputAction.done,
            onFieldSubmitted: (_) => _loading ? null : _submitDirect(),
            validator: (v) {
              if (v == null || v.trim().isEmpty) {
                return l10n.valRecipientRequired;
              }
              return null;
            },
          ),
          const SizedBox(height: 24),
          PonButton(
            onPressed: _submitDirect,
            isLoading: _loading,
            gradientColors: const [AppTheme.ponCyan, AppTheme.ponCyan],
            glowColor: AppTheme.ponCyan,
            child: Text(l10n.startConversationButton),
          ),
        ],
      ),
    );
  }

  Widget _buildGroupForm(AppLocalizations l10n) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        PonTextField(
          controller: _groupNameController,
          labelText: l10n.groupName,
          prefixIcon: Icons.group_rounded,
          focusColor: AppTheme.ponCyan,
        ),
        const SizedBox(height: 16),
        Row(
          children: [
            Expanded(
              child: PonTextField(
                controller: _controller,
                labelText: l10n.searchUsers,
                prefixIcon: Icons.person_add_alt_1_rounded,
                focusColor: AppTheme.ponCyan,
                textInputAction: TextInputAction.done,
                onFieldSubmitted: (_) => _loading ? null : _addMember(),
              ),
            ),
            IconButton(
              icon: const Icon(Icons.add_circle, color: AppTheme.ponCyan),
              onPressed: _loading ? null : _addMember,
            ),
          ],
        ),
        if (_selectedMembers.isNotEmpty) ...[
          const SizedBox(height: 12),
          Wrap(
            spacing: 6,
            runSpacing: 6,
            children: [
              for (final m in _selectedMembers)
                Chip(
                  label: Text(m.displayName),
                  backgroundColor: AppTheme.darkSurface,
                  labelStyle: const TextStyle(color: Colors.white),
                  deleteIconColor: Colors.white54,
                  onDeleted: () => setState(() => _selectedMembers.remove(m)),
                ),
            ],
          ),
        ],
        const SizedBox(height: 20),
        PonButton(
          onPressed: _submitGroup,
          isLoading: _loading,
          gradientColors: const [AppTheme.ponCyan, AppTheme.ponCyan],
          glowColor: AppTheme.ponCyan,
          child: Text(l10n.createGroup),
        ),
      ],
    );
  }
}

class _AiBotTile extends StatelessWidget {
  final bool loading;
  final VoidCallback onTap;

  const _AiBotTile({required this.loading, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return Material(
      color: const Color(0xFF2D1B69).withValues(alpha: 0.7),
      borderRadius: BorderRadius.circular(16),
      child: InkWell(
        borderRadius: BorderRadius.circular(16),
        onTap: loading ? null : onTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          child: Row(
            children: [
              Container(
                width: 44,
                height: 44,
                decoration: const BoxDecoration(
                  shape: BoxShape.circle,
                  gradient: LinearGradient(
                    colors: [Color(0xFF6B2FA0), Color(0xFF2D1B69)],
                  ),
                ),
                child: const Icon(Icons.smart_toy_outlined,
                    color: Colors.white, size: 24),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        const Text(
                          'PON AI',
                          style: TextStyle(
                              color: Colors.white,
                              fontWeight: FontWeight.bold,
                              fontSize: 15),
                        ),
                        const SizedBox(width: 6),
                        Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 6, vertical: 2),
                          decoration: BoxDecoration(
                            color: const Color(0xFFB47FFF),
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: const Text('AI',
                              style: TextStyle(
                                  fontSize: 9,
                                  color: Colors.white,
                                  fontWeight: FontWeight.bold)),
                        ),
                      ],
                    ),
                    const SizedBox(height: 2),
                    Text(
                      context.l10n.startChatWithAI,
                      style: TextStyle(
                          color: Colors.white.withValues(alpha: 0.55),
                          fontSize: 12),
                    ),
                  ],
                ),
              ),
              const Icon(Icons.arrow_forward_ios_rounded,
                  color: Color(0xFFB47FFF), size: 16),
            ],
          ),
        ),
      ),
    );
  }
}
