import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ActivityIndicator, View } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { Colors } from '../theme'; 
import LoginScreen from '../screens/Auth/LoginScreen';
import RegisterScreen from '../screens/Auth/RegisterScreen';
import HomeScreen from '../screens/HomeScreen';
import ForgotPasswordScreen from '../screens/Auth/ForgotPasswordScreen';
import VerifyOtpScreen from '../screens/Auth/VerifyOtpScreen';
import NewPasswordScreen from '../screens/Auth/NewPasswordScreen';

const Stack = createNativeStackNavigator();

const AppNavigator = () => {
  const { user, isLoading } = useAuth();

  // ✅ Loading screen khi check auth
  if (isLoading) {
    return (
      <View style={{
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: Colors.background
      }}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          animation: 'slide_from_right', // ✅ Thêm animation mượt hơn
        }}
      >
        {user ? (
          // ✅ Authenticated Stack
          <Stack.Group>
            <Stack.Screen
              name="Home"
              component={HomeScreen}
              options={{
                gestureEnabled: false,
              }}
            />

            {/* Thêm các màn hình authenticated khác ở đây */}
          </Stack.Group>
        ) : (
          // ✅ Unauthenticated Stack
          <Stack.Group>
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="Register" component={RegisterScreen} />
            <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
            <Stack.Screen name="VerifyOtp" component={VerifyOtpScreen} />
            <Stack.Screen name="NewPassword" component={NewPasswordScreen} />
          </Stack.Group>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default AppNavigator;