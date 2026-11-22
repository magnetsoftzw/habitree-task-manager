import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { useFocusEffect } from '@react-navigation/native';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { radius } from '../../theme/Tokens';
import AppText from '../../components/ui/AppText';
import { Button, IconButton } from '../../components/ui/Controls';
import { BackHeader, Screen, ScrollBody } from '../../components/ui/Layout';
import PlanSheet from '../../components/plan/PlanSheet';
import { fetchPlanner, fetchPlannerRange } from '../../store/slices/PlannerSlice';
import { fetchRangeStats } from '../../store/slices/StatsSlice';
import { addDays, dayTitle, formatMinutes, fromDateKey, monthTitle, startOfWeek, toDateKey, todayKey } from '../../utils/Format';
import { TASK_STATUS_LABELS } from '../../utils/Status';
import { entryInfo } from '../../store/TaskThunks';

const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const monthKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

export default function CalendarScreen({ navigation }) {
  const dispatch = useDispatch();
  const { colors } = useTheme();
  const [month, setMonth] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const [selected, setSelected] = useState(todayKey());
  const [planning, setPlanning] = useState(false);
  const mk = monthKey(month);
  const stats = useSelector((s) => s.stats.ranges[mk]);
  const range = useSelector((s) => s.planner.range);
  const entries = useSelector((s) => s.planner.byDate[selected]);
  const goal = useSelector((s) => s.auth.user?.settings?.dailyGoalMinutes || 480);

  const cells = useMemo(() => {
    const first = startOfWeek(month);
    const last = new Date(month.getFullYear(), month.getMonth() + 1, 0);
    const out = [];
    for (let d = first; d <= last || out.length % 7; d = addDays(d, 1)) out.push(d);
    return out;
  }, [month]);

  const loadMonth = useCallback(() => {
    dispatch(fetchRangeStats(mk));
    dispatch(fetchPlannerRange({ from: toDateKey(cells[0]), to: toDateKey(cells[cells.length - 1]) }));
  }, [dispatch, mk, cells]);

  useFocusEffect(useCallback(() => { loadMonth(); }, [loadMonth]));
  useEffect(() => { dispatch(fetchPlanner(selected)); }, [dispatch, selected]);

  const focusByDay = useMemo(() => Object.fromEntries((stats?.days || []).map((d) => [d.date, d.minutes])), [stats]);
  const today = todayKey();

  const shift = (n) => {
    const next = new Date(month.getFullYear(), month.getMonth() + n, 1);
    setMonth(next);
    setSelected(toDateKey(next.getMonth() === new Date().getMonth() && next.getFullYear() === new Date().getFullYear() ? new Date() : next));
  };

  const selDate = fromDateKey(selected);
  const sorted = entries || [];

  return (
    <Screen>
      <BackHeader title={monthTitle(month)} onBack={() => navigation.goBack()} backLabel="Back to today">
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <IconButton icon={ChevronLeft} label="Previous month" onPress={() => shift(-1)} />
          <IconButton icon={ChevronRight} label="Next month" onPress={() => shift(1)} />
        </View>
      </BackHeader>

      <View accessibilityLabel={monthTitle(month)} style={{ paddingHorizontal: 12, paddingBottom: 12 }}>
        <View importantForAccessibility="no-hide-descendants" style={{ flexDirection: 'row', paddingVertical: 4 }}>
          {WEEKDAYS.map((w, i) => <AppText key={i} variant="tinyStrong" tone="muted" style={{ flex: 1, textAlign: 'center' }}>{w}</AppText>)}
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', rowGap: 2 }}>
          {cells.map((d) => {
            const key = toDateKey(d);
            const inMonth = d.getMonth() === month.getMonth();
            const on = key === selected;
            const isToday = key === today;
            const has = inMonth && (focusByDay[key] > 0 || (range[key] && range[key].length > 0));
            return (
              <Pressable
                key={key}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                accessibilityLabel={`${dayTitle(d)}${has ? ', has activity' : ''}`}
                disabled={!inMonth}
                onPress={() => setSelected(key)}
                style={{ width: `${100 / 7}%`, height: 48, alignItems: 'center', justifyContent: 'center', gap: 3 }}
              >
                <View style={{
                  width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center',
                  backgroundColor: on ? colors.accent : 'transparent',
                  borderWidth: isToday && !on ? 2 : 0,
                  borderColor: colors.accent,
                }}>
                  <AppText variant="bodyStrong" color={on ? colors.onAccent : inMonth ? colors.text : colors.textFaint}>{d.getDate()}</AppText>
                </View>
                <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: has ? colors.chartSecondary : 'transparent' }} />
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={{ flex: 1, backgroundColor: colors.surface, borderTopWidth: 1, borderColor: colors.border, borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet }}>
        <ScrollBody contentStyle={{ paddingTop: 18 }} gap={12}>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}>
            <AppText variant="h2" accessibilityRole="header" style={{ fontSize: 18 }}>{dayTitle(selDate)}</AppText>
            <AppText variant="meta" tone="muted">{formatMinutes(focusByDay[selected] || 0)} focused · {Math.round(((focusByDay[selected] || 0) / goal) * 100)}% of goal</AppText>
          </View>
          {!entries && <ActivityIndicator color={colors.accent} />}
          {sorted.map((e) => { const info = entryInfo(e); return (
            <View key={e._id} style={{ flexDirection: 'row', gap: 12, padding: 12, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg }}>
              <View style={{ width: 4, borderRadius: 2, backgroundColor: e.taskId?.groupId?.color || e.taskId?.projectId?.color || colors.textMuted }} />
              <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                <AppText variant="title" numberOfLines={2}>{info?.title || 'Deleted task'}{e.taskType === 'projectTask' && e.taskId?.projectId ? ` · ${e.taskId.projectId.name}` : ''}</AppText>
                <AppText variant="caption" tone="muted">{e.time} · {info?.subtask ? `Subtask of ${e.taskId.title}` : TASK_STATUS_LABELS[info?.status] || 'Planned'}</AppText>
              </View>
            </View>
          ); })}
          {entries && sorted.length === 0 && (
            <View style={{ padding: 20, backgroundColor: colors.bg, borderRadius: radius.lg, alignItems: 'center' }}>
              <AppText variant="body" tone="muted">Nothing scheduled for this day.</AppText>
            </View>
          )}
          {selected >= today && <Button label="Plan this day" onPress={() => setPlanning(true)} />}
        </ScrollBody>
      </View>

      <PlanSheet
        visible={planning}
        onClose={() => { setPlanning(false); dispatch(fetchPlanner(selected)); loadMonth(); }}
        date={selected}
      />
    </Screen>
  );
}
