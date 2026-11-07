import React, { createContext, useContext, useState, useCallback } from 'react';
import { Modal, StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { CheckCircle, AlertTriangle, Info, XCircle } from 'lucide-react-native';
import { useTheme } from '../theme';

export interface AlertButton {
  text: string;
  style?: 'default' | 'cancel' | 'destructive';
  onPress?: () => void | Promise<void>;
}

export interface AlertOptions {
  title: string;
  message?: string;
  buttons?: AlertButton[];
  type?: 'success' | 'error' | 'warning' | 'info' | 'confirm';
}

interface AlertContextType {
  showAlert: (options: AlertOptions) => void;
  hideAlert: () => void;
}

const AlertContext = createContext<AlertContextType | undefined>(undefined);

export const AlertProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { colors, isDark } = useTheme();
  const [visible, setVisible] = useState(false);
  const [options, setOptions] = useState<AlertOptions | null>(null);

  const showAlert = useCallback((opts: AlertOptions) => {
    setOptions(opts);
    setVisible(true);
  }, []);

  const hideAlert = useCallback(() => {
    setVisible(false);
  }, []);

  const handleButtonPress = (onPress?: () => void | Promise<void>) => {
    hideAlert();
    if (onPress) {
      // Delay call slightly to let the modal dismiss animation finish cleanly
      setTimeout(() => {
        onPress();
      }, 100);
    }
  };

  const getIcon = () => {
    if (!options) return null;
    const size = 48;
    switch (options.type) {
      case 'success':
        return <CheckCircle size={size} color={colors.success} style={styles.icon} />;
      case 'error':
        return <XCircle size={size} color={colors.danger} style={styles.icon} />;
      case 'warning':
        return <AlertTriangle size={size} color={colors.warning} style={styles.icon} />;
      case 'info':
        return <Info size={size} color={colors.info} style={styles.icon} />;
      case 'confirm':
        return <AlertTriangle size={size} color={colors.warning} style={styles.icon} />;
      default:
        return null;
    }
  };

  const renderButtons = () => {
    if (!options) return null;
    
    // Default to an OK button if no buttons are provided
    const buttons = options.buttons && options.buttons.length > 0 
      ? options.buttons 
      : [{ text: 'OK', onPress: () => {} }];

    const isHorizontal = buttons.length <= 2;

    return (
      <View style={[styles.buttonContainer, isHorizontal ? styles.buttonRow : styles.buttonColumn]}>
        {buttons.map((btn, index) => {
          const isDestructive = btn.style === 'destructive';
          const isCancel = btn.style === 'cancel';
          
          let btnStyle: any = styles.button;
          let textStyle: any = styles.buttonText;

          if (isDestructive) {
            btnStyle = [styles.button, { backgroundColor: colors.danger }];
            textStyle = [styles.buttonText, { color: '#ffffff' }];
          } else if (isCancel) {
            btnStyle = [styles.button, { backgroundColor: isDark ? '#262626' : '#f1f5f9', borderWidth: 1, borderColor: colors.border }];
            textStyle = [styles.buttonText, { color: colors.textSecondary }];
          } else {
            // Default/primary button style
            btnStyle = [styles.button, { backgroundColor: colors.primary }];
            textStyle = [styles.buttonText, { color: '#ffffff' }];
          }

          return (
            <TouchableOpacity
              key={index}
              style={[
                btnStyle,
                isHorizontal ? { flex: 1 } : { width: '100%', marginBottom: 8 }
              ]}
              onPress={() => handleButtonPress(btn.onPress)}
              activeOpacity={0.8}
            >
              <Text style={textStyle}>{btn.text}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    );
  };

  return (
    <AlertContext.Provider value={{ showAlert, hideAlert }}>
      {children}
      <Modal
        visible={visible}
        transparent
        animationType="fade"
        onRequestClose={hideAlert}
      >
        <View style={styles.overlay}>
          <View style={[styles.alertCard, { backgroundColor: isDark ? colors.card : '#ffffff', borderColor: colors.border }]}>
            {getIcon()}
            {options?.title ? (
              <Text style={[styles.title, { color: colors.text }]}>{options.title}</Text>
            ) : null}
            {options?.message ? (
              <Text style={[styles.message, { color: colors.textSecondary }]}>{options.message}</Text>
            ) : null}
            {renderButtons()}
          </View>
        </View>
      </Modal>
    </AlertContext.Provider>
  );
};

export const useAlert = () => {
  const context = useContext(AlertContext);
  if (context === undefined) {
    throw new Error('useAlert must be used within an AlertProvider');
  }
  return context;
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  alertCard: {
    width: '100%',
    maxWidth: 320,
    borderRadius: 24,
    borderWidth: 1.5,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  icon: {
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '900',
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: 0.2,
  },
  message: {
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 18,
  },
  buttonContainer: {
    width: '100%',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  buttonColumn: {
    flexDirection: 'column',
  },
  button: {
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonText: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
});
