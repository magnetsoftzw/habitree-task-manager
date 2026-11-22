import React, { createContext, useContext, useMemo } from 'react';
import { useColorScheme } from 'react-native';
import { useSelector } from 'react-redux';
import { darkColors, lightColors } from './Tokens';

const ThemeContext = createContext({ colors: lightColors, isDark: false });

export function ThemeProvider({ children }) {
  const system = useColorScheme();
  const mode = useSelector((s) => s.prefs?.themeMode || 'system');
  const isDark = mode === 'dark' || (mode === 'system' && system === 'dark');

  const value = useMemo(() => ({ colors: isDark ? darkColors : lightColors, isDark, mode }), [isDark, mode]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);

export function useStyles(factory) {
  const { colors } = useTheme();
  return useMemo(() => factory(colors), [colors, factory]);
}
