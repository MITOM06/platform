// File: apps/client/src/screens/Auth/VerifyOtpScreen.js

import React, { useState, useEffect, useRef } from 'react';
import { 
  View, Text, StyleSheet, Alert, 
  TextInput, Pressable, Keyboard, 
  KeyboardAvoidingView, Platform 
} from 'react-native';
import CustomButton from '../../components/CustomButton';
import { authService } from '../../services/auth.service';
import { Colors } from '../../theme'; // Import màu từ theme của bạn
import styles from '../../styles/AuthStyles'; // Dùng chung style cơ bản

const VerifyOtpScreen = ({ route, navigation }) => {
  const email = route?.params?.email;
  const [otp, setOtp] = useState('');
  const [timer, setTimer] = useState(60);
  const [loading, setLoading] = useState(false);
  const [attemptsLeft, setAttemptsLeft] = useState(5);
  const [blocked, setBlocked] = useState(false);
  
  // Ref để điều khiển input ẩn
  const inputRef = useRef(null);

  // Auto focus khi vào màn hình
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Timer đếm ngược
  useEffect(() => {
    if (timer <= 0) return;
    const interval = setInterval(() => setTimer(prev => prev - 1), 1000);
    return () => clearInterval(interval);
  }, [timer]);

  // Xử lý xác thực
  const onVerifyPressed = async () => {
    if (blocked) return;
    if (otp.length < 6) {
      Alert.alert('Lỗi', 'Vui lòng nhập đủ 6 số OTP');
      return;
    }

    setLoading(true);
    try {
      // Gọi API kiểm tra OTP (để chắc chắn OTP đúng trước khi chuyển trang)
      await authService.verifyOtp(email, otp);
      
      // ✅ LOGIC CHUẨN: OTP đúng -> Chuyển sang trang đặt mật khẩu mới
      // Truyền kèm email và otp để trang sau dùng gọi API reset
      navigation.navigate('NewPassword', { email, otp });
      
    } catch (error) {
      const remaining = attemptsLeft - 1;
      setAttemptsLeft(remaining);

      if (remaining <= 0) {
        setBlocked(true);
        setOtp('');
        Alert.alert('Bị khóa', 'Bạn đã nhập sai quá 5 lần. Vui lòng gửi lại mã mới.');
      } else {
        setOtp(''); // Clear mã sai để nhập lại
        Alert.alert('Sai mã OTP', `Mã không đúng. Bạn còn ${remaining} lần thử.`);
      }
    } finally {
      setLoading(false);
    }
  };

  const onResendPressed = async () => {
    try {
      await authService.forgotPassword(email);
      setTimer(60);
      setAttemptsLeft(5);
      setBlocked(false);
      setOtp('');
      inputRef.current?.focus();
      Alert.alert('Đã gửi lại', 'Mã xác thực mới đã được gửi vào email.');
    } catch (e) {
      Alert.alert('Lỗi', 'Không thể gửi lại mã. Vui lòng thử lại sau.');
    }
  };

  // Render từng ô vuông nhập liệu
  const renderOtpBoxes = () => {
    const boxes = [];
    for (let i = 0; i < 6; i++) {
      const digit = otp[i] || '';
      const isFocused = i === otp.length;
      
      boxes.push(
        <View 
          key={i} 
          style={[
            localStyles.box,
            // Đổi màu viền nếu ô đó đang được active hoặc đã có số
            (isFocused || digit) && { borderColor: Colors.primary, borderWidth: 1.5 },
            // Nếu bị block thì viền đỏ
            blocked && { borderColor: Colors.error }
          ]}
        >
          <Text style={localStyles.boxText}>{digit}</Text>
        </View>
      );
    }
    return boxes;
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1, backgroundColor: Colors.white }}
    >
      <Pressable style={styles.root} onPress={Keyboard.dismiss}>
        <Text style={styles.title}>Xác thực OTP</Text>
        <Text style={styles.text}>
          Mã xác thực 6 số đã được gửi đến{'\n'}
          <Text style={{ fontWeight: 'bold', color: Colors.textHeader }}>{email}</Text>
        </Text>

        {/* CONTAINER CHỨA INPUT ẨN VÀ UI 6 Ô */}
        <View style={localStyles.inputContainer}>
          {/* Input thật (nhưng tàng hình) */}
          <TextInput
            ref={inputRef}
            value={otp}
            onChangeText={(text) => {
               // Chỉ cho nhập số và tối đa 6 ký tự
               if (!blocked) setOtp(text.replace(/[^0-9]/g, '').slice(0, 6));
            }}
            keyboardType="number-pad"
            style={localStyles.hiddenInput}
            caretHidden={true}
            autoFocus={true}
          />
          
          {/* Giao diện 6 ô vuông hiển thị đè lên */}
          <Pressable 
            style={localStyles.boxesContainer} 
            onPress={() => !blocked && inputRef.current?.focus()}
          >
            {renderOtpBoxes()}
          </Pressable>
        </View>

        {/* Phần Timer và Resend */}
        <View style={localStyles.timerContainer}>
           {blocked || timer <= 0 ? (
             <Pressable onPress={onResendPressed}>
                <Text style={[localStyles.resendText, { color: Colors.primary }]}>Gửi lại mã OTP</Text>
             </Pressable>
           ) : (
             <Text style={localStyles.resendText}>Gửi lại mã sau {timer}s</Text>
           )}
        </View>

        {/* Cảnh báo số lần thử */}
        {!blocked && attemptsLeft < 5 && (
           <Text style={{ color: Colors.error, marginTop: 10 }}>Còn {attemptsLeft} lần thử</Text>
        )}

        <View style={{ marginTop: 30, width: '100%' }}>
          <CustomButton
            text={loading ? 'Đang kiểm tra...' : 'Xác nhận'}
            onPress={onVerifyPressed}
            disabled={!!loading || blocked || otp.length < 6}
          />
        </View>

        <CustomButton
          text="Quay lại"
          onPress={() => navigation.goBack()}
          type="TERTIARY"
          fgColor={Colors.textSub}
        />
      </Pressable>
    </KeyboardAvoidingView>
  );
};

// Style riêng cho màn hình này
const localStyles = StyleSheet.create({
  inputContainer: {
    width: '100%',
    height: 60,
    marginTop: 30,
    marginBottom: 20,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative', // Quan trọng để xếp chồng
  },
  hiddenInput: {
    width: '100%',
    height: '100%',
    position: 'absolute',
    opacity: 0, // Tàng hình
    zIndex: 1,  // Nằm trên cùng để bắt sự kiện touch
  },
  boxesContainer: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
  },
  box: {
    width: 45,
    height: 55,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 12,
    backgroundColor: '#F9F9F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  boxText: {
    fontSize: 22,
    fontWeight: 'bold',
    color: Colors.textHeader,
  },
  timerContainer: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  resendText: {
    fontSize: 14,
    color: '#888',
    fontWeight: '500',
  }
});

export default VerifyOtpScreen;