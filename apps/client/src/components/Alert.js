import { Alert as RNAlert, Platform } from 'react-native';

/**
 * Custom Alert hoạt động trên cả Web và Mobile
 * - Mobile: Dùng native Alert
 * - Web: Dùng window.confirm
 */
export const Alert = {
  alert: (title, message, buttons = []) => {
    if (Platform.OS === 'web') {
      // ✅ Web: Dùng window.confirm hoặc custom modal
      const confirmMessage = message ? `${title}\n\n${message}` : title;
      
      if (buttons.length === 0) {
        // Simple alert
        window.alert(confirmMessage);
      } else if (buttons.length === 1) {
        // Single button alert
        window.alert(confirmMessage);
        if (buttons[0].onPress) buttons[0].onPress();
      } else {
        // Confirm dialog (2+ buttons)
        const confirmed = window.confirm(confirmMessage);
        
        // Tìm button destructive hoặc button cuối cùng
        const confirmButton = buttons.find(b => b.style === 'destructive') || buttons[buttons.length - 1];
        const cancelButton = buttons.find(b => b.style === 'cancel') || buttons[0];
        
        if (confirmed && confirmButton.onPress) {
          confirmButton.onPress();
        } else if (!confirmed && cancelButton.onPress) {
          cancelButton.onPress();
        }
      }
    } else {
      // ✅ Mobile: Dùng native Alert
      RNAlert.alert(title, message, buttons);
    }
  }
};