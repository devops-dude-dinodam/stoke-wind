import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ScrollView, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme } from '../theme/theme';
import { SkillLevel, RidingStyle } from '../types';
import { useWaterStore } from '../store/useWaterStore';
import { requestNotificationPermission, scheduleDailyNotification } from '../utils/notifications';
import { Wind } from 'lucide-react-native';

const STEPS = 6;

export default function OnboardingScreen() {
  const [step, setStep] = useState(0);
  const [weight, setWeight] = useState('');
  const [boardLength, setBoardLength] = useState('142');
  const [kiteInput, setKiteInput] = useState('');
  const [quiver, setQuiver] = useState<number[]>([]);
  const [skill, setSkill] = useState<SkillLevel>('intermediate');
  const [ridingStyle, setRidingStyle] = useState<RidingStyle>('twin_tip');
  const [notifHour, setNotifHour] = useState(7);

  const { setProfile, completeOnboarding } = useWaterStore();

  function addKite() {
    const size = parseInt(kiteInput, 10);
    if (!isNaN(size) && size >= 3 && size <= 25 && !quiver.includes(size)) {
      setQuiver(prev => [...prev, size].sort((a, b) => b - a));
    }
    setKiteInput('');
  }

  function removeKite(size: number) {
    setQuiver(prev => prev.filter(k => k !== size));
  }

  async function finish() {
    const w = parseInt(weight, 10);
    const bl = parseInt(boardLength, 10);
    setProfile({
      weight: isNaN(w) ? 80 : w,
      boardLength: isNaN(bl) ? 142 : bl,
      kiteQuiver: quiver,
      skillLevel: skill,
      ridingStyle,
      notificationHour: notifHour,
    });
    await requestNotificationPermission();
    await scheduleDailyNotification(notifHour, 'Opening Water to check today\'s conditions...');
    completeOnboarding();
  }

  function next() {
    if (step < STEPS - 1) setStep(s => s + 1);
    else finish();
  }

  function canProceed(): boolean {
    if (step === 1) return parseInt(weight, 10) >= 40 && parseInt(weight, 10) <= 200;
    if (step === 2) return quiver.length > 0;
    return true;
  }

  const progress = ((step + 1) / STEPS) * 100;

  return (
    <SafeAreaView style={s.root}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        {/* Progress bar */}
        <View style={s.progressTrack}>
          <View style={[s.progressFill, { width: `${progress}%` }]} />
        </View>

        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
          {step === 0 && <WelcomeStep />}
          {step === 1 && <WeightStep weight={weight} onChange={setWeight} boardLength={boardLength} onBoardLength={setBoardLength} />}
          {step === 2 && (
            <QuiverStep
              quiver={quiver}
              kiteInput={kiteInput}
              onInputChange={setKiteInput}
              onAdd={addKite}
              onRemove={removeKite}
            />
          )}
          {step === 3 && <SkillStep skill={skill} onSelect={setSkill} />}
          {step === 4 && <RidingStyleStep style={ridingStyle} onSelect={setRidingStyle} />}
          {step === 5 && <NotifStep hour={notifHour} onHourChange={setNotifHour} />}
        </ScrollView>

        <View style={s.footer}>
          {step > 0 && (
            <TouchableOpacity style={s.backBtn} onPress={() => setStep(s => s - 1)}>
              <Text style={s.backText}>Back</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[s.nextBtn, !canProceed() && s.disabled]}
            onPress={next}
            disabled={!canProceed()}
          >
            <Text style={s.nextText}>{step === STEPS - 1 ? 'Let\'s Go' : 'Next'}</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function WelcomeStep() {
  return (
    <View style={s.stepContainer}>
      <Text style={s.appTitle}>STOKE</Text>
      <Text style={s.heading}>Your kite forecast.</Text>
      <Text style={s.subheading}>
        Your personal kite forecast for{'\n'}
        <Text style={s.highlight}>Pringle Bay</Text> and <Text style={s.highlight}>Silversands</Text>
      </Text>
      <View style={s.featureList}>
        {[
          '🟢  Go / No-Go alerts for each spot',
          '🎯  Kite size recommendation for your weight',
          '💨  Wind, swell & gust conditions',
          '📱  Daily push notification at your chosen time',
        ].map(f => (
          <Text key={f} style={s.feature}>{f}</Text>
        ))}
      </View>
    </View>
  );
}

function WeightStep({ weight, onChange, boardLength, onBoardLength }: {
  weight: string; onChange: (v: string) => void;
  boardLength: string; onBoardLength: (v: string) => void;
}) {
  return (
    <View style={s.stepContainer}>
      <Text style={s.emoji}>⚖️</Text>
      <Text style={s.heading}>Rider Profile</Text>
      <Text style={s.subheading}>Used to calculate the right kite size for the wind.</Text>
      <TextInput
        style={s.bigInput}
        value={weight}
        onChangeText={onChange}
        keyboardType="numeric"
        placeholder="80"
        placeholderTextColor={theme.colors.textMuted}
        maxLength={3}
      />
      <Text style={s.unit}>kg</Text>
      <Text style={[s.subheading, { marginTop: theme.spacing.xl, marginBottom: theme.spacing.sm }]}>Board length</Text>
      <View style={s.inputRow}>
        <TextInput
          style={[s.kiteInput, { flex: 1 }]}
          value={boardLength}
          onChangeText={onBoardLength}
          keyboardType="numeric"
          placeholder="142"
          placeholderTextColor={theme.colors.textMuted}
          maxLength={3}
        />
        <Text style={s.kiteUnit}>cm</Text>
      </View>
      <Text style={s.hint}>{'< 138cm  ·  138–144cm (standard)  ·  > 144cm'}</Text>
    </View>
  );
}

function QuiverStep({
  quiver, kiteInput, onInputChange, onAdd, onRemove,
}: {
  quiver: number[];
  kiteInput: string;
  onInputChange: (v: string) => void;
  onAdd: () => void;
  onRemove: (size: number) => void;
}) {
  return (
    <View style={s.stepContainer}>
      <View style={s.iconCircle}>
        <Wind size={32} color={theme.colors.primary} />
      </View>
      <Text style={s.heading}>Your Kite Quiver</Text>
      <Text style={s.subheading}>Add the kite sizes you own (in m²). The app will match forecast wind to your closest kite.</Text>
      <View style={s.inputRow}>
        <TextInput
          style={s.kiteInput}
          value={kiteInput}
          onChangeText={onInputChange}
          keyboardType="numeric"
          placeholder="e.g. 9"
          placeholderTextColor={theme.colors.textMuted}
          maxLength={2}
        />
        <Text style={s.kiteUnit}>m²</Text>
        <TouchableOpacity style={s.addBtn} onPress={onAdd}>
          <Text style={s.addBtnText}>Add</Text>
        </TouchableOpacity>
      </View>
      <View style={s.chips}>
        {quiver.map(size => (
          <TouchableOpacity key={size} style={s.chip} onPress={() => onRemove(size)}>
            <Text style={s.chipText}>{size}m  ✕</Text>
          </TouchableOpacity>
        ))}
      </View>
      {quiver.length === 0 && (
        <Text style={s.hint}>Tap a kite size to remove it</Text>
      )}
    </View>
  );
}

function SkillStep({ skill, onSelect }: { skill: SkillLevel; onSelect: (s: SkillLevel) => void }) {
  const options: { value: SkillLevel; label: string; desc: string }[] = [
    { value: 'beginner', label: 'Beginner', desc: 'Learning, prefer lighter wind & smaller swell' },
    { value: 'intermediate', label: 'Intermediate', desc: 'Comfortable in 15–25kts, can handle chop' },
    { value: 'advanced', label: 'Advanced / Pro', desc: 'Big air, gusty days, heavy shore dump' },
  ];
  return (
    <View style={s.stepContainer}>
      <Text style={s.emoji}>🏄</Text>
      <Text style={s.heading}>Skill Level</Text>
      <Text style={s.subheading}>Adjusts kite recommendations and safety warnings.</Text>
      {options.map(opt => (
        <TouchableOpacity
          key={opt.value}
          style={[s.skillCard, skill === opt.value && s.skillCardSelected]}
          onPress={() => onSelect(opt.value)}
        >
          <Text style={[s.skillLabel, skill === opt.value && s.skillLabelSelected]}>{opt.label}</Text>
          <Text style={s.skillDesc}>{opt.desc}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

function RidingStyleStep({ style, onSelect }: { style: RidingStyle; onSelect: (s: RidingStyle) => void }) {
  const options: { value: RidingStyle; label: string; desc: string }[] = [
    { value: 'twin_tip', label: 'Twin Tip', desc: 'Standard TT board — full kite power, freestyle & freeride' },
    { value: 'wave_strapped', label: 'Wave — Strapped', desc: 'Directional board with straps — board volume reduces pull needed' },
    { value: 'wave_strapless', label: 'Wave — Strapless', desc: 'Pure wave riding — wave provides energy, kite just drifts' },
  ];
  return (
    <View style={s.stepContainer}>
      <Text style={s.emoji}>🌊</Text>
      <Text style={s.heading}>Riding Style</Text>
      <Text style={s.subheading}>Adjusts kite sizing — wave riders need significantly less power than Twin Tip.</Text>
      {options.map(opt => (
        <TouchableOpacity
          key={opt.value}
          style={[s.skillCard, style === opt.value && s.skillCardSelected]}
          onPress={() => onSelect(opt.value)}
        >
          <Text style={[s.skillLabel, style === opt.value && s.skillLabelSelected]}>{opt.label}</Text>
          <Text style={s.skillDesc}>{opt.desc}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

function NotifStep({ hour, onHourChange }: { hour: number; onHourChange: (h: number) => void }) {
  const hours = [6, 7, 8, 9, 10];
  return (
    <View style={s.stepContainer}>
      <Text style={s.emoji}>🔔</Text>
      <Text style={s.heading}>Daily Notification</Text>
      <Text style={s.subheading}>What time should Water send you the morning conditions report?</Text>
      <View style={s.hourGrid}>
        {hours.map(h => (
          <TouchableOpacity
            key={h}
            style={[s.hourBtn, hour === h && s.hourBtnSelected]}
            onPress={() => onHourChange(h)}
          >
            <Text style={[s.hourText, hour === h && s.hourTextSelected]}>
              {h}:00
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      <Text style={s.hint}>You'll also get an alert whenever conditions flip to green during the day.</Text>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.background },
  progressTrack: { height: 3, backgroundColor: theme.colors.border },
  progressFill: { height: 3, backgroundColor: theme.colors.primary },
  scroll: { flexGrow: 1, padding: theme.spacing.lg },
  stepContainer: { flex: 1, paddingTop: theme.spacing.xl },
  footer: {
    flexDirection: 'row',
    padding: theme.spacing.lg,
    paddingBottom: theme.spacing.xl,
    gap: theme.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  emoji: { fontSize: 48, textAlign: 'center', marginBottom: theme.spacing.md },
  appTitle: { fontSize: 42, fontWeight: '800', color: theme.colors.primary, textAlign: 'center', letterSpacing: 6, marginBottom: theme.spacing.md },
  iconCircle: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: theme.colors.card,
    borderWidth: 1, borderColor: theme.colors.border,
    alignItems: 'center', justifyContent: 'center',
    alignSelf: 'center', marginBottom: theme.spacing.md,
  },
  heading: {
    fontSize: theme.text.xxl,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    textAlign: 'center',
    marginBottom: theme.spacing.sm,
  },
  subheading: {
    fontSize: theme.text.base,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: theme.spacing.xl,
  },
  highlight: { color: theme.colors.primary, fontWeight: '600' },
  featureList: { gap: theme.spacing.md },
  feature: { fontSize: theme.text.base, color: theme.colors.textSecondary, lineHeight: 22 },
  bigInput: {
    fontSize: 56,
    fontWeight: '700',
    color: theme.colors.primary,
    textAlign: 'center',
    paddingVertical: theme.spacing.md,
  },
  unit: { fontSize: theme.text.lg, color: theme.colors.textMuted, textAlign: 'center', marginTop: -theme.spacing.sm },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm, marginBottom: theme.spacing.md },
  kiteInput: {
    flex: 1,
    backgroundColor: theme.colors.inputBg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    fontSize: theme.text.xl,
    color: theme.colors.textPrimary,
    textAlign: 'center',
  },
  kiteUnit: { fontSize: theme.text.base, color: theme.colors.textMuted },
  addBtn: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.radius.md,
  },
  addBtnText: { color: '#000', fontWeight: '700', fontSize: theme.text.base },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm },
  chip: {
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.primary,
    borderRadius: theme.radius.xl,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
  chipText: { color: theme.colors.primary, fontWeight: '600', fontSize: theme.text.base },
  hint: { fontSize: theme.text.sm, color: theme.colors.textMuted, textAlign: 'center', marginTop: theme.spacing.lg },
  skillCard: {
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  skillCardSelected: { borderColor: theme.colors.primary, backgroundColor: '#0D2A3E' },
  skillLabel: { fontSize: theme.text.lg, fontWeight: '600', color: theme.colors.textSecondary, marginBottom: 4 },
  skillLabelSelected: { color: theme.colors.primary },
  skillDesc: { fontSize: theme.text.sm, color: theme.colors.textMuted },
  hourGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm, justifyContent: 'center', marginBottom: theme.spacing.xl },
  hourBtn: {
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
  },
  hourBtnSelected: { borderColor: theme.colors.primary, backgroundColor: '#0D2A3E' },
  hourText: { fontSize: theme.text.lg, color: theme.colors.textSecondary, fontWeight: '600' },
  hourTextSelected: { color: theme.colors.primary },
  nextBtn: {
    flex: 1,
    backgroundColor: theme.colors.primary,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.radius.md,
    alignItems: 'center',
  },
  disabled: { opacity: 0.4 },
  nextText: { color: '#000', fontWeight: '700', fontSize: theme.text.lg },
  backBtn: {
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
  },
  backText: { color: theme.colors.textSecondary, fontSize: theme.text.base },
});
