import * as Notifications from 'expo-notifications';
import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';
import { SpotAssessment } from '../types';

export const BACKGROUND_TASK = 'water-conditions-check';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function requestNotificationPermission(): Promise<boolean> {
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') return true;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

export function buildConditionsSummary(assessments: SpotAssessment[]): string {
  return assessments
    .map(a => {
      const icon = a.status === 'green' ? '🟢' : a.status === 'yellow' ? '🟡' : '🔴';
      if (!a.weather) return `${icon} ${a.name}: No data`;
      const kite = a.matchingKite ? ` · ${a.kiteSizeLabel}` : '';
      return `${icon} ${a.name}: ${a.weather.windSpeed}kts ${a.weather.windDirectionLabel}${kite}`;
    })
    .join('\n');
}

export async function sendImmediateNotification(title: string, body: string): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    content: { title, body },
    trigger: null,
  });
}

export async function scheduleDailyNotification(hour: number, body: string): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
  await Notifications.scheduleNotificationAsync({
    content: {
      title: '🌊 Water — Daily Conditions',
      body,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour,
      minute: 0,
    },
  });
}


export async function registerBackgroundTask(): Promise<void> {
  const status = await BackgroundFetch.getStatusAsync();
  if (status === BackgroundFetch.BackgroundFetchStatus.Restricted ||
      status === BackgroundFetch.BackgroundFetchStatus.Denied) return;

  const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_TASK);
  if (isRegistered) return;

  await BackgroundFetch.registerTaskAsync(BACKGROUND_TASK, {
    minimumInterval: 60 * 60, // 1 hour
    stopOnTerminate: false,
    startOnBoot: true,
  });
}
