import React, { createContext, useState, useEffect, useContext } from 'react';
import { storage } from '../services/storage.service';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { authService } from '../services/auth.service';
import { API_BASE_URL } from '../constants/Config';

const AuthContext = createContext({});

WebBrowser.maybeCompleteAuthSession();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // 1. Load user từ storage khi app mở
  useEffect(() => {
    const loadStorageData = async () => {
      try {
        const accessToken = await storage.getItem('accessToken');
        const userJson = await storage.getItem('user');

        if (accessToken && userJson) {
          setUser(JSON.parse(userJson));
        }
      } catch (e) {
        console.error('Lỗi load storage:', e);
      } finally {
        setIsLoading(false);
      }
    };
    loadStorageData();
  }, []);

  // 2. Social Login với error handling tốt hơn
  const signInWithSocial = async (provider) => {
    try {
      const redirectUrl = Linking.createURL('/');
      const authUrl = `${API_BASE_URL}/auth/social/${provider}/init?platform=mobile`;

      console.log('🔗 Opening OAuth URL:', authUrl);

      const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUrl);
      
      if (result.type === 'cancel' || result.type === 'dismiss') {
        console.log('User đã hủy đăng nhập');
        return { cancelled: true };
      }

      if (result.type === 'success') {
        const { url } = result;
        const params = new URL(url).searchParams;
        const code = params.get('code');

        if (!code) {
          throw new Error('Không nhận được mã xác thực từ server');
        }

        console.log('✅ Nhận được code:', code);

        // 5. Đổi code lấy token
        const data = await authService.exchangeCode(code);

        // ✅ IMPROVEMENT: Backend giờ trả về user info luôn
        await storage.setItem('accessToken', data.accessToken);
        await storage.setItem('refreshToken', data.refreshToken);
        await storage.setItem('sid', data.sid);
        
        // data.user có thể null nếu backend không tìm được user
        if (data.user) {
          await storage.setItem('user', JSON.stringify(data.user));
          setUser(data.user);
        } else {
          console.warn('⚠️ Backend không trả về user info');
        }

        return { success: true, user: data.user };
      }
    } catch (error) {
      console.error('❌ Social login error:', error);
      throw error;
    }
  };

  // 3. Đổi code lấy token (deprecated - giữ lại để tương thích)
  const handleExchangeCode = async (code) => {
    try {
      setIsLoading(true);
      const data = await authService.exchangeCode(code);

      await storage.setItem('accessToken', data.accessToken);
      await storage.setItem('refreshToken', data.refreshToken);
      await storage.setItem('sid', data.sid);
      
      if (data.user) {
        await storage.setItem('user', JSON.stringify(data.user));
        setUser(data.user);
      }
    } catch (error) {
      console.error('Exchange code lỗi:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  // 4. Login bằng email/password
  const signInWithEmail = async (email, password) => {
    try {
      setIsLoading(true);
      const data = await authService.login(email, password);

      await storage.setItem('accessToken', data.accessToken);
      await storage.setItem('refreshToken', data.refreshToken);
      await storage.setItem('sid', data.sid);
      await storage.setItem('user', JSON.stringify(data.user));

      setUser(data.user);
    } catch (error) {
      console.error('Login lỗi:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  // 5. Đăng xuất
  const signOut = async () => {
    try {
      // ✅ FIX: authService.logout() giờ không cần tham số
      // Nó sẽ tự lấy sid và accessToken từ storage
      await authService.logout();
    } catch (error) {
      console.error('Logout backend lỗi:', error);
      // Không throw error - vẫn clear storage local
    }

    // Clear storage
    await storage.removeItem('accessToken');
    await storage.removeItem('refreshToken');
    await storage.removeItem('sid');
    await storage.removeItem('user');

    setUser(null);
  };

  return (
    <AuthContext.Provider 
      value={{ 
        user, 
        isLoading, 
        setUser, 
        signInWithSocial, 
        signInWithEmail, 
        signOut,
        handleExchangeCode  // Deprecated but kept for compatibility
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);