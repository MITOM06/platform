import React, { useState } from 'react';
import { View, TextInput, Platform } from 'react-native';
import styles from '../styles/ComponentStyles';
import { Colors } from '../theme';

const CustomInput = ({ 
  value, 
  setValue, 
  placeholder, 
  secureTextEntry, 
  keyboardType = 'default',
  autoCapitalize = 'none'
}) => {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <View style={[
      styles.inputContainer,
      isFocused && styles.inputContainerFocused // Đổi style khi focus
    ]}>
      <TextInput
        value={value}
        onChangeText={setValue}
        placeholder={placeholder}
        placeholderTextColor={Colors.textSub}
        style={styles.input}
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        // Focus events
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
      />
    </View>
  );
};

export default CustomInput;