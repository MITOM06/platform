import 'package:url_launcher/url_launcher.dart';
import '../../../../core/utils/media_url.dart';

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
