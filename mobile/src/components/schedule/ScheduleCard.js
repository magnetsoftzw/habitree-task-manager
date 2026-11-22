import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, View } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { CalendarPlus, MoveHorizontal, RotateCcw, UnfoldHorizontal } from 'lucide-react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { radius } from '../../theme/Tokens';
import AppText from '../ui/AppText';
import { Button, Card, Chip, SegmentedControl } from '../ui/Controls';
import { useToast } from '../ui/Toast';
import ScheduleDial from './ScheduleDial';
import ShiftSheet from './ShiftSheet';
import { applyResize, fetchSchedule, previewResize, resetSchedule } from '../../store/slices/ScheduleSlice';
import { entryInfo } from '../../store/TaskThunks';
import { formatDuration } from '../../utils/Format';
import {
  DAY, HALVES, entriesIn, formatLength, formatRange, freeSlot, halfFor, outsideEntries, piecesForHalf,
} from '../../utils/Schedule';

export default function ScheduleCard({ date, entries = [], nowMinutes, onAddTask, onOpenEntry }) {
  const dispatch = useDispatch();
  const { colors } = useTheme();
  const { show } = useToast();
  const day = useSelector((s) => s.schedule.byDate[date]);
  const segments = day?.segments || [];
  const [half, setHalf] = useState(halfFor(nowMinutes ?? 480));
  const [selectedKey, setSelectedKey] = useState(null);
  const [shifting, setShifting] = useState(null);
  const [resizing, setResizing] = useState(null);

  useEffect(() => { if (date) dispatch(fetchSchedule(date)); }, [date, dispatch]);

  const pieces = useMemo(() => piecesForHalf(segments, half), [segments, half]);
  const halfKeys = useMemo(() => [...new Set(pieces.map((p) => p.segment.key))], [pieces]);

  useEffect(() => {
    if (!segments.length) return;
    if (selectedKey && halfKeys.includes(selectedKey)) return;
    const now = nowMinutes ?? -1;
    const current = segments.find((s) => (now >= s.start && now < s.end) || (now + DAY >= s.start && now + DAY < s.end));
    const pick = current && halfKeys.includes(current.key) ? current.key
      : (pieces.find((p) => p.segment.kind === 'work') || pieces[0])?.segment.key;
    setSelectedKey(pick || null);
  }, [segments, halfKeys, pieces, nowMinutes, selectedKey]);

  const selected = segments.find((s) => s.key === selectedKey) || null;
  const inPeriod = entriesIn(selected, entries);
  const outside = outsideEntries(segments, entries);

  const reset = () => Alert.alert('Reset this day?', 'The default schedule comes back for this day only.', [
    { text: 'Cancel', style: 'cancel' },
    {
      text: 'Reset',
      onPress: async () => {
        const r = await dispatch(resetSchedule(date));
        show(r.error ? r.payload : 'Schedule reset to your default');
      },
    },
  ]);

  const selectedIndex = segments.findIndex((s) => s.key === selectedKey);
  const edges = [selectedIndex > 0 && 'start', selectedIndex > -1 && selectedIndex < segments.length - 1 && 'end'].filter(Boolean);

  const dragResize = async (edge, offsetMinutes) => {
    const body = { date, segmentKey: selected.key, edge, offsetMinutes };
    const p = await dispatch(previewResize(body));
    if (p.error) return show(p.payload);
    if (p.payload.requiresConfirmation) return setResizing({ segment: selected, edge, offset: offsetMinutes });
    const r = await dispatch(applyResize(body));
    if (r.error) return show(r.payload);
    const now = r.payload.schedule.segments.find((s) => s.key === selected.key);
    return show(now ? `${selected.label} now ${formatRange(now.start, now.end)}` : `${selected.label} resized`);
  };

  const addHere = () => {
    const time = freeSlot(segments, entries, 30, { within: selected.key });
    if (!time) return show(`${selected.label} is full`);
    return onAddTask(time);
  };

  if (!day) {
    return (
      <Card>
        <AppText variant="title" accessibilityRole="header" style={{ fontFamily: 'Inter_700Bold' }}>Day schedule</AppText>
        <AppText variant="meta" tone="muted">Loading your schedule…</AppText>
      </Card>
    );
  }

  return (
    <Card style={{ gap: 14 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <View style={{ flex: 1 }}>
          <AppText variant="title" accessibilityRole="header" style={{ fontFamily: 'Inter_700Bold' }}>Day schedule</AppText>
          <AppText variant="caption" tone="muted">{day.isOverride ? 'Adjusted for this day' : 'Your default schedule'}</AppText>
        </View>
        {day.isOverride && <Button label="Reset" icon={RotateCcw} variant="ghost" height={40} onPress={reset} accessibilityLabel="Reset this day to the default schedule" />}
      </View>

      <SegmentedControl label="Half of the day" options={HALVES.map((h) => ({ value: h.value, label: h.label }))} value={half} onChange={setHalf} />

      <ScheduleDial segments={segments} half={half} selectedKey={selectedKey} onSelect={setSelectedKey} onResize={dragResize} nowMinutes={nowMinutes}>
        {selected && (
          <>
            <AppText variant="captionStrong" tone="muted" numberOfLines={1}>{selected.kind === 'work' ? 'Work' : 'Personal'}</AppText>
            <AppText variant="h4" numberOfLines={2} style={{ textAlign: 'center' }}>{selected.label}</AppText>
            <AppText variant="caption" tone="muted" style={{ textAlign: 'center' }}>{formatRange(selected.start, selected.end)}</AppText>
          </>
        )}
      </ScheduleDial>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }} accessibilityLabel="Schedule segments">
        {halfKeys.map((key) => {
          const s = segments.find((x) => x.key === key);
          return (
            <Chip
              key={key}
              label={s.label}
              dot={s.kind === 'work' ? s.color : undefined}
              selected={key === selectedKey}
              accessibilityRole="tab"
              onPress={() => setSelectedKey(key)}
            />
          );
        })}
      </ScrollView>

      {selected && (
        <View style={{ gap: 10, padding: 12, borderRadius: radius.lg, backgroundColor: colors.surfaceSubtle, borderWidth: 1, borderColor: colors.border }} accessibilityLiveRegion="polite">
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            {selected.kind === 'work' && <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: selected.color }} />}
            <View style={{ flex: 1 }}>
              <AppText variant="bodyStrong">{selected.label}</AppText>
              <AppText variant="caption" tone="muted">{formatRange(selected.start, selected.end)} · {formatLength(selected.end - selected.start)}</AppText>
            </View>
          </View>
          {selected.kind === 'personal' ? (
            <>
              <AppText variant="meta" tone="muted">Personal time. Work tasks can't be planned here.</AppText>
              <Button label="Resize" icon={UnfoldHorizontal} variant="secondary" height={44} onPress={() => setResizing({ segment: selected })} accessibilityLabel={`Resize ${selected.label}`} />
            </>
          ) : (
            <>
              {inPeriod.length === 0 && <AppText variant="meta" tone="muted">No tasks planned in this work period.</AppText>}
              {inPeriod.map((e) => {
                const info = entryInfo(e);
                return (
                  <Pressable
                    key={e._id}
                    accessibilityRole="button"
                    accessibilityLabel={`${e.time}, ${info?.title || 'Removed task'}, ${formatDuration(e.duration || 30)}. Options`}
                    onPress={() => onOpenEntry(e)}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44 }}
                  >
                    <AppText variant="metaStrong" numeric style={{ width: 48 }}>{e.time}</AppText>
                    <AppText variant="body" numberOfLines={1} style={{ flex: 1 }} color={info?.done ? colors.textMuted : colors.text}>{info?.title || 'This task was deleted'}</AppText>
                    <AppText variant="caption" tone="muted">{formatDuration(e.duration || 30)}</AppText>
                  </Pressable>
                );
              })}
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Button label="Add task" icon={CalendarPlus} variant="secondary" height={44} style={{ flex: 1 }} onPress={addHere} />
                <Button label="Move" icon={MoveHorizontal} variant="secondary" height={44} style={{ flex: 1 }} onPress={() => setShifting(selected)} accessibilityLabel={`Move ${selected.label}`} />
                <Button label="Resize" icon={UnfoldHorizontal} variant="secondary" height={44} style={{ flex: 1 }} onPress={() => setResizing({ segment: selected })} accessibilityLabel={`Resize ${selected.label}`} />
              </View>
            </>
          )}
        </View>
      )}

      {outside.length > 0 && (
        <AppText variant="caption" tone="muted">
          {outside.length} planned block{outside.length === 1 ? ' sits' : 's sit'} outside your work periods. Change {outside.length === 1 ? 'its' : 'their'} time to fit a period.
        </AppText>
      )}

      {edges.length > 0 && (
        <AppText variant="caption" tone="muted">Drag the circles on the ring to stretch or shrink the selected segment.</AppText>
      )}

      <ShiftSheet visible={!!shifting} onClose={() => setShifting(null)} date={date} segment={shifting} />
      <ShiftSheet
        visible={!!resizing}
        onClose={() => setResizing(null)}
        date={date}
        mode="resize"
        segment={resizing?.segment}
        edges={resizing ? [segments.findIndex((s) => s.key === resizing.segment.key) > 0 && 'start', segments.findIndex((s) => s.key === resizing.segment.key) < segments.length - 1 && 'end'].filter(Boolean) : []}
        initialEdge={resizing?.edge}
        initialOffset={resizing?.offset}
      />
    </Card>
  );
}
