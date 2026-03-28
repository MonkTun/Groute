// Light theme tokens matching web's oklch palette
export const T = {
  // Backgrounds
  bg: '#fafafa',           // page background
  card: '#ffffff',          // card background
  cardBorder: '#e5e5e5',   // card/input borders
  muted: '#f0f0f0',        // muted backgrounds (badges, pills)
  inputBg: '#ffffff',       // input background
  inputBorder: '#e0e0e0',  // input border

  // Primary (teal)
  primary: '#0f8a6e',
  primaryLight: 'rgba(15,138,110,0.1)',
  primaryText: '#0f8a6e',

  // Text
  text: '#1a1a2e',          // primary text
  textSecondary: '#6b7280', // secondary text
  textMuted: '#9ca3af',     // muted/placeholder text

  // Accent
  amber: '#b45309',
  amberBg: '#fef3c7',
  green: '#047857',
  greenBg: '#d1fae5',
  red: '#dc2626',
  redBg: '#fee2e2',

  // Misc
  border: '#e5e5e5',
  shadow: '#000',
  overlay: 'rgba(0,0,0,0.05)',
} as const
