import 'react-native-gesture-handler';
import React, { useEffect } from 'react';
import { AppState } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { Provider, useSelector } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';
import { SpaceGrotesk_600SemiBold, SpaceGrotesk_700Bold } from '@expo-google-fonts/space-grotesk';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { store, persistor } from './src/store/Store';
import { navigationRef } from './src/navigation/NavigationRef';
import AppNavigator from './src/navigation/AppNavigator';
import { ThemeProvider, useTheme } from './src/theme/ThemeProvider';
import { ToastProvider } from './src/components/ui/Toast';
import FocusEngine from './src/components/focus/FocusEngine';
import { useUserRoom } from './src/api/Socket';
import SyncBanner from './src/components/ui/SyncBanner';
import { startSync } from './src/sync/SyncEngine';
import { refreshKinds } from './src/sync/Refresh';
import { flushStorage } from './src/storage/DeviceStorage';

SplashScreen.preventAutoHideAsync().catch(() => {});

function Shell() {
  const { colors, isDark } = useTheme();
  const base = isDark ? DarkTheme : DefaultTheme;
  const navTheme = {
    ...base,
    colors: { ...base.colors, primary: colors.accent, background: colors.bg, card: colors.surface, text: colors.text, border: colors.border },
  };

  const userId = useSelector((s) => s.auth.user?._id || s.auth.user?.id);
  useUserRoom(userId);

  const signedIn = useSelector((s) => s.auth.isAuthenticated);
  useEffect(() => (signedIn ? startSync(store, refreshKinds) : undefined), [signedIn]);
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (next !== 'active') persistor.flush().then(flushStorage).catch(() => {});
    });
    return () => sub.remove();
  }, []);

  useEffect(() => { SplashScreen.hideAsync().catch(() => {}); }, []);

  return (
    <ToastProvider>
      <NavigationContainer ref={navigationRef} theme={navTheme}>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        <AppNavigator />
      </NavigationContainer>
      <FocusEngine />
      <SyncBanner />
    </ToastProvider>
  );
}

export default function App() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold, SpaceGrotesk_600SemiBold, SpaceGrotesk_700Bold,
  });

  if (!fontsLoaded && !fontError) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <Provider store={store}>
          <PersistGate loading={null} persistor={persistor}>
            <ThemeProvider>
              <Shell />
            </ThemeProvider>
          </PersistGate>
        </Provider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
