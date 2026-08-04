import React, { createContext, useContext, useEffect, useState } from 'react';
import { Platform, useColorScheme as useSystemColorScheme } from 'react-native';

import * as FileSystem from 'expo-file-system/legacy';

export type ThemePreference = 'light' | 'dark' | 'system';
export type ColorScheme = 'light' | 'dark';

interface ThemeContextValue {
  colorScheme: ColorScheme;
  themePreference: ThemePreference;
  setThemePreference: (pref: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  colorScheme: 'light',
  themePreference: 'system',
  setThemePreference: () => {},
});

const PREF_KEY = 'imgpdf_theme_preference';
const getPrefFile = () =>
  FileSystem.documentDirectory ? `${FileSystem.documentDirectory}theme_prefs.json` : null;

async function loadSavedPreference(): Promise<ThemePreference | null> {
  try {
    if (Platform.OS === 'web') {
      const val = typeof localStorage !== 'undefined' ? localStorage.getItem(PREF_KEY) : null;
      if (val === 'light' || val === 'dark' || val === 'system') return val;
    } else {
      const file = getPrefFile();
      if (!file) return null;
      const info = await FileSystem.getInfoAsync(file);
      if (info.exists) {
        const content = await FileSystem.readAsStringAsync(file);
        const data = JSON.parse(content);
        if (data.theme === 'light' || data.theme === 'dark' || data.theme === 'system') {
          return data.theme;
        }
      }
    }
  } catch {}
  return null;
}

async function savePreference(pref: ThemePreference): Promise<void> {
  try {
    if (Platform.OS === 'web') {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(PREF_KEY, pref);
      }
    } else {
      const file = getPrefFile();
      if (!file) return;
      await FileSystem.writeAsStringAsync(file, JSON.stringify({ theme: pref }));
    }
  } catch {}
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // System scheme from the OS
  const systemScheme = (useSystemColorScheme() ?? 'light') as ColorScheme;
  const [themePreference, setThemePreferenceState] = useState<ThemePreference>('system');
  const [hydrated, setHydrated] = useState(false);

  // Load persisted preference once on mount
  useEffect(() => {
    loadSavedPreference().then((saved) => {
      if (saved) setThemePreferenceState(saved);
      setHydrated(true);
    });
  }, []);

  const colorScheme: ColorScheme =
    themePreference === 'system' ? systemScheme : themePreference;

  const setThemePreference = (pref: ThemePreference) => {
    setThemePreferenceState(pref);
    savePreference(pref);
  };

  // Render immediately — before hydration we use the system default (no flash)
  return (
    <ThemeContext.Provider value={{ colorScheme: hydrated ? colorScheme : systemScheme, themePreference, setThemePreference }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}
