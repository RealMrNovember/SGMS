export const colors = {
  bg: '#080d17',
  bgElevated: '#0f1626',
  card: '#131c2e',
  cardAlt: '#171f33',
  border: '#22304a',
  borderStrong: '#2d3d5c',
  gold: '#d4af6a',
  goldSoft: 'rgba(212,175,106,0.14)',
  goldBorder: 'rgba(212,175,106,0.35)',
  cyan: '#38bdf8',
  text: '#f1f5f9',
  muted: '#94a3b8',
  faint: '#5b6b88',
  danger: '#f87171',
  dangerSoft: 'rgba(248,113,113,0.14)',
  success: '#34d399',
  successSoft: 'rgba(52,211,153,0.14)',
  overlay: 'rgba(4,7,14,0.72)',
};

export const gradients = {
  gold: ['#e8c583', '#c9a24f'] as const,
  hero: ['#141d33', '#0b1220'] as const,
  qrHeader: ['#1c2740', '#0f1626'] as const,
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
};

export const radius = {
  sm: 10,
  md: 14,
  lg: 20,
  xl: 28,
  pill: 999,
};

export const typography = {
  title: { fontSize: 22, fontWeight: '700' as const },
  heading: { fontSize: 17, fontWeight: '700' as const },
  subheading: { fontSize: 14, fontWeight: '600' as const },
  body: { fontSize: 14, fontWeight: '400' as const },
  caption: { fontSize: 12, fontWeight: '500' as const },
  tiny: { fontSize: 10, fontWeight: '600' as const },
};

/** Android'de gerçek gölge yerine elevation kullanılır; ikisi birlikte tanımlanır. */
export const shadow = {
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.28,
    shadowRadius: 16,
    elevation: 6,
  },
  floating: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.4,
    shadowRadius: 28,
    elevation: 12,
  },
};
