import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuthContext } from '../context';
import { LoginScreen, DashboardScreen, MenuScreen, CartScreen, CompletedOrdersScreen } from '../screens';

export type RootStackParamList = {
  Login: undefined;
  Dashboard: undefined;
  Menu: { tableId: number; tableName: string; sectionName: string; activeOrderId?: number | null };
  Cart: { tableId: number; tableName: string; sectionName: string; activeOrderId?: number | null };
  CompletedOrders: undefined;
};
import { View, ActivityIndicator } from 'react-native';

const Stack = createNativeStackNavigator<RootStackParamList>();

export const AppNavigator: React.FC = () => {
  const { isAuthenticated, isLoading } = useAuthContext();

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f5f7fa' }}>
        <ActivityIndicator size="large" color="#ff6b00" />
      </View>
    );
  }

  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: '#f5f7fa' },
      }}
    >
      {!isAuthenticated ? (
        <Stack.Screen name="Login" component={LoginScreen} />
      ) : (
        <>
          <Stack.Screen name="Dashboard" component={DashboardScreen} />
          <Stack.Screen name="Menu" component={MenuScreen} />
          <Stack.Screen name="Cart" component={CartScreen} />
          <Stack.Screen name="CompletedOrders" component={CompletedOrdersScreen} />
        </>
      )}
    </Stack.Navigator>
  );
};
