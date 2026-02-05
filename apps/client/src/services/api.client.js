import axios from 'axios';
import { API_BASE_URL } from '../constants/Config';
import { storage } from './storage.service';
import { Platform } from 'react-native';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'ngrok-skip-browser-warning': 'true',
  },
});

// REQUEST INTERCEPTOR — merge log + gắn token vào 1
apiClient.interceptors.request.use(
  async (config) => {
    console.log('--- ĐANG GỌI API:', config.url);

    // ✅ Dùng storage service thay vì SecureStore trực tiếp — work trên cả web + native
    // ✅ Key đổi từ 'userToken' → 'accessToken' để đồng bộ với AuthContext
    const token = await storage.getItem('accessToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => Promise.reject(error),
);

// Flag để tránh gọi refresh nhiều lần cùng lúc
let isRefreshing = false;
// Queue các request bị 401 — sẽ retry sau khi refresh token thành công
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

// RESPONSE INTERCEPTOR — xử lý 401 bằng refresh token
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Nếu lỗi 401 VÀ chưa thử refresh lần nào cho request này
    if (error.response?.status === 401 && !originalRequest._retry) {
      // Nếu đang refresh rồi → push request này vào queue, đợi
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then((token) => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return apiClient(originalRequest);
        });
      }

      // Chưa refresh → bắt đầu refresh
      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const sid = await storage.getItem('sid');
        const refreshToken = await storage.getItem('refreshToken');

        // Gọi endpoint refresh — không dùng apiClient để tránh infinite loop
        const response = await axios.post(`${API_BASE_URL}/auth/refresh`, {
          sid,
          refreshToken,
        });

        const { accessToken: newAccessToken, refreshToken: newRefreshToken } = response.data;

        // Save token mới vào storage
        await storage.setItem('accessToken', newAccessToken);
        await storage.setItem('refreshToken', newRefreshToken);

        // Resolve queue — các request đang đợi sẽ retry với token mới
        processQueue(null, newAccessToken);

        // Retry request gốc với token mới
        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        return apiClient(originalRequest);
      } catch (refreshError) {
        // Refresh thất bại → xóa hết storage, user sẽ auto redirect về login
        processQueue(refreshError);

        await storage.removeItem('accessToken');
        await storage.removeItem('refreshToken');
        await storage.removeItem('sid');
        await storage.removeItem('user');

        console.warn('Refresh token hết hạn — đã đăng xuất');
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  },
);

export default apiClient;