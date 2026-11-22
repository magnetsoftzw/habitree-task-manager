import React, { useEffect, useState } from 'react';
import { Alert, View } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { AlertTriangle, HardDrive, RefreshCw, Smartphone } from 'lucide-react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { radius } from '../../theme/Tokens';
import AppText from '../ui/AppText';
import { Button, Card } from '../ui/Controls';
import { useToast } from '../ui/Toast';
import { persistor } from '../../store/Store';
import { clearIssues } from '../../store/slices/SyncSlice';
import { syncNow } from '../../sync/SyncEngine';
import {
  chooseExternalFolder, externalSupported, getStorageInfo, onStorageChange, switchToInternalStorage,
} from '../../storage/DeviceStorage';

const ago = (iso) => {
  if (!iso) return 'Not yet';
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  return hours < 24 ? `${hours} h ago` : new Date(iso).toLocaleDateString();
};

export default function StorageSyncCard() {
  const dispatch = useDispatch();
  const { colors } = useTheme();
  const { show } = useToast();
  const sync = useSelector((s) => s.sync);
  const [storage, setStorage] = useState(getStorageInfo());
  const [busy, setBusy] = useState(null);

  useEffect(() => onStorageChange(setStorage), []);

  const onSd = storage.active === 'external';

  const move = async (toSd) => {
    setBusy('storage');
    try {
      await persistor.flush();
      const moved = toSd ? await chooseExternalFolder() : (await switchToInternalStorage(), true);
      if (moved) show(toSd ? 'Your data is now stored on the SD card' : 'Your data is now stored on the phone');
    } catch (error) {
      show(error.message || 'Could not move your data');
    } finally {
      setStorage(getStorageInfo());
      setBusy(null);
    }
  };

  const askMove = (toSd) => {
    if (toSd) {
      return Alert.alert(
        'Store data on the SD card?',
        'Pick or create a folder on the SD card, for example "HabiTree". Your saved tasks, plans, projects and sessions are copied there and removed from the phone. Your login stays on the phone. Other apps with access to that folder can read these files.',
        [{ text: 'Cancel', style: 'cancel' }, { text: 'Choose folder', onPress: () => move(true) }],
      );
    }
    return move(false);
  };

  const runSync = async () => {
    setBusy('sync');
    await syncNow();
    setBusy(null);
  };

  const waiting = sync.outbox.length;

  return (
    <Card style={{ gap: 14 }} accessibilityLabel="Storage and sync">
      <AppText variant="title" accessibilityRole="header" style={{ fontFamily: 'Inter_700Bold' }}>Offline data</AppText>

      <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
        {onSd ? <HardDrive size={20} color={colors.textSecondary} /> : <Smartphone size={20} color={colors.textSecondary} />}
        <View style={{ flex: 1, gap: 2 }}>
          <AppText variant="bodyStrong">{onSd ? storage.location.label || 'SD card' : 'Phone storage'}</AppText>
          <AppText variant="caption" tone="muted">Everything you've loaded is kept here so the app works without a connection.</AppText>
        </View>
      </View>
      {storage.problem && <AppText variant="meta" tone="danger">{storage.problem}</AppText>}
      {externalSupported && (
        <Button
          label={onSd ? 'Move back to phone storage' : 'Store on SD card…'}
          variant="secondary"
          height={44}
          loading={busy === 'storage'}
          onPress={() => askMove(!onSd)}
        />
      )}

      <View style={{ height: 1, backgroundColor: colors.divider }} />

      <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
        <RefreshCw size={20} color={colors.textSecondary} />
        <View style={{ flex: 1, gap: 2 }} accessibilityLiveRegion="polite">
          <AppText variant="bodyStrong">{!sync.online ? 'Offline' : waiting ? `${waiting} change${waiting === 1 ? '' : 's'} waiting to sync` : 'Up to date'}</AppText>
          <AppText variant="caption" tone="muted">Last synced: {ago(sync.lastSyncAt)}</AppText>
        </View>
        <Button label="Sync now" variant="ghost" height={40} loading={busy === 'sync' || sync.syncing} disabled={!sync.online} onPress={runSync} />
      </View>

      {sync.issues.length > 0 && (
        <View style={{ gap: 8, padding: 12, borderRadius: radius.lg, backgroundColor: colors.surfaceSubtle, borderWidth: 1, borderColor: colors.border }}>
          {sync.issues.slice(0, 5).map((issue) => (
            <View key={issue.id} style={{ flexDirection: 'row', gap: 8 }}>
              <AlertTriangle size={16} color={issue.kind === 'stale' ? colors.textMuted : colors.dangerStrong} />
              <AppText variant="meta" style={{ flex: 1 }}>
                {issue.label}: {issue.kind === 'stale' ? 'a newer version from another device was kept.' : issue.message}
              </AppText>
            </View>
          ))}
          <Button label="Dismiss" variant="ghost" height={36} onPress={() => dispatch(clearIssues())} />
        </View>
      )}
    </Card>
  );
}
