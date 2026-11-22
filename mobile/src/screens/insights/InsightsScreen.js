import React, { useCallback, useMemo, useState } from 'react';
import { View } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { useFocusEffect } from '@react-navigation/native';
import Svg, { Line } from 'react-native-svg';
import { useTheme } from '../../theme/ThemeProvider';
import AppText from '../../components/ui/AppText';
import { Card, EmptyState, ProgressBar, SegmentedControl } from '../../components/ui/Controls';
import { PageHeader, Screen, ScrollBody } from '../../components/ui/Layout';
import { fetchRangeStats, fetchTaskVolume, rangeBounds } from '../../store/slices/StatsSlice';
import { fetchInventory } from '../../store/slices/TasksSlice';
import { addDays, formatGoal, formatMinutes, fullDate, monthTitle, rangeLabel, toDateKey, todayKey, weekdayShort } from '../../utils/Format';

const CHART_HEIGHT = 160;

function BarChart({ days, goal, highlight, labelEvery = 1 }) {
  const { colors } = useTheme();
  const [width, setWidth] = useState(0);
  const max = Math.max(goal, ...days.map((d) => d.minutes));
  const goalY = CHART_HEIGHT - (goal / max) * CHART_HEIGHT;
  const gap = days.length > 10 ? 3 : 10;

  return (
    <View>
      <View
        accessibilityRole="image"
        accessibilityLabel={`Focus time per day, ${formatMinutes(days.reduce((s, d) => s + d.minutes, 0))} total`}
        onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
        style={{ height: CHART_HEIGHT, flexDirection: 'row', alignItems: 'flex-end', gap, borderBottomWidth: 1, borderBottomColor: colors.borderStrong }}
      >
        {width > 0 && (
          <Svg width={width} height={2} style={{ position: 'absolute', top: goalY - 1, left: 0 }}>
            <Line x1={0} y1={1} x2={width} y2={1} stroke={colors.textFaint} strokeWidth={2} strokeDasharray="6 4" />
          </Svg>
        )}
        {days.map((d) => {
          const h = d.minutes ? Math.max(3, (d.minutes / max) * CHART_HEIGHT) : 3;
          const on = d.date === highlight;
          return (
            <View key={d.date} style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end', height: '100%' }}>
              <View style={{ width: '100%', maxWidth: 30, height: h, borderTopLeftRadius: 4, borderTopRightRadius: 4, backgroundColor: on ? colors.accent : d.minutes ? colors.chartSecondary : colors.divider }} />
            </View>
          );
        })}
      </View>
      <View importantForAccessibility="no-hide-descendants" style={{ flexDirection: 'row', gap, marginTop: 6 }}>
        {days.map((d, i) => (
          <AppText
            key={d.date}
            variant={d.date === highlight ? 'tinyStrong' : 'tiny'}
            color={d.date === highlight ? colors.text : colors.textMuted}
            style={{ flex: 1, textAlign: 'center' }}
            numberOfLines={1}
          >
            {i % labelEvery === 0 || d.date === highlight ? d.label : ''}
          </AppText>
        ))}
      </View>
    </View>
  );
}

export default function InsightsScreen() {
  const dispatch = useDispatch();
  const { colors } = useTheme();
  const [range, setRange] = useState('Week');
  const data = useSelector((s) => s.stats.ranges[range]);
  const todayData = useSelector((s) => s.stats.ranges.Today);
  const week = useSelector((s) => s.stats.ranges.Week);
  const volume = useSelector((s) => s.stats.volume);
  const loading = useSelector((s) => s.stats.loading[range]);
  const error = useSelector((s) => s.stats.error);
  const goal = useSelector((s) => s.auth.user?.settings?.dailyGoalMinutes || 480);
  const inventory = useSelector((s) => s.tasks.inventory);

  const load = useCallback(() => {
    dispatch(fetchRangeStats(range));
    if (range !== 'Today') dispatch(fetchRangeStats('Today'));
    if (range === 'Today') dispatch(fetchRangeStats('Week'));
    dispatch(fetchTaskVolume());
    dispatch(fetchInventory());
  }, [dispatch, range]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const now = new Date();
  const { from, to } = rangeBounds(range === 'Today' ? 'Week' : range, now);
  const chartSource = range === 'Today' ? week : data;
  const days = useMemo(() => {
    const byDate = Object.fromEntries((chartSource?.days || []).map((d) => [d.date, d.minutes]));
    const out = [];
    for (let d = from; d < to; d = addDays(d, 1)) {
      const key = toDateKey(d);
      out.push({ date: key, minutes: byDate[key] || 0, label: range === 'Month' ? String(d.getDate()) : weekdayShort(d)[0] });
    }
    return out;
  }, [chartSource, from.getTime(), to.getTime(), range]);

  const overline = range === 'Today' ? fullDate(now) : range === 'Month' ? monthTitle(now) : rangeLabel(from, to);
  const todayMinutes = todayData?.totalMinutes || 0;
  const best = data?.bestDay;
  const bestDate = best && new Date(`${best.date}T12:00:00`);
  const breakdown = (data?.byProject || []).filter((b) => b.minutes > 0);
  const maxBucket = Math.max(1, ...breakdown.map((b) => b.minutes));
  const completedInProjects = (data?.byProject || []).filter((b) => b.kind === 'project' && b.completed > 0);

  const statsFrom = rangeBounds(range, now).from;
  const statsTo = rangeBounds(range, now).to;
  const tomorrow = addDays(new Date(now.getFullYear(), now.getMonth(), now.getDate()), 1);
  const elapsedDays = Math.max(1, Math.round((Math.min(statsTo, tomorrow) - statsFrom) / 86400000));
  const allTasks = Object.values(inventory).flat();
  const statusRows = [
    { label: 'Done', match: ['Completed'], color: colors.status.Completed.fg },
    { label: 'In progress', match: ['On-Going'], color: colors.status['On-Going'].fg },
    { label: 'Not started', match: ['Not Started'], color: colors.textFaint },
    { label: 'On hold or shelved', match: ['On-Hold', 'Shelved'], color: colors.status.Shelved.fg },
  ].map((r) => ({ ...r, n: allTasks.filter((t) => r.match.includes(t.status)).length }));

  const kpis = [
    { label: 'Focus time', value: formatMinutes(data?.totalMinutes || 0), note: `${data?.sessionsCount || 0} session${data?.sessionsCount === 1 ? '' : 's'}` },
    { label: 'Today vs goal', value: `${Math.round((todayMinutes / goal) * 100)}%`, note: `of ${formatGoal(goal)}` },
    { label: 'Tasks done', value: volume ? `${volume.completedTasks} / ${volume.totalTasks}` : '—', note: `${data?.tasksCompleted || 0} this ${range === 'Today' ? 'day' : range.toLowerCase()}` },
    {
      label: 'Best day',
      value: best ? (range === 'Month' ? `${bestDate.getDate()} ${monthTitle(bestDate).slice(0, 3)}` : weekdayShort(bestDate)) : '—',
      note: best ? formatMinutes(best.minutes) : 'No sessions',
    },
    {
      label: 'Daily average',
      value: formatMinutes(Math.round((data?.totalMinutes || 0) / elapsedDays)),
      note: `Across ${elapsedDays} day${elapsedDays === 1 ? '' : 's'} so far`,
    },
  ];

  return (
    <Screen>
      <PageHeader overline={overline} title="Insights" />
      <View style={{ paddingHorizontal: 20, paddingBottom: 12 }}>
        <SegmentedControl
          role="group"
          label="Time range"
          value={range}
          onChange={setRange}
          options={['Today', 'Week', 'Month'].map((v) => ({ value: v, label: v }))}
        />
      </View>
      <ScrollBody refreshing={!!loading && !!data} onRefresh={load}>
        {error && !data && <EmptyState title="Couldn't load your insights" body={error} action="Try again" onAction={load} />}

        <View accessibilityLabel="Key numbers" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          {kpis.map((k) => (
            <Card key={k.label} padded={false} style={{ width: '48.5%', flexGrow: 1, padding: 14, gap: 4 }}>
              <AppText variant="caption" tone="muted">{k.label}</AppText>
              <AppText variant="statLarge" numeric>{k.value}</AppText>
              <AppText variant="tiny" tone="muted">{k.note}</AppText>
            </Card>
          ))}
        </View>

        <Card style={{ gap: 14 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <AppText variant="title" accessibilityRole="header" style={{ fontFamily: 'Inter_700Bold' }}>{range === 'Today' ? 'This week' : 'Focus time per day'}</AppText>
            <AppText variant="caption" tone="muted">Dashed = {formatGoal(goal)} goal</AppText>
          </View>
          <BarChart days={days} goal={goal} highlight={todayKey()} labelEvery={range === 'Month' ? 5 : 1} />
        </Card>

        <Card style={{ gap: 12 }}>
          <AppText variant="title" accessibilityRole="header" style={{ fontFamily: 'Inter_700Bold' }}>Where the time went</AppText>
          {breakdown.length === 0 && (
            <AppText variant="body" tone="muted">Start a focus session on a task or project to see where your time goes.</AppText>
          )}
          {breakdown.map((b) => (
            <View key={b.key} style={{ gap: 6 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                  <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: b.color }} />
                  <AppText variant="body" numberOfLines={1} style={{ flex: 1 }}>{b.name}</AppText>
                </View>
                <AppText variant="bodyStrong" numeric>{formatMinutes(b.minutes)}</AppText>
              </View>
              <ProgressBar value={(b.minutes / maxBucket) * 100} height={6} color={b.color} />
            </View>
          ))}
        </Card>

        {allTasks.length > 0 && (
          <Card style={{ gap: 12 }}>
            <AppText variant="title" accessibilityRole="header" style={{ fontFamily: 'Inter_700Bold' }}>Tasks by status</AppText>
            <View accessibilityRole="image" accessibilityLabel={statusRows.map((r) => `${r.label} ${r.n}`).join(', ')} style={{ flexDirection: 'row', height: 10, borderRadius: 5, overflow: 'hidden', backgroundColor: colors.divider }}>
              {statusRows.filter((r) => r.n).map((r) => <View key={r.label} style={{ flex: r.n, backgroundColor: r.color }} />)}
            </View>
            {statusRows.map((r) => (
              <View key={r.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: r.color }} />
                <AppText variant="body" style={{ flex: 1 }}>{r.label}</AppText>
                <AppText variant="bodyStrong" numeric>{r.n}</AppText>
              </View>
            ))}
          </Card>
        )}

        {completedInProjects.length > 0 && (
          <Card style={{ gap: 10 }}>
            <AppText variant="title" accessibilityRole="header" style={{ fontFamily: 'Inter_700Bold' }}>Completed by project</AppText>
            {completedInProjects.map((b) => (
              <View key={b.key} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: b.color }} />
                <AppText variant="body" style={{ flex: 1 }} numberOfLines={1}>{b.name}</AppText>
                <AppText variant="bodyStrong" numeric>{b.completed} done</AppText>
              </View>
            ))}
          </Card>
        )}
      </ScrollBody>
    </Screen>
  );
}
