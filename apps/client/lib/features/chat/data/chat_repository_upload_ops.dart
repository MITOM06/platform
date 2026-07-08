part of 'chat_repository.dart';

/// File/media upload operations and MIME-type resolution.
mixin ChatRepositoryUploadOps {
  Dio get _dio;

  Future<String> uploadFile(XFile file) async {
    // Đọc bytes thay vì fromFile(path) để hoạt động trên cả web (blob URL,
    // không có filesystem) lẫn mobile, hỗ trợ ảnh lẫn video.
    final bytes = await file.readAsBytes();
    final filename = file.name;
    final formData = FormData.fromMap({
      'file': MultipartFile.fromBytes(
        bytes,
        filename: filename,
        contentType: _mediaMediaType(filename),
      ),
    });
    final response = await _dio.post('/api/uploads', data: formData);
    final data = response.data as Map<String, dynamic>;
    return data['url'] as String;
  }

  /// Upload a generic document (PDF / DOC / ZIP …). Returns the stored url plus
  /// filename and size so the caller can build a "file card" message.
  Future<({String url, String name, int size})> uploadDocument(
    List<int> bytes,
    String filename,
  ) async {
    final formData = FormData.fromMap({
      'file': MultipartFile.fromBytes(bytes, filename: filename),
    });
    final response = await _dio.post('/api/uploads', data: formData);
    final data = response.data as Map<String, dynamic>;
    final returnedName = data['filename'] as String?;
    return (
      url: data['url'] as String,
      name: (returnedName != null && returnedName.isNotEmpty)
          ? returnedName
          : filename,
      size: int.tryParse(data['size']?.toString() ?? '') ?? bytes.length,
    );
  }

  DioMediaType? _mediaMediaType(String filename) {
    final ext = filename.toLowerCase().split('.').last;
    switch (ext) {
      // Ảnh
      case 'png':
        return DioMediaType('image', 'png');
      case 'jpg':
      case 'jpeg':
        return DioMediaType('image', 'jpeg');
      case 'gif':
        return DioMediaType('image', 'gif');
      case 'webp':
        return DioMediaType('image', 'webp');
      case 'bmp':
        return DioMediaType('image', 'bmp');
      case 'heic':
        return DioMediaType('image', 'heic');
      case 'heif':
        return DioMediaType('image', 'heif');
      // Video
      case 'mp4':
        return DioMediaType('video', 'mp4');
      case 'mov':
        return DioMediaType('video', 'quicktime');
      case 'webm':
        return DioMediaType('video', 'webm');
      case 'mkv':
        return DioMediaType('video', 'x-matroska');
      case 'avi':
        return DioMediaType('video', 'x-msvideo');
      case 'm4v':
        return DioMediaType('video', 'x-m4v');
      case '3gp':
        return DioMediaType('video', '3gpp');
      default:
        return null;
    }
  }
}
