import React from 'react';
import { Text } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { fonts } from '../../theme/Tokens';

const variants = {
  h1: { fontFamily: fonts.heading, fontSize: 26, letterSpacing: -0.5, lineHeight: 32 },
  h1Small: { fontFamily: fonts.heading, fontSize: 24, letterSpacing: -0.4, lineHeight: 30 },
  h2: { fontFamily: fonts.heading, fontSize: 19, letterSpacing: -0.3, lineHeight: 24 },
  h3: { fontFamily: fonts.heading, fontSize: 17, letterSpacing: -0.2, lineHeight: 22 },
  h4: { fontFamily: fonts.heading, fontSize: 16, letterSpacing: -0.2, lineHeight: 21 },
  stat: { fontFamily: fonts.heading, fontSize: 22, letterSpacing: -0.4, lineHeight: 28 },
  statLarge: { fontFamily: fonts.heading, fontSize: 24, letterSpacing: -0.4, lineHeight: 30 },
  timer: { fontFamily: fonts.heading, fontSize: 48, letterSpacing: -1, lineHeight: 52, fontVariant: ['tabular-nums'] },
  title: { fontFamily: fonts.semibold, fontSize: 15, lineHeight: 20 },
  titleLarge: { fontFamily: fonts.semibold, fontSize: 16, lineHeight: 22 },
  body: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 21 },
  bodyStrong: { fontFamily: fonts.semibold, fontSize: 14, lineHeight: 20 },
  label: { fontFamily: fonts.semibold, fontSize: 14, lineHeight: 19 },
  meta: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18 },
  metaStrong: { fontFamily: fonts.semibold, fontSize: 13, lineHeight: 18 },
  caption: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 16 },
  captionStrong: { fontFamily: fonts.semibold, fontSize: 12, lineHeight: 16 },
  tiny: { fontFamily: fonts.regular, fontSize: 11, lineHeight: 14 },
  tinyStrong: { fontFamily: fonts.semibold, fontSize: 11, lineHeight: 14 },
  overline: { fontFamily: fonts.semibold, fontSize: 11, lineHeight: 14, letterSpacing: 0.8, textTransform: 'uppercase' },
};

export default function AppText({ variant = 'body', color, tone, style, numeric, children, ...rest }) {
  const { colors } = useTheme();
  const toneColor = {
    default: colors.text,
    secondary: colors.textSecondary,
    muted: colors.textMuted,
    accent: colors.accent,
    danger: colors.dangerText,
    onAccent: colors.onAccent,
  }[tone || 'default'];

  return (
    <Text
      style={[variants[variant], { color: color || toneColor }, numeric && { fontVariant: ['tabular-nums'] }, style]}
      maxFontSizeMultiplier={1.4}
      {...rest}
    >
      {children}
    </Text>
  );
}
