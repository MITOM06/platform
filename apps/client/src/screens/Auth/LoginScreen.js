import React from 'react';
import { View, Text, Button, StyleSheet } from 'react-native';

const LoginScreen = ({ navigation }) => {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Đây là màn hình Đăng Nhập</Text>
      <Button 
        title="Chuyển sang Đăng Ký" 
        onPress={() => navigation.navigate('Register')} 
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  text: { fontSize: 20, marginBottom: 20 }
});

export default LoginScreen;