// File: apps/client/src/screens/Auth/NewPasswordScreen.js

import React, { useState } from 'react';
import { 
  View, 
  Text, 
  ScrollView, 
  Alert, 
  KeyboardAvoidingView, 
  Platform 
} from 'react-native';
import CustomInput from '../../components/CustomInput';
import CustomButton from '../../components/CustomButton';
import { authService } from '../../services/auth.service';
import styles from '../../styles/AuthStyles';
import { Colors } from '../../theme';

const NewPasswordScreen = ({ route, navigation }) => {
  const { email, otp } = route.params || {};

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const onSubmitPressed = async () => {
    if (loading) return;

    if (!password || password.length < 8) {
      const msg = 'Mật khẩu mới phải có ít nhất 8 ký tự';
      Platform.OS === 'web' ? alert(msg) : Alert.alert('Lỗi', msg);
      return;
    }
    if (password !== confirmPassword) {
      const msg = 'Mật khẩu xác nhận không khớp';
      Platform.OS === 'web' ? alert(msg) : Alert.alert('Lỗi', msg);
      return;
    }

    setLoading(true);
    try {
      // ✅ Gọi API reset password
      await authService.resetPassword(email, otp, password);
      
      const successMsg = 'Mật khẩu của bạn đã được đặt lại. Vui lòng đăng nhập.';

      // ✅ FIX: Xử lý riêng cho Web để chuyển trang được
      if (Platform.OS === 'web') {
        alert('Thành công\n' + successMsg);
        // Trên web, sau khi bấm OK ở alert, dòng này sẽ chạy ngay
        navigation.reset({
          index: 0,
          routes: [{ name: 'Login' }],
        });
      } else {
        // Trên Mobile giữ nguyên Alert đẹp
        Alert.alert(
          'Thành công',
          successMsg,
          [
            { 
              text: 'Về trang Đăng nhập', 
              onPress: () => navigation.reset({
                index: 0,
                routes: [{ name: 'Login' }],
              }) 
            }
          ]
        );
      }
      
    } catch (error) {
      console.error(error);
      const msg = error.response?.data?.message || 'Có lỗi xảy ra, vui lòng thử lại';
      
      if (Platform.OS === 'web') {
        alert(msg);
      } else {
        Alert.alert('Lỗi', msg);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1 }}
    >
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContainer}>
        <View style={styles.root}>
          <Text style={styles.title}>Đặt lại mật khẩu</Text>
          <Text style={[styles.text, { marginBottom: 20, textAlign: 'center' }]}>
            Nhập mật khẩu mới cho tài khoản {email}
          </Text>

          <View style={styles.inputWrapper}>
            <CustomInput
              placeholder="Mật khẩu mới (tối thiểu 8 ký tự)"
              value={password}
              setValue={setPassword}
              secureTextEntry
            />
          </View>

          <View style={styles.inputWrapper}>
            <CustomInput
              placeholder="Xác nhận mật khẩu mới"
              value={confirmPassword}
              setValue={setConfirmPassword}
              secureTextEntry
            />
          </View>

          <CustomButton
            text={loading ? "Đang cập nhật..." : "Xác nhận"}
            onPress={onSubmitPressed}
            disabled={!!loading}
          />
          
          <CustomButton
            text="Hủy bỏ"
            onPress={() => navigation.navigate('Login')}
            type="TERTIARY"
            fgColor={Colors.error}
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

export default NewPasswordScreen;