import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ScrollView, StatusBar, Alert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ArrowLeft, Download } from 'lucide-react-native';
import { theme } from '../theme/theme';
import { SkillLevel, RidingStyle } from '../types';
import { useWaterStore } from '../store/useWaterStore';
import { scheduleDailyNotification } from '../utils/notifications';
import { CURRENT_VERSION, checkForUpdate, downloadAndInstall } from '../utils/updater';

type Props = { navigation: NativeStackNavigationProp<any> };

export default function SettingsScreen({ navigation }: Props) {
  const { profile, setProfile } = useWaterStore();

  const [updateState, setUpdateState] = useState<'idle' | 'checking' | 'downloading' | 'up_to_date' | 'error'>('idle');
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [updateLabel, setUpdateLabel] = useState('');

  const [weight, setWeight] = useState(String(profile.weight));
  const [boardLength, setBoardLength] = useState(String(profile.boardLength ?? 142));
  const [kiteInput, setKiteInput] = useState('');
  const [quiver, setQuiver] = useState<number[]>([...profile.kiteQuiver]);
  const [skill, setSkill] = useState<SkillLevel>(profile.skillLevel);
  const [ridingStyle, setRidingStyle] = useState<RidingStyle>(profile.ridingStyle ?? 'twin_tip');
  const [notifHour, setNotifHour] = useState(profile.notificationHour);

  function addKite() {
    const size = parseInt(kiteInput, 10);
    if (!isNaN(size) && size >= 3 && size <= 25 && !quiver.includes(size)) {
      setQuiver(prev => [...prev, size].sort((a, b) => b - a));
    }
    setKiteInput('');
  }

  async function handleCheckUpdate() {
    setUpdateState('checking');
    setUpdateLabel('');
    try {
      const info = await checkForUpdate();
      if (!info.available) {
        setUpdateState('up_to_date');
        setUpdateLabel(`${CURRENT_VERSION} is the latest version`);
        return;
      }
      if (!info.downloadUrl) {
        setUpdateState('error');
        setUpdateLabel('No APK found in latest release');
        return;
      }
      Alert.alert(
        `Update available — ${info.latestVersion}`,
        'Download and install now?',
        [
          { text: 'Cancel', style: 'cancel', onPress: () => setUpdateState('idle') },
          {
            text: 'Install',
            onPress: async () => {
              setUpdateState('downloading');
              setDownloadProgress(0);
              try {
                await downloadAndInstall(info.downloadUrl!, (pct) => setDownloadProgress(pct));
                setUpdateState('idle');
              } catch {
                setUpdateState('error');
                setUpdateLabel('Download failed — check your connection');
              }
            },
          },
        ],
      );
    } catch {
      setUpdateState('error');
      setUpdateLabel('Could not reach GitHub — check your connection');
    }
  }

  async function save() {
    const w = parseInt(weight, 10);
    if (isNaN(w) || w < 40 || w > 200) {
      Alert.alert('Invalid weight', 'Please enter a weight between 40 and 200 kg.');
      return;
    }
    const bl = parseInt(boardLength, 10);
    setProfile({ weight: w, boardLength: isNaN(bl) ? 142 : bl, kiteQuiver: quiver, skillLevel: skill, ridingStyle, notificationHour: notifHour });
    await scheduleDailyNotification(notifHour, 'Updated — open Water to see today\'s conditions.');
    navigation.goBack();
  }

  return (
    <SafeAreaView style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor={theme.colors.background} />

      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <ArrowLeft size={22} color={theme.colors.textSecondary} />
        </TouchableOpacity>
        <Text style={s.title}>Settings</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">

        <Section title="Rider Profile">
          <Label>Weight (kg)</Label>
          <TextInput
            style={s.input}
            value={weight}
            onChangeText={setWeight}
            keyboardType="numeric"
            maxLength={3}
            placeholderTextColor={theme.colors.textMuted}
          />
          <Label>Board Length (cm)</Label>
          <TextInput
            style={s.input}
            value={boardLength}
            onChangeText={setBoardLength}
            keyboardType="numeric"
            maxLength={3}
            placeholderTextColor={theme.colors.textMuted}
            placeholder="142"
          />
        </Section>

        <Section title="Kite Quiver">
          <View style={s.inputRow}>
            <TextInput
              style={[s.input, { flex: 1 }]}
              value={kiteInput}
              onChangeText={setKiteInput}
              keyboardType="numeric"
              placeholder="Add size (m²)"
              placeholderTextColor={theme.colors.textMuted}
              maxLength={2}
            />
            <TouchableOpacity style={s.addBtn} onPress={addKite}>
              <Text style={s.addBtnText}>Add</Text>
            </TouchableOpacity>
          </View>
          <View style={s.chips}>
            {quiver.map(size => (
              <TouchableOpacity
                key={size}
                style={s.chip}
                onPress={() => setQuiver(prev => prev.filter(k => k !== size))}
              >
                <Text style={s.chipText}>{size}m  ✕</Text>
              </TouchableOpacity>
            ))}
          </View>
        </Section>

        <Section title="Skill Level">
          {(['beginner', 'intermediate', 'advanced'] as SkillLevel[]).map(lv => (
            <TouchableOpacity
              key={lv}
              style={[s.skillBtn, skill === lv && s.skillBtnSelected]}
              onPress={() => setSkill(lv)}
            >
              <Text style={[s.skillText, skill === lv && s.skillTextSelected]}>
                {lv.charAt(0).toUpperCase() + lv.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </Section>

        <Section title="Riding Style">
          {([
            { value: 'twin_tip', label: 'Twin Tip' },
            { value: 'wave_strapped', label: 'Wave — Strapped' },
            { value: 'wave_strapless', label: 'Wave — Strapless' },
          ] as { value: RidingStyle; label: string }[]).map(opt => (
            <TouchableOpacity
              key={opt.value}
              style={[s.skillBtn, ridingStyle === opt.value && s.skillBtnSelected]}
              onPress={() => setRidingStyle(opt.value)}
            >
              <Text style={[s.skillText, ridingStyle === opt.value && s.skillTextSelected]}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </Section>

        <Section title="Notification Time">
          <View style={s.hourGrid}>
            {[6, 7, 8, 9, 10].map(h => (
              <TouchableOpacity
                key={h}
                style={[s.hourBtn, notifHour === h && s.hourBtnSelected]}
                onPress={() => setNotifHour(h)}
              >
                <Text style={[s.hourText, notifHour === h && s.hourTextSelected]}>{h}:00</Text>
              </TouchableOpacity>
            ))}
          </View>
        </Section>

        <View style={s.updateSection}>
          <TouchableOpacity
            style={[s.updateBtn, updateState === 'downloading' && { opacity: 0.6 }]}
            onPress={handleCheckUpdate}
            disabled={updateState === 'checking' || updateState === 'downloading'}
          >
            {updateState === 'checking' || updateState === 'downloading'
              ? <ActivityIndicator size="small" color={theme.colors.primary} />
              : <Download size={15} color={theme.colors.primary} />
            }
            <Text style={s.updateBtnText}>
              {updateState === 'checking' && 'Checking...'}
              {updateState === 'downloading' && `Downloading ${downloadProgress}%`}
              {(updateState === 'idle' || updateState === 'up_to_date' || updateState === 'error') && 'Check for Update'}
            </Text>
          </TouchableOpacity>
          <Text style={s.versionText}>
            {updateState === 'up_to_date' || updateState === 'error' ? updateLabel : `Current version: ${CURRENT_VERSION}`}
          </Text>
        </View>

        <TouchableOpacity style={s.saveBtn} onPress={save}>
          <Text style={s.saveBtnText}>Save Changes</Text>
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={s.section}>
      <Text style={s.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <Text style={s.label}>{children}</Text>;
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
  title: { fontSize: theme.text.lg, fontWeight: '700', color: theme.colors.textPrimary },
  scroll: { padding: theme.spacing.lg, gap: theme.spacing.lg, paddingBottom: theme.spacing.xxl },
  section: { gap: theme.spacing.sm },
  sectionTitle: { fontSize: theme.text.sm, fontWeight: '600', color: theme.colors.primary, textTransform: 'uppercase', letterSpacing: 1 },
  label: { fontSize: theme.text.sm, color: theme.colors.textSecondary },
  input: {
    backgroundColor: theme.colors.inputBg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    fontSize: theme.text.base,
    color: theme.colors.textPrimary,
  },
  inputRow: { flexDirection: 'row', gap: theme.spacing.sm, alignItems: 'center' },
  addBtn: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.radius.md,
  },
  addBtnText: { color: '#000', fontWeight: '700' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm },
  chip: {
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.primary,
    borderRadius: theme.radius.xl,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
  chipText: { color: theme.colors.primary, fontWeight: '600' },
  skillBtn: {
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
  },
  skillBtnSelected: { borderColor: theme.colors.primary },
  skillText: { color: theme.colors.textSecondary, fontWeight: '600' },
  skillTextSelected: { color: theme.colors.primary },
  hourGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm },
  hourBtn: {
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
  },
  hourBtnSelected: { borderColor: theme.colors.primary },
  hourText: { color: theme.colors.textSecondary, fontWeight: '600' },
  hourTextSelected: { color: theme.colors.primary },
  updateSection: { gap: theme.spacing.sm, alignItems: 'center' },
  updateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.primary,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
  },
  updateBtnText: { color: theme.colors.primary, fontWeight: '600', fontSize: theme.text.sm },
  versionText: { fontSize: theme.text.xs, color: theme.colors.textMuted },
  saveBtn: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    alignItems: 'center',
    marginTop: theme.spacing.md,
  },
  saveBtnText: { color: '#000', fontWeight: '700', fontSize: theme.text.lg },
});
