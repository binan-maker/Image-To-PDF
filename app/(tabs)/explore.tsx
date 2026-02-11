
import React, { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Switch, TouchableOpacity, View } from 'react-native';
// Fix: Use 'expo-file-system/legacy' to access documentDirectory property which may be missing from the default import in some environments.
import * as FileSystem from 'expo-file-system/legacy';
import * as Haptics from 'expo-haptics';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function SettingsScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const themeColors = Colors[colorScheme];

  const [storageSize, setStorageSize] = useState('0 MB');
  const [docCount, setDocCount] = useState(0);
  const [hapticsEnabled, setHapticsEnabled] = useState(true);

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
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
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
              if (file.toLowerCase().endsWith('.pdf')) {
                await FileSystem.deleteAsync(`${docDir}${file}`);
              }
            }
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            calculateStorage();
            Alert.alert('Success', 'Library has been cleared.');
          }
        }
      ]
    );
  };

  const SettingItem = ({ 
    icon, 
    title, 
    subtitle, 
    onPress, 
    rightElement, 
    isDestructive 
  }: { 
    icon: any, 
    title: string, 
    subtitle?: string, 
    onPress?: () => void, 
    rightElement?: React.ReactNode,
    isDestructive?: boolean
  }) => (
    <TouchableOpacity 
      style={styles.settingItem} 
      onPress={onPress} 
      disabled={!onPress}
      activeOpacity={0.7}
    >
      <View style={[styles.iconContainer, { backgroundColor: isDestructive ? '#FFEBEE' : (colorScheme === 'dark' ? '#2A2D2F' : '#F0F2F5') }]}>
        <IconSymbol name={icon} size={22} color={isDestructive ? '#D32F2F' : themeColors.icon} />
      </View>
      <View style={styles.textContainer}>
        <ThemedText type="defaultSemiBold" style={isDestructive ? { color: '#D32F2F' } : undefined}>{title}</ThemedText>
        {subtitle && <ThemedText style={styles.subtitle}>{subtitle}</ThemedText>}
      </View>
      {rightElement}
      {!rightElement && onPress && <IconSymbol name="chevron.right" size={20} color={themeColors.icon} style={{ opacity: 0.3 }} />}
    </TouchableOpacity>
  );

  const SectionHeader = ({ title }: { title: string }) => (
    <ThemedText style={[styles.sectionHeader, { color: themeColors.tint }]}>{title.toUpperCase()}</ThemedText>
  );

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        
        <SectionHeader title="General" />
        <SettingItem 
          icon="bell.fill" 
          title="Haptic Feedback" 
          subtitle="Vibrate on user interaction"
          rightElement={
            <Switch 
              value={hapticsEnabled} 
              onValueChange={(val) => {
                setHapticsEnabled(val);
                if(val) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              }}
              trackColor={{ false: '#767577', true: themeColors.tint }}
            />
          }
        />
        <SettingItem 
          icon="checkmark.circle.fill" 
          title="Theme Mode" 
          subtitle={`Currently using ${colorScheme} appearance`}
        />

        <View style={styles.divider} />

        <SectionHeader title="Storage Management" />
        <SettingItem 
          icon="photo.on.rectangle.angled" 
          title="Library Stats" 
          subtitle={`${docCount} Documents • ${storageSize}`}
          onPress={calculateStorage}
        />
        <SettingItem 
          icon="trash.fill" 
          title="Clear Library" 
          subtitle="Delete all generated PDF files"
          onPress={handleClearLibrary}
          isDestructive
        />

        <View style={styles.divider} />

        <SectionHeader title="Support & About" />
        <SettingItem 
          icon="info.circle.fill" 
          title="Help Center" 
          subtitle="FAQs and User Guide"
          onPress={() => Alert.alert('Help', 'Guide coming soon!')}
        />
        <SettingItem 
          icon="checkmark.circle.fill" 
          title="App Version" 
          subtitle="1.0.0 (Build 20241028)"
        />
        
        <View style={styles.footer}>
          <ThemedText style={styles.footerText}>Made with ❤️ for PDF Management</ThemedText>
        </View>

      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  sectionHeader: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.5,
    marginBottom: 12,
    marginTop: 16,
    opacity: 0.8,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  textContainer: {
    flex: 1,
  },
  subtitle: {
    fontSize: 13,
    opacity: 0.5,
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(0,0,0,0.05)',
    marginVertical: 12,
  },
  footer: {
    marginTop: 40,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 12,
    opacity: 0.3,
  },
});
