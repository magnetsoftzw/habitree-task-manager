import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import * as Haptics from 'expo-haptics';
import { elapsedOf, focusMinutesOf, phaseLengthMs, resetFocus, saveFocusSession, startBreak } from '../../store/slices/FocusSlice';
import { fetchRangeStats } from '../../store/slices/StatsSlice';
import { cancelFocusEnd, scheduleFocusEnd } from '../../utils/Notifications';
import { useToast } from '../ui/Toast';

export default function FocusEngine() {
  const dispatch = useDispatch();
  const focus = useSelector((s) => s.focus);
  const reminders = useSelector((s) => s.auth.user?.settings?.sessionReminders !== false);
  const { show } = useToast();
  const finishing = useRef(false);

  useEffect(() => {
    if (focus.status !== 'running') {
      cancelFocusEnd();
      return undefined;
    }
    const length = phaseLengthMs(focus.phase, focusMinutesOf(focus));
    const remaining = length - elapsedOf(focus);
    if (reminders) scheduleFocusEnd(new Date(Date.now() + remaining), focus.phase, focus.task?.title);
    else cancelFocusEnd();

    const check = async () => {
      if (finishing.current || elapsedOf(focus) < length) return;
      finishing.current = true;
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      if (focus.phase === 'focus') {
        const result = await dispatch(saveFocusSession());
        if (result.error) show(result.payload || 'Could not save the session');
        else show('Session saved. Time for a 5 minute break.');
        dispatch(startBreak());
        dispatch(fetchRangeStats('Today'));
      } else {
        dispatch(resetFocus());
        show('Break is over. Ready when you are.');
      }
      finishing.current = false;
    };

    const interval = setInterval(check, 1000);
    const sub = AppState.addEventListener('change', (s) => { if (s === 'active') check(); });
    check();
    return () => {
      clearInterval(interval);
      sub.remove();
    };
  }, [focus, reminders, dispatch, show]);

  return null;
}
