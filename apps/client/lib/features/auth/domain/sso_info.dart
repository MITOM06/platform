class SsoInfo {
  final bool enabled;
  final String? loginUrl;
  final String buttonLabel;

  const SsoInfo({
    required this.enabled,
    this.loginUrl,
    required this.buttonLabel,
  });

  factory SsoInfo.fromJson(Map<String, dynamic> json) => SsoInfo(
        enabled: json['enabled'] == true,
        loginUrl: json['loginUrl'] as String?,
        buttonLabel: (json['buttonLabel'] as String?) ?? 'Sign in with SSO',
      );

  static const disabled = SsoInfo(enabled: false, buttonLabel: 'Sign in with SSO');
}
