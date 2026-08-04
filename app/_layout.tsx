import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { TouchableOpacity, View, Text, StyleSheet } from 'react-native';
import 'react-native-reanimated';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { Brand, Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

function BrandHeader() {
  const colorScheme = useColorScheme() ?? 'light';
  const isDark = colorScheme === 'dark';
  return (
    <View style={styles.brandRow}>
      <View style={[styles.brandDot, { backgroundColor: Brand.indigo }]} />
      <Text style={[styles.brandImg, { color: isDark ? '#F8FAFC' : '#0F172A' }]}>img</Text>
      <Text style={[styles.brandArrow, { color: isDark ? '#52525B' : '#A1A1AA' }]}>→</Text>
      <Text style={[styles.brandPdf, { color: Brand.pdfRed }]}>PDF</Text>
    </View>
  );
}

export default function RootLayout() {
  const colorScheme = useColorScheme() ?? 'light';
  const isDark = colorScheme === 'dark';
  const themeColors = Colors[colorScheme];
  const router = useRouter();

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen
          name="index"
          options={{
            headerStyle: {
              backgroundColor: isDark ? '#09090B' : '#FFFFFF',
            },
            headerShadowVisible: false,
            headerTitle: () => <BrandHeader />,
            headerRight: () => (
              <TouchableOpacity
                onPress={() => router.push('/explore')}
                style={[styles.headerBtn, { backgroundColor: isDark ? '#27272A' : '#F4F4F5' }]}
                activeOpacity={0.7}
              >
                <IconSymbol name="gearshape.fill" size={16} color={themeColors.icon} />
              </TouchableOpacity>
            ),
          }}
        />
        <Stack.Screen
          name="explore"
          options={{ headerShown: false }}
        />
        <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
      </Stack>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  brandDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  brandImg: {
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.4,
  },
  brandArrow: {
    fontSize: 14,
    fontWeight: '400',
  },
  brandPdf: {
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.4,
  },
  headerBtn: {
    width: 34,
    height: 34,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
