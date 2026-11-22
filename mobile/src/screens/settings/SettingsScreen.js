import React, { useEffect, useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { ChevronDown, ChevronRight, LogOut } from 'lucide-react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { radius } from '../../theme/Tokens';
import AppText from '../../components/ui/AppText';
import { Button, Card, ToggleSwitch } from '../../components/ui/Controls';
import { BackHeader, Screen, ScrollBody } from '../../components/ui/Layout';
import Sheet, { OptionSheet } from '../../components/ui/Sheet';
import { TextField } from '../../components/ui/Fields';
import { useToast } from '../../components/ui/Toast';
import { changePassword, deleteAccount, fetchMe, logout, updateProfile, updateSettings } from '../../store/slices/AuthSlice';
import { setThemeMode } from '../../store/slices/PrefsSlice';
import { clearFocus } from '../../store/slices/FocusSlice';
import { disconnectSocket } from '../../api/Socket';
import { ensurePermission, syncPlanReminders } from '../../utils/Notifications';
import { initials, monthYear } from '../../utils/Format';

const GOALS = [240, 300, 360, 420, 480, 540, 600];
const THEMES = [
  { value: 'system', label: 'Match device' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

function Row({ label, onPress, last, children, danger, icon: Icon, bold }) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, paddingHorizontal: 16, borderBottomWidth: last ? 0 : 1, borderBottomColor: colors.divider, backgroundColor: pressed ? colors.surfaceSubtle : 'transparent' })}
    >
      {Icon && <Icon size={18} color={danger ? colors.dangerStrong : colors.textSecondary} />}
      <AppText variant={bold || danger ? 'title' : 'body'} color={danger ? colors.dangerStrong : colors.text} style={{ flex: 1, fontSize: 15 }}>{label}</AppText>
      {children}
    </Pressable>
  );
}

function PrefRow({ title, body, last, children }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: 16, borderBottomWidth: last ? 0 : 1, borderBottomColor: colors.divider }}>
      <View style={{ flex: 1, gap: 3 }}>
        <AppText variant="title">{title}</AppText>
        {body && <AppText variant="meta" tone="muted">{body}</AppText>}
      </View>
      {children}
    </View>
  );
}

function SelectButton({ value, onPress, label }) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${value}`}
      onPress={onPress}
      style={{ height: 44, paddingHorizontal: 10, borderWidth: 1, borderColor: colors.borderStrong, borderRadius: radius.md, backgroundColor: colors.surface, flexDirection: 'row', alignItems: 'center', gap: 6 }}
    >
      <AppText variant="body" style={{ fontSize: 15 }}>{value}</AppText>
      <ChevronDown size={16} color={colors.textMuted} />
    </Pressable>
  );
}

export default function SettingsScreen({ navigation }) {
  const dispatch = useDispatch();
  const { colors, mode } = useTheme();
  const { show } = useToast();
  const user = useSelector((s) => s.auth.user);
  const todayPlan = useSelector((s) => s.planner.byDate);
  const settings = user?.settings || {};
  const [sheet, setSheet] = useState(null);

  useEffect(() => { dispatch(fetchMe()); }, [dispatch]);

  const save = async (updates) => {
    const r = await dispatch(updateSettings(updates));
    if (r.error) {
      show(r.payload);
      dispatch(fetchMe());
    } else {
      show('Preferences saved');
    }
    return r;
  };

  const toggleReminders = async (on) => {
    if (on && !(await ensurePermission())) {
      return show('Allow notifications for Habitree in your phone settings to get reminders');
    }
    await save({ sessionReminders: on });
    const key = Object.keys(todayPlan).sort().pop();
    if (key) syncPlanReminders(key, todayPlan[key], on);
  };

  const signOut = () => Alert.alert('Log out?', 'You can log back in at any time.', [
    { text: 'Cancel', style: 'cancel' },
    {
      text: 'Log out',
      onPress: () => {
        disconnectSocket();
        syncPlanReminders('', [], false);
        dispatch(clearFocus());
        dispatch(logout());
      },
    },
  ]);

  const goal = settings.dailyGoalMinutes || 480;

  return (
    <Screen>
      <BackHeader title="Settings" onBack={() => navigation.goBack()} />
      <ScrollBody>
        <Card padded={false} style={{ padding: 18, flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <View style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
            <AppText variant="h1Small" color={colors.accent}>{initials(user?.username).slice(0, 1)}</AppText>
          </View>
          <View style={{ flex: 1, gap: 3 }}>
            <AppText variant="h3" style={{ fontFamily: 'Inter_700Bold', fontSize: 18 }} numberOfLines={1}>{user?.username}</AppText>
            <AppText variant="meta" tone="muted" numberOfLines={1}>{user?.email}</AppText>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <View style={{ backgroundColor: colors.accentSoft, borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 1 }}>
                <AppText variant="captionStrong" color={colors.onAccentSoft}>{user?.role || 'Member'}</AppText>
              </View>
              {user?.createdAt && <AppText variant="caption" tone="muted">· Since {monthYear(user.createdAt)}</AppText>}
            </View>
          </View>
        </Card>

        <Card padded={false} accessibilityLabel="Account" style={{ overflow: 'hidden' }}>
          <Row label="Edit profile" onPress={() => setSheet('profile')}><ChevronRight size={18} color={colors.textMuted} /></Row>
          <Row label="Change password" onPress={() => setSheet('password')} last><ChevronRight size={18} color={colors.textMuted} /></Row>
        </Card>

        <Card padded={false} accessibilityLabel="Preferences" style={{ overflow: 'hidden' }}>
          <PrefRow title="Auto rollover" body="Carry unfinished planned tasks to today">
            <ToggleSwitch label="Auto rollover" value={settings.autoRollover !== false} onChange={(v) => save({ autoRollover: v })} />
          </PrefRow>
          <PrefRow title="Daily focus goal">
            <SelectButton label="Daily focus goal" value={`${goal / 60} hours`} onPress={() => setSheet('goal')} />
          </PrefRow>
          <PrefRow title="Session reminders" body="Notify when a focus session ends or a planned block starts">
            <ToggleSwitch label="Session reminders" value={settings.sessionReminders !== false} onChange={toggleReminders} />
          </PrefRow>
          <PrefRow title="Appearance" last>
            <SelectButton label="Appearance" value={THEMES.find((t) => t.value === mode)?.label} onPress={() => setSheet('theme')} />
          </PrefRow>
        </Card>

        <Card padded={false} accessibilityLabel="Session" style={{ overflow: 'hidden' }}>
          <Row label="Log out" icon={LogOut} onPress={signOut} bold />
          <Row label="Delete account…" danger onPress={() => setSheet('delete')} last />
        </Card>
      </ScrollBody>

      <OptionSheet
        visible={sheet === 'goal'}
        onClose={() => setSheet(null)}
        title="Daily focus goal"
        subtitle="Used for your goal ring and the dashed line on charts"
        options={GOALS.map((m) => ({ label: `${m / 60} hours`, selected: goal === m, onPress: () => save({ dailyGoalMinutes: m }) }))}
      />
      <OptionSheet
        visible={sheet === 'theme'}
        onClose={() => setSheet(null)}
        title="Appearance"
        options={THEMES.map((t) => ({ label: t.label, selected: mode === t.value, onPress: () => dispatch(setThemeMode(t.value)) }))}
      />
      <ProfileSheet visible={sheet === 'profile'} user={user} onClose={() => setSheet(null)} />
      <PasswordSheet visible={sheet === 'password'} onClose={() => setSheet(null)} />
      <DeleteSheet visible={sheet === 'delete'} onClose={() => setSheet(null)} />
    </Screen>
  );
}

function ProfileSheet({ visible, user, onClose }) {
  const dispatch = useDispatch();
  const { show } = useToast();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (visible) {
      setUsername(user?.username || '');
      setEmail(user?.email || '');
      setError(null);
    }
  }, [visible, user]);

  const submit = async () => {
    if (!username.trim()) return setError('Username is required');
    setBusy(true);
    const r = await dispatch(updateProfile({ username: username.trim(), email: email.trim() }));
    setBusy(false);
    if (r.error) return setError(r.payload);
    show('Profile updated');
    onClose();
  };

  return (
    <Sheet visible={visible} onClose={onClose} title="Edit profile" footer={<Button label="Save" onPress={submit} loading={busy} height={52} />}>
      <TextField label="Username" value={username} onChangeText={setUsername} autoCapitalize="none" maxLength={60} />
      <TextField label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" error={error} />
    </Sheet>
  );
}

function PasswordSheet({ visible, onClose }) {
  const dispatch = useDispatch();
  const { show } = useToast();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (visible) { setCurrent(''); setNext(''); setConfirm(''); setError(null); }
  }, [visible]);

  const submit = async () => {
    if (next.length < 6) return setError('New password must be at least 6 characters');
    if (next !== confirm) return setError("The new passwords don't match");
    setBusy(true);
    const r = await dispatch(changePassword({ currentPassword: current, newPassword: next }));
    setBusy(false);
    if (r.error) return setError(r.payload);
    show('Password changed');
    onClose();
  };

  return (
    <Sheet visible={visible} onClose={onClose} title="Change password" footer={<Button label="Change password" onPress={submit} loading={busy} height={52} />}>
      <TextField label="Current password" value={current} onChangeText={setCurrent} secureTextEntry autoComplete="current-password" />
      <TextField label="New password" value={next} onChangeText={setNext} secureTextEntry autoComplete="new-password" />
      <TextField label="Confirm new password" value={confirm} onChangeText={setConfirm} secureTextEntry autoComplete="new-password" error={error} />
    </Sheet>
  );
}

function DeleteSheet({ visible, onClose }) {
  const dispatch = useDispatch();
  const { colors } = useTheme();
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (visible) { setPassword(''); setError(null); } }, [visible]);

  const submit = async () => {
    setBusy(true);
    disconnectSocket();
    const r = await dispatch(deleteAccount(password));
    setBusy(false);
    if (r.error) return setError(r.payload);
    dispatch(clearFocus());
  };

  return (
    <Sheet visible={visible} onClose={onClose} title="Delete account" footer={<Button label="Delete my account" variant="danger" onPress={submit} loading={busy} disabled={!password} height={52} />}>
      <View style={{ padding: 14, borderRadius: radius.lg, backgroundColor: colors.dangerBg, borderWidth: 1, borderColor: colors.dangerBorder }}>
        <AppText variant="body" color={colors.dangerInk}>This permanently deletes your tasks, plans, sessions, roadmaps and the projects you own. It can't be undone.</AppText>
      </View>
      <TextField label="Enter your password to confirm" value={password} onChangeText={(t) => { setPassword(t); setError(null); }} secureTextEntry error={error} />
    </Sheet>
  );
}
