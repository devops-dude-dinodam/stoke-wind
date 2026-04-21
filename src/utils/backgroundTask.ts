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
    const twoHours = 2 * 60 * 60 * 1000;

    const newlyGreen = list.filter(
      a => a.status === 'green' && !previousGreenState[a.spotId as SpotId],
    );

    if (newlyGreen.length > 0 && Date.now() - lastNotifiedAt > twoHours) {
      const names = newlyGreen.map(a => a.name).join(' & ');
      const verb = newlyGreen.length > 1 ? 'are' : 'is';
      await sendImmediateNotification(`🟢 ${names} ${verb} a Go!`, buildConditionsSummary(newlyGreen));
      state.setLastNotifiedAt(Date.now());
    }

    const nextGreenState = { pringle: false, silversands: false } as Record<SpotId, boolean>;
    for (const a of list) nextGreenState[a.spotId as SpotId] = a.status === 'green';
    state.setPreviousGreenState(nextGreenState);

    return BackgroundFetch.BackgroundFetchResult.NewData;
  } catch {
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});
