import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { useFocusEffect } from '@react-navigation/native';
import { Archive, Bell, Calendar, Check, Clock, ExternalLink, Play, Plus, Trash2 } from 'lucide-react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { radius } from '../../theme/Tokens';
import AppText from '../../components/ui/AppText';
import { Button, Card, Chip, DashedButton, EmptyState, ProgressBar } from '../../components/ui/Controls';
import { PageHeader, Screen, ScrollBody, SectionTitle } from '../../components/ui/Layout';
import Sheet, { OptionSheet } from '../../components/ui/Sheet';
import { TimeField } from '../../components/ui/Fields';
import { useToast } from '../../components/ui/Toast';
import FocusCard from '../../components/focus/FocusCard';
import PlanSheet from '../../components/plan/PlanSheet';
import { useStartFocus } from '../../components/focus/FocusActions';
import { addToPlanner, fetchPlanner, removeFromPlanner, rolloverPlanner, updatePlannerEntry } from '../../store/slices/PlannerSlice';
import { fetchInventory, setTaskStatus } from '../../store/slices/TasksSlice';
import { fetchNotifications } from '../../store/slices/NotificationsSlice';
import NotificationsSheet from '../../components/notifications/NotificationsSheet';
import ScheduleCard from '../../components/schedule/ScheduleCard';
import { fetchSchedule } from '../../store/slices/ScheduleSlice';
import { freeSlot } from '../../utils/Schedule';
import { fetchActivity, fetchRangeStats } from '../../store/slices/StatsSlice';
import { entryInfo, isGroupEntry, refForEntry, setRefDone } from '../../store/TaskThunks';
import { clock, formatDuration, formatGoal, formatMinutes, fullDate, greeting, initials, nextHalfHour, timeToMinutes, todayKey } from '../../utils/Format';
import { TASK_STATUS_LABELS } from '../../utils/Status';
import { syncPlanReminders } from '../../utils/Notifications';
import { selectFocusTask } from '../../store/slices/FocusSlice';

const DURATIONS = [15, 30, 45, 60, 90, 120];

function Stat({ label, value, children }) {
  return (
    <Card padded={false} style={{ flex: 1, padding: 14, gap: 4 }}>
      <AppText variant="caption" tone="muted">{label}</AppText>
      <AppText variant="stat" numeric>{value}</AppText>
      {children}
    </Card>
  );
}

const blockState = (entry, nowMins, focus) => {
  const info = entryInfo(entry);
  if (!info) return 'missing';
  if (info.done) return 'done';
  const start = timeToMinutes(entry.time);
  const focusing = focus.status !== 'idle' && focus.phase === 'focus' && focus.task?.taskId === info.task._id
    && (focus.task?.subtaskId || null) === (entry.subtaskId || null);
  if (focusing || (nowMins >= start && nowMins < start + (entry.duration || 30))) return 'now';
  return start >= nowMins ? 'next' : 'past';
};

function PlanRow({ entry, state, upNext, onAction, onOpen }) {
  const { colors } = useTheme();
  const task = entry.taskId;
  const info = entryInfo(entry);
  const title = info?.title;
  const done = state === 'done';
  const now = state === 'now';
  const color = task?.groupId?.color || task?.projectId?.color || colors.textMuted;
  const context = info?.subtask ? `Subtask of ${task.title}`
    : isGroupEntry(entry) && task ? `${task.doneCount || 0} of ${task.taskCount || 0} tasks done`
      : task?.groupId?.name || task?.projectId?.name || 'Uncategorized';
  const statusText = !task ? 'Removed task' : done ? 'Done' : now ? 'In progress' : upNext ? 'Up next' : state === 'past' ? 'Missed' : 'Planned';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${entry.time}, ${title || 'Removed task'}, ${statusText}. Options`}
      onPress={onOpen}
      style={{
        flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: radius.xl,
        backgroundColor: now ? colors.nowBg : colors.surface,
        borderWidth: now ? 1.5 : 1,
        borderColor: now ? colors.nowBorder : colors.border,
      }}
    >
      <View style={{ width: 48 }}>
        <AppText variant="metaStrong" numeric style={{ fontFamily: 'Inter_700Bold' }}>{entry.time}</AppText>
        <AppText variant="tiny" tone="muted">{formatDuration(entry.duration || 30)}</AppText>
      </View>
      <View style={{ width: 4, alignSelf: 'stretch', borderRadius: 2, backgroundColor: color }} />
      <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
        <AppText
          variant="title"
          numberOfLines={1}
          color={done ? colors.textMuted : colors.text}
          style={done && { textDecorationLine: 'line-through' }}
        >
          {title || 'This task was deleted'}
        </AppText>
        <AppText variant="caption" tone="muted" numberOfLines={1}>{context} · {statusText}</AppText>
      </View>
      {task && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={done ? (isGroupEntry(entry) ? `Completed. Options for ${title}` : `Completed. Mark ${title} not done`) : `Start session for ${title}`}
          onPress={onAction}
          style={{
            width: 44, height: 44, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center',
            backgroundColor: done ? colors.accentSoft : now ? colors.accent : colors.surface,
            borderWidth: done || now ? 0 : 1,
            borderColor: colors.border,
          }}
        >
          {done
            ? <Check size={16} color={colors.onAccentSoft} strokeWidth={2.6} />
            : <Play size={12} color={now ? colors.onAccent : colors.textSecondary} fill={now ? colors.onAccent : colors.textSecondary} />}
        </Pressable>
      )}
    </Pressable>
  );
}

export default function TodayScreen({ navigation }) {
  const dispatch = useDispatch();
  const { colors } = useTheme();
  const { show } = useToast();
  const startFocusOn = useStartFocus();
  const user = useSelector((s) => s.auth.user);
  const focus = useSelector((s) => s.focus);
  const [date, setDate] = useState(todayKey());
  const entries = useSelector((s) => s.planner.byDate[date]);
  const loading = useSelector((s) => s.planner.loading);
  const today = useSelector((s) => s.stats.ranges.Today);
  const activity = useSelector((s) => s.stats.activity);
  const inventory = useSelector((s) => s.tasks.inventory);
  const unread = useSelector((s) => s.notifications.items.filter((n) => !n.isRead).length);
  const [notifOpen, setNotifOpen] = useState(false);
  const [planOpen, setPlanOpen] = useState(false);
  const [planTime, setPlanTime] = useState(null);
  const segments = useSelector((s) => s.schedule.byDate[date]?.segments);
  const [pickFocus, setPickFocus] = useState(false);
  const [menuEntry, setMenuEntry] = useState(null);
  const [editEntry, setEditEntry] = useState(null);
  const [now, setNow] = useState(new Date());

  const goal = user?.settings?.dailyGoalMinutes || 480;

  const load = useCallback(async () => {
    const key = todayKey();
    setDate(key);
    await dispatch(rolloverPlanner(key));
    dispatch(fetchPlanner(key));
    dispatch(fetchSchedule(key));
    dispatch(fetchRangeStats('Today'));
    dispatch(fetchActivity());
    dispatch(fetchInventory());
    dispatch(fetchNotifications());
  }, [dispatch]);

  useFocusEffect(useCallback(() => {
    load();
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(t);
  }, [load]));

  useEffect(() => {
    if (entries) syncPlanReminders(date, entries, user?.settings?.sessionReminders !== false);
  }, [entries, date, user?.settings?.sessionReminders]);

  const nowMins = now.getHours() * 60 + now.getMinutes();
  const rows = useMemo(() => (entries || []).map((e) => ({ entry: e, state: blockState(e, nowMins, focus) })), [entries, nowMins, focus]);
  const upNextId = rows.find((r) => r.state === 'next')?.entry._id;
  const doneCount = rows.filter((r) => r.state === 'done').length;

  const focused = today?.totalMinutes || 0;
  const goalPct = Math.min(999, Math.round((focused / goal) * 100));

  const toggleDone = async (entry, done) => {
    const result = await dispatch(setRefDone({ ref: refForEntry(entry), done, previousStatus: entry.taskId?.status }));
    if (result.error) show(result.payload);
  };

  const suggestions = useMemo(() => {
    const open = Object.values(inventory).flat().filter((t) => t.status !== 'Completed' && t.status !== 'Shelved');
    return [...open.filter((t) => t.status === 'On-Going'), ...open.filter((t) => t.status !== 'On-Going')].slice(0, 3);
  }, [inventory]);

  const suggest = async (task) => {
    const time = (segments && freeSlot(segments, entries || [], 30, { after: nowMins })) || nextHalfHour();
    const r = await dispatch(addToPlanner({ date, taskType: 'task', taskId: task._id, time, duration: 30 }));
    if (r.error) show(r.payload);
  };

  const shelve = async (entry) => {
    const r = await dispatch(setTaskStatus({ id: entry.taskId._id, status: 'Shelved', previous: entry.taskId.status }));
    if (r.error) return show(r.payload);
    const removed = await dispatch(removeFromPlanner({ date, entryId: entry._id }));
    show(removed.error ? removed.payload : 'Task shelved and removed from the plan');
  };

  const menuInfo = menuEntry ? entryInfo(menuEntry) : null;
  const menuOptions = menuEntry ? [
    menuInfo && !menuInfo.done && { label: 'Start focus session', icon: Play, onPress: () => startFocusOn(refForEntry(menuEntry), { stay: true }) },
    menuInfo && !isGroupEntry(menuEntry) && {
      label: menuInfo.done ? 'Mark not done' : 'Mark done',
      icon: Check,
      onPress: () => toggleDone(menuEntry, !menuInfo.done),
    },
    { label: 'Change time or length', icon: Clock, onPress: () => setEditEntry(menuEntry) },
    menuEntry.taskId && (menuEntry.taskType || 'task') === 'task' && { label: 'Open task', icon: ExternalLink, onPress: () => navigation.navigate('TaskDetails', { taskId: menuEntry.taskId._id }) },
    menuEntry.taskId && (menuEntry.taskType === 'projectTask' || isGroupEntry(menuEntry)) && { label: 'Open project', icon: ExternalLink, onPress: () => navigation.navigate('Projects', { screen: 'ProjectDetail', params: { projectId: menuEntry.projectId, view: 'list' }, initial: false }) },
    menuInfo && !menuInfo.done && !menuInfo.subtask && (menuEntry.taskType || 'task') === 'task' && {
      label: 'Shelve task',
      icon: Archive,
      hint: 'Set it aside and remove it from the plan',
      onPress: () => shelve(menuEntry),
    },
    {
      label: 'Remove from plan',
      icon: Trash2,
      danger: true,
      onPress: async () => {
        const r = await dispatch(removeFromPlanner({ date, entryId: menuEntry._id }));
        if (r.error) show(r.payload);
      },
    },
  ] : [];

  return (
    <Screen>
      <PageHeader overline={fullDate(now)} title={greeting(now)}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={unread ? `Notifications, ${unread} unread` : 'Notifications'}
          onPress={() => { setNotifOpen(true); dispatch(fetchNotifications()); }}
          style={{ width: 44, height: 44, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' }}
        >
          <Bell size={20} color={colors.textSecondary} />
          {unread > 0 && <View style={{ position: 'absolute', top: 9, right: 10, width: 9, height: 9, borderRadius: 5, backgroundColor: colors.dangerStrong, borderWidth: 2, borderColor: colors.surface }} />}
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Calendar"
          onPress={() => navigation.navigate('Calendar')}
          style={{ width: 44, height: 44, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' }}
        >
          <Calendar size={20} color={colors.textSecondary} />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Profile and settings"
          onPress={() => navigation.navigate('Settings')}
          style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' }}
        >
          <AppText variant="bodyStrong" color={colors.accent} style={{ fontFamily: 'Inter_700Bold' }}>{initials(user?.username).slice(0, 1)}</AppText>
        </Pressable>
      </PageHeader>

      <ScrollBody refreshing={loading} onRefresh={load}>
        <FocusCard onPickTask={() => setPickFocus(true)} />

        <View accessibilityLabel="Today at a glance" style={{ flexDirection: 'row', gap: 10 }}>
          <Stat label="Goal" value={`${goalPct}%`}>
            <ProgressBar value={goalPct} />
          </Stat>
          <Stat label="Focused" value={formatMinutes(focused)}>
            <AppText variant="tiny" tone="muted">of {formatGoal(goal)}</AppText>
          </Stat>
          <Stat label="Sessions" value={String(today?.sessionsCount || 0)}>
            <AppText variant="tiny" tone="muted">today</AppText>
          </Stat>
        </View>

        <View style={{ gap: 10 }}>
          <SectionTitle title="Today's plan" right={rows.length ? `${rows.length} block${rows.length === 1 ? '' : 's'} · ${doneCount} done` : 'No blocks yet'} />
          {rows.length > 0 ? rows.map(({ entry, state }) => (
            <PlanRow
              key={entry._id}
              entry={entry}
              state={state}
              upNext={entry._id === upNextId}
              onOpen={() => setMenuEntry(entry)}
              onAction={() => (state !== 'done' ? startFocusOn(refForEntry(entry), { stay: true }) : isGroupEntry(entry) ? setMenuEntry(entry) : toggleDone(entry, false))}
            />
          )) : entries && (
            <EmptyState title="Nothing planned yet" body="Pick a few tasks to build your day, or start a free session above." />
          )}
          {entries && rows.length === 0 && suggestions.length > 0 && (
            <Card style={{ gap: 4 }}>
              <AppText variant="overline" tone="muted">Suggested from your tasks</AppText>
              {suggestions.map((t) => (
                <View key={t._id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 52 }}>
                  <View style={{ width: 4, height: 32, borderRadius: 2, backgroundColor: t.groupId?.color || colors.textMuted }} />
                  <Pressable accessibilityRole="link" onPress={() => navigation.navigate('TaskDetails', { taskId: t._id })} style={{ flex: 1, minWidth: 0 }}>
                    <AppText variant="title" numberOfLines={1}>{t.title}</AppText>
                    <AppText variant="caption" tone="muted" numberOfLines={1}>{t.groupId?.name || 'Uncategorized'} · {t.category || 'General'}</AppText>
                  </Pressable>
                  <Button label="Add" variant="secondary" height={40} accessibilityLabel={`Add ${t.title} to today`} onPress={() => suggest(t)} />
                </View>
              ))}
            </Card>
          )}
          <DashedButton label="Add to today" icon={Plus} onPress={() => setPlanOpen(true)} />
        </View>

        <ScheduleCard
          date={date}
          entries={entries || []}
          nowMinutes={nowMins}
          onAddTask={(time) => { setPlanTime(time); setPlanOpen(true); }}
          onOpenEntry={setMenuEntry}
        />

        <Card style={{ gap: 12 }}>
          <AppText variant="title" accessibilityRole="header" style={{ fontFamily: 'Inter_700Bold' }}>Recent activity</AppText>
          {activity.length === 0 && <AppText variant="body" tone="muted">Tasks you complete will show up here.</AppText>}
          {activity.slice(0, 4).map((a) => {
            const at = new Date(a.at);
            const sameDay = at.toDateString() === new Date().toDateString();
            return (
              <View key={`${a.taskType}-${a.id}`} style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
                <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
                  <Check size={12} color={colors.onAccentSoft} strokeWidth={3} />
                </View>
                <AppText variant="body" style={{ flex: 1 }}>
                  <AppText variant="body" tone="muted">{a.verb} </AppText>
                  <AppText variant="bodyStrong">{a.title}</AppText>
                </AppText>
                <AppText variant="caption" tone="muted">{sameDay ? clock(at) : 'Earlier'}</AppText>
              </View>
            );
          })}
        </Card>
      </ScrollBody>

      <PlanSheet visible={planOpen} onClose={() => { setPlanOpen(false); setPlanTime(null); }} date={date} presetTime={planTime} />
      <PlanSheet visible={pickFocus} onClose={() => setPickFocus(false)} title="Focus on" onPick={(ref) => dispatch(selectFocusTask(ref))} />
      <OptionSheet
        visible={!!menuEntry}
        onClose={() => setMenuEntry(null)}
        title={menuInfo?.title || 'Plan block'}
        subtitle={menuEntry ? `${menuEntry.time} · ${formatDuration(menuEntry.duration || 30)} · ${menuInfo?.subtask ? `Subtask of ${menuEntry.taskId.title}` : TASK_STATUS_LABELS[menuInfo?.status] || 'Task unavailable'}` : ''}
        options={menuOptions}
      />
      <EditBlockSheet entry={editEntry} date={date} onClose={() => setEditEntry(null)} />
      <NotificationsSheet visible={notifOpen} onClose={() => setNotifOpen(false)} />
    </Screen>
  );
}

function EditBlockSheet({ entry, date, onClose }) {
  const dispatch = useDispatch();
  const { show } = useToast();
  const [time, setTime] = useState('08:00');
  const [duration, setDuration] = useState(30);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (entry) {
      setTime(entry.time);
      setDuration(entry.duration || 30);
    }
  }, [entry]);

  const save = async () => {
    setBusy(true);
    const r = await dispatch(updatePlannerEntry({ date, entryId: entry._id, time, duration }));
    setBusy(false);
    if (r.error) return show(r.payload);
    onClose();
  };

  return (
    <Sheet visible={!!entry} onClose={onClose} title="Change block" subtitle={entry ? entryInfo(entry)?.title : ''} footer={<Button label="Save" onPress={save} loading={busy} />}>
      <TimeField label="Start time" value={time} onChange={setTime} />
      <View style={{ gap: 8 }}>
        <AppText variant="label">Duration</AppText>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {DURATIONS.map((d) => <Chip key={d} label={formatDuration(d)} selected={duration === d} onPress={() => setDuration(d)} />)}
        </ScrollView>
      </View>
    </Sheet>
  );
}
