import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import AppText from '../ui/AppText';
import { Button } from '../ui/Controls';
import { TimeField } from '../ui/Fields';
import Sheet from '../ui/Sheet';
import { useToast } from '../ui/Toast';
import MinuteDial from './MinuteDial';
import { focusMinutesOf, logFocusTime, MAX_FOCUS, MIN_FOCUS, setFocusMinutes } from '../../store/slices/FocusSlice';
import { fetchActivity, fetchRangeStats } from '../../store/slices/StatsSlice';
import { clock } from '../../utils/Format';

export function FocusLengthSheet({ visible, onClose }) {
  const dispatch = useDispatch();
  const focus = useSelector((s) => s.focus);
  const [minutes, setMinutes] = useState(25);

  useEffect(() => { if (visible) setMinutes(focusMinutesOf(focus)); }, [visible]);

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title="Session length"
      subtitle={focus.task ? `Working on ${focus.task.title}` : 'No task selected — the time still counts toward your daily goal.'}
      footer={<Button label={`Use ${minutes} min`} onPress={() => { dispatch(setFocusMinutes(minutes)); onClose(); }} height={52} />}
    >
      <MinuteDial value={minutes} onChange={setMinutes} min={MIN_FOCUS} max={MAX_FOCUS} label="Session length in minutes" />
      <AppText variant="meta" tone="muted" style={{ textAlign: 'center' }}>
        A 5 minute break follows each session. End it early any time to save the minutes you've done.
      </AppText>
    </Sheet>
  );
}

export function LogTimeSheet({ visible, onClose }) {
  const dispatch = useDispatch();
  const { show } = useToast();
  const [minutes, setMinutes] = useState(25);
  const [endTime, setEndTime] = useState(clock(new Date()));
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (visible) { setMinutes(25); setEndTime(clock(new Date())); setError(null); }
  }, [visible]);

  const submit = async () => {
    const [h, m] = endTime.split(':').map(Number);
    const end = new Date();
    end.setHours(h || 0, m || 0, 0, 0);
    if (end - new Date() > 60000) return setError("That's in the future. Pick a time that has already passed.");
    setBusy(true);
    const r = await dispatch(logFocusTime({ minutes, endTime: end.toISOString() }));
    setBusy(false);
    if (r.error) return setError(r.payload);
    show(`Logged ${minutes} min`);
    dispatch(fetchRangeStats('Today'));
    dispatch(fetchActivity());
    onClose();
  };

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title="Log focus time"
      subtitle="Add time you worked away from the timer today."
      footer={<Button label={`Log ${minutes} min`} onPress={submit} loading={busy} height={52} />}
    >
      <MinuteDial value={minutes} onChange={(v) => { setMinutes(v); setError(null); }} max={720} label="Minutes worked" />
      <View style={{ flexDirection: 'row' }}>
        <TimeField label="Finished at" value={endTime} onChange={(t) => { setEndTime(t); setError(null); }} />
      </View>
      {error && <AppText variant="meta" tone="danger" accessibilityRole="alert">{error}</AppText>}
    </Sheet>
  );
}
