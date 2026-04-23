import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { UserProfile, SpotAssessment, SpotId, BestWindow, HourlySlot } from '../types';

interface WaterState {
  profile: UserProfile;
  assessments: Record<SpotId, SpotAssessment | null>;
  isFetching: boolean;
  lastFetchedAt: number | null;
  lastNotifiedAt: number;
  previousGreenState: Record<SpotId, boolean>;
  bestWindows: Record<SpotId, BestWindow | null>;
  hourlySlots: Record<SpotId, HourlySlot[]>;

  setProfile: (profile: Partial<UserProfile>) => void;
  completeOnboarding: () => void;
  setAssessments: (assessments: Record<SpotId, SpotAssessment | null>) => void;
  setFetching: (v: boolean) => void;
  setLastNotifiedAt: (t: number) => void;
  setPreviousGreenState: (v: Record<SpotId, boolean>) => void;
  setBestWindows: (windows: Record<SpotId, BestWindow | null>) => void;
  setHourlySlots: (slots: Record<SpotId, HourlySlot[]>) => void;
}

export const useWaterStore = create<WaterState>()(
  persist(
    (set) => ({
      profile: {
        weight: 80,
        boardLength: 142,
        kiteQuiver: [],
        skillLevel: 'intermediate',
        ridingStyle: 'twin_tip',
        notificationHour: 7,
        onboardingComplete: false,
      },
      assessments: {
        pringle: null,
        silversands: null,
      },
      isFetching: false,
      lastFetchedAt: null,
      lastNotifiedAt: 0,
      previousGreenState: { pringle: false, silversands: false },
      bestWindows: { pringle: null, silversands: null },
      hourlySlots: { pringle: [], silversands: [] },

      setProfile: (partial) =>
        set((s) => ({ profile: { ...s.profile, ...partial } })),

      completeOnboarding: () =>
        set((s) => ({ profile: { ...s.profile, onboardingComplete: true } })),

      setAssessments: (assessments) =>
        set({ assessments, lastFetchedAt: Date.now() }),

      setFetching: (isFetching) => set({ isFetching }),

      setLastNotifiedAt: (lastNotifiedAt) => set({ lastNotifiedAt }),

      setPreviousGreenState: (previousGreenState) => set({ previousGreenState }),

      setBestWindows: (bestWindows) => set({ bestWindows }),

      setHourlySlots: (hourlySlots) => set({ hourlySlots }),
    }),
    {
      name: 'water-storage-v1',
      version: 2,
      migrate: (persisted: any, version: number) => {
        if (version < 2 && typeof persisted?.previousGreenState === 'boolean') {
          persisted.previousGreenState = { pringle: false, silversands: false };
        }
        return persisted;
      },
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({
        profile: s.profile,
        lastNotifiedAt: s.lastNotifiedAt,
        previousGreenState: s.previousGreenState,
      }),
    },
  ),
);
