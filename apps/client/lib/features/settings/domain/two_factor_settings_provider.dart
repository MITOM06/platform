import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../auth/data/auth_repository.dart';
import '../../auth/domain/auth_provider.dart';
import '../../auth/domain/mfa_models.dart';
import '../../auth/utils/auth_error.dart';

/// Where "Turn on 2FA" (Settings → Security, contract 15) stands. Optional
/// 2FA is for members whose role doesn't require it; the flow never touches
/// the session. Mirror of the web Security page's in-page enrollment.
sealed class TwoFactorSetupStep {
  const TwoFactorSetupStep();
}

/// Nothing in progress: the section shows the status and its actions.
class TwoFactorSetupIdle extends TwoFactorSetupStep {
  const TwoFactorSetupIdle();
}

/// QR / "open in app" / manual key, then the first 6-digit code.
class TwoFactorSetupScan extends TwoFactorSetupStep {
  final MfaEnrollment enrollment;
  const TwoFactorSetupScan(this.enrollment);
}

/// 2FA is on. The 10 backup codes are shown once, until "I saved my backup
/// codes" → Done.
class TwoFactorSetupCodes extends TwoFactorSetupStep {
  final List<String> codes;
  const TwoFactorSetupCodes(this.codes);
}

/// The pending setup no longer exists server-side (its 10 minutes ran out):
/// the member has to start again. Shown localized, never as a code.
class TwoFactorSetupExpired implements Exception {
  const TwoFactorSetupExpired();
}

/// Refusals that mean the cached `/me` 2FA flags are stale (already on / off,
/// the role now requires 2FA, the domain now requires SSO).
const _staleFlagCodes = {
  'MFA_ALREADY_ENROLLED',
  'MFA_NOT_ENROLLED',
  'MFA_REQUIRED_BY_ROLE',
  'SSO_REQUIRED',
};

/// Turn on (start → confirm → backup codes → done) and turn off the signed-in
/// member's own optional 2FA. Loading and errors of "Turn on 2FA" ride on the
/// [AsyncValue]; a wrong code on the confirm step propagates to the step,
/// which shows it and stays. Every change re-syncs the signed-in user so the
/// status line follows the server.
class TwoFactorSettingsNotifier
    extends AutoDisposeAsyncNotifier<TwoFactorSetupStep> {
  bool _disposed = false;

  @override
  TwoFactorSetupStep build() {
    _disposed = false;
    ref.onDispose(() => _disposed = true);
    return const TwoFactorSetupIdle();
  }

  /// The member may leave the screen mid-request (autoDispose).
  void _set(AsyncValue<TwoFactorSetupStep> next) {
    if (!_disposed) state = next;
  }

  /// "Turn on 2FA": fetches the setup material.
  Future<void> start() async {
    if (state.isLoading) return;
    final auth = ref.read(authNotifierProvider.notifier);
    final repo = ref.read(authRepositoryProvider);
    _set(const AsyncLoading());
    try {
      _set(AsyncData(TwoFactorSetupScan(await repo.selfMfaEnrollStart())));
    } catch (e, st) {
      _set(AsyncError(e, st));
      if (_staleFlagCodes.contains(authErrorCode(e))) await auth.resyncMfa();
    }
  }

  /// Confirms the first [code]. From here 2FA is on: the codes are shown
  /// once and the user is re-synced, so the status reads On even if the
  /// member leaves before Done. A setup that can't continue (too many wrong
  /// codes, timed out, already on, SSO now required) goes back to the start
  /// with the reason; anything else (wrong code, network) propagates.
  Future<void> confirm(String code) async {
    final auth = ref.read(authNotifierProvider.notifier);
    final repo = ref.read(authRepositoryProvider);
    final List<String> codes;
    try {
      codes = await repo.selfMfaEnrollConfirm(code);
    } catch (e, st) {
      final errorCode = authErrorCode(e);
      if (errorCode == 'MFA_TOKEN_INVALID' || errorCode == 'MFA_NOT_ENROLLED') {
        _set(AsyncError(const TwoFactorSetupExpired(), st));
        return;
      }
      if (errorCode == 'MFA_TOO_MANY_ATTEMPTS' ||
          _staleFlagCodes.contains(errorCode)) {
        _set(AsyncError(e, st));
        if (_staleFlagCodes.contains(errorCode)) await auth.resyncMfa();
        return;
      }
      rethrow;
    }
    _set(AsyncData(TwoFactorSetupCodes(codes)));
    await auth.resyncMfa(enabled: true);
  }

  /// Done (only after "I saved my backup codes") or Cancel on the scan step
  /// (the pending secret simply expires server-side): back to the status.
  void reset() => _set(const AsyncData(TwoFactorSetupIdle()));

  /// "Turn off 2FA" with exactly one of a current TOTP [code] or an unused
  /// [backupCode]. Failures propagate (the dialog shows them); a refusal
  /// showing stale flags (e.g. `MFA_REQUIRED_BY_ROLE` after a promotion)
  /// re-syncs `/me` first so the section switches to the right state.
  Future<void> turnOff({String? code, String? backupCode}) async {
    final auth = ref.read(authNotifierProvider.notifier);
    final repo = ref.read(authRepositoryProvider);
    try {
      await repo.selfMfaDisable(code: code, backupCode: backupCode);
    } catch (e) {
      if (_staleFlagCodes.contains(authErrorCode(e))) await auth.resyncMfa();
      rethrow;
    }
    // A reason left over from an earlier "Turn on" attempt must not show up
    // again under the fresh "Turn on 2FA" button.
    reset();
    await auth.resyncMfa(enabled: false);
  }
}

final twoFactorSettingsProvider = AsyncNotifierProvider.autoDispose<
    TwoFactorSettingsNotifier, TwoFactorSetupStep>(
  TwoFactorSettingsNotifier.new,
);
