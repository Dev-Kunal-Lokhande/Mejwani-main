import React, { createContext, useState, useContext, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Captain } from '../types';

interface AuthContextType {
  captain: Captain | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (captainData: Captain, token: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [captain, setCaptain] = useState<Captain | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    // Load persisted authentication state on startup
    const loadPersistedState = async () => {
      try {
        const storedCaptain = await AsyncStorage.getItem('mejwani_captain_user');
        const storedToken = await AsyncStorage.getItem('mejwani_captain_jwt');
        if (storedCaptain && storedToken) {
          setCaptain(JSON.parse(storedCaptain));
          setToken(storedToken);
        }
      } catch (err) {
        console.error('Failed to load persisted auth state:', err);
      } finally {
        setIsLoading(false);
      }
    };
    loadPersistedState();
  }, []);

  const login = async (captainData: Captain, jwtToken: string) => {
    try {
      await AsyncStorage.setItem('mejwani_captain_user', JSON.stringify(captainData));
      await AsyncStorage.setItem('mejwani_captain_jwt', jwtToken);
      setCaptain(captainData);
      setToken(jwtToken);
    } catch (err) {
      console.error('Failed to save auth state on login:', err);
      throw err;
    }
  };

  const logout = async () => {
    try {
      await AsyncStorage.removeItem('mejwani_captain_user');
      await AsyncStorage.removeItem('mejwani_captain_jwt');
      setCaptain(null);
      setToken(null);
    } catch (err) {
      console.error('Failed to clear auth state on logout:', err);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        captain,
        token,
        isAuthenticated: !!captain,
        isLoading,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuthContext = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuthContext must be used within an AuthProvider');
  }
  return context;
};

export * from './CartContext';
export * from './DataContext';
export * from './AlertContext';

