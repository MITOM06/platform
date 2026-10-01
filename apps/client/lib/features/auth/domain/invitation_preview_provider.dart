import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../data/auth_repository.dart';
import 'invitation_preview.dart';

/// Loads the public preview for an invitation token. Auto-disposed so a
/// revisit (e.g. after the admin resent the link) always re-validates.
final invitationPreviewProvider = FutureProvider.autoDispose
    .family<InvitationPreview, String>((ref, token) {
  return ref.read(authRepositoryProvider).getInvitation(token);
});
