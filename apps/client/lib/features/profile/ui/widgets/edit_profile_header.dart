import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import '../../../../core/api/dio_client.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../auth/domain/auth_state.dart';
import '../../../chat/ui/widgets/conversation_avatar.dart';

/// Cover-photo + avatar header shown at the top of the Edit Profile screen.
/// Extracted from edit_profile_screen.dart (clean-code file limit).
class EditProfileHeader extends StatelessWidget {
  final UserModel? user;
  final bool isLoading;
  final VoidCallback onTapCover;
  final VoidCallback onTapAvatar;

  const EditProfileHeader({
    super.key,
    required this.user,
    required this.isLoading,
    required this.onTapCover,
    required this.onTapAvatar,
  });

  @override
  Widget build(BuildContext context) {
    final user = this.user;
    // Cover uses the same 16:6 aspect ratio as the crop target (ImageCropper),
    // so what the user crops is exactly what shows here — no fixed height that
    // squashes the image. The overall box height is computed from the resulting
    // cover height plus the avatar overhang so the avatar is never clipped.
    return LayoutBuilder(
      builder: (context, constraints) {
        final coverWidth = constraints.maxWidth;
        final coverHeight = coverWidth * 6 / 16;
        // Avatar diameter incl. border = 96 + 4*2 = 104; it straddles the cover
        // bottom edge (32px overlap), so it extends 72px below the cover.
        return SizedBox(
          height: coverHeight + 72,
          child: Stack(
            children: [
              // Cover Photo
              Positioned(
                top: 0,
                left: 0,
                right: 0,
                child: GestureDetector(
                  onTap: isLoading ? null : onTapCover,
                  child: AspectRatio(
                    aspectRatio: 16 / 6,
                    child: Container(
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(12),
                        gradient: const LinearGradient(
                          colors: [AppTheme.ponCyan, AppTheme.ponPink],
                          begin: Alignment.topLeft,
                          end: Alignment.bottomRight,
                        ),
                      ),
                      child: Stack(
                        children: [
                          if (user?.coverPhoto != null &&
                              user!.coverPhoto!.isNotEmpty)
                            ClipRRect(
                              borderRadius: BorderRadius.circular(12),
                              child: CachedNetworkImage(
                                imageUrl: user.coverPhoto!.startsWith('http')
                                    ? user.coverPhoto!
                                    : '${DioClient.chatBaseUrl}${user.coverPhoto}',
                                width: double.infinity,
                                height: double.infinity,
                                fit: BoxFit.cover,
                              ),
                            ),
                          Container(
                            decoration: BoxDecoration(
                              borderRadius: BorderRadius.circular(12),
                              color: Colors.black.withValues(alpha: 0.25),
                            ),
                          ),
                          const Positioned(
                            top: 8,
                            right: 8,
                            child: CircleAvatar(
                              radius: 16,
                              backgroundColor: Colors.black54,
                              child: Icon(Icons.camera_alt_rounded,
                                  color: Colors.white, size: 16),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
              // Avatar
              Positioned(
                bottom: 0,
                left: 0,
                right: 0,
                child: Center(
                  child: Stack(
                    children: [
                      Container(
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          border: Border.all(
                              color: AppTheme.darkBackground, width: 4),
                        ),
                        child: ConversationAvatar(
                          avatarUrl: user?.avatarUrl,
                          fallbackLetter:
                              (user?.displayName.isNotEmpty ?? false)
                                  ? user!.displayName[0].toUpperCase()
                                  : '?',
                          size: 96,
                        ),
                      ),
                      Positioned(
                        right: 0,
                        bottom: 0,
                        child: GestureDetector(
                          onTap: isLoading ? null : onTapAvatar,
                          child: Container(
                            padding: const EdgeInsets.all(6),
                            decoration: const BoxDecoration(
                              color: AppTheme.ponCyan,
                              shape: BoxShape.circle,
                            ),
                            child: const Icon(Icons.camera_alt_rounded,
                                size: 18, color: Colors.white),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}
