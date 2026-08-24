import { DarkTheme, DefaultTheme, ThemeProvider as NavThemeProvider } from '@react-navigation/native';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { TouchableOpacity, View, Text, StyleSheet } from 'react-native';
import 'react-native-reanimated';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { Brand } from '@/constants/theme';
import { ThemeProvider, useTheme } from '@/context/theme-context';

function BrandHeader() {
  const { colorScheme } = useTheme();
  const isDark = colorScheme === 'dark';
  return (
    <View style={styles.brandRow}>
      <View style={[styles.brandDot, { backgroundColor: Brand.indigo }]} />
      <Text style={[styles.brandImg, { color: isDark ? '#F8FAFC' : '#0F172A' }]}>PDF</Text>
      <Text style={[styles.brandArrow, { color: isDark ? '#52525B' : '#A1A1AA' }]}>/</Text>
      <Text style={[styles.brandPdf, { color: Brand.indigo }]}>Unlocker</Text>
    </View>
  );
}

function RootLayoutInner() {
  const { colorScheme } = useTheme();
  const isDark = colorScheme === 'dark';
  const router = useRouter();

  return (
    <NavThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
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
                style={[styles.headerBtn, { borderColor: isDark ? '#3F3F46' : '#E4E4E7' }]}
                activeOpacity={0.6}
              >
                <IconSymbol name="gearshape.fill" size={16} color={isDark ? '#71717A' : '#A1A1AA'} />
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
      <StatusBar style={isDark ? 'light' : 'dark'} />
    </NavThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <RootLayoutInner />
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
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
