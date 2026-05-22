import 'package:dio/dio.dart';

String friendlyError(Object error) {
  if (error is DioException) {
    switch (error.type) {
      case DioExceptionType.connectionError:
      case DioExceptionType.connectionTimeout:
      case DioExceptionType.receiveTimeout:
        return 'Không có kết nối mạng, kiểm tra lại';
      case DioExceptionType.sendTimeout:
        return 'Kết nối quá chậm, thử lại';
      case DioExceptionType.badResponse:
        final code = error.response?.statusCode;
        if (code == 401) return 'Phiên đăng nhập hết hạn';
        if (code == 403) return 'Không có quyền thực hiện';
        if (code == 404) return 'Không tìm thấy dữ liệu';
        if (code == 409) return 'Dữ liệu đã tồn tại';
        if (code == 422) return 'Dữ liệu không hợp lệ';
        if (code != null && code >= 500) return 'Lỗi server, thử lại sau';
        return 'Yêu cầu thất bại (${code ?? 'unknown'})';
      case DioExceptionType.cancel:
        return 'Yêu cầu đã bị hủy';
      default:
        return 'Lỗi kết nối, thử lại';
    }
  }
  return 'Đã xảy ra lỗi, thử lại';
}

bool isNetworkError(Object error) {
  if (error is DioException) {
    return error.type == DioExceptionType.connectionError ||
        error.type == DioExceptionType.connectionTimeout ||
        error.type == DioExceptionType.receiveTimeout ||
        error.type == DioExceptionType.sendTimeout;
  }
  return false;
}
