import { SpotId, WeatherData, DailyForecast, HourlySlot, SPOTS } from '../types';

const WEATHER_BASE = 'https://api.open-meteo.com/v1/forecast';
const MARINE_BASE = 'https://marine-api.open-meteo.com/v1/marine';

function degreesToLabel(deg: number): string {
  const dirs = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'];
  return dirs[Math.round(deg / 22.5) % 16];
}

function getCurrentHourIndex(times: string[]): number {
  // API returns times in Africa/Johannesburg (UTC+2, no DST) — use fixed offset
  const jhb = new Date(Date.now() + 2 * 3_600_000);
  const nowStr = `${jhb.getUTCFullYear()}-${String(jhb.getUTCMonth()+1).padStart(2,'0')}-${String(jhb.getUTCDate()).padStart(2,'0')}T${String(jhb.getUTCHours()).padStart(2,'0')}:00`;
  const idx = times.indexOf(nowStr);
  return idx >= 0 ? idx : 0;
}

async function fetchWeather(lat: number, lon: number): Promise<{ windSpeed: number; windGust: number; windDir: number; weatherCode: number; temperature: number }> {
  const url = `${WEATHER_BASE}?latitude=${lat}&longitude=${lon}&hourly=wind_speed_10m,wind_direction_10m,wind_gusts_10m,weather_code,temperature_2m&wind_speed_unit=kn&timezone=Africa%2FJohannesburg&forecast_days=1&models=ecmwf_ifs025`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Weather API error: ${res.status}`);
  const data = await res.json();
  const idx = getCurrentHourIndex(data.hourly.time);
  return {
    windSpeed: data.hourly.wind_speed_10m[idx],
    windGust: data.hourly.wind_gusts_10m[idx],
    windDir: data.hourly.wind_direction_10m[idx],
    weatherCode: data.hourly.weather_code[idx] ?? 0,
    temperature: Math.round(data.hourly.temperature_2m[idx] ?? 0),
  };
}

async function fetchMarine(lat: number, lon: number): Promise<{ waveHeight: number; swellHeight: number; swellDir: number; swellPeriod: number }> {
  const url = `${MARINE_BASE}?latitude=${lat}&longitude=${lon}&hourly=wave_height,swell_wave_height,swell_wave_direction,swell_wave_period&timezone=Africa%2FJohannesburg&forecast_days=1`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Marine API error: ${res.status}`);
  const data = await res.json();
  const idx = getCurrentHourIndex(data.hourly.time);
  return {
    waveHeight: data.hourly.wave_height[idx] ?? 0,
    swellHeight: data.hourly.swell_wave_height[idx] ?? 0,
    swellDir: data.hourly.swell_wave_direction[idx] ?? 0,
    swellPeriod: data.hourly.swell_wave_period[idx] ?? 0,
  };
}

export async function fetchSpotWeather(spotId: SpotId): Promise<WeatherData> {
  const spot = SPOTS[spotId];
  const [wind, marine] = await Promise.all([
    fetchWeather(spot.lat, spot.lon),
    fetchMarine(spot.lat, spot.lon),
  ]);
  return {
    windSpeed: Math.round(wind.windSpeed),
    windGust: Math.round(wind.windGust),
    windDirectionDeg: wind.windDir,
    windDirectionLabel: degreesToLabel(wind.windDir),
    waveHeight: marine.waveHeight,
    swellHeight: marine.swellHeight,
    swellDirectionDeg: marine.swellDir,
    swellPeriod: marine.swellPeriod,
    weatherCode: wind.weatherCode,
    temperature: wind.temperature,
    fetchedAt: Date.now(),
  };
}

export async function fetchDailyForecast(spotId: SpotId): Promise<DailyForecast[]> {
  const spot = SPOTS[spotId];
  const [weatherRes, marineRes] = await Promise.all([
    fetch(`${WEATHER_BASE}?latitude=${spot.lat}&longitude=${spot.lon}&daily=wind_speed_10m_max,wind_gusts_10m_max,wind_direction_10m_dominant&wind_speed_unit=kn&timezone=Africa%2FJohannesburg&forecast_days=4&models=ecmwf_ifs025`),
    fetch(`${MARINE_BASE}?latitude=${spot.lat}&longitude=${spot.lon}&daily=wave_height_max&timezone=Africa%2FJohannesburg&forecast_days=4`),
  ]);
  if (!weatherRes.ok || !marineRes.ok) throw new Error('Forecast fetch failed');
  const [w, m] = await Promise.all([weatherRes.json(), marineRes.json()]);

  // days 1-3 (skip index 0 = today, already shown in current conditions)
  return [1, 2, 3].map(i => {
    const raw = new Date(w.daily.time[i]);
    const date = raw.toLocaleDateString('en-ZA', { weekday: 'short', day: 'numeric', month: 'short' });
    const windDir = w.daily.wind_direction_10m_dominant[i];
    return {
      date,
      windSpeedMax: Math.round(w.daily.wind_speed_10m_max[i] ?? 0),
      windGustMax: Math.round(w.daily.wind_gusts_10m_max[i] ?? 0),
      windDirectionDeg: windDir,
      windDirectionLabel: degreesToLabel(windDir),
      waveHeightMax: m.daily.wave_height_max[i] ?? 0,
    };
  });
}

export async function fetchTodayHourly(spotId: SpotId): Promise<HourlySlot[]> {
  const spot = SPOTS[spotId];
  const url = `${WEATHER_BASE}?latitude=${spot.lat}&longitude=${spot.lon}&hourly=wind_speed_10m,wind_direction_10m,wind_gusts_10m&wind_speed_unit=kn&timezone=Africa%2FJohannesburg&forecast_days=1&models=ecmwf_ifs025`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Hourly fetch failed: ${res.status}`);
  const data = await res.json();
  const currentIdx = getCurrentHourIndex(data.hourly.time);
  return data.hourly.time.slice(currentIdx).map((t: string, i: number) => {
    const idx = currentIdx + i;
    const dir = data.hourly.wind_direction_10m[idx];
    return {
      hour: parseInt(t.split('T')[1].split(':')[0], 10),
      windSpeed: Math.round(data.hourly.wind_speed_10m[idx] ?? 0),
      windGust: Math.round(data.hourly.wind_gusts_10m[idx] ?? 0),
      windDirectionDeg: dir,
      windDirectionLabel: degreesToLabel(dir),
    };
  });
}

export async function fetchAllSpots(): Promise<Record<SpotId, WeatherData>> {
  const [pringle, silversands] = await Promise.all([
    fetchSpotWeather('pringle'),
    fetchSpotWeather('silversands'),
  ]);
  return { pringle, silversands };
}
