import 'dart:convert';

import 'package:url_launcher/url_launcher.dart';
import '../../../../core/utils/media_url.dart';

/// Returns the first URL from an image message's [content], which may be either
/// a single URL string or a JSON array of URLs (collage). Used when an action
/// (download/copy) targets a single representative image.
String firstImageUrl(String content) {
  try {
    final decoded = jsonDecode(content);
    if (decoded is List && decoded.isNotEmpty) {
      return decoded.first.toString();
    }
  } catch (_) {}
  return content;
}

/// Opens the original media file externally (browser / system viewer) so the
/// user can view it at full resolution.
Future<void> openExternally(String rawUrl) async {
  final uri = Uri.parse(absoluteMediaUrl(rawUrl));
  await launchUrl(uri, mode: LaunchMode.externalApplication);
}

/// Opens the media file externally with a `download=true` hint so the browser
/// saves it rather than rendering it inline.
Future<void> downloadMedia(String rawUrl) async {
  final base = absoluteMediaUrl(rawUrl);
  final sep = base.contains('?') ? '&' : '?';
  final uri = Uri.parse('$base${sep}download=true');
  await launchUrl(uri, mode: LaunchMode.externalApplication);
}
