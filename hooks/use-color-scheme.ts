import { useTheme } from '@/context/theme-context';

/**
 * Returns the resolved color scheme ('light' | 'dark'), respecting the
 * user's in-app preference (Light / Dark / System) set in Settings.
 */
export function useColorScheme() {
  return useTheme().colorScheme;
}
