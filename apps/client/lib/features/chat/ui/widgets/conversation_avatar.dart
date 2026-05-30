import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import '../../../../core/api/dio_client.dart';
import '../../../../core/theme/app_theme.dart';

/// Circular avatar for a conversation or user. Shows a remote image when
/// [avatarUrl] is set, otherwise a group icon (groups) or initial letter.
class ConversationAvatar extends StatelessWidget {
  final String? avatarUrl;
  final String fallbackLetter;
  final bool isGroup;
  final double size;
  final bool online;
  final List<Color>? gradientColors;

  const ConversationAvatar({
    super.key,
    this.avatarUrl,
    this.fallbackLetter = '?',
    this.isGroup = false,
    this.size = 48,
    this.online = false,
    this.gradientColors,
  });

  @override
  Widget build(BuildContext context) {
    final colors = gradientColors ??
        const [AppTheme.neonCyan, AppTheme.neonPurple];
    final hasImage = avatarUrl != null && avatarUrl!.isNotEmpty;

    Widget inner;
    if (hasImage) {
      inner = ClipOval(
        child: CachedNetworkImage(
          imageUrl: _absoluteUrl(avatarUrl!),
          width: size,
          height: size,
          fit: BoxFit.cover,
          placeholder: (_, __) => _LetterCircle(letter: fallbackLetter, size: size),
          errorWidget: (_, __, ___) =>
              _LetterCircle(letter: fallbackLetter, size: size),
        ),
      );
    } else if (isGroup) {
      inner = Icon(Icons.groups_rounded, color: Colors.white, size: size * 0.5);
    } else {
      inner = Text(
        fallbackLetter,
        style: TextStyle(
          color: Colors.white,
          fontWeight: FontWeight.bold,
          fontSize: size * 0.36,
        ),
      );
    }

    return Stack(
      children: [
        Container(
          width: size,
          height: size,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            gradient: hasImage
                ? null
                : LinearGradient(
                    colors: colors,
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
          ),
          child: inner,
        ),
        if (online)
          Positioned(
            right: 0,
            bottom: 0,
            child: Container(
              width: size * 0.26,
              height: size * 0.26,
              decoration: BoxDecoration(
                color: AppTheme.onlineGreen,
                shape: BoxShape.circle,
                border: Border.all(color: AppTheme.obsidianBackground, width: 2),
              ),
            ),
          ),
      ],
    );
  }

  /// GridFS upload URLs are returned relative to the chat-service root.
  String _absoluteUrl(String url) {
    if (url.startsWith('http')) return url;
    return '${DioClient.chatBaseUrl}$url';
  }
}

class _LetterCircle extends StatelessWidget {
  final String letter;
  final double size;
  const _LetterCircle({required this.letter, required this.size});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size,
      height: size,
      alignment: Alignment.center,
      color: AppTheme.darkSurface,
      child: Text(
        letter,
        style: TextStyle(
          color: Colors.white,
          fontWeight: FontWeight.bold,
          fontSize: size * 0.36,
        ),
      ),
    );
  }
}
