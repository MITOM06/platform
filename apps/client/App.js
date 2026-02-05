import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AppNavigator from './src/navigation/AppNavigator';
import { AuthProvider } from './src/context/AuthContext'; 
export default function App() {
  return (
    <AuthProvider> 
      <SafeAreaProvider>
        <AppNavigator />
      </SafeAreaProvider>
    </AuthProvider>
  );
}