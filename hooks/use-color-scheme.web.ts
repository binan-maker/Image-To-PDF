import { useTheme } from '@/context/theme-context';

/**
 * Web version — same as native: reads from ThemeContext so the user's
 * saved preference (Light / Dark / System) is honoured on web too.
 */
export function useColorScheme() {
  return useTheme().colorScheme;
}
