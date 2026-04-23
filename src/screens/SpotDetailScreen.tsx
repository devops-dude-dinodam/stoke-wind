import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, StatusBar, ActivityIndicator, Image,
  Share, Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import {
  ArrowLeft, Wind, Waves, AlertTriangle, Zap,
  CheckCircle, XCircle, MinusCircle, Navigation, Calendar,
  ArrowUp, ArrowDown, Share2, Clock,
} from 'lucide-react-native';
import Svg, { Line, Polygon } from 'react-native-svg';
import Animated, {
  useSharedValue, useAnimatedStyle, withRepeat, withTiming, withDelay, Easing,
} from 'react-native-reanimated';
import { theme } from '../theme/theme';
import { SpotId, ConditionStatus, DirectionRating, DailyForecast, BestWindow, SpotAssessment, HourlySlot } from '../types';
import { useWaterStore } from '../store/useWaterStore';
import { fetchDailyForecast } from '../utils/weatherApi';
import { assessDailyForecast, getWeatherCondition, getDirectionRating } from '../utils/kiteAlgorithm';
import { getNextTideEvent, formatHoursAway } from '../utils/tideCalc';

const spotImages: Record<SpotId, any> = {
  pringle: require('../../assets/pringle.png'),
  silversands: require('../../assets/silversands.png'),
};

type Props = {
  navigation: NativeStackNavigationProp<any>;
  route: RouteProp<any>;
};

export default function SpotDetailScreen({ navigation, route }: Props) {
  const spotId = route.params?.spotId as SpotId;
  const assessment = useWaterStore(s => s.assessments[spotId]);
  const profile = useWaterStore(s => s.profile);
  const bestWindow = useWaterStore(s => s.bestWindows[spotId]);
  const hourlySlots = useWaterStore(s => s.hourlySlots[spotId]);
  const [forecast, setForecast] = useState<DailyForecast[] | null>(null);
  const [forecastLoading, setForecastLoading] = useState(true);

  useEffect(() => {
    fetchDailyForecast(spotId)
      .then(setForecast)
      .catch(() => setForecast([]))
      .finally(() => setForecastLoading(false));
  }, [spotId]);

  if (!assessment) {
    return (
      <SafeAreaView style={s.root}>
        <Text style={s.errorText}>No data available.</Text>
      </SafeAreaView>
    );
  }

  const { name, weather, status, directionLabel, directionRating, isGusty, kiteSizeLabel, matchingKite, recommendedKiteSize, warnings, error } = assessment;
  const colors = statusColors(status);

  return (
    <SafeAreaView style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor={theme.colors.background} />

      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <ArrowLeft size={22} color={theme.colors.textSecondary} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>{name}</Text>
        <View style={s.headerRight}>
          <TouchableOpacity onPress={() => shareConditions(assessment, bestWindow)} style={s.shareBtn}>
            <Share2 size={18} color={theme.colors.textSecondary} />
          </TouchableOpacity>
          <View style={[s.statusPill, { backgroundColor: colors.badgeBg }]}>
            <StatusIcon status={status} size={13} color={colors.text} />
            <Text style={[s.statusText, { color: colors.text }]}>{assessment.statusLabel}</Text>
          </View>
        </View>
      </View>

      <ScrollView contentContainerStyle={s.scroll}>

        {error ? (
          <Text style={s.errorText}>{error}</Text>
        ) : weather ? (
          <>
            {/* Satellite image + wind direction overlay */}
            <View style={s.mapBlock}>
              <Image source={spotImages[spotId]} style={s.spotImage} resizeMode="cover" />
              <WindFlow deg={weather.windDirectionDeg} windSpeed={weather.windSpeed} windGust={weather.windGust} />
              <View style={s.mapLabel}>
                <Text style={s.mapLabelText}>
                  {weather.windDirectionLabel}  ·  {weather.windSpeed} kts
                </Text>
              </View>
            </View>

            {/* Wind block */}
            <View style={s.block}>
              <View style={s.blockHeader}>
                <Wind size={15} color={theme.colors.primary} />
                <Text style={s.blockTitle}>Wind</Text>
              </View>
              <View style={s.statRow}>
                <Stat label="Speed" value={`${weather.windSpeed} kts`} />
                <Stat label="Gusts" value={`${weather.windGust} kts`} highlight={isGusty} />
                <Stat label="Direction" value={weather.windDirectionLabel} color={theme.colors.primary} />
                <Stat label="Temp" value={`${weather.temperature}°C`} />
              </View>
              {(() => { const wx = getWeatherCondition(weather.weatherCode); return (
                <View style={s.wxRow}>
                  <Text style={s.wxEmoji}>{wx.emoji}</Text>
                  <Text style={[s.wxLabel, wx.isStorm && { color: theme.colors.red }, wx.isRain && !wx.isStorm && { color: theme.colors.yellow }]}>{wx.label}</Text>
                </View>
              ); })()}
              <View style={[s.directionBadge, { borderColor: directionRatingBorder(directionRating) }]}>
                <Navigation size={13} color={directionRatingColor(directionRating)} />
                <Text style={[s.directionText, { color: directionRatingColor(directionRating) }]}>
                  {weather.windDirectionLabel} · {directionLabel}
                </Text>
              </View>
              {hourlySlots && hourlySlots.length > 0 && (
                <HourlyWindStrip spotId={spotId} slots={hourlySlots} />
              )}
              {isGusty && (
                <Text style={s.gustNote}>
                  Gust range {weather.windGust - weather.windSpeed} kts above average — kite sized to gusts for safety
                </Text>
              )}
              {bestWindow && (
                <View style={s.windowRow}>
                  <Clock size={13} color={theme.colors.primary} />
                  <Text style={s.windowText}>
                    {`Best today: ${formatHour(bestWindow.startHour)} – ${formatHour(bestWindow.endHour)}  ·  ${bestWindow.peakWindSpeed}kts ${bestWindow.windDirectionLabel}${bestWindow.kiteSize ? `  ·  ${bestWindow.kiteSize}m` : ''}`}
                  </Text>
                </View>
              )}
            </View>

            {/* Kite recommendation block */}
            {(matchingKite || recommendedKiteSize) && (
              <View style={[s.block, s.kiteBlock, { borderColor: colors.border }]}>
                <View style={s.kiteHeader}>
                  <Zap size={18} color={colors.text} />
                  <Text style={[s.kiteSize, { color: colors.text }]}>
                    {matchingKite ?? recommendedKiteSize}m
                  </Text>
                </View>
                <Text style={[s.kiteLabel, { color: colors.text }]}>{kiteSizeLabel}</Text>
                {!matchingKite && recommendedKiteSize && (
                  <Text style={s.kiteNote}>Not in your quiver — closest match needed</Text>
                )}
              </View>
            )}

            {/* Swell block */}
            <View style={s.block}>
              <View style={s.blockHeader}>
                <Waves size={15} color={theme.colors.primary} />
                <Text style={s.blockTitle}>Swell</Text>
              </View>
              <View style={s.statRow}>
                <Stat label="Height" value={`${weather.waveHeight.toFixed(1)}m`} />
                {weather.swellPeriod > 0 && <Stat label="Period" value={`${weather.swellPeriod.toFixed(0)}s`} />}
                {weather.swellHeight > 0 && <Stat label="Swell" value={`${weather.swellHeight.toFixed(1)}m`} />}
              </View>
              <TideRow />
            </View>

            {/* Warnings block */}
            {warnings.length > 0 && (
              <View style={s.block}>
                <View style={s.blockHeader}>
                  <AlertTriangle size={15} color={theme.colors.yellow} />
                  <Text style={[s.blockTitle, { color: theme.colors.yellow }]}>Warnings</Text>
                </View>
                {warnings.map(w => (
                  <View key={w} style={s.warningRow}>
                    <View style={s.warningDot} />
                    <Text style={s.warningText}>{w}</Text>
                  </View>
                ))}
              </View>
            )}
            {/* 3-day forecast block */}
            <View style={s.block}>
              <View style={s.blockHeader}>
                <Calendar size={15} color={theme.colors.primary} />
                <Text style={s.blockTitle}>3-Day Outlook</Text>
              </View>
              {forecastLoading ? (
                <ActivityIndicator color={theme.colors.primary} size="small" style={{ marginVertical: 8 }} />
              ) : forecast && forecast.length > 0 ? (
                forecast.map(day => {
                  const { status, statusLabel, kiteSize } = assessDailyForecast(spotId, day, profile);
                  const colors = statusColors(status);
                  return (
                    <View key={day.date} style={s.forecastRow}>
                      <Text style={s.forecastDate}>{day.date}</Text>
                      <View style={s.forecastMid}>
                        <Text style={s.forecastWind}>
                          {day.windSpeedMax}<Text style={s.forecastUnit}>kts </Text>
                          <Text style={{ color: theme.colors.primary }}>{day.windDirectionLabel}</Text>
                        </Text>
                        <Text style={s.forecastSwell}>{day.waveHeightMax.toFixed(1)}m swell</Text>
                      </View>
                      <View style={s.forecastRight}>
                        {kiteSize ? <Text style={[s.forecastKite, { color: colors.text }]}>{kiteSize}m</Text> : null}
                        <View style={[s.forecastBadge, { backgroundColor: colors.badgeBg }]}>
                          <Text style={[s.forecastBadgeText, { color: colors.text }]}>{statusLabel}</Text>
                        </View>
                      </View>
                    </View>
                  );
                })
              ) : (
                <Text style={s.errorText}>Forecast unavailable.</Text>
              )}
            </View>
          </>
        ) : (
          <Text style={s.errorText}>No weather data loaded — go back and refresh.</Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function WindFlow({ deg, windSpeed, windGust }: { deg: number; windSpeed: number; windGust: number }) {
  // Particles travel downwind
  const travelDeg = (deg + 180) % 360;
  const rad = (travelDeg - 90) * (Math.PI / 180);
  const dx = Math.cos(rad);
  const dy = Math.sin(rad);

  // Use average of lull and gust as representative speed
  const avgSpeed = (windSpeed + windGust) / 2;
  const count = Math.round(Math.min(20, Math.max(4, avgSpeed * 0.55)));
  const baseDuration = Math.max(650, 3200 - avgSpeed * 72);

  const particles = useMemo(
    () => Array.from({ length: count }, (_, i) => ({
      startX: Math.random() * 380,
      startY: Math.random() * 220,
      duration: baseDuration + Math.random() * baseDuration * 0.4,
      delay: i * Math.round(2200 / count),
    })),
    [count, baseDuration],
  );

  return (
    <View style={s.windOverlay}>
      {particles.map((p, i) => (
        <WindParticle
          key={i}
          startX={p.startX}
          startY={p.startY}
          duration={p.duration}
          delay={p.delay}
          dx={dx}
          dy={dy}
          rotateDeg={travelDeg}
        />
      ))}
    </View>
  );
}

function WindParticle({ startX, startY, duration, delay, dx, dy, rotateDeg }: {
  startX: number; startY: number; duration: number; delay: number;
  dx: number; dy: number; rotateDeg: number;
}) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withDelay(
      delay,
      withRepeat(withTiming(1, { duration, easing: Easing.linear }), -1, false),
    );
  }, [duration]);

  const style = useAnimatedStyle(() => {
    const p = progress.value;
    const opacity = p < 0.15 ? p / 0.15 : p > 0.72 ? (1 - p) / 0.28 : 0.85;
    return {
      transform: [
        { translateX: startX + p * dx * 260 },
        { translateY: startY + p * dy * 260 },
        { rotate: `${rotateDeg}deg` },
      ],
      opacity,
    };
  });

  return (
    <Animated.View style={[{ position: 'absolute' }, style]}>
      <Svg width={10} height={20}>
        <Line x1={5} y1={18} x2={5} y2={6} stroke="rgba(255,255,255,0.9)" strokeWidth={2} strokeLinecap="round" />
        <Polygon points="5,1 1.5,8 8.5,8" fill="rgba(255,255,255,0.9)" />
      </Svg>
    </Animated.View>
  );
}

function HourlyWindStrip({ spotId, slots }: { spotId: SpotId; slots: HourlySlot[] }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={s.stripScroll}
      contentContainerStyle={s.stripContent}
    >
      {slots.map(slot => {
        const { rating } = getDirectionRating(spotId, slot.windDirectionDeg);
        const isDangerous = rating === 'dangerous';
        const isLight = slot.windSpeed < 8;
        const arrowColor = isDangerous
          ? theme.colors.red
          : isLight
            ? theme.colors.textMuted
            : rating === 'ideal' || rating === 'good'
              ? theme.colors.green
              : theme.colors.yellow;
        const rotation = (slot.windDirectionDeg + 180) % 360;

        return (
          <View key={slot.hour} style={s.stripSlot}>
            <Text style={s.stripHour}>{String(slot.hour).padStart(2, '0')}</Text>
            <View style={[s.stripArrow, { transform: [{ rotate: `${rotation}deg` }] }]}>
              <Text style={[s.stripArrowChar, { color: arrowColor }]}>↑</Text>
            </View>
            <Text style={[s.stripSpeed, { color: arrowColor }]}>{slot.windSpeed}</Text>
          </View>
        );
      })}
    </ScrollView>
  );
}

function TideRow() {
  const tide = getNextTideEvent();
  const isHigh = tide.type === 'high';
  const color = isHigh ? theme.colors.primary : theme.colors.textMuted;
  return (
    <View style={s.tideRow}>
      {isHigh
        ? <ArrowUp size={13} color={color} />
        : <ArrowDown size={13} color={color} />}
      <Text style={[s.tideText, { color }]}>
        {isHigh ? 'High' : 'Low'} tide at {tide.timeStr}
      </Text>
      <Text style={s.tideAway}>· in {formatHoursAway(tide.hoursAway)}</Text>
    </View>
  );
}

function Stat({ label, value, highlight, color }: { label: string; value: string; highlight?: boolean; color?: string }) {
  return (
    <View style={s.stat}>
      <Text style={s.statLabel}>{label}</Text>
      <Text style={[s.statValue, highlight && { color: theme.colors.yellow }, color ? { color } : {}]}>
        {value}
      </Text>
    </View>
  );
}

function StatusIcon({ status, size, color }: { status: ConditionStatus; size: number; color: string }) {
  if (status === 'green') return <CheckCircle size={size} color={color} />;
  if (status === 'yellow') return <MinusCircle size={size} color={color} />;
  return <XCircle size={size} color={color} />;
}

function statusColors(status: ConditionStatus) {
  if (status === 'green') return { text: theme.colors.green, border: theme.colors.greenBorder, badgeBg: theme.colors.greenBg };
  if (status === 'yellow') return { text: theme.colors.yellow, border: theme.colors.yellowBorder, badgeBg: theme.colors.yellowBg };
  return { text: theme.colors.red, border: theme.colors.redBorder, badgeBg: theme.colors.redBg };
}

function formatHour(h: number): string {
  return `${String(h).padStart(2, '0')}:00`;
}

async function shareConditions(assessment: SpotAssessment, bestWindow: BestWindow | null | undefined) {
  const { name, status, statusLabel, weather, matchingKite, recommendedKiteSize } = assessment;

  let msg = `*${name.toUpperCase()} — ${statusLabel.toUpperCase()}*\n`;

  if (weather) {
    const kite = matchingKite ?? recommendedKiteSize;
    const parts = [
      `${weather.windSpeed}kts ${weather.windDirectionLabel}`,
      `gusts ${weather.windGust}kts`,
      ...(kite && status !== 'red' ? [`${kite}m kite`] : []),
      `${weather.waveHeight.toFixed(1)}m swell`,
    ];
    msg += parts.join(' · ') + '\n';
  }

  if (bestWindow && status !== 'red') {
    msg += `Best: ${formatHour(bestWindow.startHour)} – ${formatHour(bestWindow.endHour)}\n`;
  }

  msg += '\nStoke';

  const waUrl = `whatsapp://send?text=${encodeURIComponent(msg)}`;
  try {
    const canWhatsApp = await Linking.canOpenURL(waUrl);
    if (canWhatsApp) {
      await Linking.openURL(waUrl);
    } else {
      await Share.share({ message: msg });
    }
  } catch {
    await Share.share({ message: msg });
  }
}

function directionRatingColor(rating: DirectionRating): string {
  if (rating === 'ideal') return theme.colors.green;
  if (rating === 'good') return theme.colors.primaryLight;
  if (rating === 'moderate') return theme.colors.yellow;
  return theme.colors.red;
}

function directionRatingBorder(rating: DirectionRating): string {
  if (rating === 'ideal') return theme.colors.greenBorder;
  if (rating === 'good') return theme.colors.border;
  if (rating === 'moderate') return theme.colors.yellowBorder;
  return theme.colors.redBorder;
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  backBtn: { padding: theme.spacing.sm },
  headerTitle: { fontSize: theme.text.lg, fontWeight: '700', color: theme.colors.textPrimary, flex: 1, marginLeft: theme.spacing.sm },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
  shareBtn: { padding: theme.spacing.sm },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 4,
    borderRadius: theme.radius.xl,
  },
  statusText: { fontSize: theme.text.xs, fontWeight: '700' },
  scroll: { padding: theme.spacing.lg, gap: theme.spacing.md, paddingBottom: theme.spacing.xxl },
  block: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  blockHeader: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
  blockTitle: { fontSize: theme.text.sm, fontWeight: '600', color: theme.colors.textSecondary, textTransform: 'uppercase', letterSpacing: 1 },
  statRow: { flexDirection: 'row', gap: theme.spacing.lg },
  stat: { gap: 3 },
  statLabel: { fontSize: theme.text.xs, color: theme.colors.textMuted },
  statValue: { fontSize: theme.text.xl, fontWeight: '700', color: theme.colors.textPrimary },
  directionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 6,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  directionText: { fontSize: theme.text.sm, fontWeight: '600' },
  gustNote: { fontSize: theme.text.xs, color: theme.colors.yellow, lineHeight: 18 },
  windowRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  windowText: { fontSize: theme.text.sm, fontWeight: '600', color: theme.colors.primary },
  stripScroll: { marginHorizontal: -theme.spacing.sm },
  stripContent: { paddingHorizontal: theme.spacing.sm, gap: 2 },
  stripSlot: { alignItems: 'center', width: 36, gap: 2 },
  stripHour: { fontSize: 10, color: theme.colors.textMuted },
  stripArrow: { width: 18, height: 18, alignItems: 'center', justifyContent: 'center' },
  stripArrowChar: { fontSize: 14, lineHeight: 18 },
  stripSpeed: { fontSize: 10, fontWeight: '600' },
  kiteBlock: {
    borderWidth: 1.5,
    alignItems: 'flex-start',
    gap: 6,
  },
  kiteHeader: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
  kiteSize: { fontSize: theme.text.xxxl, fontWeight: '800' },
  kiteLabel: { fontSize: theme.text.base, fontWeight: '600' },
  kiteNote: { fontSize: theme.text.xs, color: theme.colors.textMuted },
  warningRow: { flexDirection: 'row', alignItems: 'flex-start', gap: theme.spacing.sm },
  warningDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: theme.colors.yellow, marginTop: 6 },
  warningText: { flex: 1, fontSize: theme.text.sm, color: theme.colors.yellow, lineHeight: 20 },
  mapBlock: {
    borderRadius: theme.radius.lg,
    overflow: 'hidden',
    height: 220,
    position: 'relative',
  },
  spotImage: { width: '100%', height: '100%' },
  windOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    overflow: 'hidden',
  },
  mapLabel: {
    position: 'absolute',
    bottom: theme.spacing.md,
    left: theme.spacing.md,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 4,
    borderRadius: theme.radius.sm,
  },
  mapLabelText: { color: '#fff', fontSize: theme.text.sm, fontWeight: '700' },
  errorText: { fontSize: theme.text.sm, color: theme.colors.red, textAlign: 'center', padding: theme.spacing.xl },
  forecastRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  forecastDate: { fontSize: theme.text.xs, color: theme.colors.textMuted, width: 60 },
  forecastMid: { flex: 1, gap: 2 },
  forecastWind: { fontSize: theme.text.sm, fontWeight: '600', color: theme.colors.textPrimary },
  forecastUnit: { fontWeight: '400', color: theme.colors.textMuted },
  forecastSwell: { fontSize: theme.text.xs, color: theme.colors.textMuted },
  forecastRight: { alignItems: 'flex-end', gap: 4 },
  forecastKite: { fontSize: theme.text.base, fontWeight: '700' },
  forecastBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: theme.radius.xl,
  },
  forecastBadgeText: { fontSize: theme.text.xs, fontWeight: '700' },
  wxRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  wxEmoji: { fontSize: 14 },
  wxLabel: { fontSize: theme.text.sm, fontWeight: '600', color: theme.colors.textSecondary },
  tideRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
  tideText: { fontSize: theme.text.sm, fontWeight: '600' },
  tideAway: { fontSize: theme.text.xs, color: theme.colors.textMuted },
});
