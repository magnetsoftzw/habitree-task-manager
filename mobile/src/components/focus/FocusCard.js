import React, { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { ChevronDown, Pause, Play, Plus, Square } from 'lucide-react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { radius } from '../../theme/Tokens';
import AppText from '../ui/AppText';
import { useToast } from '../ui/Toast';
import {
  BREAK_MINUTES, elapsedOf, focusMinutesOf, pauseFocus, phaseLengthMs, resetFocus, resumeFocus, saveFocusSession, startFocus,
} from '../../store/slices/FocusSlice';
import { FocusLengthSheet, LogTimeSheet } from './FocusSheets';
import { fetchRangeStats } from '../../store/slices/StatsSlice';
import { ensurePermission } from '../../utils/Notifications';
import { timer } from '../../utils/Format';

export default function FocusCard({ onPickTask }) {
  const dispatch = useDispatch();
  const { colors } = useTheme();
  const { show } = useToast();
  const focus = useSelector((s) => s.focus);
  const [, tick] = useState(0);
  const [sheet, setSheet] = useState(null);

  useEffect(() => {
    if (focus.status !== 'running') return undefined;
    const t = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, [focus.status]);

  const minutes = focusMinutesOf(focus);
  const remaining = phaseLengthMs(focus.phase, minutes) - elapsedOf(focus);
  const onBreak = focus.phase === 'break';
  const active = focus.status !== 'idle';

  const primary = () => {
    if (focus.status === 'running') return dispatch(pauseFocus());
    if (focus.status === 'paused') return dispatch(resumeFocus());
    ensurePermission();
    dispatch(startFocus());
  };

  const finish = async () => {
    if (!onBreak) {
      const result = await dispatch(saveFocusSession());
      if (result.error) show(result.payload);
      else if (result.payload) show(`Saved ${result.payload.durationMinutes} min of focus`);
      else show('Sessions under a minute are not saved');
      dispatch(fetchRangeStats('Today'));
    }
    dispatch(resetFocus());
  };

  const label = focus.status === 'running' ? 'Pause session' : focus.status === 'paused' ? 'Resume session' : 'Start focus session';

  return (
    <View accessibilityLabel="Focus session" style={{ backgroundColor: colors.dark, borderRadius: radius.sheet, padding: 20, gap: 14 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <AppText variant="meta" color={colors.onDarkMuted}>{onBreak ? 'Break' : 'Focus session'}</AppText>
        {active ? (
          <AppText variant="meta" color={colors.onDarkMuted}>{onBreak ? `${BREAK_MINUTES} min break` : `${minutes} min session`}</AppText>
        ) : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Session length ${minutes} minutes. Change`}
            onPress={() => setSheet('length')}
            hitSlop={10}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
          >
            <AppText variant="metaStrong" color={colors.onDarkSoft}>{minutes} min</AppText>
            <ChevronDown size={14} color={colors.onDarkSoft} />
          </Pressable>
        )}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 }}>
        <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
          <AppText variant="timer" color={colors.onDark} accessibilityLabel={`${timer(remaining)} remaining`}>{timer(remaining)}</AppText>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={focus.task ? `Focus task: ${focus.task.title}. Change task` : 'Pick a task to focus on'}
            onPress={active ? undefined : onPickTask}
            disabled={active}
            hitSlop={8}
          >
            <AppText variant="body" color={colors.onDarkSoft} numberOfLines={1}>
              {onBreak ? 'Stretch, breathe, get some water' : focus.task?.title || 'No task selected'}
            </AppText>
          </Pressable>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={label}
          onPress={primary}
          style={({ pressed }) => ({ width: 60, height: 60, borderRadius: 30, backgroundColor: colors.onDark, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.85 : 1 })}
        >
          {focus.status === 'running'
            ? <Pause size={20} color={colors.dark} fill={colors.dark} />
            : <Play size={20} color={colors.dark} fill={colors.dark} style={{ marginLeft: 3 }} />}
        </Pressable>
      </View>
      {!active && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Log focus time you did away from the timer"
          onPress={() => setSheet('log')}
          style={{ alignSelf: 'flex-start', minHeight: 36, paddingHorizontal: 12, borderRadius: radius.md, borderWidth: 1, borderColor: colors.darkBorder, backgroundColor: colors.darkRaised, flexDirection: 'row', alignItems: 'center', gap: 6 }}
        >
          <Plus size={14} color={colors.onDarkSoft} />
          <AppText variant="metaStrong" color={colors.onDarkSoft}>Log time</AppText>
        </Pressable>
      )}
      {active && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={onBreak ? 'Skip break' : 'End and save session'}
          onPress={finish}
          style={{ alignSelf: 'flex-start', minHeight: 36, paddingHorizontal: 12, borderRadius: radius.md, borderWidth: 1, borderColor: colors.darkBorder, backgroundColor: colors.darkRaised, flexDirection: 'row', alignItems: 'center', gap: 6 }}
        >
          <Square size={12} color={colors.onDarkSoft} fill={colors.onDarkSoft} />
          <AppText variant="metaStrong" color={colors.onDarkSoft}>{onBreak ? 'Skip break' : 'End & save'}</AppText>
        </Pressable>
      )}
      <FocusLengthSheet visible={sheet === 'length'} onClose={() => setSheet(null)} />
      <LogTimeSheet visible={sheet === 'log'} onClose={() => setSheet(null)} />
    </View>
  );
}
