import React from 'react';
import { View, NativeModules } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider, initialWindowMetrics } from 'react-native-safe-area-context';
import { AuthProvider, DataProvider, CartProvider, AlertProvider } from './src/context';
import { AppNavigator } from './src/navigation';

function App(): React.JSX.Element {
  React.useEffect(() => {
    const requestNotificationPermission = async () => {
      try {
        const hasNative = !!(
          NativeModules.NotifeeApiModule ||
          NativeModules.Notifee ||
          NativeModules.NotifeeNativeModule
        );
        if (!hasNative) {
          console.log('[App] Notifee native module not registered, skipping permission request');
          return;
        }
        const notifee = require('@notifee/react-native').default;
        await notifee.requestPermission();
      } catch (e) {
        console.warn('[App] Startup notification permission check skipped/failed:', e);
      }
    };
    requestNotificationPermission();
  }, []);

  return (
    <SafeAreaProvider initialMetrics={initialWindowMetrics} style={{ flex: 1 }}>
      <View style={{ flex: 1, backgroundColor: '#f5f7fa' }}>
        <AuthProvider>
          <AlertProvider>
            <DataProvider>
              <CartProvider>
                <NavigationContainer>
                  <AppNavigator />
                </NavigationContainer>
              </CartProvider>
            </DataProvider>
          </AlertProvider>
        </AuthProvider>
      </View>
    </SafeAreaProvider>
  );
}

export default App;
