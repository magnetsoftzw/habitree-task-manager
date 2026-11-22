import React from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Sprout } from 'lucide-react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { radius } from '../../theme/Tokens';
import AppText from '../../components/ui/AppText';

export default function AuthLayout({ title, subtitle, children }) {
  const { colors } = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
          <View style={{ backgroundColor: colors.dark }}>
            <SafeAreaView edges={['top']}>
              <View style={{ paddingTop: 40, paddingHorizontal: 24, paddingBottom: 32, gap: 28 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <View style={{ width: 36, height: 36, borderRadius: radius.md, backgroundColor: colors.scheme === 'dark' ? '#1E6B47' : colors.accent, alignItems: 'center', justifyContent: 'center' }}>
                    <Sprout size={20} color="#FFFFFF" />
                  </View>
                  <AppText variant="h2" color={colors.onDark} style={{ fontSize: 20 }}>Habitree</AppText>
                </View>
                <View style={{ gap: 10 }}>
                  <AppText variant="h1" accessibilityRole="header" color={colors.onDark} style={{ fontSize: 32, lineHeight: 35, letterSpacing: -1 }}>{title}</AppText>
                  <AppText variant="body" color={colors.onDarkSoft} style={{ fontSize: 15, lineHeight: 22 }}>{subtitle}</AppText>
                </View>
              </View>
            </SafeAreaView>
          </View>
          <SafeAreaView edges={['bottom']} style={{ flex: 1 }}>
            <View style={{ flex: 1, paddingTop: 28, paddingHorizontal: 24, paddingBottom: 24, gap: 16 }}>{children}</View>
          </SafeAreaView>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
