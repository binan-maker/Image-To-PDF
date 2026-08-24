import { useRouter } from 'expo-router';
import React from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { Brand, Colors } from '@/constants/theme';
import { ThemePreference, useTheme } from '@/context/theme-context';

const OPTIONS: { value: ThemePreference; label: string; icon: any }[] = [
  { value: 'light', label: 'Light', icon: 'sun.max.fill' },
  { value: 'system', label: 'Auto', icon: 'circle.lefthalf.filled' },
  { value: 'dark', label: 'Dark', icon: 'moon.fill' },
];

export default function SettingsScreen() {
  const { colorScheme, themePreference, setThemePreference } = useTheme();
  const tc = Colors[colorScheme];
  const isDark = colorScheme === 'dark';
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.root, { backgroundColor: tc.background }]}>
      <View style={[styles.header, { paddingTop: Platform.OS === 'web' ? 20 : insets.top + 12, backgroundColor: tc.surface, borderBottomColor: tc.border }]}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <IconSymbol name="chevron.left" size={20} color={tc.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: tc.text }]}>Settings</Text>
        <View style={styles.backButton} />
      </View>
      <View style={styles.body}>
        <Text style={[styles.sectionLabel, { color: tc.textSecondary }]}>APPEARANCE</Text>
        <View style={[styles.card, { backgroundColor: tc.surface, borderColor: tc.border }]}>
          <View style={styles.cardHeading}>
            <View style={[styles.iconBox, { backgroundColor: `${Brand.indigo}16` }]}>
              <IconSymbol name="paintbrush.fill" size={17} color={Brand.indigo} />
            </View>
            <View>
              <Text style={[styles.cardTitle, { color: tc.text }]}>Theme</Text>
              <Text style={[styles.cardHint, { color: tc.textSecondary }]}>Choose how PDF Unlocker looks</Text>
            </View>
          </View>
          <View style={[styles.toggle, { backgroundColor: isDark ? '#09090B' : '#F1F5F9', borderColor: tc.border }]}>
            {OPTIONS.map((option) => {
              const active = themePreference === option.value;
              return (
                <Pressable key={option.value} onPress={() => setThemePreference(option.value)} style={[styles.option, active && { backgroundColor: isDark ? '#27272A' : '#FFFFFF' }]}>
                  <IconSymbol name={option.icon} size={14} color={active ? Brand.indigo : tc.textSecondary} />
                  <Text style={[styles.optionText, { color: active ? Brand.indigo : tc.textSecondary }]}>{option.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
        <Text style={[styles.footer, { color: tc.textSecondary }]}>PDF Unlocker · Private by design</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: StyleSheet.hairlineWidth },
  backButton: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '800' },
  body: { width: '100%', maxWidth: 680, alignSelf: 'center', padding: 24 },
  sectionLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 1.3, marginBottom: 10 },
  card: { borderRadius: 18, borderWidth: 1, padding: 18 },
  cardHeading: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconBox: { width: 38, height: 38, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { fontSize: 16, fontWeight: '800' },
  cardHint: { fontSize: 12, marginTop: 3 },
  toggle: { flexDirection: 'row', borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, padding: 3, gap: 3, marginTop: 18 },
  option: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 9, borderRadius: 9 },
  optionText: { fontSize: 13, fontWeight: '700' },
  footer: { textAlign: 'center', fontSize: 12, marginTop: 28 },
});