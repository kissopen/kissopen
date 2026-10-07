import { Platform } from 'react-native';

// Shared spacing, sizing constants (DRY - used by both themes)
const sharedSpacing = {
    // Spacing scale (based on actual usage patterns in codebase)
    margins: {
        xs: 4,   // Tight spacing, status indicators
        sm: 8,   // Small gaps, most common gap value
        md: 12,  // Button gaps, card margins
        lg: 16,  // Most common padding value
        xl: 20,  // Large padding
        xxl: 24, // Section spacing
    },

    // Border radii (based on actual usage patterns in codebase). Typed as
    // numbers, not literals: a custom theme scales them (themeDoc.ts).
    borderRadius: {
        sm: 4,   // Checkboxes (20x20 boxes use 4px corners)
        md: 8,   // Buttons, items (most common - 31 uses)
        lg: 10,  // Input fields (matches "new session panel input fields")
        xl: 12,  // Cards, containers (20 uses)
        xxl: 16, // Main containers
    } as { sm: number; md: number; lg: number; xl: number; xxl: number },

    // Icon sizes (based on actual usage patterns)
    iconSize: {
        small: 12,  // Inline icons (checkmark, lock, status indicators)
        medium: 16, // Section headers, add buttons
        large: 20,  // Action buttons (delete, duplicate, edit) - most common
        xlarge: 24, // Main section icons (desktop, folder)
    },
} as const;

export const lightTheme = {
    dark: false,
    colors: {

        //
        // Main colors
        //

        text: '#000000',
        textDestructive: Platform.select({ ios: '#FF3B30', default: '#F44336' }),
        textSecondary: Platform.select({ ios: '#8E8E93', default: '#49454F' }),
        textLink: '#CE4438',
        deleteAction: '#FF6B6B', // Delete/remove button color
        warningCritical: '#FF3B30',
        warning: '#8E8E93',
        success: '#34C759',
        surface: '#ffffff',
        surfaceRipple: 'rgba(0, 0, 0, 0.08)',
        surfacePressed: '#f0f0f2',
        surfaceSelected: Platform.select({ ios: '#C6C6C8', default: '#eaeaea' }),
        surfacePressedOverlay: Platform.select({ ios: '#D1D1D6', default: 'transparent' }),
        surfaceHigh: '#F8F8F8',
        surfaceHighest: '#f0f0f0',
        divider: Platform.select({ ios: '#eaeaea', default: '#eaeaea' }),
        shadow: {
            color: Platform.select({ default: '#000000', web: 'rgba(0, 0, 0, 0.1)' }),
            opacity: 0.1,
        },
        glass: {
            background: 'rgba(255, 255, 255, 0.68)',
            backgroundStrong: 'rgba(255, 255, 255, 0.84)',
            backgroundSubtle: 'rgba(255, 255, 255, 0.42)',
            overlay: 'rgba(245, 245, 248, 0.58)',
            overlayTint: 'rgba(255, 255, 255, 0.46)',
            border: 'rgba(255, 255, 255, 0.82)',
            divider: 'rgba(60, 60, 67, 0.12)',
            highlight: 'rgba(255, 255, 255, 0.94)',
            shadow: 'rgba(39, 47, 54, 0.16)',
            tint: 'rgba(255, 255, 255, 0.14)',
            // Plain white, mirroring the dark theme's plain black: the tinted
            // gradient + colored glows read as a stain behind white surfaces.
            backdrop: ['#FFFFFF', '#FFFFFF', '#FFFFFF'] as readonly [string, string, string],
            glowPrimary: 'transparent',
            glowSecondary: 'transparent',
        },

        // Fixed brand palette from the KISSOPEN VI. These are identity colours,
        // so they do NOT flip between themes the way surfaces do — only `mark`
        // differs, because the glyph has to stay legible on either ground.
        brand: {
            accent: '#9184D9',      // Blurple — primary brand accent
            deepIndigo: '#262A60',  // app icon plate
            ground: '#161826',      // VI page ground
            inkLight: '#E9E9ED',
            inkDark: '#1B1D29',
            mark: '#1B1D29',        // glyph ink on a light surface
        },

        // The home, work and project board pages: a soft lilac ground with
        // white cards, one violet accent and two companions for progress.
        home: {
            bg: '#F7F6FB',
            card: '#FFFFFF',
            cardSoft: '#FAF9FD',
            border: 'rgba(108,92,210,0.08)',
            shadow: 'rgba(40,30,90,0.10)',
            accent: '#6B5BD2',
            accentStrong: '#5A4CB6',
            accentSoft: '#EFECFD',
            hover: 'rgba(107,91,210,0.06)',
            onAccent: '#FFFFFF',
            green: '#3F9D67',
            greenSoft: '#E8F6EE',
            peach: '#EE8A5E',
            peachSoft: '#FFF0E8',
            peachText: '#B5532B',
            muted: '#6C6880',
            danger: '#D9534F',
            track: '#EEECF5',
            skyTop: '#F6F1FF',
            skyBottom: '#FDE9DC',
            hillFar: '#D9D2F5',
            hillMid: '#C4BBEE',
            hillNear: '#AEA3E3',
            trees: '#8C80CF',
            sun: '#FFD7A3',
        },

        //
        // System components
        //

        groupped: {
            background: Platform.select({ ios: '#F2F2F7', default: '#F5F5F5' }),
            chevron: Platform.select({ ios: '#C7C7CC', default: '#49454F' }),
            sectionTitle: Platform.select({ ios: '#8E8E93', default: '#49454F' }),
        },
        header: {
            background: '#ffffff',
            tint: '#18171C'
        },
        switch: {
            track: {
                active: '#CE4438',
                inactive: '#dddddd',
            },
            thumb: {
                active: '#FFFFFF',
                inactive: '#767577',
            },
        },
        fab: {
            background: '#CE4438',
            backgroundPressed: '#B23A30',
            icon: '#FFFFFF',
        },
        radio: {
            active: '#CE4438',
            inactive: '#C0C0C0',
            dot: '#CE4438',
        },
        modal: {
            border: 'rgba(0, 0, 0, 0.1)'
        },
        button: {
            primary: {
                background: '#CE4438',
                tint: '#FFFFFF',
                disabled: '#C0C0C0',
            },
            secondary: {
                tint: '#666666',
            },
            // The one filled action of a screen (send, connect, round buttons):
            // the primary colour here, a white pill on the dark theme.
            emphasis: {
                background: '#CE4438',
                pressed: '#333333',
                text: '#FFFFFF',
            },
        },
        input: {
            background: '#F5F5F5',
            text: '#000000',
            placeholder: '#999999',
        },
        box: {
            warning: {
                background: '#FFF8F0',
                border: '#FF9500',
                text: '#FF9500',
            },
            error: {
                background: '#FFF0F0',
                border: '#FF3B30',
                text: '#FF3B30',
            }
        },

        //
        // App components
        //

        status: {
            connected: '#34C759',
            connecting: '#007AFF',
            disconnected: '#999999',
            error: '#FF3B30',
            default: '#8E8E93',
        },

        // Permission mode colors
        permission: {
            default: '#8E8E93',
            acceptEdits: '#007AFF',
            bypass: '#FF9500',
            plan: '#34C759',
            readOnly: '#8B8B8D',
            safeYolo: '#FF6B35',
            yolo: '#DC143C',
        },

        // Permission button colors
        permissionButton: {
            allow: {
                background: '#34C759',
                text: '#FFFFFF',
            },
            deny: {
                background: '#FF3B30',
                text: '#FFFFFF',
            },
            allowAll: {
                background: '#007AFF',
                text: '#FFFFFF',
            },
            inactive: {
                background: '#E5E5EA',
                border: '#D1D1D6',
                text: '#8E8E93',
            },
            selected: {
                background: '#F2F2F7',
                border: '#D1D1D6',
                text: '#3C3C43',
            },
        },


        // Diff view
        diff: {
            outline: '#E0E0E0',
            success: '#28A745',
            error: '#DC3545',
            // Traditional diff colors
            addedBg: '#E6FFED',
            addedBorder: '#34D058',
            addedText: '#24292E',
            removedBg: '#FFEEF0',
            removedBorder: '#D73A49',
            removedText: '#24292E',
            contextBg: '#F6F8FA',
            contextText: '#586069',
            lineNumberBg: '#F6F8FA',
            lineNumberText: '#959DA5',
            hunkHeaderBg: '#F1F8FF',
            hunkHeaderText: '#005CC5',
            leadingSpaceDot: '#E8E8E8',
            inlineAddedBg: '#ACFFA6',
            inlineAddedText: '#0A3F0A',
            inlineRemovedBg: '#FFCECB',
            inlineRemovedText: '#5A0A05',

            // Renderer palette (components/diff). Tuned against GitHub's
            // current light diff so a screenshot of either reads the same.
            rowAddedBg: '#E6FFEC',
            rowRemovedBg: '#FFEBE9',
            rowContextBg: 'transparent',
            gutterAddedBg: '#CCFFD8',
            gutterRemovedBg: '#FFD7D5',
            gutterContextBg: 'transparent',
            gutterBorder: '#D8DEE4',
            markerAdded: '#1A7F37',
            markerRemoved: '#CF222E',
            wordAddedBg: '#ABF2BC',
            wordRemovedBg: '#FFC1C0',
            sectionText: '#6E7781',
            syntax: {
                plain: '#1F2328',
                keyword: '#CF222E',
                string: '#0A3069',
                comment: '#6E7781',
                number: '#0550AE',
                function: '#8250DF',
                operator: '#0550AE',
                punctuation: '#1F2328',
                type: '#953800',
                variable: '#953800',
                tag: '#116329',
                attr: '#0550AE',
            },
        },

        // Message View colors
        userMessageBackground: '#f0eee6',
        userMessageText: '#000000',
        agentMessageText: '#000000',
        agentEventText: '#666666',

        // Code/Syntax colors
        syntaxKeyword: '#1d4ed8',
        syntaxString: '#059669',
        syntaxComment: '#6b7280',
        syntaxNumber: '#0891b2',
        syntaxFunction: '#9333ea',
        syntaxBracket1: '#ff6b6b',
        syntaxBracket2: '#4ecdc4',
        syntaxBracket3: '#45b7d1',
        syntaxBracket4: '#f7b731',
        syntaxBracket5: '#5f27cd',
        syntaxDefault: '#374151',

        // Git status colors
        gitBranchText: '#6b7280',
        gitFileCountText: '#6b7280',
        gitAddedText: '#22c55e',
        gitRemovedText: '#ef4444',

        // Terminal/Command colors
        terminal: {
            background: '#1E1E1E',
            prompt: '#34C759',
            command: '#E0E0E0',
            stdout: '#E0E0E0',
            stderr: '#FFB86C',
            error: '#FF5555',
            emptyOutput: '#6272A4',
        },

    },

    ...sharedSpacing,
};

export const darkTheme = {
    dark: true,
    colors: {

        //
        // Main colors
        //

        text: '#ffffff',
        textDestructive: Platform.select({ ios: '#FF453A', default: '#F48FB1' }),
        textSecondary: Platform.select({ ios: '#8E8E93', default: '#CAC4D0' }),
        textLink: '#FF8A7D',
        deleteAction: '#FF6B6B', // Delete/remove button color (same in both themes)
        warningCritical: '#FF453A',
        warning: '#8E8E93',
        success: '#32D74B',
        // Keep the established desktop palette while using the new neutral
        // graphite elevation scale for the native glass redesign.
        surface: Platform.select({ web: '#212121', default: '#161616' }),
        surfaceRipple: Platform.select({ web: 'rgba(255, 255, 255, 0.08)', default: 'rgba(255, 255, 255, 0.07)' }),
        surfacePressed: Platform.select({ web: '#2C2C2E', default: '#242424' }),
        surfaceSelected: Platform.select({ web: '#2C2C2E', default: '#242424' }),
        surfacePressedOverlay: Platform.select({ web: 'transparent', default: '#242424' }),
        surfaceHigh: Platform.select({ web: '#171717', default: '#1E1E1E' }),
        surfaceHighest: Platform.select({ web: '#292929', default: '#282828' }),
        divider: Platform.select({ web: '#292929', default: '#2A2A2A' }),
        shadow: {
            color: Platform.select({ default: '#000000', web: 'rgba(0, 0, 0, 0.1)' }),
            opacity: 0.1,
        },
        glass: {
            background: 'rgba(22, 22, 22, 0.44)',
            backgroundStrong: 'rgba(28, 28, 28, 0.68)',
            backgroundSubtle: 'rgba(255, 255, 255, 0.07)',
            overlay: 'rgba(0, 0, 0, 0.72)',
            overlayTint: 'rgba(0, 0, 0, 0.56)',
            border: 'rgba(255, 255, 255, 0.14)',
            divider: 'rgba(255, 255, 255, 0.08)',
            highlight: 'rgba(255, 255, 255, 0.22)',
            shadow: 'rgba(0, 0, 0, 0.55)',
            tint: 'rgba(16, 16, 16, 0.08)',
            backdrop: ['#000000', '#000000', '#000000'] as readonly [string, string, string],
            glowPrimary: 'transparent',
            glowSecondary: 'transparent',
        },

        // Same fixed VI palette as the light theme — only `mark` flips, so the
        // glyph reverses out of a dark ground instead of disappearing into it.
        brand: {
            accent: '#9184D9',
            deepIndigo: '#262A60',
            ground: '#161826',
            inkLight: '#E9E9ED',
            inkDark: '#1B1D29',
            mark: '#F3F5FE',
        },

        home: {
            bg: '#151519',
            card: '#1F1F25',
            cardSoft: '#25252C',
            border: 'rgba(255,255,255,0.06)',
            shadow: 'rgba(0,0,0,0.35)',
            accent: '#A597F3',
            accentStrong: '#B4A8F5',
            accentSoft: '#2C2945',
            hover: 'rgba(165,151,243,0.06)',
            onAccent: '#16131F',
            green: '#6CC792',
            greenSoft: '#1C3226',
            peach: '#F3A27D',
            peachSoft: '#3A2A22',
            peachText: '#F5B393',
            muted: '#A9A5B8',
            danger: '#F07C78',
            track: '#2E2D36',
            skyTop: '#2A2744',
            skyBottom: '#3D2F3A',
            hillFar: '#3B3761',
            hillMid: '#34305A',
            hillNear: '#2C2850',
            trees: '#4B4585',
            sun: '#F5C26B',
        },

        //
        // System components
        //

        header: {
            background: Platform.select({ web: '#212121', default: '#000000' }),
            tint: '#ffffff'
        },
        switch: {
            track: {
                active: '#E2574B',
                inactive: Platform.select({ web: '#3a393f', default: '#363636' }),
            },
            thumb: {
                active: '#FFFFFF',
                inactive: '#767577',
            },
        },
        groupped: {
            background: Platform.select({ web: '#1e1e1e', default: '#000000' }),
            chevron: Platform.select({ ios: '#505050', default: '#CAC4D0' }),
            sectionTitle: Platform.select({ ios: '#8E8E93', default: '#CAC4D0' }),
        },
        fab: {
            background: '#F2685C',
            backgroundPressed: '#E2574B',
            icon: '#FFFFFF',
        },
        radio: {
            active: '#FF8A7D',
            inactive: '#48484A',
            dot: '#FF8A7D',
        },
        modal: {
            border: 'rgba(255, 255, 255, 0.1)'
        },
        button: {
            primary: {
                background: '#CE4438',
                tint: '#FFFFFF',
                disabled: '#C0C0C0',
            },
            secondary: {
                tint: '#8E8E93',
            },
            emphasis: {
                background: '#F5F5F5',
                pressed: '#D9D9D9',
                text: '#111111',
            },
        },
        input: {
            background: Platform.select({ web: '#303030', default: '#1E1E1E' }),
            text: '#FFFFFF',
            placeholder: '#8E8E93',
        },
        box: {
            warning: {
                background: 'rgba(255, 159, 10, 0.15)',
                border: '#FF9F0A',
                text: '#FFAB00',
            },
            error: {
                background: 'rgba(255, 69, 58, 0.15)',
                border: '#FF453A',
                text: '#FF6B6B',
            }
        },

        //
        // App components
        //

        status: { // App Connection Status
            connected: '#34C759',
            connecting: '#FFFFFF',
            disconnected: '#8E8E93',
            error: '#FF453A',
            default: '#8E8E93',
        },

        // Permission mode colors
        permission: {
            default: '#8E8E93',
            acceptEdits: '#0A84FF',
            bypass: '#FF9F0A',
            plan: '#32D74B',
            readOnly: '#98989D',
            safeYolo: '#FF7A4C',
            yolo: '#FF453A',
        },

        // Permission button colors
        permissionButton: {
            allow: {
                background: '#32D74B',
                text: '#FFFFFF',
            },
            deny: {
                background: '#FF453A',
                text: '#FFFFFF',
            },
            allowAll: {
                background: '#0A84FF',
                text: '#FFFFFF',
            },
            inactive: {
                background: '#2C2C2E',
                border: '#38383A',
                text: '#8E8E93',
            },
            selected: {
                background: '#1C1C1E',
                border: '#38383A',
                text: '#FFFFFF',
            },
        },


        // Diff view
        diff: {
            outline: '#30363D',
            success: '#3FB950',
            error: '#F85149',
            // Traditional diff colors for dark mode
            addedBg: '#0D2E1F',
            addedBorder: '#3FB950',
            addedText: '#C9D1D9',
            removedBg: '#3F1B23',
            removedBorder: '#F85149',
            removedText: '#C9D1D9',
            contextBg: '#161B22',
            contextText: '#8B949E',
            lineNumberBg: '#161B22',
            lineNumberText: '#6E7681',
            hunkHeaderBg: '#161B22',
            hunkHeaderText: '#58A6FF',
            leadingSpaceDot: '#2A2A2A',
            inlineAddedBg: '#2A5A2A',
            inlineAddedText: '#7AFF7A',
            inlineRemovedBg: '#5A2A2A',
            inlineRemovedText: '#FF7A7A',

            // Renderer palette (components/diff), matched to GitHub dark default.
            rowAddedBg: '#12261E',
            rowRemovedBg: '#25171C',
            rowContextBg: 'transparent',
            gutterAddedBg: '#1B4721',
            gutterRemovedBg: '#78191B',
            gutterContextBg: 'transparent',
            gutterBorder: '#21262D',
            markerAdded: '#3FB950',
            markerRemoved: '#F85149',
            wordAddedBg: '#1F6F2E',
            wordRemovedBg: '#8B2C2F',
            sectionText: '#8B949E',
            syntax: {
                plain: '#E6EDF3',
                keyword: '#FF7B72',
                string: '#A5D6FF',
                comment: '#8B949E',
                number: '#79C0FF',
                function: '#D2A8FF',
                operator: '#79C0FF',
                punctuation: '#E6EDF3',
                type: '#FFA657',
                variable: '#FFA657',
                tag: '#7EE787',
                attr: '#79C0FF',
            },
        },

        // Message View colors
        userMessageBackground: '#2C2C2E',
        userMessageText: '#FFFFFF',
        agentMessageText: '#FFFFFF',
        agentEventText: '#8E8E93',

        // Code/Syntax colors (brighter for dark mode)
        syntaxKeyword: '#569CD6',
        syntaxString: '#CE9178',
        syntaxComment: '#6A9955',
        syntaxNumber: '#B5CEA8',
        syntaxFunction: '#DCDCAA',
        syntaxBracket1: '#FFD700',
        syntaxBracket2: '#DA70D6',
        syntaxBracket3: '#179FFF',
        syntaxBracket4: '#FF8C00',
        syntaxBracket5: '#00FF00',
        syntaxDefault: '#D4D4D4',

        // Git status colors
        gitBranchText: '#8E8E93',
        gitFileCountText: '#8E8E93',
        gitAddedText: '#34C759',
        gitRemovedText: '#FF453A',

        // Terminal/Command colors
        terminal: {
            background: '#1E1E1E',
            prompt: '#32D74B',
            command: '#E0E0E0',
            stdout: '#E0E0E0',
            stderr: '#FFB86C',
            error: '#FF6B6B',
            emptyOutput: '#7B7B93',
        },

    },

    ...sharedSpacing,
} satisfies typeof lightTheme;

export type Theme = typeof lightTheme;
