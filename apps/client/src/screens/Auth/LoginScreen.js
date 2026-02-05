import React, { useState } from 'react';
import { 
  View, 
  Image, 
  useWindowDimensions, 
  ScrollView, 
  Alert, 
  Text, 
  KeyboardAvoidingView, 
  Platform 
} from 'react-native';
import CustomInput from '../../components/CustomInput';
import CustomButton from '../../components/CustomButton';
import { useAuth } from '../../context/AuthContext';
import { authService } from '../../services/auth.service';
import { storage } from '../../services/storage.service';
import Logo from '../../../assets/images/logo.png';
import styles from '../../styles/AuthStyles';
import { Colors } from '../../theme'; // ✅ Import thêm Colors để đồng bộ màu

const LoginScreen = ({ navigation }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState(null);
  const [errors, setErrors] = useState({});

  const { height } = useWindowDimensions();
  const { setUser, signInWithSocial } = useAuth();

  const validate = () => {
    let isValid = true;
    let newErrors = {};

    if (!username.trim()) {
      newErrors.username = 'Vui lòng nhập email hoặc số điện thoại';
      isValid = false;
    } else if (username.length < 5) {
      newErrors.username = 'Tài khoản quá ngắn';
      isValid = false;
    }

    if (!password) {
      newErrors.password = 'Vui lòng nhập mật khẩu';
      isValid = false;
    } else if (password.length < 8) {
      newErrors.password = 'Mật khẩu phải có ít nhất 8 ký tự';
      isValid = false;
    }

    setErrors(newErrors);
    return isValid;
  };

  const onSignInPressed = async () => {
    if (loading) return;
    if (!validate()) return;

    setLoading(true);
    setErrors({});

    try {
      const data = await authService.login(username, password);
      if (data.accessToken) {
        await storage.setItem('accessToken', data.accessToken);
        await storage.setItem('refreshToken', data.refreshToken);
        await storage.setItem('sid', data.sid);
        await storage.setItem('user', JSON.stringify(data.user));
        setUser(data.user);
      }
    } catch (error) {
      const status = error.response?.status;
      const message = error.response?.data?.message;

      if (status === 401) {
        setErrors({ general: 'Tài khoản hoặc mật khẩu không chính xác' });
      } else if (status === 404) {
        setErrors({ username: 'Tài khoản này chưa được đăng ký' });
      } else {
        setErrors({ general: message || 'Lỗi kết nối máy chủ. Vui lòng thử lại' });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSocialLogin = async (provider) => {
    if (socialLoading) return;
    setSocialLoading(provider);
    setErrors({});

    try {
      const result = await signInWithSocial(provider);
      if (result?.cancelled) return;
      if (result?.success) {
        // AuthContext handles state
      }
    } catch (error) {
      let errorMessage = 'Đăng nhập thất bại. Vui lòng thử lại.';
      if (error.message?.includes('mã xác thực')) errorMessage = 'Không nhận được mã xác thực từ server';
      Alert.alert('Đăng nhập thất bại', errorMessage, [{ text: 'OK' }]);
    } finally {
      setSocialLoading(null);
    }
  };

  const onForgotPasswordPressed = () => navigation.navigate('ForgotPassword');

  return (
    // ✅ UI UPDATE: Thêm KeyboardAvoidingView để bàn phím không che input
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1 }}
    >
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContainer}>
        <View style={styles.root}>
          {/* Logo giữ nguyên 25% chiều cao vì trang login ít field hơn register */}
          <Image 
            source={Logo} 
            style={[styles.logo, { height: height * 0.25 }]} 
            resizeMode="contain" 
          />

          <Text style={styles.title}>Đăng nhập PON</Text>

          {/* Hiển thị lỗi chung (sai pass, mất mạng...) */}
          {errors.general && (
            <Text style={[styles.errorTextCenter, { color: Colors.error, marginBottom: 10 }]}>
              {errors.general}
            </Text>
          )}

          {/* ✅ UI UPDATE: Dùng View bao ngoài giống RegisterScreen để căn lề chuẩn */}
          <View style={styles.inputWrapper}>
            <CustomInput
              placeholder="Email hoặc số điện thoại"
              value={username}
              setValue={(val) => { setUsername(val); setErrors({}); }}
              autoCapitalize="none" // Quan trọng: tắt tự viết hoa email
              keyboardType="email-address"
            />
            {errors.username && <Text style={styles.errorText}>{errors.username}</Text>}
          </View>

          <View style={styles.inputWrapper}>
            <CustomInput
              placeholder="Mật khẩu"
              value={password}
              setValue={(val) => { setPassword(val); setErrors({}); }}
              secureTextEntry
            />
            {errors.password && <Text style={styles.errorText}>{errors.password}</Text>}
          </View>

          <CustomButton 
            text={loading ? "Đang xử lý..." : "Đăng Nhập"} 
            onPress={onSignInPressed} 
            disabled={loading}
          />

          {/* Nút quên mật khẩu */}
          <CustomButton 
            text="Quên mật khẩu?" 
            onPress={onForgotPasswordPressed} 
            type="TERTIARY" 
            fgColor={Colors.textSub} // Màu xám nhẹ cho nút phụ
          />

          {/* Phần chia cắt Social Login */}
          <View style={styles.dividerContainer}>
            <View style={styles.line} />
            <Text style={styles.dividerText}>Hoặc đăng nhập với</Text>
            <View style={styles.line} />
          </View>

          {/* Các nút Social */}
          <CustomButton
            text={socialLoading === 'google' ? "Đang kết nối..." : "Google"}
            onPress={() => handleSocialLogin('google')}
            type="GOOGLE"
            disabled={socialLoading !== null}
          />

          <CustomButton
            text={socialLoading === 'facebook' ? "Đang kết nối..." : "Facebook"}
            onPress={() => handleSocialLogin('facebook')}
            type="FACEBOOK"
            disabled={socialLoading !== null}
          />

           {/* Nút X (Twitter) */}
           <CustomButton
            text={socialLoading === 'twitter' ? "Đang kết nối..." : "X (Twitter)"}
            onPress={() => handleSocialLogin('twitter')}
            type="TWITTER"
            disabled={socialLoading !== null}
          />
          <CustomButton
            text="Chưa có tài khoản? Đăng ký ngay"
            onPress={() => navigation.navigate('Register')}
            type="TERTIARY"
            fgColor={Colors.primary} 
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

export default LoginScreen;