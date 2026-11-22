import React from 'react';
import { Pressable, View } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { Bell, ChevronRight } from 'lucide-react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { radius } from '../../theme/Tokens';
import AppText from '../ui/AppText';
import Sheet from '../ui/Sheet';
import { markNotificationRead } from '../../store/slices/NotificationsSlice';
import { navigateTo } from '../../navigation/NavigationRef';
import { clock, shortDate } from '../../utils/Format';

const when = (value) => {
  const d = new Date(value);
  return d.toDateString() === new Date().toDateString() ? clock(d) : shortDate(d);
};

export default function NotificationsSheet({ visible, onClose }) {
  const dispatch = useDispatch();
  const { colors } = useTheme();
  const { items, error } = useSelector((s) => s.notifications);

  const open = (n) => {
    if (!n.isRead) dispatch(markNotificationRead(n._id));
    if (n.projectId) {
      onClose();
      navigateTo('Main', { screen: 'Projects', params: { screen: 'ProjectDetail', params: { projectId: n.projectId }, initial: false } });
    }
  };

  return (
    <Sheet visible={visible} onClose={onClose} title="Notifications">
      {error && items.length === 0 && <AppText variant="body" tone="muted">{error}</AppText>}
      {!error && items.length === 0 && (
        <View style={{ alignItems: 'center', gap: 8, paddingVertical: 24 }}>
          <Bell size={24} color={colors.textMuted} />
          <AppText variant="body" tone="muted">You're all caught up.</AppText>
        </View>
      )}
      {items.slice(0, 20).map((n) => (
        <Pressable
          key={n._id}
          accessibilityRole="button"
          accessibilityLabel={`${n.isRead ? '' : 'Unread. '}${n.message}`}
          onPress={() => open(n)}
          style={({ pressed }) => ({
            flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: radius.lg,
            backgroundColor: pressed ? colors.surfaceSubtle : n.isRead ? 'transparent' : colors.accentSoft,
          })}
        >
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: n.isRead ? 'transparent' : colors.accent }} />
          <View style={{ flex: 1, gap: 2 }}>
            <AppText variant={n.isRead ? 'body' : 'bodyStrong'}>{n.message}</AppText>
            <AppText variant="caption" tone="muted">{when(n.createdAt)}</AppText>
          </View>
          {n.projectId && <ChevronRight size={16} color={colors.textMuted} />}
        </Pressable>
      ))}
    </Sheet>
  );
}
