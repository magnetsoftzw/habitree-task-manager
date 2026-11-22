import React from 'react';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChartNoAxesColumn, Folder, LayoutDashboard, ListChecks, Route } from 'lucide-react-native';
import { useTheme } from '../../theme/ThemeProvider';
import AppText from '../ui/AppText';

const ICONS = { Today: LayoutDashboard, Tasks: ListChecks, Projects: Folder, Roadmaps: Route, Insights: ChartNoAxesColumn };

export default function TabBar({ state, navigation }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View
      accessibilityRole="tablist"
      style={{
        flexDirection: 'row',
        backgroundColor: colors.surface,
        borderTopWidth: 1,
        borderTopColor: colors.border,
        paddingHorizontal: 8,
        paddingTop: 8,
        paddingBottom: Math.max(insets.bottom, 12),
      }}
    >
      {state.routes.map((route, index) => {
        const focused = state.index === index;
        const Icon = ICONS[route.name];
        const color = focused ? colors.accent : colors.textMuted;
        const onPress = () => {
          const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!event.defaultPrevented) {
            if (focused) navigation.navigate(route.name, route.params);
            else navigation.navigate(route.name);
          }
        };
        return (
          <Pressable
            key={route.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: focused }}
            accessibilityLabel={route.name}
            onPress={onPress}
            style={{ flex: 1, minHeight: 52, alignItems: 'center', justifyContent: 'center', gap: 4, borderRadius: 12 }}
          >
            <Icon size={22} color={color} strokeWidth={2} />
            <AppText variant="tinyStrong" color={color}>{route.name}</AppText>
          </Pressable>
        );
      })}
    </View>
  );
}
