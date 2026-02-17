import * as FileSystem from 'expo-file-system/legacy';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import Animated, { FadeIn, FadeOut, SlideInRight, ZoomIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function SettingsScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const themeColors = Colors[colorScheme];
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [storageSize, setStorageSize] = useState('0.00 MB');
  const [docCount, setDocCount] = useState(0);
  
  const [versionClicks, setVersionClicks] = useState(0);
  const [showSecret, setShowSecret] = useState(false);
  const [showManual, setShowManual] = useState(false);

  const calculateStorage = async () => {
    try {
      const docDir = FileSystem.documentDirectory;
      if (!docDir) return;

      const files = await FileSystem.readDirectoryAsync(docDir);
      const pdfs = files.filter(f => f.toLowerCase().endsWith('.pdf'));
      setDocCount(pdfs.length);

      let total = 0;
      for (const file of pdfs) {
        const info = await FileSystem.getInfoAsync(`${docDir}${file}`);
        if (info.exists) total += info.size;
      }
      setStorageSize(`${(total / (1024 * 1024)).toFixed(2)} MB`);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    calculateStorage();
  }, []);

  const handleClearLibrary = () => {
    Alert.alert(
      'Clear All Documents',
      'This will permanently delete all generated PDF files. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete All',
          style: 'destructive',
          onPress: async () => {
            const docDir = FileSystem.documentDirectory;
            if (!docDir) return;
            const files = await FileSystem.readDirectoryAsync(docDir);
            for (const file of files) {
              if (file.toLowerCase().endsWith('.pdf') || file.toLowerCase().endsWith('.jpg')) {
                await FileSystem.deleteAsync(`${docDir}${file}`);
              }
            }
            calculateStorage();
            Alert.alert('Success', 'Library has been cleared.');
          }
        }
      ]
    );
  };

  const handleVersionPress = () => {
    const nextCount = versionClicks + 1;
    if (nextCount >= 3) {
      setShowSecret(true);
      setVersionClicks(0);
    } else {
      setVersionClicks(nextCount);
    }
  };

  const SettingRow = ({ 
    icon, 
    title, 
    subtitle, 
    onPress, 
    isDestructive 
  }: { 
    icon: any, 
    title: string, 
    subtitle?: string, 
    onPress?: () => void, 
    isDestructive?: boolean 
  }) => (
    <TouchableOpacity 
      style={[styles.rowCard, { backgroundColor: colorScheme === 'dark' ? '#1C1C1E' : '#FFFFFF' }]} 
      onPress={onPress} 
      activeOpacity={0.7}
    >
      <View style={[styles.iconWrapper, { backgroundColor: isDestructive ? '#FF3B30' : '#007AFF' }]}>
        <IconSymbol name={icon} size={18} color="#FFFFFF" />
        <View style={styles.iconGloss} />
      </View>
      <View style={styles.rowContent}>
        <ThemedText style={[styles.rowTitle, isDestructive ? { color: '#FF3B30' } : undefined]}>{title}</ThemedText>
        {subtitle && <ThemedText style={styles.rowSubtitle}>{subtitle}</ThemedText>}
      </View>
      <IconSymbol name="chevron.right" size={14} color={themeColors.icon} style={{ opacity: 0.3 }} />
    </TouchableOpacity>
  );

  const ManualSection = ({ title, icon, color, description, steps }: { title: string, icon: any, color: string, description: string, steps: string[] }) => (
    <Animated.View entering={SlideInRight.springify()} style={[styles.manualSection, { backgroundColor: colorScheme === 'dark' ? '#1C1C1E' : '#FFFFFF' }]}>
      <View style={styles.manualHeader}>
        <View style={[styles.manualIcon, { backgroundColor: color }]}>
          <IconSymbol name={icon} size={20} color="#FFF" />
          <View style={styles.iconGloss} />
        </View>
        <ThemedText style={styles.manualSectionTitle}>{title}</ThemedText>
      </View>
      <ThemedText style={styles.manualDescription}>{description}</ThemedText>
      {steps.map((step, idx) => (
        <View key={idx} style={styles.stepRow}>
          <View style={[styles.stepNumber, { borderColor: color }]}>
            <ThemedText style={[styles.stepNumberText, { color }]}>{idx + 1}</ThemedText>
          </View>
          <ThemedText style={styles.stepText}>{step}</ThemedText>
        </View>
      ))}
    </Animated.View>
  );

  return (
    <ThemedView style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity 
          style={[styles.backButton, { backgroundColor: colorScheme === 'dark' ? '#232328' : '#F5F5F7' }]} 
          onPress={() => router.back()}
        >
          <IconSymbol name="chevron.right" size={22} color={themeColors.text} style={{ transform: [{ rotate: '180deg' }] }} />
        </TouchableOpacity>
        
        <ThemedText style={styles.headerTitle}>SETTINGS</ThemedText>
        
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.hubContainer}>
          <View style={[styles.hubCard, styles.primaryHub]}>
            <ThemedText style={styles.hubStatValue}>{docCount}</ThemedText>
            <View>
              <ThemedText style={styles.hubStatLabel}>DOCS</ThemedText>
              <ThemedText style={styles.hubStatSub}>In Library</ThemedText>
            </View>
            <View style={styles.hubDecoration}><IconSymbol name="doc.text.fill" size={40} color="rgba(255,255,255,0.15)" /></View>
          </View>
          <View style={[styles.hubCard, styles.secondaryHub]}>
            <ThemedText style={styles.hubStatValue}>{storageSize.split(' ')[0]}</ThemedText>
            <View>
              <ThemedText style={styles.hubStatLabel}>MB USED</ThemedText>
              <ThemedText style={styles.hubStatSub}>Device Space</ThemedText>
            </View>
            <View style={styles.hubDecoration}><IconSymbol name="photo.on.rectangle.angled" size={40} color="rgba(255,255,255,0.15)" /></View>
          </View>
        </View>

        <ThemedText style={styles.sectionHeader}>GENERAL</ThemedText>
        <SettingRow 
          icon="paintbrush" 
          title="Interface Theme" 
          subtitle={`Running in ${colorScheme} mode`}
        />
        <SettingRow 
          icon="info.circle.fill" 
          title="User Manual" 
          subtitle="True facts about app performance"
          onPress={() => setShowManual(true)}
        />

        <ThemedText style={styles.sectionHeader}>MAINTENANCE</ThemedText>
        <SettingRow 
          icon="rotate.right" 
          title="Recalculate Stats" 
          subtitle="Refresh storage metrics"
          onPress={calculateStorage}
        />
        <SettingRow 
          icon="trash.fill" 
          title="Clear Archive" 
          subtitle="Permanently delete all PDFs"
          onPress={handleClearLibrary}
          isDestructive
        />

        <ThemedText style={styles.sectionHeader}>ABOUT</ThemedText>
        <SettingRow 
          icon="checkmark.circle.fill" 
          title="App Version" 
          subtitle="v1.0.2 Performance+"
          onPress={handleVersionPress}
        />

        <View style={styles.footer}>
          <View style={styles.footerLine} />
          <ThemedText style={styles.footerText}>IMAGE TO PDF PREMIUM</ThemedText>
          <ThemedText style={styles.footerSubText}>Designed for High Productivity</ThemedText>
        </View>
      </ScrollView>

      <Modal visible={showManual} animationType="slide" presentationStyle="pageSheet">
        <ThemedView style={styles.container}>
          <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
            <TouchableOpacity 
              style={[styles.backButton, { backgroundColor: colorScheme === 'dark' ? '#232328' : '#F5F5F7' }]} 
              onPress={() => setShowManual(false)}
            >
              <IconSymbol name="chevron.right" size={22} color={themeColors.text} style={{ transform: [{ rotate: '180deg' }] }} />
            </TouchableOpacity>
            
            <ThemedText style={styles.headerTitle}>USER MANUAL</ThemedText>
            
            <View style={styles.headerSpacer} />
          </View>

          <ScrollView contentContainerStyle={styles.manualScroll} showsVerticalScrollIndicator={false}>
            <View style={styles.manualIntro}>
              <ThemedText style={styles.manualIntroTitle}>Truthful Engineering</ThemedText>
              <ThemedText style={styles.manualIntroSub}>Understanding the advanced technology powering your documents.</ThemedText>
            </View>

            <ManualSection 
              title="Scale & Stability" 
              icon="slider.horizontal.3" 
              color="#007AFF"
              description="How we handle 100+ images without crashing your device."
              steps={[
                "Large image batches create massive memory footprints during conversion.",
                "To prevent 'Blank Page' errors, we automatically resize pages to 800px width.",
                "This resolution is optimized for standard A4 mobile viewing and sharing.",
                "Sequential processing ensures the system never runs out of RAM.",
                "For batches over 150 images, we recommend splitting into two documents for safety."
              ]}
            />

            <ManualSection 
              title="Privacy Standards" 
              icon="lock.fill" 
              color="#34C759"
              description="Your data never leaves your physical device."
              steps={[
                "This app is 100% offline. No cloud, no tracking, no servers.",
                "PDF generation happens in a secure sandbox on your local CPU.",
                "Temporary optimization files are deleted immediately after document creation.",
                "The app only requests access to the photos you specifically select.",
                "Your privacy is guaranteed by the code, not just a policy."
              ]}
            />

            <ManualSection 
              title="Mastering the Draft" 
              icon="paintbrush" 
              color="#FF3B30"
              description="Advanced control over your final output."
              steps={[
                "Use 'Selection Guard' during bulk imports to prevent UI freezing.",
                "Long-press any page in the draft to enter 'Draggable Mode'.",
                "Tap the '+' icon to add more images to an existing draft.",
                "Rename files in the Archive to keep your storage organized.",
                "Clear the archive regularly if you handle high-resolution image batches."
              ]}
            />

            <ManualSection 
              title="Troubleshooting" 
              icon="exclamationmark.triangle.fill" 
              color="#FF9500"
              description="Real solutions for common workflow issues."
              steps={[
                "Blank PDF? Usually caused by a memory spike. Restart the app and try fewer images.",
                "Slow Loading? Bulk optimizing 100 images can take 30-60 seconds on older CPUs.",
                "Missing Thumbnails? Recalculate stats in Settings to refresh the cache.",
                "Sharing issues? Ensure you have an active PDF viewer installed on your OS."
              ]}
            />
            
            <View style={{ height: 40 }} />
          </ScrollView>
        </ThemedView>
      </Modal>

      <Modal visible={showSecret} transparent animationType="none">
        <Pressable style={styles.secretOverlay} onPress={() => setShowSecret(false)}>
          <Animated.View entering={FadeIn.duration(400)} style={StyleSheet.absoluteFill}>
            <View style={styles.secretBlurBackdrop} />
          </Animated.View>
          
          <Animated.View entering={ZoomIn.springify()} exiting={FadeOut} style={styles.secretCard}>
            <ThemedText style={styles.secretPreTitle}>THE FUTURE REVEALED</ThemedText>
            <ThemedText style={styles.secretBinanText}>BINAN</ThemedText>
            <View style={styles.secretDividerGold} />
            <ThemedText style={styles.secretDescription}>The Worlds First Trillionaire</ThemedText>
            <View style={styles.secretDateContainer}>
              <ThemedText style={styles.secretDateLabel}>MARK THE DATE</ThemedText>
              <ThemedText style={styles.secretDateValue}>2027 MARCH 20</ThemedText>
            </View>
            <TouchableOpacity 
              style={styles.secretCloseBtn} 
              onPress={() => setShowSecret(false)}
            >
              <ThemedText style={styles.secretCloseBtnText}>DISMISS</ThemedText>
            </TouchableOpacity>
          </Animated.View>
        </Pressable>
      </Modal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 15,
  },
  headerSpacer: {
    width: 44,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  headerTitle: {
    fontSize: 14,
    fontWeight: '900',
    opacity: 0.9,
    letterSpacing: 1,
    textAlign: 'center',
  },
  scrollContent: {
    paddingBottom: 40,
  },
  hubContainer: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 10,
    height: 140,
  },
  hubCard: {
    flex: 1,
    borderRadius: 24,
    padding: 16,
    justifyContent: 'space-between',
    elevation: 8,
    shadowOpacity: 0.15,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    overflow: 'hidden',
  },
  primaryHub: { backgroundColor: '#007AFF' },
  secondaryHub: { backgroundColor: '#FF3B30' },
  hubStatValue: {
    color: '#FFF',
    fontSize: 32,
    fontWeight: '900',
  },
  hubStatLabel: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
  },
  hubStatSub: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 9,
    fontWeight: '600',
  },
  hubDecoration: {
    position: 'absolute',
    right: -10,
    bottom: -10,
  },
  sectionHeader: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.5,
    marginBottom: 12,
    marginTop: 24,
    marginHorizontal: 25,
    opacity: 0.3,
  },
  rowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    marginBottom: 10,
    padding: 14,
    borderRadius: 20,
    elevation: 2,
    shadowOpacity: 0.04,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  iconWrapper: {
    width: 38,
    height: 38,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
    overflow: 'hidden',
  },
  iconGloss: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '40%',
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  rowContent: {
    flex: 1,
  },
  rowTitle: {
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  rowSubtitle: {
    fontSize: 12,
    opacity: 0.4,
    marginTop: 1,
    fontWeight: '500',
  },
  footer: {
    marginTop: 50,
    alignItems: 'center',
    paddingBottom: 20,
  },
  footerLine: {
    width: 30,
    height: 3,
    backgroundColor: 'rgba(0,0,0,0.05)',
    borderRadius: 2,
    marginBottom: 15,
  },
  footerText: {
    fontSize: 11,
    opacity: 0.25,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  footerSubText: {
    fontSize: 9,
    opacity: 0.15,
    fontWeight: '700',
    marginTop: 2,
  },
  manualScroll: {
    paddingHorizontal: 20,
    paddingBottom: 50,
  },
  manualIntro: {
    marginVertical: 20,
    alignItems: 'center',
  },
  manualIntroTitle: {
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  manualIntroSub: {
    fontSize: 14,
    opacity: 0.5,
    marginTop: 5,
    textAlign: 'center',
    lineHeight: 20,
  },
  manualSection: {
    borderRadius: 24,
    padding: 20,
    marginBottom: 16,
    elevation: 2,
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  manualHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  manualIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    overflow: 'hidden',
  },
  manualSectionTitle: {
    fontSize: 17,
    fontWeight: '900',
    letterSpacing: -0.2,
  },
  manualDescription: {
    fontSize: 14,
    opacity: 0.6,
    lineHeight: 20,
    marginBottom: 16,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  stepNumber: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  stepNumberText: {
    fontSize: 11,
    fontWeight: '900',
  },
  stepText: {
    fontSize: 13,
    fontWeight: '600',
    opacity: 0.8,
    flex: 1,
  },
  secretOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
  },
  secretBlurBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  secretCard: {
    width: '100%',
    alignItems: 'center',
    padding: 40,
    borderRadius: 40,
    backgroundColor: '#000',
    borderWidth: 1,
    borderColor: '#FFD700',
    shadowColor: '#FFD700',
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 20,
  },
  secretPreTitle: {
    fontSize: 10,
    fontWeight: '900',
    color: '#FFD700',
    letterSpacing: 4,
    marginBottom: 10,
  },
  secretBinanText: {
    fontSize: 48,
    fontWeight: '900',
    color: '#FFF',
    letterSpacing: 10,
  },
  secretDividerGold: {
    width: 60,
    height: 4,
    backgroundColor: '#FFD700',
    marginVertical: 20,
    borderRadius: 2,
  },
  secretDescription: {
    fontSize: 18,
    fontWeight: '300',
    color: '#FFF',
    textAlign: 'center',
    lineHeight: 28,
  },
  secretDateContainer: {
    marginTop: 40,
    alignItems: 'center',
  },
  secretDateLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: 'rgba(255,255,255,0.4)',
    letterSpacing: 2,
    marginBottom: 5,
  },
  secretDateValue: {
    fontSize: 24,
    fontWeight: '900',
    color: '#FF3B30', 
    letterSpacing: 1,
  },
  secretCloseBtn: {
    marginTop: 50,
    paddingHorizontal: 25,
    paddingVertical: 12,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  secretCloseBtnText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#FFF',
    letterSpacing: 2,
  },
});
