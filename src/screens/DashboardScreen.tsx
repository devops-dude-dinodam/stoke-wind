import React, { useCallback, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, ActivityIndicator, StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Settings, RefreshCw, Wind, ChevronRight, CheckCircle, XCircle, MinusCircle } from 'lucide-react-native';
import { theme } from '../theme/theme';
import { SpotAssessment, ConditionStatus, SpotId } from '../types';
import { useWaterStore } from '../store/useWaterStore';
import { fetchAllSpots } from '../utils/weatherApi';
import { assessSpot, buildErrorAssessment, getWeatherCondition } from '../utils/kiteAlgorithm';
import {
  buildConditionsSummary, scheduleDailyNotification,
  sendImmediateNotification, registerBackgroundTask,
} from '../utils/notifications';

type Props = { navigation: NativeStackNavigationProp<any> };

export default function DashboardScreen({ navigation }: Props) {
  const {
    profile, assessments, isFetching, lastFetchedAt,
    setAssessments, setFetching, previousGreenState,
    setPreviousGreenState, setLastNotifiedAt, lastNotifiedAt,
  } = useWaterStore();

  const REFRESH_COOLDOWN = 60_000;
  const canRefresh = !isFetching && (!lastFetchedAt || Date.now() - lastFetchedAt > REFRESH_COOLDOWN);

  const didMount = useRef(false);

  const fetchConditions = useCallback(async (force = false) => {
    if (!force && lastFetchedAt && Date.now() - lastFetchedAt < REFRESH_COOLDOWN) return;
    setFetching(true);
    try {
      const weatherMap = await fetchAllSpots();
      const spotIds: SpotId[] = ['pringle', 'silversands'];
      const result: Record<SpotId, SpotAssessment | null> = { pringle: null, silversands: null };

      for (const id of spotIds) {
        result[id] = assessSpot(id, weatherMap[id], profile);
      }

      setAssessments(result);

      const list = Object.values(result).filter(Boolean) as SpotAssessment[];
      const twoHours = 2 * 60 * 60 * 1000;

      const newlyGreen = list.filter(
        a => a.status === 'green' && !previousGreenState[a.spotId as SpotId],
      );

      if (newlyGreen.length > 0 && Date.now() - lastNotifiedAt > twoHours) {
        const names = newlyGreen.map(a => a.name).join(' & ');
        const verb = newlyGreen.length > 1 ? 'are' : 'is';
        await sendImmediateNotification(`🟢 ${names} ${verb} a Go!`, buildConditionsSummary(newlyGreen));
        setLastNotifiedAt(Date.now());
      }

      const nextGreenState = { pringle: false, silversands: false } as Record<SpotId, boolean>;
      for (const a of list) nextGreenState[a.spotId as SpotId] = a.status === 'green';
      setPreviousGreenState(nextGreenState);
      await scheduleDailyNotification(profile.notificationHour, buildConditionsSummary(list));

    } catch (e) {
      const err = e instanceof Error ? e.message : 'Failed to fetch';
      setAssessments({
        pringle: buildErrorAssessment('pringle', err),
        silversands: buildErrorAssessment('silversands', err),
      });
    } finally {
      setFetching(false);
    }
  }, [profile, previousGreenState, lastNotifiedAt, setAssessments, setFetching, setPreviousGreenState, setLastNotifiedAt]);

  useEffect(() => {
    if (!didMount.current) {
      didMount.current = true;
      fetchConditions(true);
      registerBackgroundTask();
    }
  }, [fetchConditions]);

  const statusRank = (a: SpotAssessment) => {
    if (a.status === 'green') return 0;
    if (a.status === 'yellow') {
      if (a.statusLabel === 'Worth a Check') return 1;
      return 2;
    }
    return 3;
  };

  const spotList: SpotAssessment[] = (['pringle', 'silversands'] as SpotId[])
    .map(id => assessments[id])
    .filter(Boolean) as SpotAssessment[];

  spotList.sort((a, b) => statusRank(a) - statusRank(b));

  return (
    <SafeAreaView style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor={theme.colors.background} />

      <View style={s.header}>
        <View>
          <Text style={s.appName}>STOKE</Text>
          <Text style={s.subtitle}>Overberg · Kite Forecast</Text>
        </View>
        <View style={s.headerActions}>
          {isFetching
            ? <ActivityIndicator color={theme.colors.primary} size="small" />
            : (
              <TouchableOpacity onPress={() => fetchConditions()} style={s.iconBtn} disabled={!canRefresh}>
                <RefreshCw size={20} color={canRefresh ? theme.colors.textSecondary : theme.colors.textMuted} />
              </TouchableOpacity>
            )
          }
          <TouchableOpacity onPress={() => navigation.navigate('Settings')} style={s.iconBtn}>
            <Settings size={20} color={theme.colors.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={s.scroll}
        refreshControl={
          <RefreshControl refreshing={isFetching} onRefresh={fetchConditions} tintColor={theme.colors.primary} />
        }
      >
        {lastFetchedAt && (
          <Text style={s.lastUpdated}>Updated {formatRelativeTime(lastFetchedAt)}</Text>
        )}

        {spotList.length === 0 && !isFetching && (
          <Text style={s.emptyText}>Pull down to fetch conditions.</Text>
        )}

        {spotList.map(assessment => (
          <SpotSummaryCard
            key={assessment.spotId}
            assessment={assessment}
            onPress={() => navigation.navigate('SpotDetail', { spotId: assessment.spotId })}
          />
        ))}

        <Text style={s.notifText}>
          Daily brief at {String(profile.notificationHour).padStart(2, '0')}:00
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function SpotSummaryCard({ assessment, onPress }: { assessment: SpotAssessment; onPress: () => void }) {
  const { status, name, weather, isGusty, matchingKite, kiteSizeLabel, error } = assessment;
  const colors = statusColors(status);

  return (
    <TouchableOpacity style={[s.card, { borderColor: colors.border }]} onPress={onPress} activeOpacity={0.75}>
      <View style={s.cardTop}>
        <View style={s.cardLeft}>
          <Text style={s.spotName}>{name}</Text>
          {weather && !error && (
            <View style={s.windRow}>
              <Wind size={13} color={theme.colors.textMuted} />
              <Text style={s.windText}>
                <Text style={s.windSpeed}>{weather.windSpeed}</Text>
                <Text style={s.windUnit}> kts </Text>
                <Text style={s.windDir}>{weather.windDirectionLabel}</Text>
                {isGusty && <Text style={s.gustTag}>  ·  gusty</Text>}
              </Text>
              <Text style={s.wxTag}>{getWeatherCondition(weather.weatherCode).emoji}  {weather.temperature}°C</Text>
            </View>
          )}
          {matchingKite && (
            <Text style={[s.kiteRec, { color: colors.text }]}>
              {kiteSizeLabel}
            </Text>
          )}
          {error && <Text style={s.errorText}>{error}</Text>}
        </View>

        <View style={s.cardRight}>
          <View style={[s.statusBadge, { backgroundColor: colors.badgeBg }]}>
            <StatusIcon status={status} size={13} color={colors.text} />
            <Text style={[s.statusText, { color: colors.text }]}>{assessment.statusLabel}</Text>
          </View>
          <ChevronRight size={16} color={theme.colors.textMuted} style={{ marginTop: 8 }} />
        </View>
      </View>

      {weather && assessment.warnings.length > 0 && (
        <Text style={s.warningPreview} numberOfLines={1}>
          ⚠  {assessment.warnings[0]}
        </Text>
      )}
    </TouchableOpacity>
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

function formatRelativeTime(ts: number): string {
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.background },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  appName: { fontSize: theme.text.xxl, fontWeight: '800', color: theme.colors.primary, letterSpacing: 4 },
  subtitle: { fontSize: theme.text.xs, color: theme.colors.textMuted, marginTop: 2, letterSpacing: 1 },
  headerActions: { flexDirection: 'row', gap: theme.spacing.sm, alignItems: 'center' },
  iconBtn: { padding: theme.spacing.sm },
  scroll: { padding: theme.spacing.lg, gap: theme.spacing.md, paddingBottom: theme.spacing.xxl },
  lastUpdated: { fontSize: theme.text.xs, color: theme.colors.textMuted, textAlign: 'center' },
  emptyText: { color: theme.colors.textMuted, fontSize: theme.text.sm, textAlign: 'center', marginTop: theme.spacing.xl },
  card: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.lg,
    borderWidth: 1.5,
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  cardLeft: { flex: 1, gap: 6 },
  cardRight: { alignItems: 'flex-end' },
  spotName: { fontSize: theme.text.lg, fontWeight: '700', color: theme.colors.textPrimary },
  windRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  windText: { fontSize: theme.text.base },
  windSpeed: { fontSize: theme.text.lg, fontWeight: '700', color: theme.colors.textPrimary },
  windUnit: { fontSize: theme.text.sm, color: theme.colors.textMuted },
  windDir: { fontSize: theme.text.base, fontWeight: '600', color: theme.colors.primary },
  gustTag: { fontSize: theme.text.xs, color: theme.colors.yellow },
  wxTag: { fontSize: theme.text.xs, color: theme.colors.textMuted, marginLeft: 6 },
  kiteRec: { fontSize: theme.text.sm, fontWeight: '600' },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 4,
    borderRadius: theme.radius.xl,
  },
  statusText: { fontSize: theme.text.xs, fontWeight: '700' },
  warningPreview: { fontSize: theme.text.xs, color: theme.colors.yellow },
  errorText: { fontSize: theme.text.xs, color: theme.colors.red },
  notifText: { fontSize: theme.text.xs, color: theme.colors.textMuted, textAlign: 'center', marginTop: theme.spacing.sm },
});
