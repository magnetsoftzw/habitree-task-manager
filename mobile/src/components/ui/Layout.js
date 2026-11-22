import React, { useEffect, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Plus } from 'lucide-react-native';
import { useTheme } from '../../theme/ThemeProvider';
import AppText from './AppText';
import { Button } from './Controls';
import Sheet from './Sheet';
import { TextField } from './Fields';

export function Screen({ children, background, edges = ['top'] }) {
  const { colors } = useTheme();
  return (
    <SafeAreaView edges={edges} style={{ flex: 1, backgroundColor: background || colors.bg }}>
      {children}
    </SafeAreaView>
  );
}

export function PageHeader({ overline, title, children, small }) {
  return (
    <View style={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: 12, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        {overline ? <AppText variant="meta" tone="muted" numberOfLines={1}>{overline}</AppText> : null}
        <AppText variant={small ? 'h1Small' : 'h1'} accessibilityRole="header" numberOfLines={1}>{title}</AppText>
      </View>
      {children}
    </View>
  );
}

export function BackHeader({ title, onBack, backLabel = 'Back', children, subtitle, bordered, background }) {
  const { colors } = useTheme();
  return (
    <View style={[
      { paddingLeft: 10, paddingRight: 20, paddingTop: 16, paddingBottom: 8, flexDirection: 'row', alignItems: 'center', gap: 6 },
      bordered && { paddingTop: 12, paddingBottom: 10, paddingRight: 12, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: background || colors.surface },
    ]}>
      <Pressable accessibilityRole="button" accessibilityLabel={backLabel} onPress={onBack} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
        <ArrowLeft size={22} color={colors.text} strokeWidth={2} />
      </Pressable>
      <View style={{ flex: 1, minWidth: 0 }}>
        <AppText variant={subtitle ? 'h3' : 'h1Small'} accessibilityRole="header" numberOfLines={1}>{title}</AppText>
        {subtitle ? <AppText variant="caption" tone="muted" numberOfLines={1}>{subtitle}</AppText> : null}
      </View>
      {children}
    </View>
  );
}

export function ScrollBody({ children, refreshing, onRefresh, bottomPad = 24, contentStyle, gap = 16, ...rest }) {
  const { colors } = useTheme();
  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={[{ paddingHorizontal: 20, paddingTop: 4, paddingBottom: bottomPad, gap }, contentStyle]}
      keyboardShouldPersistTaps="handled"
      refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={colors.accent} colors={[colors.accent]} /> : undefined}
      {...rest}
    >
      {children}
    </ScrollView>
  );
}

export function Fab({ label, onPress, bottom = 16 }) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => ({
        position: 'absolute', right: 20, bottom, width: 60, height: 60, borderRadius: 18, backgroundColor: colors.accent,
        alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.85 : 1,
        shadowColor: colors.shadow, shadowOpacity: 1, shadowRadius: 24, shadowOffset: { width: 0, height: 10 }, elevation: 8,
      })}
    >
      <Plus size={24} color={colors.onAccent} strokeWidth={2.4} />
    </Pressable>
  );
}

export function PromptSheet({ visible, onClose, title, label, placeholder, initialValue = '', submitLabel = 'Save', onSubmit, maxLength = 200, multiline }) {
  const [value, setValue] = useState(initialValue);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (visible) {
      setValue(initialValue);
      setError(null);
    }
  }, [visible, initialValue]);

  const submit = async () => {
    if (!value.trim()) return setError(`${label || 'Title'} is required`);
    setBusy(true);
    try {
      await onSubmit(value.trim());
      onClose();
    } catch (e) {
      setError(typeof e === 'string' ? e : e?.message || 'Something went wrong');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={title}
      footer={<Button label={submitLabel} onPress={submit} loading={busy} />}
    >
      <TextField
        label={label}
        placeholder={placeholder}
        value={value}
        onChangeText={(t) => { setValue(t); setError(null); }}
        maxLength={maxLength}
        autoFocus
        multiline={multiline}
        returnKeyType="done"
        onSubmitEditing={multiline ? undefined : submit}
        error={error}
      />
    </Sheet>
  );
}

export function SectionTitle({ title, right, id }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
      <AppText variant="h2" accessibilityRole="header" nativeID={id}>{title}</AppText>
      {right ? <AppText variant="meta" tone="muted">{right}</AppText> : null}
    </View>
  );
}
