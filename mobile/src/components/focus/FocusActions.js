import { useCallback } from 'react';
import { Alert } from 'react-native';
import { useDispatch, useSelector, useStore } from 'react-redux';
import { saveFocusSession, startFocus } from '../../store/slices/FocusSlice';
import { navigateTo } from '../../navigation/NavigationRef';
import { ensurePermission } from '../../utils/Notifications';

export function useStartFocus() {
  const dispatch = useDispatch();
  const store = useStore();
  const focus = useSelector((s) => s.focus);

  return useCallback((ref, { stay } = {}) => {
    const begin = async () => {
      const current = store.getState().focus;
      if (current.phase === 'focus' && current.status !== 'idle') await dispatch(saveFocusSession());
      dispatch(startFocus(ref || null));
      ensurePermission();
      if (!stay) navigateTo('Main', { screen: 'Today' });
    };

    const busy = focus.phase === 'focus' && focus.status !== 'idle';
    if (busy && focus.task?.taskId !== ref?.taskId) {
      Alert.alert(
        'Switch focus task?',
        `Your session on ${focus.task?.title || 'no task'} will be saved and a new one started.`,
        [{ text: 'Cancel', style: 'cancel' }, { text: 'Switch', onPress: begin }],
      );
      return;
    }
    if (busy) {
      if (!stay) navigateTo('Main', { screen: 'Today' });
      return;
    }
    begin();
  }, [dispatch, focus, store]);
}
