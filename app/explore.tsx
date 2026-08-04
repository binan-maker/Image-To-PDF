import * as FileSystem from 'expo-file-system/legacy';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  Alert,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { Brand, Colors } from '@/constants/theme';
import { ThemePreference, useTheme } from '@/context/theme-context';

// ─── Theme toggle ─────────────────────────────────────────────────────────────

const THEME_OPTIONS: { value: ThemePreference; label: string; icon: any }[] = [
  { value: 'light', label: 'Light', icon: 'sun.max.fill' },
  { value: 'system', label: 'Auto', icon: 'circle.lefthalf.filled' },
  { value: 'dark', label: 'Dark', icon: 'moon.fill' },
];

function ThemeToggle({ tc, isDark }: { tc: any; isDark: boolean }) {
  const { themePreference, setThemePreference } = useTheme();

  return (
    <View style={[toggleStyles.row, { backgroundColor: isDark ? '#09090B' : '#F1F5F9', borderColor: tc.border ?? (isDark ? '#27272A' : '#F4F4F5') }]}>
      {THEME_OPTIONS.map((opt) => {
        const active = themePreference === opt.value;
        return (
          <TouchableOpacity
            key={opt.value}
            style={[
              toggleStyles.option,
              active && { backgroundColor: isDark ? '#27272A' : '#FFFFFF' },
            ]}
            onPress={() => setThemePreference(opt.value)}
            activeOpacity={0.7}
          >
            <IconSymbol
              name={opt.icon}
              size={14}
              color={active ? Brand.indigo : tc.textSecondary}
            />
            <Text
              style={[
                toggleStyles.label,
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

const toggleStyles = StyleSheet.create({
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

// ─── Settings screen ──────────────────────────────────────────────────────────

export default function SettingsScreen() {
  const { colorScheme, themePreference } = useTheme();
  const tc = Colors[colorScheme];
  const isDark = colorScheme === 'dark';
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [storageSize, setStorageSize] = useState('0.00');
  const [docCount, setDocCount] = useState(0);
  const [showPrivacy, setShowPrivacy] = useState(false);

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
    Alert.alert(
      'Clear All Documents',
      'This permanently deletes every PDF in your library. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete All',
          style: 'destructive',
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
      ]
    );
  };

  const topPad = Platform.OS === 'web' ? 24 : insets.top + 12;
  const botPad = Platform.OS === 'web' ? 40 : Math.max(insets.bottom, 24) + 16;

  const themeLabel =
    themePreference === 'system' ? 'Follows device setting' :
    themePreference === 'dark' ? 'Dark mode' : 'Light mode';

  return (
    <View style={[styles.root, { backgroundColor: tc.background }]}>
      {/* Header */}
      <View style={[styles.header, {
        paddingTop: topPad,
        backgroundColor: isDark ? '#09090B' : '#FFFFFF',
        borderBottomColor: isDark ? '#27272A' : '#F4F4F5',
      }]}>
        <TouchableOpacity
          style={[styles.backBtn, { backgroundColor: isDark ? '#27272A' : '#F4F4F5' }]}
          onPress={() => router.back()}
          activeOpacity={0.7}
        >
          <IconSymbol name="chevron.right" size={16} color={tc.text} style={{ transform: [{ rotate: '180deg' }] }} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: tc.text }]}>Settings</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: botPad }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Storage card */}
        <View style={[styles.storageCard, {
          backgroundColor: isDark ? '#18181B' : '#FFFFFF',
          borderColor: isDark ? '#27272A' : '#F4F4F5',
        }]}>
          <View style={styles.storageStat}>
            <Text style={[styles.storageNumber, { color: tc.text }]}>{docCount}</Text>
            <Text style={[styles.storageLabel, { color: tc.textSecondary }]}>PDFs</Text>
          </View>
          <View style={[styles.storageDivider, { backgroundColor: isDark ? '#27272A' : '#F4F4F5' }]} />
          <View style={styles.storageStat}>
            <Text style={[styles.storageNumber, { color: tc.text }]}>
              {storageSize}
              <Text style={[styles.storageUnit, { color: tc.textSecondary }]}> MB</Text>
            </Text>
            <Text style={[styles.storageLabel, { color: tc.textSecondary }]}>Used</Text>
          </View>
          <View style={[styles.storageDivider, { backgroundColor: isDark ? '#27272A' : '#F4F4F5' }]} />
          <TouchableOpacity style={styles.storageStat} onPress={calcStorage} activeOpacity={0.7}>
            <View style={[styles.refreshIconBox, { backgroundColor: `${Brand.indigo}15` }]}>
              <IconSymbol name="arrow.clockwise" size={15} color={Brand.indigo} />
            </View>
            <Text style={[styles.storageLabel, { color: Brand.indigo }]}>Refresh</Text>
          </TouchableOpacity>
        </View>

        {/* Appearance group */}
        <Text style={[styles.groupLabel, { color: tc.textSecondary }]}>Appearance</Text>
        <View style={[styles.group, {
          backgroundColor: isDark ? '#18181B' : '#FFFFFF',
          borderColor: isDark ? '#27272A' : '#F4F4F5',
        }]}>
          <View style={styles.appearanceBlock}>
            <View style={styles.appearanceTitleRow}>
              <View style={[styles.rowIconBox, { backgroundColor: `${Brand.indigo}18` }]}>
                <IconSymbol name="paintbrush" size={15} color={Brand.indigo} />
              </View>
              <View style={styles.appearanceText}>
                <Text style={[styles.rowTitle, { color: tc.text }]}>Theme</Text>
                <Text style={[styles.rowValue, { color: tc.textSecondary }]}>{themeLabel}</Text>
              </View>
            </View>
            <ThemeToggle tc={tc} isDark={isDark} />
          </View>
        </View>

        {/* Library group */}
        <Text style={[styles.groupLabel, { color: tc.textSecondary }]}>Library</Text>
        <View style={[styles.group, {
          backgroundColor: isDark ? '#18181B' : '#FFFFFF',
          borderColor: isDark ? '#27272A' : '#F4F4F5',
        }]}>
          <Row
            icon="trash.fill"
            iconColor={Brand.pdfRed}
            title="Clear All PDFs"
            value="Permanent"
            isDestructive
            tc={tc} isDark={isDark}
            onPress={handleClear}
          />
        </View>

        {/* About */}
        <Text style={[styles.groupLabel, { color: tc.textSecondary }]}>About</Text>
        <View style={[styles.group, {
          backgroundColor: isDark ? '#18181B' : '#FFFFFF',
          borderColor: isDark ? '#27272A' : '#F4F4F5',
        }]}>
          <Row
            icon="info.circle.fill"
            iconColor={Brand.indigo}
            title="Version"
            value="1.0.2"
            tc={tc} isDark={isDark}
          />
          <RowDivider isDark={isDark} />
          <Row
            icon="doc.text.fill"
            iconColor={Brand.indigo}
            title="Privacy Policy"
            tc={tc} isDark={isDark}
            onPress={() => setShowPrivacy(true)}
          />
        </View>

        {/* Footer wordmark */}
        <View style={styles.footer}>
          <View style={[styles.footerDot, { backgroundColor: Brand.indigo }]} />
          <Text style={[styles.footerText, { color: tc.textSecondary }]}>
            img<Text style={{ color: Brand.pdfRed }}>PDF</Text>
          </Text>
        </View>
      </ScrollView>

      {/* Privacy Policy modal */}
      <Modal visible={showPrivacy} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowPrivacy(false)}>
        <View style={[styles.root, { backgroundColor: tc.background }]}>
          <View style={[styles.header, {
            paddingTop: Platform.OS === 'web' ? 20 : insets.top + 12,
            backgroundColor: isDark ? '#09090B' : '#FFFFFF',
            borderBottomColor: isDark ? '#27272A' : '#F4F4F5',
          }]}>
            <View style={{ width: 36 }} />
            <Text style={[styles.headerTitle, { color: tc.text }]}>Privacy Policy</Text>
            <TouchableOpacity
              style={[styles.doneBtn, { backgroundColor: isDark ? '#27272A' : '#F4F4F5' }]}
              onPress={() => setShowPrivacy(false)}
            >
              <Text style={[styles.doneBtnText, { color: tc.textSecondary }]}>Done</Text>
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.privacyScroll} showsVerticalScrollIndicator={false}>
            <View style={[styles.privacyNotice, { backgroundColor: `${Brand.indigo}12`, borderColor: `${Brand.indigo}30` }]}>
              <IconSymbol name="info.circle.fill" size={15} color={Brand.indigo} />
              <Text style={[styles.privacyNoticeText, { color: Brand.indigo }]}>
                By using imgPDF you agree to this Privacy Policy.
              </Text>
            </View>

            <Text style={[styles.privacyUpdated, { color: tc.textSecondary }]}>Last updated: July 2025</Text>

            {PRIVACY_SECTIONS.map((section, i) => (
              <View key={i} style={styles.privacySection}>
                <View style={styles.privacySectionHeader}>
                  <View style={[styles.privacySectionIconBox, { backgroundColor: `${section.color}18` }]}>
                    <IconSymbol name={section.icon as any} size={14} color={section.color} />
                  </View>
                  <Text style={[styles.privacySectionTitle, { color: tc.text }]}>{section.title}</Text>
                </View>
                {section.paragraphs.map((p, j) => (
                  <Text key={j} style={[styles.privacyParagraph, { color: tc.textSecondary }]}>{p}</Text>
                ))}
              </View>
            ))}

            <View style={[styles.privacyFooter, { borderColor: isDark ? '#27272A' : '#F4F4F5' }]}>
              <Text style={[styles.privacyFooterText, { color: tc.textSecondary }]}>
                If you have questions about this policy, please contact us through the app store listing.
              </Text>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function RowDivider({ isDark }: { isDark: boolean }) {
  return (
    <View style={[styles.rowDivider, { backgroundColor: isDark ? '#27272A' : '#F4F4F5' }]} />
  );
}

function Row({
  icon, iconColor, title, value, onPress, isDestructive, tc, isDark,
}: {
  icon: any; iconColor: string; title: string; value?: string;
  onPress?: () => void; isDestructive?: boolean; tc: any; isDark: boolean;
}) {
  return (
    <TouchableOpacity
      style={styles.row}
      onPress={onPress}
      activeOpacity={onPress ? 0.65 : 1}
    >
      <View style={[styles.rowIconBox, { backgroundColor: `${iconColor}18` }]}>
        <IconSymbol name={icon} size={15} color={iconColor} />
      </View>
      <Text style={[styles.rowTitle, { color: isDestructive ? Brand.pdfRed : tc.text }]}>
        {title}
      </Text>
      <View style={styles.rowRight}>
        {value ? (
          <Text style={[styles.rowValue, { color: tc.textSecondary }]}>{value}</Text>
        ) : null}
        {onPress ? (
          <IconSymbol name="chevron.right" size={12} color={tc.textSecondary} style={{ opacity: 0.35 }} />
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

// ─── Privacy content ──────────────────────────────────────────────────────────

const PRIVACY_SECTIONS = [
  {
    title: 'Overview',
    icon: 'info.circle.fill',
    color: Brand.indigo,
    paragraphs: [
      'imgPDF is a completely offline image-to-PDF converter. This policy explains how the app handles your data and what responsibilities we accept — and do not accept — in relation to your files.',
      'By opening and using imgPDF, you confirm that you have read and agreed to this Privacy Policy.',
    ],
  },
  {
    title: 'No Data Collection',
    icon: 'lock.fill',
    color: '#34C759',
    paragraphs: [
      'imgPDF does not collect, transmit, store, or share any personal information or file data. All processing — image reading, compression, and PDF generation — happens entirely on your device.',
      'We have no servers, no accounts, no analytics, and no third-party SDKs that communicate over the network. Your images and documents never leave your device.',
    ],
  },
  {
    title: 'File Storage & Loss',
    icon: 'doc.text.fill',
    color: Brand.pdfRed,
    paragraphs: [
      "PDFs created by imgPDF are saved to your device's local storage. We are not responsible for any loss, corruption, or accidental deletion of PDF files or source images, whether caused by app errors, device failures, OS updates, storage issues, or any other circumstance.",
      'We strongly recommend that you back up important PDFs to a cloud service or external storage immediately after creation. imgPDF provides a "Clear All PDFs" action that permanently removes all stored documents — this action cannot be undone.',
      'imgPDF is provided as-is without any guarantee of data preservation or file integrity beyond the current session.',
    ],
  },
  {
    title: 'Permissions',
    icon: 'eye.fill',
    color: Brand.amber,
    paragraphs: [
      'imgPDF requests access to your photo library solely to allow you to select images for conversion. This permission is used only when you actively choose to pick images. We do not scan your library in the background or access any media you have not explicitly selected.',
      'On iOS, permission is requested at the moment you tap "Select Images". You may revoke this permission at any time in your device Settings.',
    ],
  },
  {
    title: 'No Legal Liability',
    icon: 'exclamationmark.triangle.fill',
    color: Brand.amber,
    paragraphs: [
      'imgPDF is a simple utility with no network connectivity, no user accounts, and no external services. To the fullest extent permitted by applicable law, the developers of imgPDF accept no liability for: any loss of files or data; any damage arising from use or inability to use the app; any outcomes resulting from PDFs created by the app.',
      'This app does not handle sensitive, financial, medical, or legally binding documents in any special way. Users are solely responsible for verifying the accuracy and completeness of any documents they create.',
    ],
  },
  {
    title: 'Changes to This Policy',
    icon: 'paintbrush',
    color: Brand.indigo,
    paragraphs: [
      'We may update this Privacy Policy from time to time. Any changes will be reflected in an updated version of the app. Continued use of imgPDF after an update constitutes acceptance of the revised policy.',
    ],
  },
];

// ─── Styles ───────────────────────────────────────────────────────────────────

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
  headerTitle: { fontSize: 17, fontWeight: '600', letterSpacing: -0.2 },
  backBtn: {
    width: 36, height: 36, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  doneBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 9 },
  doneBtnText: { fontSize: 14, fontWeight: '500' },

  scroll: { paddingHorizontal: 20, paddingTop: 24, gap: 0 },

  storageCard: {
    flexDirection: 'row',
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    marginBottom: 28,
  },
  storageStat: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 20,
    gap: 4,
  },
  storageNumber: { fontSize: 26, fontWeight: '700', letterSpacing: -0.8 },
  storageUnit: { fontSize: 14, fontWeight: '500' },
  storageLabel: { fontSize: 12, fontWeight: '500' },
  storageDivider: { width: StyleSheet.hairlineWidth },
  refreshIconBox: {
    width: 32, height: 32, borderRadius: 9,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 2,
  },

  groupLabel: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.1,
    marginBottom: 8,
    marginLeft: 2,
  },
  group: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    marginBottom: 24,
  },

  // Appearance block
  appearanceBlock: { padding: 14, gap: 12 },
  appearanceTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  appearanceText: { flex: 1, gap: 2 },

  rowDivider: { height: StyleSheet.hairlineWidth, marginLeft: 54 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
    paddingHorizontal: 14,
    gap: 12,
  },
  rowIconBox: {
    width: 32, height: 32, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
  },
  rowTitle: { flex: 1, fontSize: 15, fontWeight: '500' },
  rowRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  rowValue: { fontSize: 14, fontWeight: '400' },

  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingTop: 8,
    paddingBottom: 4,
  },
  footerDot: { width: 6, height: 6, borderRadius: 3 },
  footerText: { fontSize: 14, fontWeight: '600', letterSpacing: -0.2 },

  privacyScroll: { padding: 20, gap: 0, paddingBottom: 48 },
  privacyNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    marginBottom: 16,
  },
  privacyNoticeText: { flex: 1, fontSize: 13, fontWeight: '500', lineHeight: 18 },
  privacyUpdated: { fontSize: 12, fontWeight: '400', marginBottom: 20 },
  privacySection: { marginBottom: 22 },
  privacySectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 9, marginBottom: 8 },
  privacySectionIconBox: { width: 28, height: 28, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  privacySectionTitle: { fontSize: 15, fontWeight: '600' },
  privacyParagraph: { fontSize: 13, lineHeight: 20, fontWeight: '400', marginBottom: 8 },
  privacyFooter: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 16, marginTop: 4 },
  privacyFooterText: { fontSize: 12, lineHeight: 18, fontWeight: '400', textAlign: 'center' },
});
