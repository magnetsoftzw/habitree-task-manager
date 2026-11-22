import { createContext, useContext } from 'react';

export const THEME_STORAGE_KEY = 'habitree:theme';

export const ThemeContext = createContext({
    theme: 'light',
    setTheme: () => {},
    toggle: () => {},
});

export const useTheme = () => useContext(ThemeContext);
