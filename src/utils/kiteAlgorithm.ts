import { SpotId, SkillLevel, RidingStyle, DirectionRating, ConditionStatus, WeatherData, UserProfile, SpotAssessment, DailyForecast, SPOTS } from '../types';

const SKILL_MULTIPLIER: Record<SkillLevel, number> = {
  beginner: 1.1,
  intermediate: 1.0,
  advanced: 0.9,
};

const STYLE_MULTIPLIER: Record<RidingStyle, number> = {
  twin_tip: 1.0,
  wave_strapped: 0.85,  // board volume reduces pull needed
  wave_strapless: 0.75, // even less power; wave provides energy
};

function getDirectionRating(spotId: SpotId, deg: number): { rating: DirectionRating; label: string } {
  const d = ((deg % 360) + 360) % 360;

  if (spotId === 'pringle') {
    if (d >= 213 && d < 338) return { rating: 'ideal', label: 'Side-on / Onshore' };
    if (d >= 338 || d < 12)  return { rating: 'good',  label: 'Onshore' };
    if (d >= 157 && d < 213) return { rating: 'moderate', label: 'Side' };
    if (d >= 124 && d < 157) return { rating: 'poor',    label: 'Gusty / Expert' };
    if (d >= 57  && d < 124) return { rating: 'dangerous', label: 'Offshore' };
    if (d >= 12  && d < 57)  return { rating: 'poor',    label: 'Side-offshore' };
    return { rating: 'poor', label: 'Variable' };
  }

  // Silversands: SE is ideal (clean cross-shore), NW is offshore danger
  if (d >= 101 && d < 213) return { rating: 'ideal',    label: 'Cross-shore' };
  if (d >= 213 && d < 247) return { rating: 'good',     label: 'Cross-onshore' };
  if (d >= 247 && d < 292) return { rating: 'moderate', label: 'Onshore' };
  if (d >= 57  && d < 101) return { rating: 'moderate', label: 'Side' };
  if (d >= 292 || d < 57)  return { rating: 'dangerous', label: 'Offshore' };
  return { rating: 'poor', label: 'Variable' };
}

function getBoardLengthAdjustment(boardLength: number): number {
  if (boardLength < 138) return 1;   // small board needs more grunt
  if (boardLength > 144) return -1;  // long board planes early
  return 0;
}

export function calculateRecommendedKiteSize(
  weight: number,
  boardLength: number,
  windSpeed: number,
  gustSpeed: number,
  skillLevel: SkillLevel,
  ridingStyle: RidingStyle,
): number {
  const gustDiff = gustSpeed - windSpeed;
  const gustBias = ridingStyle === 'twin_tip' ? 0.7 : 0.8;
  const effectiveSpeed = windSpeed + (gustDiff * gustBias);

  if (effectiveSpeed < 8) return 0;

  const raw = (weight / effectiveSpeed) * 2.0;
  let adjusted = raw * SKILL_MULTIPLIER[skillLevel] * STYLE_MULTIPLIER[ridingStyle];
  adjusted += getBoardLengthAdjustment(boardLength);

  if (ridingStyle !== 'twin_tip' && adjusted > 12) adjusted = 12;
  if (ridingStyle === 'twin_tip' && gustSpeed > 22 && adjusted > 13) adjusted = 12;

  return Math.round(Math.max(adjusted, 0));
}

export function findMatchingKite(quiver: number[], recommendedSize: number): number | null {
  if (quiver.length === 0 || recommendedSize === 0) return null;
  
  // Find the kite in quiver closest to recommended size, within ±2.5m²
  const sorted = [...quiver].sort((a, b) => Math.abs(a - recommendedSize) - Math.abs(b - recommendedSize));
  const best = sorted[0];
  return Math.abs(best - recommendedSize) <= 2.5 ? best : null;
}

function getKiteSizeLabel(effectiveSpeed: number, kiteSize: number | null, isGusty: boolean): string {
  if (!kiteSize) return 'No kite in range';
  const suffix = isGusty ? ' (sized to gusts)' : '';
  
  if (effectiveSpeed < 12) return 'No-Go — too light';
  if (effectiveSpeed <= 14) return `${kiteSize}m — Low Power${suffix}`;
  if (effectiveSpeed <= 22) return `${kiteSize}m — Sweet Spot${suffix}`;
  if (effectiveSpeed <= 30) return `${kiteSize}m — Strong Wind${suffix}`;
  if (effectiveSpeed <= 40) return `${kiteSize}m — Expert Only${suffix}`;
  return 'Danger — No-Go';
}

export function getWeatherCondition(code: number): { label: string; emoji: string; isRain: boolean; isStorm: boolean } {
  if (code === 0)  return { label: 'Clear',        emoji: '☀️',  isRain: false, isStorm: false };
  if (code <= 3)   return { label: 'Cloudy',        emoji: '⛅',  isRain: false, isStorm: false };
  if (code <= 48)  return { label: 'Fog',           emoji: '🌫️', isRain: false, isStorm: false };
  if (code <= 67)  return { label: 'Rain',          emoji: '🌧️', isRain: true,  isStorm: false };
  if (code <= 77)  return { label: 'Snow',          emoji: '❄️',  isRain: false, isStorm: false };
  if (code <= 82)  return { label: 'Showers',       emoji: '🌦️', isRain: true,  isStorm: false };
  return           { label: 'Thunderstorm',         emoji: '⛈️',  isRain: true,  isStorm: true  };
}

export function assessSpot(spotId: SpotId, weather: WeatherData, profile: UserProfile): SpotAssessment {
  const spot = SPOTS[spotId];
  const warnings: string[] = [];

  const { rating: dirRating, label: dirLabel } = getDirectionRating(spotId, weather.windDirectionDeg);

  const gustDiff = weather.windGust - weather.windSpeed;
  const isGusty = gustDiff > 7; // Lowered threshold for "Gusty" label

  const boardLength = profile.boardLength ?? 142;
  const recommendedKiteSize = weather.windSpeed > 0
    ? calculateRecommendedKiteSize(profile.weight, boardLength, weather.windSpeed, weather.windGust, profile.skillLevel, profile.ridingStyle)
    : null;

  const matchingKite = recommendedKiteSize
    ? findMatchingKite(profile.kiteQuiver, recommendedKiteSize)
    : null;

  // Use Weighted speed for the UI label categorization
  const effectiveSpeed = weather.windSpeed + (gustDiff * 0.7);
  const kiteSizeLabel = getKiteSizeLabel(effectiveSpeed, matchingKite ?? recommendedKiteSize, isGusty);

  // Swell thresholds
  const swellDangerThreshold =
    profile.skillLevel === 'advanced' ? spot.dangerSwell * 1.6 :
    profile.skillLevel === 'beginner' ? spot.warningSwell :
    spot.dangerSwell;

  const swellWarningThreshold =
    profile.skillLevel === 'advanced' ? spot.dangerSwell :
    profile.skillLevel === 'beginner' ? spot.warningSwell * 0.6 :
    spot.warningSwell;

  // Warnings
  const wx = getWeatherCondition(weather.weatherCode);
  if (wx.isStorm) warnings.push('Thunderstorm — No-Go, lightning risk with a kite');
  if (wx.isRain && !wx.isStorm) warnings.push('Raining — reduced visibility, slippery launch');

  if (dirRating === 'dangerous') warnings.push('Offshore wind — dangerous for all levels');
  if (dirRating === 'poor' && spotId === 'pringle') warnings.push('Mountain turbulence — very gusty/unpredictable');
  if (isGusty) warnings.push(`High Variance: Sized down for ${weather.windGust}kt gusts`);
  if (gustDiff > 12) warnings.push('Extreme gusts — kite stability is high risk');

  const isWaveRider = profile.ridingStyle !== 'twin_tip';
  if (isWaveRider && weather.waveHeight < 0.5) warnings.push('Swell < 0.5m — flat water, wave riding not ideal');
  if (isWaveRider && recommendedKiteSize !== null && recommendedKiteSize >= 12) {
    warnings.push('Light wind: 12m cap applied — large kites turn too slowly for waves');
  }

  if (weather.waveHeight > swellDangerThreshold) {
    warnings.push(`Heavy swell ${weather.waveHeight.toFixed(1)}m — dangerous shore dump`);
  }

  // Overall status logic
  let status: ConditionStatus = 'yellow';
  let statusLabel: string = 'Marginal';

  const tooLight = weather.windSpeed < spot.minWind;
  const tooStrong = weather.windGust > spot.absoluteMaxWind; 
  const dangerousSwell = weather.waveHeight > swellDangerThreshold;

  const swellNoGo = dangerousSwell && weather.windSpeed < 15;
  const isThunderstorm = getWeatherCondition(weather.weatherCode).isStorm;

  if (dirRating === 'dangerous' || tooStrong || swellNoGo || isThunderstorm || (isGusty && gustDiff > 18)) {
    status = 'red';
    statusLabel = 'No-Go';
  } else if (
    (dirRating === 'ideal' || dirRating === 'good') &&
    !tooLight &&
    weather.windGust <= spot.optimalMaxWind
  ) {
    status = 'green';
    statusLabel = 'Go!';
  } 
  // Everything else is Marginal (Yellow)
  else {
    status = 'yellow';
    statusLabel = 'Caution';
  }

  return {
    spotId,
    name: spot.name,
    weather,
    status,
    statusLabel,
    directionRating: dirRating,
    directionLabel: dirLabel,
    isGusty,
    recommendedKiteSize,
    matchingKite,
    kiteSizeLabel,
    warnings,
    error: null,
  };
}

export function assessDailyForecast(
  spotId: SpotId,
  day: DailyForecast,
  profile: UserProfile,
): { status: ConditionStatus; statusLabel: string; kiteSize: number | null } {
  const spot = SPOTS[spotId];
  const { rating } = getDirectionRating(spotId, day.windDirectionDeg);
  const boardLength = profile.boardLength ?? 142;
  const gustDiff = day.windGustMax - day.windSpeedMax;
  const isGusty = gustDiff > 7;

  const kiteSize = day.windSpeedMax > 0
    ? calculateRecommendedKiteSize(profile.weight, boardLength, day.windSpeedMax, day.windGustMax, profile.skillLevel, profile.ridingStyle)
    : null;

  const swellDanger = profile.skillLevel === 'advanced' ? spot.dangerSwell * 1.6 : spot.dangerSwell;
  const tooLight = day.windSpeedMax < spot.minWind;
  const tooStrong = day.windGustMax > spot.absoluteMaxWind;
  const dangerousSwell = day.waveHeightMax > swellDanger;
  const swellNoGo = dangerousSwell && day.windSpeedMax < 15;

  let status: ConditionStatus;
  let statusLabel: string;

  if (rating === 'dangerous' || tooStrong || swellNoGo || (isGusty && gustDiff > 18)) {
    status = 'red'; statusLabel = 'No-Go';
  } else if (
    (rating === 'ideal' || rating === 'good') && !tooLight &&
    day.windGustMax <= spot.optimalMaxWind && !isGusty
  ) {
    status = 'green'; statusLabel = 'Go!';
  } else if (tooLight || rating === 'poor') {
    status = 'red'; statusLabel = 'No-Go';
  } else {
    status = 'yellow'; statusLabel = 'Marginal';
  }

  return { status, statusLabel, kiteSize };
}

export function buildErrorAssessment(spotId: SpotId, error: string): SpotAssessment {
  return {
    spotId,
    name: SPOTS[spotId].name,
    weather: null,
    status: 'red',
    statusLabel: 'Error',
    directionRating: 'poor',
    directionLabel: '—',
    isGusty: false,
    recommendedKiteSize: null,
    matchingKite: null,
    kiteSizeLabel: '—',
    warnings: [],
    error,
  };
}