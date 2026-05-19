import React, { useState } from 'react';
import { 
  View, 
  Text, 
  ScrollView, 
  Alert, 
  KeyboardAvoidingView, 
  Platform // Quan trọng để check web
} from 'react-native';
import CustomInput from '../../components/CustomInput';
import CustomButton from '../../components/CustomButton';
import { authService } from '../../services/auth.service';
import styles from '../../styles/AuthStyles';
import { Colors } from '../../theme';

const ForgotPasswordScreen = ({ navigation }) => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  const onSendPressed = async () => {
    if (loading) return;
    
    if (!email.trim()) {
      // Logic Alert cho Web và Mobile khác nhau
      if (Platform.OS === 'web') {
        alert("Vui lòng nhập email");
      } else {
        Alert.alert("Lỗi", "Vui lòng nhập email");
      }
      return;
    }

    setLoading(true);
    try {
      await authService.forgotPassword(email);
      
      const successTitle = "Đã gửi mã OTP";
      const successMsg = `Mã xác thực đã được gửi tới ${email}. Vui lòng kiểm tra hộp thư.`;

      // ✅ FIX: Xử lý riêng cho Web
      if (Platform.OS === 'web') {
        // Trên web, window.alert sẽ chặn màn hình lại, bấm OK xong dòng dưới mới chạy
        alert(`${successTitle}\n${successMsg}`);
        navigation.navigate('VerifyOtp', { email });
      } else {
        // Trên Mobile, dùng Alert xịn xò
        Alert.alert(
          successTitle, 
          successMsg,
          [
            { 
              text: "Nhập mã OTP", 
              onPress: () => navigation.navigate('VerifyOtp', { email }) 
            }
          ]
        );
      }

    } catch (error) {
      const errorMessage = error.response?.data?.message || error.message || "Không thể gửi mã OTP";
      
      if (Platform.OS === 'web') {
        alert(errorMessage);
      } else {
        Alert.alert("Lỗi", errorMessage);
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
          <Text style={styles.title}>Quên mật khẩu</Text>
          
          <Text style={[styles.text, { textAlign: 'center', marginBottom: 30, color: Colors.textSub }]}>
            Nhập email đã đăng ký tài khoản của bạn. Chúng tôi sẽ gửi mã xác thực để đặt lại mật khẩu.
          </Text>
          
          <View style={styles.inputWrapper}>
            <CustomInput 
              placeholder="Email của bạn" 
              value={email} 
              setValue={setEmail} 
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>
          
          <CustomButton 
            text={loading ? "Đang gửi..." : "Gửi mã xác nhận"} 
            onPress={onSendPressed} 
            disabled={!!loading}
          />
          
          <CustomButton 
            text="Quay lại đăng nhập" 
            onPress={() => navigation.navigate('Login')} 
            type="TERTIARY" 
            fgColor={Colors.textSub}
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

export default ForgotPasswordScreen;