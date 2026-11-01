import 'package:flutter/material.dart';

/// Confirmation shown in the password card after a successful change (mirror
/// of the `role="status"` panel on web `/settings/security`). It stays until
/// the form is touched again: a top banner faded before people noticed it, and
/// the emptied form then looked as if nothing had happened.
class PasswordChangedNotice extends StatelessWidget {
  final String title;
  final String body;
  const PasswordChangedNotice({
    super.key,
    required this.title,
    required this.body,
  });

  @override
  Widget build(BuildContext context) {
    const green = Colors.green;
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Semantics(
      liveRegion: true,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        decoration: BoxDecoration(
          color: green.withValues(alpha: isDark ? 0.12 : 0.1),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: green.withValues(alpha: 0.3)),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Icon(Icons.check_circle_rounded, color: green, size: 20),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: const TextStyle(
                      color: green,
                      fontWeight: FontWeight.w600,
                      fontSize: 14,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    body,
                    style: TextStyle(
                      color: green.withValues(alpha: 0.85),
                      fontSize: 12,
                      height: 1.3,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
