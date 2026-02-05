import apiClient from './api.client';
import { Platform } from 'react-native';
import * as Device from 'expo-device';
import { storage } from './storage.service';

export const authService = {
  // Đăng nhập thường
  login: async (email, password) => {
    const response = await apiClient.post('/auth/login', { email, password });
    return response.data;
  },

  // Đăng ký
  register: async (email, password, displayName) => {
    const response = await apiClient.post('/auth/register', { email, password, displayName });
    return response.data;
  },

  // Đổi code lấy Token (Google/Facebook/X)
  exchangeCode: async (code) => {
    const response = await apiClient.post('/auth/exchange', {
      code,
      deviceId: Device.deviceName || 'Unknown Device',
      platform: Platform.OS,
    });
    return response.data;
  },

  // Forgot password flow
  forgotPassword: async (email) => {
    const response = await apiClient.post('/auth/forgot-password', { email });
    return response.data;
  },

  verifyOtp: async (email, otp) => {
    const response = await apiClient.post('/auth/verify-otp', { email, otp });
    return response.data;
  },

  resetPassword: async (email, otp, password) => {
    const response = await apiClient.post('/auth/reset-password', { email, otp, password });
    return response.data;
  },

  // ✅ FIX: Logout chỉ cần sid - userId lấy từ JWT token
  logout: async () => {
    const sid = await storage.getItem('sid');
    if (!sid) {
      console.warn('⚠️ Không có sid, skip logout API call');
      return;
    }

    const accessToken = await storage.getItem('accessToken');
    
    // Gửi header Authorization với Bearer token
    // Backend sẽ lấy userId từ JWT payload (req.user.sub)
    const config = accessToken
      ? { headers: { Authorization: `Bearer ${accessToken}` } }
      : undefined;

    await apiClient.post('/auth/logout', { sid }, config);
  },

  // Refresh token — lấy accessToken mới khi token hết hạn
  refresh: async () => {
    const sid = await storage.getItem('sid');
    const refreshToken = await storage.getItem('refreshToken');

    if (!sid || !refreshToken) {
      throw new Error('Không có session để refresh');
    }

    const response = await apiClient.post('/auth/refresh', { sid, refreshToken });
    return response.data;
  },
};