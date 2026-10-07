import { Platform } from 'react-native';

/**
 * Typography system for Kissopen Coder app
 * 
 * Default typography: IBM Plex Sans
 * Monospace typography: IBM Plex Mono  
 * Logo typography: Bricolage Grotesque (specific use only)
 * 
 * Usage Examples:
 * 
 * // Default typography (IBM Plex Sans)
 * <Text style={{ fontSize: 16, ...Typography.default() }}>Regular text</Text>
 * <Text style={{ fontSize: 16, ...Typography.default('italic') }}>Italic text</Text>
 * <Text style={{ fontSize: 16, ...Typography.default('semiBold') }}>Semi-bold text</Text>
 * 
 * // Monospace typography (IBM Plex Mono)
 * <Text style={{ fontSize: 14, ...Typography.mono() }}>Code text</Text>
 * <Text style={{ fontSize: 14, ...Typography.mono('italic') }}>Italic code</Text>
 * <Text style={{ fontSize: 14, ...Typography.mono('semiBold') }}>Bold code</Text>
 * 
 * // Logo typography (Bricolage Grotesque - use sparingly!)
 * // Note: Don't add fontWeight as this font is already bold
 * <Text style={{ fontSize: 28, ...Typography.logo() }}>Logo Text</Text>
 * 
 * // Alternative direct usage
 * <Text style={{ fontSize: 16, fontFamily: getDefaultFont('semiBold') }}>Direct usage</Text>
 * <Text style={{ fontSize: 14, fontFamily: getMonoFont() }}>Direct mono usage</Text>
 * <Text style={{ fontSize: 28, fontFamily: getLogoFont() }}>Direct logo usage</Text>
 */

// Font family constants
export const FontFamilies = {
  // IBM Plex Sans (default typography)
  default: {
    regular: 'IBMPlexSans-Regular',
    italic: 'IBMPlexSans-Italic', 
    semiBold: 'IBMPlexSans-SemiBold',
  },
  
  // IBM Plex Mono (default monospace)
  mono: {
    regular: 'IBMPlexMono-Regular',
    italic: 'IBMPlexMono-Italic',
    semiBold: 'IBMPlexMono-SemiBold',
  },
  
  // Bricolage Grotesque (logo/special use only)
  logo: {
    bold: 'BricolageGrotesque-Bold',
  },

  // 站酷小薇 (ZCOOL XiaoWei) — the logo face for the Chinese wordmark KissOpen,
  // and nothing else. The bundled file is a subset holding only 一 起 卷, so
  // it cannot set any other text. SIL OFL 1.1; see assets/fonts.
  wordmark: {
    hanzi: 'ZCOOLXiaoWei',
  },

  // Legacy fonts (keep for backward compatibility)
  legacy: {
    spaceMono: 'SpaceMono',
    systemMono: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  }
};

/** The body face a custom theme asks for: sans is the app's own IBM Plex Sans. */
export type BodyFont = 'sans' | 'serif' | 'mono';

// A serif body uses the system's Chinese serif: Songti on iOS, the generic
// serif (Noto Serif CJK where installed) on Android, and a stack on the web.
const serifFamily = Platform.select({
  ios: 'Songti SC',
  android: 'serif',
  default: '"Songti SC", "Noto Serif CJK SC", Georgia, serif',
});

let bodyFont: BodyFont = 'sans';

/**
 * Sets the body face for the whole app; the theme store calls this before
 * the Unistyles theme updates, so every stylesheet that spreads
 * `Typography.default()` picks it up on that repaint.
 */
export const setBodyFont = (font: BodyFont) => { bodyFont = font; };
export const getBodyFont = () => bodyFont;

// Helper functions for easy access to font families
export const getDefaultFont = (weight: 'regular' | 'italic' | 'semiBold' = 'regular') => {
  if (bodyFont === 'mono') return FontFamilies.mono[weight];
  return FontFamilies.default[weight];
};

export const getMonoFont = (weight: 'regular' | 'italic' | 'semiBold' = 'regular') => {
  return FontFamilies.mono[weight];
};

export const getLogoFont = () => {
  return FontFamilies.logo.bold;
};

export const getWordmarkFont = () => {
  return FontFamilies.wordmark.hanzi;
};

// Font weight mappings for the font families
export const FontWeights = {
  regular: '400',
  semiBold: '600', 
  bold: '700',
} as const;

// Style utilities for easy inline usage
// The body style: the bundled Plex face by name, or, for a serif theme, the
// system serif with the weight and slant set as attributes since it has no
// per-weight family names.
const bodyStyle = (weight: 'regular' | 'italic' | 'semiBold'): { fontFamily: string; fontWeight?: '400' | '600'; fontStyle?: 'normal' | 'italic' } => {
  if (bodyFont === 'serif') {
    return {
      fontFamily: serifFamily,
      fontWeight: weight === 'semiBold' ? '600' : '400',
      fontStyle: weight === 'italic' ? 'italic' : 'normal',
    };
  }
  return { fontFamily: getDefaultFont(weight) };
};

export const Typography = {
  // Default font styles (IBM Plex Sans, or the body face of a custom theme)
  default: (weight: 'regular' | 'italic' | 'semiBold' = 'regular') => bodyStyle(weight),
  
  // Monospace font styles (IBM Plex Mono)
  mono: (weight: 'regular' | 'italic' | 'semiBold' = 'regular') => ({
    fontFamily: getMonoFont(weight),
  }),
  
  // Logo font style (Bricolage Grotesque)
  logo: () => ({
    fontFamily: getLogoFont(),
  }),

  // Chinese wordmark style (站酷小薇), for KissOpen only — the face is a
  // three-glyph subset. The Latin name KissOpen is set in the UI face at 600.
  wordmark: () => ({
    fontFamily: getWordmarkFont(),
  }),


  // Header text style (always the app's own face; a theme's font is for body text)
  header: () => ({
    fontFamily: FontFamilies.default.semiBold,
  }),
  
  // Body text style
  body: () => bodyStyle('regular'),
  
  // Legacy font styles (for backward compatibility)
  legacy: {
    spaceMono: () => ({
      fontFamily: FontFamilies.legacy.spaceMono,
    }),
    systemMono: () => ({
      fontFamily: FontFamilies.legacy.systemMono,
    }),
  }
}; 