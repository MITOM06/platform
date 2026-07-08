import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import '../../../../core/api/dio_client.dart';
import '../../../../core/theme/app_theme.dart';

/// A single centered info row (icon + value), used for role/DOB-style details
/// on the public profile screen. Extracted from user_profile_screen.dart
/// (clean-code file limit).
class ProfileCenteredInfoRow extends StatelessWidget {
  final IconData icon;
  final String value;
  const ProfileCenteredInfoRow({
    super.key,
    required this.icon,
    required this.value,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(top: 12),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(icon, size: 16, color: Colors.white60),
          const SizedBox(width: 6),
          Flexible(
            child: Text(
              value,
              textAlign: TextAlign.center,
              style: const TextStyle(color: Colors.white60, fontSize: 13.5),
            ),
          ),
        ],
      ),
    );
  }
}

/// Cover-photo banner shown at the top of the public profile screen.
/// Extracted from user_profile_screen.dart (clean-code file limit).
class ProfileCover extends StatelessWidget {
  final String? coverPhoto;
  const ProfileCover({super.key, this.coverPhoto});

  @override
  Widget build(BuildContext context) {
    final hasCover = coverPhoto != null && coverPhoto!.isNotEmpty;
    final url = hasCover && coverPhoto!.startsWith('http')
        ? coverPhoto!
        : (hasCover ? '${DioClient.chatBaseUrl}$coverPhoto' : null);
    return Container(
      height: 160,
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          colors: [AppTheme.ponCyan, AppTheme.ponPink],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
      ),
      child: url != null
          ? CachedNetworkImage(
              imageUrl: url,
              fit: BoxFit.cover,
              width: double.infinity,
              errorWidget: (_, __, ___) => const SizedBox.shrink(),
            )
          : null,
    );
  }
}
