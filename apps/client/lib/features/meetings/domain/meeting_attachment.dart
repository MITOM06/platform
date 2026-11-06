// A file attached to a meeting chat line — mirror of web
// `lib/meetings/meeting-attachment.ts`. Pure: no Flutter, no I/O.

/// Only our own upload store is a valid attachment target.
const kUploadPrefix = '/api/uploads/';

class MeetingAttachment {
  const MeetingAttachment({
    required this.url,
    required this.name,
    required this.size,
    required this.contentType,
  });

  final String url;
  final String name;
  final int size;
  final String? contentType;

  /// What goes to the server: it takes size and type from the stored file.
  Map<String, Object?> toWire() => {'url': url, 'name': name};

  @override
  bool operator ==(Object other) =>
      other is MeetingAttachment &&
      other.url == url &&
      other.name == name &&
      other.size == size &&
      other.contentType == contentType;

  @override
  int get hashCode => Object.hash(url, name, size, contentType);
}

/// `attachment` off the wire (meet.chat frame or history row) → typed, or
/// null. Valid: url string under `/api/uploads/`, non-empty name; size a
/// number (else 0); contentType a string (else null). Anything else drops the
/// attachment, never the line.
MeetingAttachment? parseAttachment(Object? v) {
  if (v is! Map) return null;
  final url = v['url'];
  final name = v['name'];
  if (url is! String || !url.startsWith(kUploadPrefix)) return null;
  if (name is! String || name.isEmpty) return null;
  final size = v['size'];
  final type = v['contentType'];
  return MeetingAttachment(
      url: url,
      name: name,
      size: size is num && size.isFinite ? size.toInt() : 0,
      contentType: type is String ? type : null);
}
