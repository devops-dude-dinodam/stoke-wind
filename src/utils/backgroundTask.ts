import * as TaskManager from 'expo-task-manager';
import * as BackgroundFetch from 'expo-background-fetch';
import { SpotId, SpotAssessment } from '../types';
import { BACKGROUND_TASK, buildConditionsSummary, sendImmediateNotification } from './notifications';

// Must be defined at module level before registerBackgroundTask() is called
TaskManager.defineTask(BACKGROUND_TASK, async () => {
  try {
    // Lazy imports to avoid circular deps and ensure store is hydrated
    const { useWaterStore } = await import('../store/useWaterStore');
    const { fetchAllSpots } = await import('./weatherApi');
    const { assessSpot } = await import('./kiteAlgorithm');

    const state = useWaterStore.getState();
    const { profile, previousGreenState, lastNotifiedAt } = state;

    const weatherMap = await fetchAllSpots();
    const result: Record<SpotId, SpotAssessment | null> = { pringle: null, silversands: null };

    for (const id of ['pringle', 'silversands'] as SpotId[]) {
      result[id] = assessSpot(id, weatherMap[id], profile);
    }

    state.setAssessments(result);

    const list = Object.values(result).filter(Boolean) as SpotAssessment[];
    const anyGreen = list.some(a => a.status === 'green');
    const twoHours = 2 * 60 * 60 * 1000;

    if (anyGreen && !previousGreenState && Date.now() - lastNotifiedAt > twoHours) {
      await sendImmediateNotification('🟢 Conditions just turned green!', buildConditionsSummary(list));
      state.setLastNotifiedAt(Date.now());
    }

    state.setPreviousGreenState(anyGreen);

    return BackgroundFetch.BackgroundFetchResult.NewData;
  } catch {
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});
