import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { UserProfile, SpotAssessment, SpotId } from '../types';

interface WaterState {
  profile: UserProfile;
  assessments: Record<SpotId, SpotAssessment | null>;
  isFetching: boolean;
  lastFetchedAt: number | null;
  lastNotifiedAt: number;
  previousGreenState: boolean;

  setProfile: (profile: Partial<UserProfile>) => void;
  completeOnboarding: () => void;
  setAssessments: (assessments: Record<SpotId, SpotAssessment | null>) => void;
  setFetching: (v: boolean) => void;
  setLastNotifiedAt: (t: number) => void;
  setPreviousGreenState: (v: boolean) => void;
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
      previousGreenState: false,

      setProfile: (partial) =>
        set((s) => ({ profile: { ...s.profile, ...partial } })),

      completeOnboarding: () =>
        set((s) => ({ profile: { ...s.profile, onboardingComplete: true } })),

      setAssessments: (assessments) =>
        set({ assessments, lastFetchedAt: Date.now() }),

      setFetching: (isFetching) => set({ isFetching }),

      setLastNotifiedAt: (lastNotifiedAt) => set({ lastNotifiedAt }),

      setPreviousGreenState: (previousGreenState) => set({ previousGreenState }),
    }),
    {
      name: 'water-storage-v1',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({
        profile: s.profile,
        lastNotifiedAt: s.lastNotifiedAt,
        previousGreenState: s.previousGreenState,
      }),
    },
  ),
);
