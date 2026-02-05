// File: apps/client/src/screens/Auth/RegisterScreen.js
import React, { useState } from 'react';
import { View, Text, ScrollView, Alert, Image, useWindowDimensions, KeyboardAvoidingView, Platform } from 'react-native';
import CustomInput from '../../components/CustomInput';
import CustomButton from '../../components/CustomButton';
import { authService } from '../../services/auth.service';
import { useAuth } from '../../context/AuthContext';
import styles from '../../styles/AuthStyles';
import { Colors } from '../../theme';
import Logo from '../../../assets/images/logo.png';
import { storage } from '../../services/storage.service';

const RegisterScreen = ({ navigation }) => {
  // ✅ FIX: Thêm state displayName
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');  // ✅ Đổi tên từ emailOrPhone → email
  const [password, setPassword] = useState('');
  const [passwordRepeat, setPasswordRepeat] = useState('');
  const [loading, setLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState(null);
  const { signInWithSocial, setUser } = useAuth();
  const { height } = useWindowDimensions();

  // ✅ FIX: Email validation helper
  const isValidEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const onRegisterPressed = async () => {
    if (loading) return;

    try {
      // BƯỚC 1: Gọi API Đăng ký
      await authService.register(email, password, displayName);

      // BƯỚC 2: (MỚI) Tự động gọi API Đăng nhập luôn
      // Thay vì hiện Alert, ta đăng nhập luôn cho người dùng đỡ mất công
      const loginData = await authService.login(email, password);

      // BƯỚC 3: (MỚI) Lưu Token (Giống hệt bên LoginScreen)
      if (loginData.accessToken) {
        await storage.setItem('accessToken', loginData.accessToken);
        await storage.setItem('refreshToken', loginData.refreshToken);
        await storage.setItem('sid', loginData.sid);
        await storage.setItem('user', JSON.stringify(loginData.user));

        // BƯỚC 4: (QUAN TRỌNG NHẤT) Cập nhật Context để App chuyển sang Home
        setUser(loginData.user);

        // Không cần Alert hay navigate nữa, Context sẽ tự điều hướng
      }

    } catch (error) {
      console.error('Register/Login error:', error);

      const errorMessage = error.response?.data?.message || error.message || "Có lỗi xảy ra";

      // Xử lý lỗi
      if (error.response?.status === 409 || errorMessage.includes('tồn tại')) {
        Alert.alert("Đăng ký thất bại", "Email này đã được sử dụng.");
      } else {
        Alert.alert("Lỗi", errorMessage);
      }
    } finally {
      setLoading(false);
    }
    // ✅ FIX: Validation đầy đủ
    if (!displayName.trim()) {
      Alert.alert("Lỗi", "Vui lòng nhập tên hiển thị");
      return;
    }
    if (displayName.length < 2) {
      Alert.alert("Lỗi", "Tên hiển thị phải có ít nhất 2 ký tự");
      return;
    }
    if (!email.trim()) {
      Alert.alert("Lỗi", "Vui lòng nhập email");
      return;
    }
    if (!isValidEmail(email)) {
      Alert.alert("Lỗi", "Email không đúng định dạng");
      return;
    }
    if (!password) {
      Alert.alert("Lỗi", "Vui lòng nhập mật khẩu");
      return;
    }
    // ✅ FIX: Đổi từ 6 → 8 ký tự để khớp với backend
    if (password.length < 8) {
      Alert.alert("Lỗi", "Mật khẩu phải có ít nhất 8 ký tự");
      return;
    }
    if (!passwordRepeat) {
      Alert.alert("Lỗi", "Vui lòng xác nhận mật khẩu");
      return;
    }
    if (password !== passwordRepeat) {
      Alert.alert("Lỗi", "Mật khẩu xác nhận không khớp");
      return;
    }

    setLoading(true);
    try {
      // ✅ FIX: Gọi đúng thứ tự tham số
      await authService.register(email, password, displayName);

      Alert.alert(
        "Thành công",
        "Tài khoản của bạn đã được tạo!",
        [{ text: "Đăng nhập ngay", onPress: () => navigation.navigate('Login') }]
      );
    } catch (error) {
      console.error('Register error:', error);

      // Parse error message từ backend
      const errorMessage = error.response?.data?.message || error.message || "Có lỗi xảy ra";

      // Xử lý các lỗi phổ biến
      if (errorMessage.includes('Email này đã được sử dụng')) {
        Alert.alert("Đăng ký thất bại", "Email này đã được đăng ký. Vui lòng sử dụng email khác hoặc đăng nhập.");
      } else if (errorMessage.includes('validation')) {
        Alert.alert("Thông tin không hợp lệ", errorMessage);
      } else {
        Alert.alert("Đăng ký thất bại", errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSocialRegister = async (provider) => {
    if (socialLoading) return;
    setSocialLoading(provider);
    try {
      const result = await signInWithSocial(provider);
      if (result?.success) {
        // Navigation handled by AuthContext
      }
    } catch (error) {
      Alert.alert("Lỗi", "Kết nối mạng xã hội thất bại");
    } finally {
      setSocialLoading(null);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1 }}
    >
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContainer}>
        <View style={styles.root}>
          <Image
            source={Logo}
            style={[styles.logo, { height: height * 0.15 }]}
            resizeMode="contain"
          />

          <Text style={styles.title}>Tạo tài khoản</Text>

          {/* ✅ FIX: Thêm input Tên hiển thị */}
          <View style={styles.inputWrapper}>
            <CustomInput
              placeholder="Tên hiển thị"
              value={displayName}
              setValue={setDisplayName}
              autoCapitalize="words"
            />
          </View>

          {/* ✅ FIX: Đổi placeholder và variable name */}
          <View style={styles.inputWrapper}>
            <CustomInput
              placeholder="Email"
              value={email}
              setValue={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>

          <View style={styles.inputWrapper}>
            <CustomInput
              placeholder="Mật khẩu (tối thiểu 8 ký tự)"
              value={password}
              setValue={setPassword}
              secureTextEntry
            />
          </View>

          <View style={styles.inputWrapper}>
            <CustomInput
              placeholder="Xác nhận mật khẩu"
              value={passwordRepeat}
              setValue={setPasswordRepeat}
              secureTextEntry
            />
          </View>

          <CustomButton
            text={loading ? "Đang xử lý..." : "Đăng Ký"}
            onPress={onRegisterPressed}
            disabled={loading}
          />

          <Text style={styles.text}>
            Bằng cách đăng ký, bạn đồng ý với {' '}
            <Text style={styles.link} onPress={() => console.warn('Terms')}>
              Điều khoản sử dụng
            </Text>
          </Text>

          <View style={styles.dividerContainer}>
            <View style={styles.line} />
            <Text style={styles.dividerText}>Hoặc đăng ký bằng</Text>
            <View style={styles.line} />
          </View>

          <CustomButton
            text={socialLoading === 'google' ? "Đang kết nối..." : "Tiếp tục với Google"}
            onPress={() => handleSocialRegister('google')}
            type="GOOGLE"
            disabled={socialLoading !== null}
          />

          <CustomButton
            text={socialLoading === 'facebook' ? "Đang kết nối..." : "Tiếp tục với Facebook"}
            onPress={() => handleSocialRegister('facebook')}
            type="FACEBOOK"
            disabled={socialLoading !== null}
          />

          <CustomButton
            text={socialLoading === 'twitter' ? "Đang kết nối..." : "Tiếp tục với X"}
            onPress={() => handleSocialRegister('twitter')}
            type="TWITTER"
            disabled={socialLoading !== null}
          />

          <CustomButton
            text="Đã có tài khoản? Đăng nhập"
            onPress={() => navigation.navigate('Login')}
            type="TERTIARY"
            fgColor={Colors.primary}
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

export default RegisterScreen;