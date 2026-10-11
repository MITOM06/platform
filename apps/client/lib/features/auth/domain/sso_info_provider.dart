import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../data/auth_repository.dart';
import 'sso_info.dart';

/// The deployment's public sign-in options (`GET /auth/sso/info`) — SSO and
/// whether Google sign-in is on. Never fails: an unreachable server reads as
/// [SsoInfo.disabled] (Google shown, no SSO).
final ssoInfoProvider = FutureProvider.autoDispose<SsoInfo>(
    (ref) => ref.read(authRepositoryProvider).getSsoInfo());
