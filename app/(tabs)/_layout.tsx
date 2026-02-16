import { Tabs, useRouter } from 'expo-router';
import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

function BrandHeader() {
  return (
    <View style={styles.brandContainer}>
      <ThemedText style={styles.imageText}>Image</ThemedText>
      <View style={styles.arrowContainer}>
        <ThemedText style={[styles.arrowPart, { color: '#007AFF' }]}>-</ThemedText>
        <ThemedText style={[styles.arrowPart, { color: '#FF3B30', marginLeft: -2 }]}>&gt;</ThemedText>
      </View>
      <View style={styles.pdfBadge}>
        <ThemedText style={styles.pdfText}>PDF</ThemedText>
        <View style={styles.badgeGloss} />
      </View>
    </View>
  );
}

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const router = useRouter();
  const themeColors = Colors[colorScheme ?? 'light'];

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: themeColors.tint,
        headerShown: true,
        headerTitle: () => <BrandHeader />,
        tabBarStyle: { display: 'none' }, // Completely hide the bottom navigation bar
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Image → PDF',
          tabBarLabel: 'Home',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="house.fill" color={color} />,
          headerRight: () => (
            <TouchableOpacity 
              onPress={() => router.push('/explore')}
              style={{ marginRight: 20 }}
              activeOpacity={0.7}
            >
              <IconSymbol name="gearshape.fill" size={24} color={themeColors.text} />
            </TouchableOpacity>
          ),
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: 'Settings',
          headerShown: false, // Use custom header in explore.tsx for a more attractive look
          tabBarLabel: 'Settings',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="gearshape.fill" color={color} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  brandContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  imageText: {
    fontWeight: '900',
    fontSize: 17,
    color: '#007AFF',
    letterSpacing: -0.8,
  },
  arrowContainer: {
    flexDirection: 'row',
    marginHorizontal: 6,
    alignItems: 'center',
  },
  arrowPart: {
    fontSize: 15,
    fontWeight: '900',
    lineHeight: 18,
  },
  pdfBadge: {
    backgroundColor: '#FF3B30',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    overflow: 'hidden',
    shadowColor: '#FF3B30',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 2,
  },
  pdfText: {
    fontWeight: '900',
    fontSize: 11,
    color: '#FFFFFF',
    letterSpacing: 0.8,
  },
  badgeGloss: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '35%',
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
});
