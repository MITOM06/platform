import 'package:flutter/material.dart';

/// Brand logos by provider/icon id — the same official favicon URLs as web
/// `DIRECTORY_LOGO_URLS` (components/integrations/DirectoryCard.tsx). Keep the
/// two lists in sync.
const providerLogoUrls = <String, String>{
  'notion': 'https://www.notion.so/front-static/favicon.ico',
  'linear': 'https://linear.app/favicon.ico',
  'sentry': 'https://sentry.io/favicon.ico',
  'atlassian': 'https://atlassian.com/favicon.ico',
  'github': 'https://github.com/favicon.ico',
  'stripe': 'https://stripe.com/favicon.ico',
  'huggingface': 'https://huggingface.co/favicon.ico',
  'asana': 'https://asana.com/favicon.ico',
  'gmail': 'https://ssl.gstatic.com/ui/v1/icons/mail/rfr/gmail.ico',
  'calendar':
      'https://calendar.google.com/googlecalendar/images/favicon_v2018_256.png',
  'drive':
      'https://ssl.gstatic.com/images/branding/product/1x/drive_2020q4_32dp.png',
};

/// A provider's brand logo, or its monogram ([name]'s first letter) when there
/// is no known logo or it fails to load.
class ProviderLogo extends StatelessWidget {
  final String icon;
  final String name;
  final Color monogramColor;
  final double size;

  const ProviderLogo({
    super.key,
    required this.icon,
    required this.name,
    required this.monogramColor,
    this.size = 26,
  });

  @override
  Widget build(BuildContext context) {
    final url = providerLogoUrls[icon.toLowerCase()];
    if (url == null) return _monogram();
    return Image.network(
      url,
      width: size,
      height: size,
      fit: BoxFit.contain,
      errorBuilder: (_, __, ___) => _monogram(),
    );
  }

  Widget _monogram() => Text(
        name.isNotEmpty ? name[0].toUpperCase() : '?',
        style: TextStyle(
          color: monogramColor,
          fontSize: 18,
          fontWeight: FontWeight.w600,
        ),
      );
}
