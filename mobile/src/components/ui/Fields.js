import React, { forwardRef, useState } from 'react';
import { Platform, Pressable, TextInput, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Calendar, Clock, X } from 'lucide-react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { fonts, radius } from '../../theme/Tokens';
import AppText from './AppText';
import { longDate } from '../../utils/Format';

export const TextField = forwardRef(function TextField({ label, error, hint, style, inputStyle, right, multiline, height = 52, ...rest }, ref) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);
  return (
    <View style={[{ gap: 8 }, style]}>
      {label && <AppText variant="label">{label}</AppText>}
      <View style={{ flexDirection: 'row', alignItems: multiline ? 'flex-start' : 'center' }}>
        <TextInput
          ref={ref}
          accessibilityLabel={label || rest.placeholder}
          placeholderTextColor={colors.textMuted}
          multiline={multiline}
          onFocus={(e) => { setFocused(true); rest.onFocus?.(e); }}
          onBlur={(e) => { setFocused(false); rest.onBlur?.(e); }}
          style={[{
            flex: 1,
            minWidth: 0,
            minHeight: multiline ? 96 : height,
            paddingHorizontal: 14,
            paddingVertical: multiline ? 12 : 0,
            paddingRight: right ? 52 : 14,
            borderWidth: focused ? 2 : 1,
            borderColor: error ? colors.dangerText : focused ? colors.accent : colors.borderStrong,
            borderRadius: radius.lg,
            backgroundColor: colors.surface,
            color: colors.text,
            fontSize: 16,
            fontFamily: fonts.regular,
            textAlignVertical: multiline ? 'top' : 'center',
          }, inputStyle]}
          {...rest}
        />
        {right && <View style={{ position: 'absolute', right: 4, top: multiline ? 4 : undefined }}>{right}</View>}
      </View>
      {error ? <AppText variant="meta" tone="danger">{error}</AppText> : hint ? <AppText variant="meta" tone="muted">{hint}</AppText> : null}
    </View>
  );
});

function PickerButton({ icon: Icon, text, placeholder, onPress, onClear, label }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${text || placeholder}`}
        onPress={onPress}
        style={{ flex: 1, minHeight: 52, paddingHorizontal: 14, borderWidth: 1, borderColor: colors.borderStrong, borderRadius: radius.lg, backgroundColor: colors.surface, flexDirection: 'row', alignItems: 'center', gap: 10 }}
      >
        <Icon size={18} color={colors.textSecondary} />
        <AppText variant="title" color={text ? colors.text : colors.textMuted} style={{ flex: 1, fontFamily: fonts.regular, fontSize: 16 }}>{text || placeholder}</AppText>
      </Pressable>
      {text && onClear && (
        <Pressable accessibilityRole="button" accessibilityLabel={`Clear ${label}`} onPress={onClear} style={{ position: 'absolute', right: 4, width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
          <X size={18} color={colors.textMuted} />
        </Pressable>
      )}
    </View>
  );
}

export function DateField({ label, value, onChange, placeholder = 'No date', clearable = true, minimumDate }) {
  const { isDark } = useTheme();
  const [open, setOpen] = useState(false);
  const date = value ? new Date(value) : null;
  return (
    <View style={{ gap: 8 }}>
      {label && <AppText variant="label">{label}</AppText>}
      <PickerButton icon={Calendar} label={label || 'Date'} text={date ? longDate(date) : ''} placeholder={placeholder} onPress={() => setOpen(true)} onClear={clearable ? () => onChange(null) : null} />
      {open && (
        <DateTimePicker
          value={date || new Date()}
          mode="date"
          minimumDate={minimumDate}
          themeVariant={isDark ? 'dark' : 'light'}
          display={Platform.OS === 'ios' ? 'inline' : 'default'}
          onChange={(event, picked) => {
            if (Platform.OS !== 'ios') setOpen(false);
            if (event.type === 'set' && picked) {
              const d = new Date(picked);
              d.setHours(12, 0, 0, 0);
              onChange(d);
              if (Platform.OS === 'ios') setOpen(false);
            }
            if (event.type === 'dismissed') setOpen(false);
          }}
        />
      )}
    </View>
  );
}

export function TimeField({ label, value, onChange }) {
  const { isDark } = useTheme();
  const [open, setOpen] = useState(false);
  const [h, m] = (value || '08:00').split(':').map(Number);
  const current = new Date();
  current.setHours(h, m, 0, 0);
  return (
    <View style={{ gap: 8, flex: 1 }}>
      {label && <AppText variant="label">{label}</AppText>}
      <PickerButton icon={Clock} label={label || 'Time'} text={value} placeholder="Pick a time" onPress={() => setOpen(true)} />
      {open && (
        <DateTimePicker
          value={current}
          mode="time"
          is24Hour
          minuteInterval={5}
          themeVariant={isDark ? 'dark' : 'light'}
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={(event, picked) => {
            if (Platform.OS !== 'ios') setOpen(false);
            if (event.type === 'set' && picked) {
              onChange(`${String(picked.getHours()).padStart(2, '0')}:${String(picked.getMinutes()).padStart(2, '0')}`);
              if (Platform.OS === 'ios') setOpen(false);
            }
            if (event.type === 'dismissed') setOpen(false);
          }}
        />
      )}
    </View>
  );
}
