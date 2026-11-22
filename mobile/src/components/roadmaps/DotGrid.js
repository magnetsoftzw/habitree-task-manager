import React from 'react';
import { StyleSheet } from 'react-native';
import Svg, { Circle, Defs, Pattern, Rect } from 'react-native-svg';
import { useTheme } from '../../theme/ThemeProvider';

export default function DotGrid({ spacing = 22, dot = 1.2 }) {
  const { colors } = useTheme();
  return (
    <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
      <Defs>
        <Pattern id="dots" width={spacing} height={spacing} patternUnits="userSpaceOnUse">
          <Circle cx={spacing / 2} cy={spacing / 2} r={dot} fill={colors.canvasDot} />
        </Pattern>
      </Defs>
      <Rect width="100%" height="100%" fill={colors.canvas} />
      <Rect width="100%" height="100%" fill="url(#dots)" />
    </Svg>
  );
}
