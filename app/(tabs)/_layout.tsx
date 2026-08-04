import { Tabs, useRouter } from 'expo-router';
import React from 'react';
import { StyleSheet, TouchableOpacity, View, Platform } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Brand, Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

function BrandHeader() {
  const colorScheme = useColorScheme() ?? 'light';
  const isDark = colorScheme === 'dark';
  return (
    <View style={styles.brandContainer}>
      <View style={[styles.brandIcon, { backgroundColor: Brand.indigo }]}>
        <IconSymbol name="photo.on.rectangle.angled" size={13} color="#FFF" />
      </View>
      <ThemedText style={[styles.brandWord, { color: isDark ? '#F8FAFC' : '#0F172A' }]}>img</ThemedText>
      <View style={styles.arrowChip}>
        <ThemedText style={styles.arrowText}>→</ThemedText>
      </View>
      <View style={[styles.pdfChip, { backgroundColor: Brand.pdfRed }]}>
        <ThemedText style={styles.pdfChipText}>PDF</ThemedText>
      </View>
    </View>
  );
}

export default function TabLayout() {
  const colorScheme = useColorScheme() ?? 'light';
  const router = useRouter();
  const themeColors = Colors[colorScheme];
  const isDark = colorScheme === 'dark';

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: themeColors.tint,
        tabBarInactiveTintColor: themeColors.tabIconDefault,
        headerStyle: {
          backgroundColor: isDark ? '#09090B' : '#FFFFFF',
          elevation: 0,
          shadowOpacity: 0,
          borderBottomWidth: 0,
        },
        headerTitle: () => <BrandHeader />,
        tabBarStyle: {
          backgroundColor: isDark ? '#18181B' : '#FFFFFF',
          borderTopColor: isDark ? '#27272A' : '#F1F5F9',
          borderTopWidth: 1,
          height: Platform.OS === 'web' ? 84 : 60,
          paddingBottom: Platform.OS === 'web' ? 34 : 6,
          paddingTop: 6,
          elevation: 0,
          shadowOpacity: 0,
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '700',
          letterSpacing: 0.3,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarLabel: 'Convert',
          tabBarIcon: ({ color, focused }) => (
            <View style={[styles.tabIcon, focused && { backgroundColor: `${Brand.indigo}20` }]}>
              <IconSymbol size={22} name="house.fill" color={color} />
            </View>
          ),
          headerRight: () => (
            <TouchableOpacity
              onPress={() => router.push('/explore')}
              style={[styles.headerBtn, { backgroundColor: isDark ? '#27272A' : '#F1F5F9' }]}
              activeOpacity={0.7}
            >
              <IconSymbol name="gearshape.fill" size={18} color={themeColors.icon} />
            </TouchableOpacity>
          ),
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: 'Settings',
          headerShown: false,
          tabBarLabel: 'Settings',
          tabBarIcon: ({ color, focused }) => (
            <View style={[styles.tabIcon, focused && { backgroundColor: `${Brand.indigo}20` }]}>
              <IconSymbol size={22} name="gearshape.fill" color={color} />
            </View>
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  brandContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  brandIcon: {
    width: 26,
    height: 26,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandWord: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  arrowChip: {
    paddingHorizontal: 2,
  },
  arrowText: {
    fontSize: 14,
    color: '#94A3B8',
    fontWeight: '700',
  },
  pdfChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  pdfChipText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  headerBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  tabIcon: {
    width: 36,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
