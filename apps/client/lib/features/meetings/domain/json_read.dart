// Defensive readers for meeting payloads (REST + STOMP).
//
// Everything off the wire is `Object?` until it passes through one of these:
// a value of the wrong type becomes null — nothing here ever throws.

typedef Json = Map<String, dynamic>;

/// A JSON object, else null (lists and scalars are not objects).
Json? asJson(Object? v) => v is Map ? v.cast<String, dynamic>() : null;

/// A non-empty string, else null.
String? str(Object? v) => v is String && v.isNotEmpty ? v : null;

bool? boolOrNull(Object? v) => v is bool ? v : null;

int? intOrNull(Object? v) => v is int ? v : (v is num ? v.toInt() : null);

/// An ISO-8601 string as a UTC [DateTime], else null.
DateTime? dateOrNull(Object? v) =>
    v is String ? DateTime.tryParse(v)?.toUtc() : null;

/// Rows of a list; a broken row is dropped, never the whole list.
List<T> rowsOf<T>(Object? v, T? Function(Json row) parse) {
  if (v is! List) return const [];
  final out = <T>[];
  for (final raw in v) {
    final row = asJson(raw);
    if (row == null) continue;
    final parsed = parse(row);
    if (parsed != null) out.add(parsed);
  }
  return List.unmodifiable(out);
}

/// Only the string / number values of an object (`params` of an error).
Map<String, Object>? scalarParams(Object? v) {
  final o = asJson(v);
  if (o == null) return null;
  final out = <String, Object>{};
  o.forEach((k, val) {
    if (val is String || val is num) out[k] = val as Object;
  });
  return out.isEmpty ? null : Map.unmodifiable(out);
}
