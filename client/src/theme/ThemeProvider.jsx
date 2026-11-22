import { useCallback, useEffect, useMemo, useState } from 'react';
import { ThemeContext, THEME_STORAGE_KEY } from './ThemeContext';

const readTheme = () => {
    try {
        return localStorage.getItem(THEME_STORAGE_KEY) === 'dark' ? 'dark' : 'light';
    } catch {
        return 'light';
    }
};

const ThemeProvider = ({ children }) => {
    const [theme, setThemeState] = useState(readTheme);

    useEffect(() => {
        document.documentElement.setAttribute('data-theme', theme);
    }, [theme]);

    const setTheme = useCallback((value) => {
        const next = value === 'dark' ? 'dark' : 'light';
        setThemeState(next);
        try {
            localStorage.setItem(THEME_STORAGE_KEY, next);
        } catch {
            /* storage unavailable */
        }
    }, []);

    const toggle = useCallback(() => setTheme(theme === 'dark' ? 'light' : 'dark'), [theme, setTheme]);

    const value = useMemo(() => ({ theme, setTheme, toggle }), [theme, setTheme, toggle]);

    return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export default ThemeProvider;
