import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'auth_provider.dart';
import 'mfa_models.dart';

/// Enrollment material (secret + QR) for the pending challenge identified by
/// its `mfaToken`. Re-fetching is safe: the server returns the same pending
/// secret for the same token. A dead token sends the user back to `/login`
/// (handled in [AuthNotifier.startMfaEnrollment]).
final mfaEnrollmentProvider =
    FutureProvider.autoDispose.family<MfaEnrollment, String>(
  (ref, mfaToken) =>
      ref.read(authNotifierProvider.notifier).startMfaEnrollment(),
);
