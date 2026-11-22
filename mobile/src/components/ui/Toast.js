import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Animated, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/ThemeProvider';
import { radius } from '../../theme/Tokens';
import AppText from './AppText';

const ToastContext = createContext({ show: () => {} });

export function ToastProvider({ children }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [toast, setToast] = useState(null);
  const timer = useRef(null);
  const fade = useRef(new Animated.Value(0)).current;

  const current = useRef(null);

  const hide = useCallback((runExpire = true) => {
    clearTimeout(timer.current);
    const previous = current.current;
    current.current = null;
    setToast(null);
    if (previous && runExpire) previous.onExpire?.();
  }, []);

  const show = useCallback((message, options = {}) => {
    clearTimeout(timer.current);
    const previous = current.current;
    current.current = { message, ...options, key: Date.now() };
    setToast(current.current);
    previous?.onExpire?.();
    timer.current = setTimeout(() => hide(true), options.duration || (options.action ? 5000 : 3200));
  }, [hide]);

  useEffect(() => {
    Animated.timing(fade, { toValue: toast ? 1 : 0, duration: 160, useNativeDriver: true }).start();
  }, [toast, fade]);

  useEffect(() => () => clearTimeout(timer.current), []);

  return (
    <ToastContext.Provider value={{ show, hide }}>
      {children}
      {toast && (
        <Animated.View
          pointerEvents="box-none"
          style={{ position: 'absolute', left: 16, right: 16, bottom: insets.bottom + 96, opacity: fade }}
        >
          <View
            accessibilityLiveRegion="polite"
            accessibilityRole="alert"
            style={{ backgroundColor: colors.inverse, borderRadius: radius.xl, paddingLeft: 16, paddingRight: 6, minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 8 }}
          >
            <AppText variant="bodyStrong" color={colors.onInverse} style={{ flex: 1, paddingVertical: 12 }}>{toast.message}</AppText>
            {toast.action && (
              <Pressable
                accessibilityRole="button"
                onPress={() => { toast.action.onPress(); hide(false); }}
                style={{ minHeight: 44, paddingHorizontal: 12, justifyContent: 'center' }}
              >
                <AppText variant="label" color={colors.scheme === 'dark' ? colors.accentHover : '#8DDBB0'}>{toast.action.label}</AppText>
              </Pressable>
            )}
          </View>
        </Animated.View>
      )}
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
