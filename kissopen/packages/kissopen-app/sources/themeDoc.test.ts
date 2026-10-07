import { describe, expect, it, vi } from 'vitest';

vi.mock('react-native', () => ({
    Platform: { OS: 'ios', select: (options: Record<string, unknown>) => options.ios ?? options.default },
}));

const { alpha, isDark, mix, radiusScale, themeFromDoc } = await import('./themeDoc');
const { darkTheme, lightTheme } = await import('./theme');

// The server's 暖阳 system theme, as GET /api/themes/public/sys-warm answers.
const warm = {
    version: 1,
    font: 'serif',
    radius: 'round',
    light: { accent: '#c96a1f', on_accent: '#ffffff', canvas: '#faf5ec', surface: '#fffdf8', raised: '#f3ecdf', text: '#2b2118', muted: '#6d6157', line: '#e9dfcf', success: '#3d9a5b', warning: '#d98a11', danger: '#d64533' },
    dark: { accent: '#f0a35c', on_accent: '#2a1a08', canvas: '#211b16', surface: '#2a231d', raised: '#1a1511', text: '#f6efe6', muted: '#c7bbae', line: '#3a3129', success: '#6ccc8a', warning: '#f2b451', danger: '#f0766a' },
};

describe('themeDoc', () => {
    it('mixes and fades colours', () => {
        expect(mix('#000000', '#ffffff', 0.5)).toBe('#808080');
        expect(mix('#fff', '#000', 0)).toBe('#ffffff');
        expect(alpha('#ff0000', 0.5)).toBe('rgba(255, 0, 0, 0.5)');
        expect(isDark('#211b16')).toBe(true);
        expect(isDark('#faf5ec')).toBe(false);
        expect(radiusScale('sharp')).toBeLessThan(1);
        expect(radiusScale('soft')).toBe(1);
    });

    it('derives every role of both appearances from the palette', () => {
        const light = themeFromDoc(warm, lightTheme, warm.light);
        const dark = themeFromDoc(warm, darkTheme, warm.dark);
        expect(light.dark).toBe(false);
        expect(dark.dark).toBe(true);
        expect(light.colors.text).toBe('#2b2118');
        expect(light.colors.groupped.background).toBe('#faf5ec');
        expect(light.colors.home.bg).toBe('#faf5ec');
        expect(light.colors.surface).toBe('#fffdf8');
        expect(light.colors.header.background).toBe('#f3ecdf');
        expect(light.colors.button.primary.background).toBe('#c96a1f');
        expect(light.colors.button.primary.tint).toBe('#ffffff');
        expect(light.colors.button.emphasis.background).toBe('#c96a1f');
        expect(light.colors.home.accentSoft).toBe(mix('#fffdf8', '#c96a1f', 0.12));
        expect(light.colors.home.hover).toBe(alpha('#c96a1f', 0.06));
        expect(light.colors.home.peachText).toBe(mix('#d98a11', '#2b2118', 0.3));
        expect(dark.colors.divider).toBe('#3a3129');
        expect(dark.colors.textSecondary).toBe('#c7bbae');
        // Round corners scale the shared radii up; fixed palettes stay as they were.
        expect(light.borderRadius.md).toBeGreaterThan(lightTheme.borderRadius.md);
        expect(light.colors.diff).toEqual(lightTheme.colors.diff);
        expect(dark.colors.terminal).toEqual(darkTheme.colors.terminal);
        expect(light.colors.syntaxKeyword).toBe(lightTheme.colors.syntaxKeyword);
        // The shape is the app's own theme's, key for key.
        const keys = (o: object): string[] => Object.entries(o).flatMap(([k, v]) => v && typeof v === 'object' && !Array.isArray(v) ? keys(v).map(x => `${k}.${x}`) : [k]);
        expect(keys(light).sort()).toEqual(keys(lightTheme).sort());
    });
});
