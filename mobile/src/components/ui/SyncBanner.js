import React from 'react';
import { View } from 'react-native';
import { useSelector } from 'react-redux';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CloudOff, RefreshCw } from 'lucide-react-native';
import { useTheme } from '../../theme/ThemeProvider';
import AppText from './AppText';

export default function SyncBanner() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const online = useSelector((s) => s.sync.online);
  const waiting = useSelector((s) => s.sync.outbox.length);
  const signedIn = useSelector((s) => s.auth.isAuthenticated);
  if (!signedIn || (online && !waiting)) return null;
  const Icon = online ? RefreshCw : CloudOff;
  const text = online
    ? `Syncing ${waiting} change${waiting === 1 ? '' : 's'}…`
    : `Offline${waiting ? ` · ${waiting} change${waiting === 1 ? '' : 's'} saved on this phone` : ' · showing saved data'}`;
  return (
    <View
      pointerEvents="none"
      accessibilityLiveRegion="polite"
      style={{ position: 'absolute', top: insets.top + 6, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderStrong }}
    >
      <Icon size={14} color={colors.textMuted} />
      <AppText variant="caption" tone="muted">{text}</AppText>
    </View>
  );
}
