import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { Check } from 'lucide-react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { radius } from '../../theme/Tokens';
import AppText from './AppText';

export function Card({ style, children, padded = true, ...rest }) {
  const { colors } = useTheme();
  return (
    <View
      style={[{ backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: radius.card }, padded && { padding: 16 }, style]}
      {...rest}
    >
      {children}
    </View>
  );
}

export function IconButton({ icon: Icon, label, onPress, variant = 'surface', size = 44, round, disabled, style, iconSize = 20 }) {
  const { colors } = useTheme();
  const palette = {
    surface: { bg: colors.surface, fg: colors.textSecondary, border: colors.border },
    accent: { bg: colors.accent, fg: colors.onAccent, border: colors.accent },
    ghost: { bg: 'transparent', fg: colors.text, border: 'transparent' },
    soft: { bg: colors.accentSoft, fg: colors.accent, border: colors.accentSoft },
  }[variant];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      disabled={disabled}
      hitSlop={4}
      style={({ pressed }) => [
        {
          width: size,
          height: size,
          borderRadius: round ? size / 2 : radius.lg,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: palette.bg,
          borderWidth: variant === 'ghost' ? 0 : 1,
          borderColor: palette.border,
          opacity: disabled ? 0.5 : pressed ? 0.75 : 1,
        },
        style,
      ]}
    >
      <Icon size={iconSize} color={palette.fg} strokeWidth={2} />
    </Pressable>
  );
}

export function Button({ label, onPress, variant = 'primary', icon: Icon, loading, disabled, height = 48, style, textStyle, accessibilityLabel }) {
  const { colors } = useTheme();
  const palette = {
    primary: { bg: colors.accent, fg: colors.onAccent, border: colors.accent },
    secondary: { bg: colors.surface, fg: colors.text, border: colors.border },
    ghost: { bg: 'transparent', fg: colors.accent, border: 'transparent' },
    danger: { bg: colors.dangerBg, fg: colors.dangerStrong, border: colors.dangerBorder },
    dark: { bg: colors.onDark, fg: colors.dark, border: colors.onDark },
  }[variant];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || label}
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        {
          minHeight: height,
          paddingHorizontal: 16,
          borderRadius: height >= 52 ? radius.xl : radius.lg,
          backgroundColor: palette.bg,
          borderWidth: 1,
          borderColor: palette.border,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          opacity: disabled ? 0.5 : pressed ? 0.8 : 1,
        },
        style,
      ]}
    >
      {loading ? <ActivityIndicator color={palette.fg} /> : (
        <>
          {Icon && <Icon size={16} color={palette.fg} strokeWidth={2.2} />}
          <AppText variant={height >= 52 ? 'titleLarge' : 'title'} color={palette.fg} style={[{ fontFamily: 'Inter_600SemiBold' }, textStyle]}>{label}</AppText>
        </>
      )}
    </Pressable>
  );
}

export function DashedButton({ label, sublabel, onPress, icon: Icon, minHeight = 52, style }) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [{
        minHeight,
        borderWidth: 1.5,
        borderStyle: 'dashed',
        borderColor: colors.borderStrong,
        borderRadius: radius.xl,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingHorizontal: 16,
        paddingVertical: 10,
        opacity: pressed ? 0.7 : 1,
      }, style]}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        {Icon && <Icon size={16} color={colors.textSecondary} strokeWidth={2.4} />}
        <AppText variant="title" tone="secondary">{label}</AppText>
      </View>
      {sublabel && <AppText variant="meta" tone="muted">{sublabel}</AppText>}
    </Pressable>
  );
}

export function StatusPill({ status, label, colors: override }) {
  const { colors } = useTheme();
  const c = override || colors.status[status] || colors.status['Not Started'];
  return (
    <View style={{ alignSelf: 'flex-start', backgroundColor: c.bg, borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 2 }}>
      <AppText variant="tinyStrong" color={c.fg}>{label || c.label}</AppText>
    </View>
  );
}

export function SegmentedControl({ options, value, onChange, label, role = 'tablist' }) {
  const { colors } = useTheme();
  return (
    <View accessibilityRole={role === 'tablist' ? 'tablist' : undefined} accessibilityLabel={label} style={{ flexDirection: 'row', padding: 4, backgroundColor: colors.surfaceSunken, borderRadius: radius.lg }}>
      {options.map((opt) => {
        const on = opt.value === value;
        return (
          <Pressable
            key={opt.value}
            accessibilityRole={role === 'tablist' ? 'tab' : 'button'}
            accessibilityState={{ selected: on }}
            onPress={() => onChange(opt.value)}
            style={[
              { flex: 1, minHeight: 44, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
              on && { backgroundColor: colors.surface, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 2, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
            ]}
          >
            <AppText variant="label" color={on ? colors.text : colors.textSecondary}>{opt.label}</AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Chip({ label, count, selected, onPress, dot, accessibilityRole = 'button' }) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole={accessibilityRole}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={{
        height: 40,
        paddingHorizontal: 14,
        borderRadius: radius.pill,
        borderWidth: 1,
        borderColor: selected ? colors.inverse : colors.border,
        backgroundColor: selected ? colors.inverse : colors.surface,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
      }}
    >
      {dot && <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: dot }} />}
      <AppText variant="metaStrong" color={selected ? colors.onInverse : colors.textSecondary}>{label}</AppText>
      {count !== undefined && (
        <AppText variant="metaStrong" color={selected ? colors.onInverse : colors.textSecondary} style={{ opacity: 0.7 }}>{count}</AppText>
      )}
    </Pressable>
  );
}

export function ProgressBar({ value = 0, height = 4, color, track, width }) {
  const { colors } = useTheme();
  return (
    <View style={{ height, borderRadius: height / 2, backgroundColor: track || colors.divider, overflow: 'hidden', width }}>
      <View style={{ height, width: `${Math.max(0, Math.min(100, value))}%`, backgroundColor: color || colors.accent, borderRadius: height / 2 }} />
    </View>
  );
}

export function Checkbox({ checked, onPress, label, size = 28 }) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: !!checked }}
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={Math.max(0, (44 - size) / 2)}
      style={{
        width: size,
        height: size,
        borderRadius: 7,
        borderWidth: 2,
        borderColor: checked ? colors.accent : colors.textFaint,
        backgroundColor: checked ? colors.accent : colors.surface,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {checked && <Check size={size * 0.55} color={colors.onAccent} strokeWidth={3} />}
    </Pressable>
  );
}

export function ToggleSwitch({ value, onChange, label }) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: !!value }}
      accessibilityLabel={label}
      onPress={() => onChange(!value)}
      hitSlop={6}
      style={{ width: 52, height: 32, borderRadius: 16, backgroundColor: value ? colors.accent : colors.borderStrong, justifyContent: 'center' }}
    >
      <View style={{
        position: 'absolute', top: 4, left: value ? 24 : 4, width: 24, height: 24, borderRadius: 12, backgroundColor: '#FFFFFF',
        shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 3, shadowOffset: { width: 0, height: 1 }, elevation: 2,
      }} />
    </Pressable>
  );
}

export function EmptyState({ title, body, action, onAction, actionVariant = 'primary', style }) {
  const { colors } = useTheme();
  return (
    <View style={[{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.card, padding: 20, alignItems: 'center', gap: 6 }, style]}>
      <AppText variant="titleLarge" style={{ textAlign: 'center' }}>{title}</AppText>
      {body && <AppText variant="body" tone="muted" style={{ textAlign: 'center' }}>{body}</AppText>}
      {action && <Button label={action} onPress={onAction} variant={actionVariant} style={{ marginTop: 8, alignSelf: 'stretch' }} />}
    </View>
  );
}

export function Badge({ label, color, size = 44, fontSize = 15, radiusSize = 12 }) {
  return (
    <View style={{ width: size, height: size, borderRadius: radiusSize, backgroundColor: color, alignItems: 'center', justifyContent: 'center' }}>
      <AppText variant="h4" color="#FFFFFF" style={{ fontSize, lineHeight: fontSize * 1.25 }}>{label}</AppText>
    </View>
  );
}

export function Divider() {
  const { colors } = useTheme();
  return <View style={{ height: StyleSheet.hairlineWidth * 2, backgroundColor: colors.divider }} />;
}
