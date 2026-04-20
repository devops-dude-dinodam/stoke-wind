export const theme = {
  colors: {
    background: '#060F1E',
    backgroundAlt: '#0A1628',
    card: '#0D1F35',
    cardBorder: '#1A3050',
    primary: '#00B4D8',
    primaryLight: '#48CAE4',

    green: '#22C55E',
    greenDim: '#16A34A',
    greenBg: '#052e16',
    greenBorder: '#166534',

    yellow: '#EAB308',
    yellowDim: '#CA8A04',
    yellowBg: '#1c1407',
    yellowBorder: '#713f12',

    red: '#EF4444',
    redDim: '#DC2626',
    redBg: '#1c0707',
    redBorder: '#7f1d1d',

    textPrimary: '#E2E8F0',
    textSecondary: '#94A3B8',
    textMuted: '#475569',

    border: '#1A3050',
    inputBg: '#0D1F35',
    divider: '#1A3050',
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48,
  },
  radius: {
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
  },
  text: {
    xs: 11,
    sm: 13,
    base: 15,
    lg: 17,
    xl: 20,
    xxl: 26,
    xxxl: 34,
  },
};

export type Theme = typeof theme;
