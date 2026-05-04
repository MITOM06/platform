import React from 'react';
import { Text, Pressable, ActivityIndicator } from 'react-native';
import styles from '../styles/ComponentStyles';
import { Colors } from '../theme';

const CustomButton = ({ 
  onPress, 
  text, 
  type = "PRIMARY", 
  bgColor, 
  fgColor, 
  disabled = false,
  loading = false,
}) => {
  return (
    <Pressable
      onPress={(disabled || !!loading) ? undefined : onPress}
      style={[
        styles.container,
        styles[`container_${type}`],
        bgColor ? { backgroundColor: bgColor } : {},
        (disabled || loading) && styles.containerDisabled
      ]}
      disabled={disabled || !!loading}
    >
      {loading ? (
        <ActivityIndicator size="small" color={fgColor || (type === "PRIMARY" ? "white" : Colors.primary)} />
      ) : (
        <Text
          style={[
            styles.text,
            styles[`text_${type}`],
            fgColor ? { color: fgColor } : {},
            disabled && styles.textDisabled
          ]}
        >
          {text}
        </Text>
      )}
    </Pressable>
  );
};

export default CustomButton;