import type { WidgetTheme } from './types/api.js';

export interface WidgetThemePalette {
  background: string;
  backgroundSecondary: string;
  border: string;
  textPrimary: string;
  textSecondary: string;
  accent: string;
  clientColor: string;
  headerBg: string;
}

export const WIDGET_THEMES: Record<WidgetTheme, WidgetThemePalette> = {
  dark: {
    background: '#0f1117',
    backgroundSecondary: '#161b22',
    border: '#30363d',
    textPrimary: '#e6edf3',
    textSecondary: '#8b949e',
    accent: '#58a6ff',
    clientColor: '#3fb950',
    headerBg: '#21262d',
  },
  light: {
    background: '#ffffff',
    backgroundSecondary: '#f6f8fa',
    border: '#d0d7de',
    textPrimary: '#1f2328',
    textSecondary: '#636c76',
    accent: '#0969da',
    clientColor: '#1a7f37',
    headerBg: '#f6f8fa',
  },
  transparent: {
    background: 'rgba(0,0,0,0.65)',
    backgroundSecondary: 'rgba(255,255,255,0.05)',
    border: 'rgba(255,255,255,0.12)',
    textPrimary: '#ffffff',
    textSecondary: 'rgba(255,255,255,0.55)',
    accent: '#60a5fa',
    clientColor: '#4ade80',
    headerBg: 'rgba(0,0,0,0.4)',
  },
  neon: {
    background: '#020510',
    backgroundSecondary: '#080d1a',
    border: '#00e5ff',
    textPrimary: '#e0f7ff',
    textSecondary: '#7ecfef',
    accent: '#00ffff',
    clientColor: '#00ff88',
    headerBg: '#050c18',
  },
  military: {
    background: '#1a1f0e',
    backgroundSecondary: '#232a12',
    border: '#4a5a2a',
    textPrimary: '#c8d4a0',
    textSecondary: '#8a9860',
    accent: '#8ab840',
    clientColor: '#70a030',
    headerBg: '#151c0a',
  },
  minimal: {
    background: '#fafafa',
    backgroundSecondary: '#f4f4f5',
    border: '#e4e4e7',
    textPrimary: '#18181b',
    textSecondary: '#71717a',
    accent: '#18181b',
    clientColor: '#16a34a',
    headerBg: '#f4f4f5',
  },
};

export const WIDGET_THEME_LABELS: Record<WidgetTheme, string> = {
  dark: 'Dark',
  light: 'Light',
  transparent: 'Transparent',
  neon: 'Neon / Cyberpunk',
  military: 'Military / OD Green',
  minimal: 'Minimal / Clean',
};
