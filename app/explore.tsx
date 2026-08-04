import * as FileSystem from 'expo-file-system/legacy';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Alert, Modal, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { Brand, Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function SettingsScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const tc = Colors[colorScheme];
  const isDark = colorScheme === 'dark';
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [storageSize, setStorageSize] = useState('0.00');
  const [docCount, setDocCount] = useState(0);
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
          Alert.alert('Done', 'Library cleared.');
        },
      },
    ]);
  };

  const topPad = Platform.OS === 'web' ? 24 : insets.top + 12;

  return (
    <View style={[styles.root, { backgroundColor: tc.background }]}>
      <View style={[styles.header, { paddingTop: topPad, backgroundColor: isDark ? '#18181B' : '#FFFFFF', borderBottomColor: isDark ? '#3F3F46' : '#E4E4E7' }]}>
        <TouchableOpacity
          style={[styles.backBtn, { backgroundColor: isDark ? '#27272A' : '#F4F4F5' }]}
          onPress={() => router.back()}
        >
          <IconSymbol name="chevron.right" size={18} color={tc.text} style={{ transform: [{ rotate: '180deg' }] }} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: tc.text }]}>Settings</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: Platform.OS === 'web' ? 40 : Math.max(insets.bottom, 24) + 16 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Stats */}
        <View style={styles.statsRow}>
          <View style={[styles.statCard, { backgroundColor: isDark ? '#18181B' : '#FFFFFF', borderColor: isDark ? '#3F3F46' : '#E4E4E7' }]}>
            <Text style={[styles.statValue, { color: tc.text }]}>{docCount}</Text>
            <Text style={[styles.statLabel, { color: tc.textSecondary }]}>Documents</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: isDark ? '#18181B' : '#FFFFFF', borderColor: isDark ? '#3F3F46' : '#E4E4E7' }]}>
            <Text style={[styles.statValue, { color: tc.text }]}>{storageSize}</Text>
            <Text style={[styles.statLabel, { color: tc.textSecondary }]}>MB used</Text>
          </View>
        </View>

        <Text style={[styles.groupLabel, { color: tc.textSecondary }]}>General</Text>
        <View style={[styles.group, { backgroundColor: isDark ? '#18181B' : '#FFFFFF', borderColor: isDark ? '#3F3F46' : '#E4E4E7' }]}>
          <SettingRow icon="paintbrush" title="Appearance" subtitle={`${colorScheme === 'dark' ? 'Dark' : 'Light'} mode`} tc={tc} isDark={isDark} />
          <Separator tc={tc} isDark={isDark} />
          <SettingRow icon="info.circle.fill" title="User Manual" subtitle="Tips and troubleshooting" tc={tc} isDark={isDark} onPress={() => setShowManual(true)} />
        </View>

        <Text style={[styles.groupLabel, { color: tc.textSecondary }]}>Maintenance</Text>
        <View style={[styles.group, { backgroundColor: isDark ? '#18181B' : '#FFFFFF', borderColor: isDark ? '#3F3F46' : '#E4E4E7' }]}>
          <SettingRow icon="rotate.right" title="Recalculate Stats" subtitle="Refresh storage metrics" tc={tc} isDark={isDark} onPress={calcStorage} />
          <Separator tc={tc} isDark={isDark} />
          <SettingRow icon="trash.fill" title="Clear All PDFs" subtitle="Permanently delete library" tc={tc} isDark={isDark} onPress={handleClear} isDestructive />
        </View>

        <Text style={[styles.groupLabel, { color: tc.textSecondary }]}>About</Text>
        <View style={[styles.group, { backgroundColor: isDark ? '#18181B' : '#FFFFFF', borderColor: isDark ? '#3F3F46' : '#E4E4E7' }]}>
          <SettingRow icon="checkmark.circle.fill" title="Version" subtitle="1.0.2" tc={tc} isDark={isDark} />
        </View>

        <View style={styles.footer}>
          <Text style={[styles.footerText, { color: tc.textSecondary }]}>100% offline · private · on‑device</Text>
        </View>
      </ScrollView>

      {/* Manual modal */}
      <Modal visible={showManual} animationType="slide" presentationStyle="pageSheet">
        <View style={[styles.root, { backgroundColor: tc.background }]}>
          <View style={[styles.header, {
            paddingTop: Platform.OS === 'web' ? 20 : insets.top + 12,
            backgroundColor: isDark ? '#18181B' : '#FFFFFF',
            borderBottomColor: isDark ? '#3F3F46' : '#E4E4E7',
          }]}>
            <View style={{ width: 40 }} />
            <Text style={[styles.headerTitle, { color: tc.text }]}>User Manual</Text>
            <TouchableOpacity
              style={[styles.doneBtn, { backgroundColor: isDark ? '#27272A' : '#F4F4F5' }]}
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
    </View>
  );
}

function Separator({ tc, isDark }: { tc: any; isDark: boolean }) {
  return <View style={[styles.separator, { backgroundColor: isDark ? '#3F3F46' : '#E4E4E7' }]} />;
}

function SettingRow({ icon, title, subtitle, onPress, isDestructive, tc, isDark }: {
  icon: any; title: string; subtitle?: string; onPress?: () => void;
  isDestructive?: boolean; tc: any; isDark: boolean;
}) {
  return (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={onPress ? 0.7 : 1}>
      <View style={[styles.rowIcon, { backgroundColor: isDestructive ? `${Brand.pdfRed}15` : `${Brand.indigo}12` }]}>
        <IconSymbol name={icon} size={16} color={isDestructive ? Brand.pdfRed : Brand.indigo} />
      </View>
      <View style={styles.rowContent}>
        <Text style={[styles.rowTitle, { color: isDestructive ? Brand.pdfRed : tc.text }]}>{title}</Text>
        {subtitle && <Text style={[styles.rowSub, { color: tc.textSecondary }]}>{subtitle}</Text>}
      </View>
      {onPress && <IconSymbol name="chevron.right" size={13} color={tc.textSecondary} style={{ opacity: 0.3 }} />}
    </TouchableOpacity>
  );
}

function ManualCard({ title, icon, color, description, steps, tc, isDark }: {
  title: string; icon: any; color: string; description: string; steps: string[]; tc: any; isDark: boolean;
}) {
  return (
    <View style={[styles.manualCard, { backgroundColor: isDark ? '#18181B' : '#FFFFFF', borderColor: isDark ? '#3F3F46' : '#E4E4E7' }]}>
      <View style={styles.manualCardHeader}>
        <View style={[styles.manualCardIcon, { backgroundColor: `${color}15` }]}>
          <IconSymbol name={icon} size={16} color={color} />
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
    </View>
  );
}

const MANUAL_SECTIONS = [
  {
    title: 'Scale & Stability',
    icon: 'slider.horizontal.3' as const,
    color: Brand.indigo,
    description: 'How large image batches are handled safely.',
    steps: [
      'Images are resized to 750px width before conversion.',
      'Sequential processing keeps RAM low even for 100+ pages.',
      'For batches over 150 images, split into two documents.',
    ],
  },
  {
    title: 'Privacy',
    icon: 'lock.fill' as const,
    color: Brand.emerald,
    description: 'Your data never leaves your device.',
    steps: [
      '100% offline — no cloud, no tracking, no servers.',
      'PDF generation runs entirely in a local sandbox.',
      'Temp files are deleted immediately after conversion.',
    ],
  },
  {
    title: 'Using the Draft Editor',
    icon: 'paintbrush' as const,
    color: Brand.pdfRed,
    description: 'Get the most out of the editor.',
    steps: [
      'Long-press a page thumbnail to drag and reorder.',
      'Tap + in the draft header to append more images.',
      'Edit the document title before generating.',
    ],
  },
  {
    title: 'Troubleshooting',
    icon: 'exclamationmark.triangle.fill' as const,
    color: Brand.amber,
    description: 'Common issues and fixes.',
    steps: [
      'Blank PDF? Restart and try with fewer images.',
      '100+ images can take 30–60s on older devices.',
      "Can't open PDF? Ensure you have a PDF viewer installed.",
    ],
  },
];

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '700', letterSpacing: -0.3 },
  doneBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10 },
  doneBtnText: { fontSize: 14, fontWeight: '500' },

  scroll: { padding: 20, gap: 4 },

  statsRow: { flexDirection: 'row', gap: 12, marginBottom: 24 },
  statCard: {
    flex: 1,
    borderRadius: 14,
    padding: 16,
    gap: 4,
    borderWidth: StyleSheet.hairlineWidth,
  },
  statValue: { fontSize: 28, fontWeight: '700', letterSpacing: -1 },
  statLabel: { fontSize: 12, fontWeight: '500' },

  groupLabel: { fontSize: 12, fontWeight: '600', marginBottom: 8, marginTop: 20, marginLeft: 2 },
  group: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  separator: { height: StyleSheet.hairlineWidth, marginLeft: 56 },
  row: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 },
  rowIcon: { width: 34, height: 34, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  rowContent: { flex: 1, gap: 2 },
  rowTitle: { fontSize: 15, fontWeight: '500' },
  rowSub: { fontSize: 12, fontWeight: '400' },

  footer: { marginTop: 32, alignItems: 'center' },
  footerText: { fontSize: 12, fontWeight: '400' },

  manualScroll: { padding: 20, gap: 12, paddingBottom: 40 },
  manualCard: {
    borderRadius: 14,
    padding: 16,
    gap: 10,
    borderWidth: StyleSheet.hairlineWidth,
  },
  manualCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  manualCardIcon: { width: 34, height: 34, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  manualCardTitle: { fontSize: 15, fontWeight: '600' },
  manualCardDesc: { fontSize: 13, lineHeight: 19, fontWeight: '400' },
  stepRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  stepDot: { width: 5, height: 5, borderRadius: 3, marginTop: 6 },
  stepText: { flex: 1, fontSize: 13, fontWeight: '400', lineHeight: 19 },
});
