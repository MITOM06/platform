import 'package:flutter/material.dart';
import '../../domain/chat_state.dart';
import 'image_content.dart';

String formatBytes(int bytes) {
  if (bytes <= 0) return '';
  const units = ['B', 'KB', 'MB', 'GB'];
  var size = bytes.toDouble();
  var unit = 0;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit++;
  }
  final str = unit == 0 ? size.toStringAsFixed(0) : size.toStringAsFixed(1);
  return '$str ${units[unit]}';
}

IconData fileIcon(String name) {
  final ext = name.toLowerCase().split('.').last;
  switch (ext) {
    case 'pdf':
      return Icons.picture_as_pdf_outlined;
    case 'doc':
    case 'docx':
      return Icons.description_outlined;
    case 'xls':
    case 'xlsx':
    case 'csv':
      return Icons.table_chart_outlined;
    case 'ppt':
    case 'pptx':
      return Icons.slideshow_outlined;
    case 'zip':
    case 'rar':
    case '7z':
      return Icons.folder_zip_outlined;
    default:
      return Icons.insert_drive_file_outlined;
  }
}

class FileContent extends StatelessWidget {
  final MessageModel message;
  final bool isSentByMe;

  const FileContent({super.key, required this.message, required this.isSentByMe});

  @override
  Widget build(BuildContext context) {
    final sizeStr = formatBytes(message.fileSize);
    final onColor =
        isSentByMe ? Colors.white : Colors.white.withValues(alpha: 0.9);
    return GestureDetector(
      onTap: () => downloadMedia(message.fileUrl),
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 240),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: Colors.black.withValues(alpha: 0.25),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Icon(fileIcon(message.fileName), color: onColor, size: 26),
            ),
            const SizedBox(width: 10),
            Flexible(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    message.fileName,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      color: onColor,
                      fontSize: 13.5,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  if (sizeStr.isNotEmpty)
                    Padding(
                      padding: const EdgeInsets.only(top: 2),
                      child: Text(
                        sizeStr,
                        style: TextStyle(
                          color: onColor.withValues(alpha: 0.7),
                          fontSize: 11,
                        ),
                      ),
                    ),
                ],
              ),
            ),
            const SizedBox(width: 8),
            Icon(Icons.download_rounded, color: onColor, size: 20),
          ],
        ),
      ),
    );
  }
}
