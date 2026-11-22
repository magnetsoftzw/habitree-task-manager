import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { fromDateKey, timeToMinutes } from './Format';

const FOCUS_ID = 'focus-phase-end';
const PLAN_PREFIX = 'plan-';

let configured = false;

const configure = async () => {
  if (configured) return;
  configured = true;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
  });
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Reminders',
      importance: Notifications.AndroidImportance.HIGH,
    });
  }
};

export const ensurePermission = async () => {
  try {
    await configure();
    const current = await Notifications.getPermissionsAsync();
    if (current.granted) return true;
    if (!current.canAskAgain) return false;
    return (await Notifications.requestPermissionsAsync()).granted;
  } catch {
    return false;
  }
};

const schedule = (identifier, title, body, date) => Notifications.scheduleNotificationAsync({
  identifier,
  content: { title, body },
  trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date, channelId: 'default' },
});

export const scheduleFocusEnd = async (date, phase, title) => {
  try {
    await configure();
    await Notifications.cancelScheduledNotificationAsync(FOCUS_ID).catch(() => {});
    if (!(await Notifications.getPermissionsAsync()).granted) return;
    await schedule(
      FOCUS_ID,
      phase === 'break' ? 'Break is over' : 'Focus session complete',
      phase === 'break' ? 'Ready for the next session?' : `Nice work${title ? ` on ${title}` : ''}. Take a 5 minute break.`,
      date,
    );
  } catch {}
};

export const cancelFocusEnd = () => Notifications.cancelScheduledNotificationAsync(FOCUS_ID).catch(() => {});

export const syncPlanReminders = async (dateKey, entries, enabled) => {
  try {
    await configure();
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    await Promise.all(scheduled
      .filter((n) => n.identifier.startsWith(PLAN_PREFIX))
      .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)));
    if (!enabled || !(await Notifications.getPermissionsAsync()).granted) return;

    const day = fromDateKey(dateKey);
    const now = Date.now();
    await Promise.all(entries.map((entry) => {
      const at = new Date(day.getTime() + timeToMinutes(entry.time) * 60000);
      if (at.getTime() <= now || !entry.taskId || entry.taskId.status === 'Completed') return null;
      return schedule(`${PLAN_PREFIX}${entry._id}`, `Starting now: ${entry.taskId.title}`, `Planned for ${entry.time}. Open Habitree to start a focus session.`, at);
    }));
  } catch {}
};
