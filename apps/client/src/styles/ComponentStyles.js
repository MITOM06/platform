import { StyleSheet, Platform } from 'react-native';
import { Colors, Spacing } from '../theme';

const styles = StyleSheet.create({
  // === BUTTON STYLES ===
  container: {
    width: '100%',
    padding: Spacing.buttonPadding,
    marginVertical: 5,
    alignItems: 'center',
    borderRadius: Spacing.borderRadius,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  
  // Button Types
  container_PRIMARY: {
    backgroundColor: Colors.primary,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 5,
  },
  container_SECONDARY: {
    backgroundColor: Colors.secondary,
  },
  container_TERTIARY: {
    backgroundColor: 'transparent',
    padding: Spacing.s,
    elevation: 0,
    shadowOpacity: 0,
  },
  container_GOOGLE: {
    backgroundColor: Colors.google,
  },
  container_FACEBOOK: {
    backgroundColor: Colors.facebook,
  },
  container_TWITTER: {
    backgroundColor: Colors.twitter,
  },

  // Button States
  containerDisabled: {
    backgroundColor: Colors.border,
    opacity: 0.7,
    elevation: 0,
  },

  // Text Styles
  text: {
    fontWeight: 'bold',
    fontSize: 16,
    color: Colors.white,
  },
  text_PRIMARY: { color: Colors.white },
  text_SECONDARY: { color: Colors.white },
  text_TERTIARY: { color: Colors.textSub, fontSize: 14 },
  text_GOOGLE: { color: Colors.googleText },
  text_FACEBOOK: { color: Colors.facebookText },
  text_TWITTER: { color: Colors.textHeader }, // Màu đậm cho dễ đọc

  // === INPUT STYLES ===
  inputContainer: {
    backgroundColor: Colors.white,
    width: '100%',
    borderColor: Colors.border,
    borderWidth: 1,
    borderRadius: Spacing.borderRadius,
    paddingHorizontal: Spacing.m,
    paddingVertical: Spacing.inputPadding,
    marginVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  inputContainerFocused: {
    borderColor: Colors.borderFocus,
    borderWidth: 1.5,
    backgroundColor: '#F9F9FF', // Nền hơi xanh nhẹ khi focus
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: Colors.textHeader,
    ...(Platform.OS === 'web' ? { outlineStyle: 'none' } : {}),
  },
});

export default styles;