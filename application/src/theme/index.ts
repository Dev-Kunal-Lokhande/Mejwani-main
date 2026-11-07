import { useColorScheme } from 'react-native';
import { colors } from './colors';
import { spacing } from './spacing';
import { typography } from './typography';

export * from './colors';
export * from './spacing';
export * from './typography';

export const theme = {
  spacing,
  typography,
};

// Custom hook to get the active color theme (light or dark)
export function useTheme() {
  const scheme = useColorScheme();
  const currentColors = scheme === 'dark' ? colors.dark : colors.light;
  
  return {
    colors: currentColors,
    spacing,
    typography,
    isDark: scheme === 'dark',
  };
}
