import React, { useEffect, useRef } from 'react';
import { Animated, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X } from 'lucide-react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { radius } from '../../theme/Tokens';
import AppText from './AppText';
import { IconButton } from './Controls';

export default function Sheet({ visible, onClose, title, subtitle, children, footer, scroll = true, maxHeight = '88%' }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const slide = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      slide.setValue(0);
      Animated.spring(slide, { toValue: 1, useNativeDriver: true, damping: 22, stiffness: 220 }).start();
    }
  }, [visible, slide]);

  const translateY = slide.interpolate({ inputRange: [0, 1], outputRange: [400, 0] });
  const Body = scroll ? ScrollView : View;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Pressable accessibilityLabel="Close" onPress={onClose} style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: colors.scrim }} />
        <Animated.View
          accessibilityViewIsModal
          style={{
            maxHeight,
            backgroundColor: colors.surface,
            borderTopLeftRadius: radius.sheet,
            borderTopRightRadius: radius.sheet,
            paddingBottom: Math.max(insets.bottom, 16),
            transform: [{ translateY }],
            shadowColor: colors.shadow,
            shadowOpacity: 1,
            shadowRadius: 24,
            shadowOffset: { width: 0, height: -8 },
            elevation: 16,
          }}
        >
          <View style={{ alignItems: 'center', paddingTop: 10 }}>
            <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: colors.borderStrong }} />
          </View>
          {(title || onClose) && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 20, paddingTop: 8, paddingBottom: 4 }}>
              <View style={{ flex: 1, gap: 2 }}>
                {title && <AppText variant="h2" accessibilityRole="header">{title}</AppText>}
                {subtitle && <AppText variant="meta" tone="muted">{subtitle}</AppText>}
              </View>
              <IconButton icon={X} label="Close" variant="ghost" onPress={onClose} />
            </View>
          )}
          <Body
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={scroll ? { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12, gap: 14 } : undefined}
            style={scroll ? undefined : { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12, gap: 14 }}
          >
            {children}
          </Body>
          {footer && <View style={{ paddingHorizontal: 20, paddingTop: 4, gap: 10 }}>{footer}</View>}
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export function OptionSheet({ visible, onClose, title, subtitle, options }) {
  const { colors } = useTheme();
  return (
    <Sheet visible={visible} onClose={onClose} title={title} subtitle={subtitle}>
      <View style={{ borderWidth: 1, borderColor: colors.border, borderRadius: radius.card, overflow: 'hidden' }}>
        {options.filter(Boolean).map((opt, i) => (
          <Pressable
            key={opt.key || `${opt.label}-${i}`}
            accessibilityRole="button"
            accessibilityState={{ selected: !!opt.selected, disabled: !!opt.disabled }}
            disabled={opt.disabled}
            onPress={() => { onClose(); setTimeout(() => opt.onPress?.(), 250); }}
            style={({ pressed }) => ({
              minHeight: 56,
              paddingHorizontal: 16,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
              borderTopWidth: i === 0 ? 0 : 1,
              borderTopColor: colors.divider,
              backgroundColor: pressed ? colors.surfaceSubtle : colors.surface,
              opacity: opt.disabled ? 0.5 : 1,
            })}
          >
            {opt.icon && <opt.icon size={18} color={opt.danger ? colors.dangerStrong : colors.textSecondary} strokeWidth={2} />}
            {opt.dot && <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: opt.dot }} />}
            <View style={{ flex: 1 }}>
              <AppText variant="title" color={opt.danger ? colors.dangerStrong : colors.text}>{opt.label}</AppText>
              {opt.hint && <AppText variant="caption" tone="muted">{opt.hint}</AppText>}
            </View>
            {opt.selected && <AppText variant="metaStrong" tone="accent">Selected</AppText>}
          </Pressable>
        ))}
      </View>
    </Sheet>
  );
}
