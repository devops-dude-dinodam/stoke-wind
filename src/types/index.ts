export type SkillLevel = 'beginner' | 'intermediate' | 'advanced';
export type ConditionStatus = 'green' | 'yellow' | 'red';
export type SpotId = 'pringle' | 'silversands';
export type DirectionRating = 'ideal' | 'good' | 'moderate' | 'poor' | 'dangerous';
export type RidingStyle = 'twin_tip' | 'wave_strapped' | 'wave_strapless';

export interface UserProfile {
  weight: number;
  boardLength: number;
  kiteQuiver: number[];
  skillLevel: SkillLevel;
  ridingStyle: RidingStyle;
  notificationHour: number;
  onboardingComplete: boolean;
}

export interface DailyForecast {
  date: string;
  windSpeedMax: number;
  windGustMax: number;
  windDirectionDeg: number;
  windDirectionLabel: string;
  waveHeightMax: number;
}

export interface WeatherData {
  windSpeed: number;
  windGust: number;
  windDirectionDeg: number;
  windDirectionLabel: string;
  waveHeight: number;
  swellHeight: number;
  swellDirectionDeg: number;
  swellPeriod: number;
  fetchedAt: number;
}

export interface SpotAssessment {
  spotId: SpotId;
  name: string;
  weather: WeatherData | null;
  status: ConditionStatus;
  statusLabel: string;
  directionRating: DirectionRating;
  directionLabel: string;
  isGusty: boolean;
  recommendedKiteSize: number | null;
  matchingKite: number | null;
  kiteSizeLabel: string;
  warnings: string[];
  error: string | null;
}

export interface SpotConfig {
  name: string;
  lat: number;
  lon: number;
  minWind: number;
  optimalMaxWind: number;
  absoluteMaxWind: number;
  dangerSwell: number;
  warningSwell: number;
}

export const SPOTS: Record<SpotId, SpotConfig> = {
  pringle: {
    name: 'Pringle Bay',
    lat: -34.3667,
    lon: 18.8167,
    minWind: 12,
    optimalMaxWind: 25,
    absoluteMaxWind: 30,
    dangerSwell: 3.5,
    warningSwell: 2.0,
  },
  silversands: {
    name: 'Silversands',
    lat: -34.3611,
    lon: 18.9236,
    minWind: 14,
    optimalMaxWind: 30,
    absoluteMaxWind: 40,
    dangerSwell: 2.5,
    warningSwell: 1.5,
  },
};
