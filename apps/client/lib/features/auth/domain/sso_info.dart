/// Public SSO facts for the sign-in screens (`GET /auth/sso/info`).
class SsoInfo {
  final bool enabled;
  final String? loginUrl;
  final String buttonLabel;

  /// "Require SSO" is switched on for some email domains (contract 13 §C):
  /// the login screen emphasises the SSO button. No domain list is exposed.
  final bool enforced;

  /// "Sign in with Google" is configured on this deployment. Older servers
  /// do not send it: absent means on.
  final bool googleEnabled;

  const SsoInfo({
    required this.enabled,
    this.loginUrl,
    required this.buttonLabel,
    this.enforced = false,
    this.googleEnabled = true,
  });

  factory SsoInfo.fromJson(Map<String, dynamic> json) => SsoInfo(
        enabled: json['enabled'] == true,
        loginUrl: json['loginUrl'] as String?,
        buttonLabel: (json['buttonLabel'] as String?) ?? 'Sign in with SSO',
        enforced: json['enabled'] == true && json['enforced'] == true,
        googleEnabled: json['googleEnabled'] != false,
      );

  static const disabled = SsoInfo(enabled: false, buttonLabel: 'Sign in with SSO');
}
