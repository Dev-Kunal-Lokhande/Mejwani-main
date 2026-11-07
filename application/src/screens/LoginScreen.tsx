import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Utensils, Mail, Lock, Eye, EyeOff } from 'lucide-react-native';
import { useTheme } from '../theme';
import { useAuthContext } from '../context';
import { API_URL } from '../constants';

const LoginScreen: React.FC = () => {
  const { colors, spacing, isDark } = useTheme();
  const { login } = useAuthContext();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [focusedField, setFocusedField] = useState<'email' | 'password' | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleLogin = async () => {
    setErrorMessage(null);

    const trimmedEmail = email.trim();
    const trimmedPassword = password.trim();

    if (!trimmedEmail || !trimmedPassword) {
      setErrorMessage('Please enter both email and password.');
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch(`${API_URL}/staff/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: trimmedEmail,
          password: trimmedPassword,
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        await login(data.captain, data.token);
      } else {
        setErrorMessage(data.message || 'Invalid credentials. Please try again.');
      }
    } catch (err) {
      console.error('Login request failed:', err);
      setErrorMessage('Network error. Cannot reach server. Please check your connection.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={colors.background}
      />
      
      {/* Premium Decorative Background Blobs */}
      <View style={[styles.decorBlob1, { backgroundColor: colors.primary + '15' }]} />
      <View style={[styles.decorBlob2, { backgroundColor: colors.primary + '08' }]} />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView 
          contentContainerStyle={styles.scrollContainer} 
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={[styles.card, { backgroundColor: isDark ? colors.card : '#ffffff', borderColor: colors.border }]}>
            
            {/* Logo & Icon */}
            <View style={styles.logoContainer}>
              <View style={[styles.iconWrapper, { borderColor: colors.primary, backgroundColor: isDark ? '#261000' : '#fff0e6' }]}>
                <Utensils size={32} color={colors.primary} />
              </View>
              <Text style={[styles.brandName, { color: colors.text }]}>
                Mejwani
              </Text>
              <Text style={[styles.brandSub, { color: colors.primary }]}>
                CAPTAIN PORTAL
              </Text>
            </View>

            {/* Form */}
            <View style={styles.form}>
              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Email Address</Text>
              
              <View style={[
                styles.inputWrapper, 
                { 
                  borderColor: focusedField === 'email' ? colors.primary : colors.border,
                  backgroundColor: isDark ? '#1a1a1a' : '#f8fafc'
                }
              ]}>
                <Mail size={18} color={focusedField === 'email' ? colors.primary : colors.textMuted} style={styles.inputIcon} />
                <TextInput
                  style={[styles.input, { color: colors.text }]}
                  placeholder="captain@mejwani.com"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  value={email}
                  onChangeText={(text) => {
                    setEmail(text);
                    if (errorMessage) setErrorMessage(null);
                  }}
                  onFocus={() => setFocusedField('email')}
                  onBlur={() => setFocusedField(null)}
                  editable={!isLoading}
                />
              </View>

              <Text style={[styles.inputLabel, { color: colors.textSecondary, marginTop: spacing.md }]}>
                Password
              </Text>
              
              <View style={[
                styles.inputWrapper, 
                { 
                  borderColor: focusedField === 'password' ? colors.primary : colors.border,
                  backgroundColor: isDark ? '#1a1a1a' : '#f8fafc'
                }
              ]}>
                <Lock size={18} color={focusedField === 'password' ? colors.primary : colors.textMuted} style={styles.inputIcon} />
                <TextInput
                  style={[styles.input, { color: colors.text }]}
                  placeholder="••••••••"
                  placeholderTextColor={colors.textMuted}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  value={password}
                  onChangeText={(text) => {
                    setPassword(text);
                    if (errorMessage) setErrorMessage(null);
                  }}
                  onFocus={() => setFocusedField('password')}
                  onBlur={() => setFocusedField(null)}
                  editable={!isLoading}
                />
                <TouchableOpacity 
                  onPress={() => setShowPassword(!showPassword)}
                  style={styles.eyeButton}
                  activeOpacity={0.7}
                >
                  {showPassword ? (
                    <EyeOff size={18} color={colors.textMuted} />
                  ) : (
                    <Eye size={18} color={colors.textMuted} />
                  )}
                </TouchableOpacity>
              </View>

              {/* Error Message */}
              {errorMessage && (
                <View style={[styles.errorContainer, { backgroundColor: colors.danger + '10', borderColor: colors.danger + '30' }]}>
                  <Text style={[styles.errorText, { color: colors.danger }]}>{errorMessage}</Text>
                </View>
              )}

              {/* Submit Button */}
              <TouchableOpacity
                style={[
                  styles.button,
                  {
                    backgroundColor: colors.primary,
                    marginTop: errorMessage ? spacing.md : spacing.xl,
                  },
                ]}
                onPress={handleLogin}
                disabled={isLoading}
                activeOpacity={0.85}
              >
                {isLoading ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={styles.buttonText}>SIGN IN</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>

          {/* Footer */}
          <Text style={[styles.footerText, { color: colors.textMuted }]}>
            Mejwani POS Systems • v1.0.0
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: 'relative',
    overflow: 'hidden',
  },
  decorBlob1: {
    position: 'absolute',
    top: -100,
    right: -100,
    width: 300,
    height: 300,
    borderRadius: 150,
  },
  decorBlob2: {
    position: 'absolute',
    bottom: -150,
    left: -150,
    width: 350,
    height: 350,
    borderRadius: 175,
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 28,
    paddingVertical: 40,
    paddingHorizontal: 28,
    borderWidth: 1,
    shadowColor: '#ff6b00',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.05,
    shadowRadius: 20,
    elevation: 8,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 36,
  },
  iconWrapper: {
    width: 72,
    height: 72,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2.5,
    shadowColor: '#ff6b00',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 4,
  },
  brandName: {
    fontSize: 28,
    fontWeight: '900',
    marginTop: 16,
    letterSpacing: -0.5,
  },
  brandSub: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 3,
    marginTop: 6,
  },
  form: {
    width: '100%',
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: 14,
    height: 52,
    paddingHorizontal: 16,
    marginBottom: 4,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    height: '100%',
    fontSize: 14,
    fontWeight: '600',
    padding: 0,
  },
  eyeButton: {
    padding: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    padding: 12,
    borderRadius: 12,
    marginTop: 16,
    borderWidth: 1,
  },
  errorText: {
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  button: {
    height: 52,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#ff6b00',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 4,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  footerText: {
    fontSize: 11,
    fontWeight: '700',
    marginTop: 32,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
});

export default LoginScreen;
