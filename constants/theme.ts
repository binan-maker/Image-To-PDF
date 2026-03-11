import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#0F172A',
    textSecondary: '#64748B',
    background: '#F1F5F9',
    surface: '#FFFFFF',
    surfaceElevated: '#FFFFFF',
    border: '#E2E8F0',
    tint: '#6366F1',
    icon: '#64748B',
    tabIconDefault: '#94A3B8',
    tabIconSelected: '#6366F1',
  },
  dark: {
    text: '#F8FAFC',
    textSecondary: '#94A3B8',
    background: '#09090B',
    surface: '#18181B',
    surfaceElevated: '#27272A',
    border: '#27272A',
    tint: '#818CF8',
    icon: '#94A3B8',
    tabIconDefault: '#52525B',
    tabIconSelected: '#818CF8',
  },
};

export const Brand = {
  indigo: '#6366F1',
  indigoDark: '#4F46E5',
  indigoLight: '#818CF8',
  pdfRed: '#EF4444',
  pdfRedDark: '#DC2626',
  amber: '#F59E0B',
  emerald: '#10B981',
  rose: '#F43F5E',
};

export const Fonts = Platform.select({
  ios: {
    sans: 'system-ui',
    serif: 'ui-serif',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
