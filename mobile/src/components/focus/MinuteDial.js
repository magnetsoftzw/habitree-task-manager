import React from 'react';
import { TextInput, View } from 'react-native';
import { Minus, Plus } from 'lucide-react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { fonts } from '../../theme/Tokens';
import { FOCUS_PRESETS } from '../../store/slices/FocusSlice';
import AppText from '../ui/AppText';
import { Chip, IconButton } from '../ui/Controls';

export const presetLabel = (m) => (m <= 60 ? `${m} min` : m % 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${m / 60} h`);

export default function MinuteDial({ value, onChange, min = 1, max = 180, presets = FOCUS_PRESETS, label = 'Minutes' }) {
  const { colors } = useTheme();
  const clamp = (v) => Math.max(min, Math.min(max, Math.round(v) || min));

  return (
    <View style={{ gap: 16 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 20 }}>
        <IconButton icon={Minus} label="Five minutes less" round onPress={() => onChange(clamp(value - 5))} disabled={value <= min} />
        <View style={{ alignItems: 'center', minWidth: 96 }}>
          <TextInput
            accessibilityLabel={label}
            keyboardType="number-pad"
            value={String(value)}
            onChangeText={(t) => onChange(clamp(Number(t.replace(/\D/g, ''))))}
            maxLength={3}
            selectTextOnFocus
            style={{ fontFamily: fonts.heading, fontSize: 48, color: colors.text, textAlign: 'center', padding: 0, minWidth: 96 }}
          />
          <AppText variant="meta" tone="muted">minutes</AppText>
        </View>
        <IconButton icon={Plus} label="Five minutes more" round onPress={() => onChange(clamp(value + 5))} disabled={value >= max} />
      </View>
      <View accessibilityLabel="Presets" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
        {presets.map((p) => <Chip key={p} label={presetLabel(p)} selected={value === p} onPress={() => onChange(p)} />)}
      </View>
    </View>
  );
}
