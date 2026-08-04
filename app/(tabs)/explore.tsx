import * as FileSystem from 'expo-file-system/legacy';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Alert, Modal, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, { FadeIn, FadeOut, SlideInUp, ZoomIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { Brand, Colors } from '@/constants/theme';
import { ThemePreference, useTheme } from '@/context/theme-context';

// ─── Theme toggle ────────────────────────────────────────────────────────────

const THEME_OPTIONS: { value: ThemePreference; label: string; icon: any }[] = [
  { value: 'light', label: 'Light', icon: 'sun.max.fill' },
  { value: 'system', label: 'Auto', icon: 'circle.lefthalf.filled' },
  { value: 'dark', label: 'Dark', icon: 'moon.fill' },
];

function ThemeToggle({ tc, isDark }: { tc: any; isDark: boolean }) {
  const { themePreference, setThemePreference } = useTheme();

  return (
    <View style={[themeToggleStyles.row, { backgroundColor: isDark ? '#09090B' : '#F1F5F9', borderColor: tc.border }]}>
      {THEME_OPTIONS.map((opt) => {
        const active = themePreference === opt.value;
        return (
          <TouchableOpacity
            key={opt.value}
            style={[
              themeToggleStyles.option,
              active && { backgroundColor: isDark ? '#27272A' : '#FFFFFF' },
            ]}
            onPress={() => setThemePreference(opt.value)}
            activeOpacity={0.7}
          >
            <IconSymbol
              name={opt.icon}
              size={15}
              color={active ? Brand.indigo : tc.textSecondary}
            />
            <Text
              style={[
                themeToggleStyles.label,
                { color: active ? Brand.indigo : tc.textSecondary },
                active && { fontWeight: '800' },
              ]}
            >
              {opt.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const themeToggleStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 3,
    gap: 3,
  },
  option: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 8,
    borderRadius: 9,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
  },
});

// ─── Settings screen ─────────────────────────────────────────────────────────

export default function SettingsScreen() {
  const { colorScheme, themePreference } = useTheme();
  const tc = Colors[colorScheme];
  const isDark = colorScheme === 'dark';
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [storageSize, setStorageSize] = useState('0.00');
  const [docCount, setDocCount] = useState(0);
  const [versionClicks, setVersionClicks] = useState(0);
  const [showSecret, setShowSecret] = useState(false);
  const [showManual, setShowManual] = useState(false);

  const calcStorage = async () => {
    try {
      const dir = FileSystem.documentDirectory;
      if (!dir) return;
      const files = await FileSystem.readDirectoryAsync(dir);
      const pdfs = files.filter(f => f.toLowerCase().endsWith('.pdf'));
      setDocCount(pdfs.length);
      let total = 0;
      for (const file of pdfs) {
        const info = await FileSystem.getInfoAsync(`${dir}${file}`);
        if (info.exists) total += info.size;
      }
      setStorageSize((total / (1024 * 1024)).toFixed(2));
    } catch (e) { console.error(e); }
  };

  useEffect(() => { calcStorage(); }, []);

  const handleClear = () => {
    Alert.alert('Clear All Documents', 'This permanently deletes all PDF files. This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete All', style: 'destructive',
        onPress: async () => {
          const dir = FileSystem.documentDirectory;
          if (!dir) return;
          const files = await FileSystem.readDirectoryAsync(dir);
          for (const f of files) {
            if (f.toLowerCase().endsWith('.pdf') || f.toLowerCase().endsWith('.jpg')) {
              await FileSystem.deleteAsync(`${dir}${f}`);
            }
          }
          calcStorage();
          Alert.alert('Done', 'Library cleared successfully.');
        },
      },
    ]);
  };

  const handleVersionPress = () => {
    const next = versionClicks + 1;
    if (next >= 3) { setShowSecret(true); setVersionClicks(0); }
    else setVersionClicks(next);
  };

  const topPad = Platform.OS === 'web' ? 67 : insets.top + 12;

  const themeLabel =
    themePreference === 'system' ? 'Follows device setting' :
    themePreference === 'dark' ? 'Dark mode' : 'Light mode';

  return (
    <View style={[styles.root, { backgroundColor: tc.background }]}>
      <View style={[styles.header, { paddingTop: topPad, backgroundColor: isDark ? '#18181B' : '#FFFFFF', borderBottomColor: tc.border }]}>
        <TouchableOpacity
          style={[styles.backBtn, { backgroundColor: isDark ? '#27272A' : '#F1F5F9' }]}
          onPress={() => router.back()}
        >
          <IconSymbol name="chevron.right" size={20} color={tc.text} style={{ transform: [{ rotate: '180deg' }] }} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: tc.text }]}>Settings</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: Platform.OS === 'web' ? 34 : Math.max(insets.bottom, 24) + 16 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.statsRow}>
          <View style={[styles.statCard, { backgroundColor: Brand.indigo }]}>
            <IconSymbol name="doc.text.fill" size={20} color="rgba(255,255,255,0.5)" style={styles.statBgIcon} />
            <Text style={styles.statValue}>{docCount}</Text>
            <Text style={styles.statLabel}>Documents</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: Brand.pdfRed }]}>
            <IconSymbol name="photo.on.rectangle.angled" size={20} color="rgba(255,255,255,0.5)" style={styles.statBgIcon} />
            <Text style={styles.statValue}>{storageSize}</Text>
            <Text style={styles.statLabel}>MB Used</Text>
          </View>
        </View>

        {/* ── Appearance ── */}
        <Text style={[styles.groupLabel, { color: tc.textSecondary }]}>APPEARANCE</Text>
        <View style={[styles.group, { backgroundColor: tc.surface, borderColor: tc.border }]}>
          <View style={styles.appearanceBlock}>
            <View style={styles.appearanceTitleRow}>
              <View style={[styles.rowIcon, { backgroundColor: `${Brand.indigo}15` }]}>
                <IconSymbol name="paintbrush" size={17} color={Brand.indigo} />
              </View>
              <View style={styles.rowContent}>
                <Text style={[styles.rowTitle, { color: tc.text }]}>Theme</Text>
                <Text style={[styles.rowSub, { color: tc.textSecondary }]}>{themeLabel}</Text>
              </View>
            </View>
            <ThemeToggle tc={tc} isDark={isDark} />
          </View>
        </View>

        {/* ── General ── */}
        <Text style={[styles.groupLabel, { color: tc.textSecondary }]}>GENERAL</Text>
        <View style={[styles.group, { backgroundColor: tc.surface, borderColor: tc.border }]}>
          <SettingRow icon="info.circle.fill" title="User Manual" subtitle="Tips and troubleshooting" tc={tc} isDark={isDark} onPress={() => setShowManual(true)} />
        </View>

        {/* ── Maintenance ── */}
        <Text style={[styles.groupLabel, { color: tc.textSecondary }]}>MAINTENANCE</Text>
        <View style={[styles.group, { backgroundColor: tc.surface, borderColor: tc.border }]}>
          <SettingRow icon="rotate.right" title="Recalculate Stats" subtitle="Refresh storage metrics" tc={tc} isDark={isDark} onPress={calcStorage} />
          <Separator tc={tc} />
          <SettingRow icon="trash.fill" title="Clear All PDFs" subtitle="Permanently delete library" tc={tc} isDark={isDark} onPress={handleClear} isDestructive />
        </View>

        {/* ── About ── */}
        <Text style={[styles.groupLabel, { color: tc.textSecondary }]}>ABOUT</Text>
        <View style={[styles.group, { backgroundColor: tc.surface, borderColor: tc.border }]}>
          <SettingRow icon="checkmark.circle.fill" title="Version" subtitle="v1.0.2 Performance+" tc={tc} isDark={isDark} onPress={handleVersionPress} />
        </View>

        <View style={styles.footerBlock}>
          <View style={[styles.footerBrand, { backgroundColor: isDark ? '#18181B' : '#FFFFFF', borderColor: tc.border }]}>
            <View style={[styles.footerIcon, { backgroundColor: Brand.indigo }]}>
              <IconSymbol name="photo.on.rectangle.angled" size={16} color="#FFF" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.footerAppName, { color: tc.text }]}>Image to PDF</Text>
              <Text style={[styles.footerTagline, { color: tc.textSecondary }]}>100% offline · private · fast</Text>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* ── User Manual modal ── */}
      <Modal visible={showManual} animationType="slide" presentationStyle="pageSheet">
        <View style={[styles.root, { backgroundColor: tc.background }]}>
          <View style={[styles.header, {
            paddingTop: Platform.OS === 'web' ? 20 : insets.top + 12,
            backgroundColor: isDark ? '#18181B' : '#FFFFFF',
            borderBottomColor: tc.border,
          }]}>
            <View style={{ width: 40 }} />
            <Text style={[styles.headerTitle, { color: tc.text }]}>User Manual</Text>
            <TouchableOpacity
              style={[styles.doneBtn, { backgroundColor: isDark ? '#27272A' : '#F1F5F9' }]}
              onPress={() => setShowManual(false)}
            >
              <Text style={[styles.doneBtnText, { color: tc.textSecondary }]}>Done</Text>
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.manualScroll} showsVerticalScrollIndicator={false}>
            {MANUAL_SECTIONS.map((s, i) => (
              <ManualCard key={i} {...s} tc={tc} isDark={isDark} />
            ))}
          </ScrollView>
        </View>
      </Modal>

      {/* ── Secret easter egg ── */}
      <Modal visible={showSecret} transparent animationType="none">
        <Animated.View entering={FadeIn.duration(300)} exiting={FadeOut} style={styles.secretOverlay}>
          <Animated.View entering={ZoomIn.springify().damping(18)} style={styles.secretCard}>
            <Text style={styles.secretEyebrow}>THE FUTURE</Text>
            <Text style={styles.secretTitle}>BINAN</Text>
            <View style={styles.secretDivider} />
            <Text style={styles.secretDesc}>{"The World's First Trillionaire"}</Text>
            <View style={styles.secretDate}>
              <Text style={styles.secretDateLabel}>MARK THE DATE</Text>
              <Text style={styles.secretDateValue}>2027 · MARCH 20</Text>
            </View>
            <TouchableOpacity style={styles.secretClose} onPress={() => setShowSecret(false)}>
              <Text style={styles.secretCloseText}>DISMISS</Text>
            </TouchableOpacity>
          </Animated.View>
        </Animated.View>
      </Modal>
    </View>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Separator({ tc }: { tc: any }) {
  return <View style={[styles.separator, { backgroundColor: tc.border }]} />;
}

function SettingRow({ icon, title, subtitle, onPress, isDestructive, tc, isDark }: {
  icon: any; title: string; subtitle?: string; onPress?: () => void;
  isDestructive?: boolean; tc: any; isDark: boolean;
}) {
  return (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={onPress ? 0.7 : 1}>
      <View style={[styles.rowIcon, { backgroundColor: isDestructive ? `${Brand.pdfRed}20` : `${Brand.indigo}15` }]}>
        <IconSymbol name={icon} size={17} color={isDestructive ? Brand.pdfRed : Brand.indigo} />
      </View>
      <View style={styles.rowContent}>
        <Text style={[styles.rowTitle, { color: isDestructive ? Brand.pdfRed : tc.text }]}>{title}</Text>
        {subtitle && <Text style={[styles.rowSub, { color: tc.textSecondary }]}>{subtitle}</Text>}
      </View>
      {onPress && <IconSymbol name="chevron.right" size={14} color={tc.textSecondary} style={{ opacity: 0.4 }} />}
    </TouchableOpacity>
  );
}

function ManualCard({ title, icon, color, description, steps, tc, isDark }: {
  title: string; icon: any; color: string; description: string; steps: string[]; tc: any; isDark: boolean;
}) {
  return (
    <Animated.View entering={SlideInUp.springify().damping(20)} style={[styles.manualCard, { backgroundColor: isDark ? '#18181B' : '#FFFFFF', borderColor: tc.border }]}>
      <View style={styles.manualCardHeader}>
        <View style={[styles.manualCardIcon, { backgroundColor: `${color}20` }]}>
          <IconSymbol name={icon} size={18} color={color} />
        </View>
        <Text style={[styles.manualCardTitle, { color: tc.text }]}>{title}</Text>
      </View>
      <Text style={[styles.manualCardDesc, { color: tc.textSecondary }]}>{description}</Text>
      {steps.map((step, i) => (
        <View key={i} style={styles.stepRow}>
          <View style={[styles.stepDot, { backgroundColor: color }]} />
          <Text style={[styles.stepText, { color: tc.text }]}>{step}</Text>
        </View>
      ))}
    </Animated.View>
  );
}

// ─── Manual content ───────────────────────────────────────────────────────────

const MANUAL_SECTIONS = [
  {
    title: 'Scale & Stability',
    icon: 'slider.horizontal.3' as const,
    color: Brand.indigo,
    description: 'How large image batches are handled safely.',
    steps: [
      'Images are resized to 750px width before conversion — ideal for A4 mobile PDFs.',
      'Sequential processing keeps RAM usage low even for 100+ page documents.',
      'For batches over 150 images, split into two documents for best results.',
    ],
  },
  {
    title: 'Privacy & Security',
    icon: 'lock.fill' as const,
    color: Brand.emerald,
    description: 'Your data never leaves your device.',
    steps: [
      '100% offline — no cloud, no tracking, no servers.',
      'PDF generation runs entirely in a local sandbox.',
      'Temp files are deleted immediately after each conversion.',
    ],
  },
  {
    title: 'Mastering the Draft',
    icon: 'paintbrush' as const,
    color: Brand.pdfRed,
    description: 'Get the most out of the editor.',
    steps: [
      'Long-press any page thumbnail to drag and reorder pages.',
      'Tap "+" in the draft header to append more images.',
      'Edit the document title before generating to keep things organized.',
    ],
  },
  {
    title: 'Troubleshooting',
    icon: 'exclamationmark.triangle.fill' as const,
    color: Brand.amber,
    description: 'Common issues and fixes.',
    steps: [
      'Blank PDF? Restart the app and try with fewer images.',
      'Slow processing? 100+ images can take 30–60s on older devices.',
      "Can't open PDF? Ensure you have a PDF viewer installed.",
    ],
  },
];

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '800', letterSpacing: -0.3 },
  doneBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10 },
  doneBtnText: { fontSize: 14, fontWeight: '600' },

  scroll: { padding: 16, gap: 6 },

  statsRow: { flexDirection: 'row', gap: 12, marginBottom: 24 },
  statCard: {
    flex: 1, borderRadius: 18, padding: 18, gap: 4, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 10, elevation: 5,
  },
  statBgIcon: { position: 'absolute', right: 10, top: 10 },
  statValue: { color: '#FFF', fontSize: 28, fontWeight: '900', letterSpacing: -1 },
  statLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: '700' },

  groupLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 1.2, marginBottom: 8, marginTop: 16, marginLeft: 4 },
  group: {
    borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  separator: { height: StyleSheet.hairlineWidth, marginLeft: 58 },

  // Appearance block
  appearanceBlock: { padding: 14, gap: 12 },
  appearanceTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },

  row: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 },
  rowIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  rowContent: { flex: 1, gap: 2 },
  rowTitle: { fontSize: 15, fontWeight: '700' },
  rowSub: { fontSize: 12, fontWeight: '500' },

  footerBlock: { marginTop: 32, marginBottom: 8 },
  footerBrand: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 16, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth,
  },
  footerIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  footerAppName: { fontSize: 15, fontWeight: '800' },
  footerTagline: { fontSize: 12, fontWeight: '500', marginTop: 2 },

  manualScroll: { padding: 16, gap: 12, paddingBottom: 40 },
  manualCard: {
    borderRadius: 16, padding: 16, gap: 10, borderWidth: StyleSheet.hairlineWidth,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 2,
  },
  manualCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  manualCardIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  manualCardTitle: { fontSize: 16, fontWeight: '800' },
  manualCardDesc: { fontSize: 13, lineHeight: 18, fontWeight: '500' },
  stepRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  stepDot: { width: 6, height: 6, borderRadius: 3, marginTop: 5 },
  stepText: { flex: 1, fontSize: 13, fontWeight: '500', lineHeight: 19 },

  secretOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.94)',
    alignItems: 'center', justifyContent: 'center', padding: 32,
  },
  secretCard: {
    width: '100%', alignItems: 'center', padding: 36, borderRadius: 32,
    backgroundColor: '#000', borderWidth: 1, borderColor: '#FFD700',
    shadowColor: '#FFD700', shadowOpacity: 0.5, shadowRadius: 24, elevation: 20,
  },
  secretEyebrow: { fontSize: 10, fontWeight: '900', color: '#FFD700', letterSpacing: 4, marginBottom: 8 },
  secretTitle: { fontSize: 46, fontWeight: '900', color: '#FFF', letterSpacing: 8 },
  secretDivider: { width: 50, height: 3, backgroundColor: '#FFD700', borderRadius: 2, marginVertical: 20 },
  secretDesc: { fontSize: 17, fontWeight: '300', color: '#FFF', textAlign: 'center', lineHeight: 26 },
  secretDate: { marginTop: 32, alignItems: 'center', gap: 4 },
  secretDateLabel: { fontSize: 10, fontWeight: '800', color: 'rgba(255,255,255,0.4)', letterSpacing: 2 },
  secretDateValue: { fontSize: 22, fontWeight: '900', color: Brand.pdfRed, letterSpacing: 1 },
  secretClose: { marginTop: 40, paddingHorizontal: 24, paddingVertical: 11, borderRadius: 24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  secretCloseText: { fontSize: 11, fontWeight: '900', color: '#FFF', letterSpacing: 2 },
});
