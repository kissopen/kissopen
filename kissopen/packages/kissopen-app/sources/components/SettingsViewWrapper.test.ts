import * as React from 'react';
// @ts-expect-error react-test-renderer has no declarations in this workspace.
import { act, create } from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';

vi.mock('react-native', async () => {
    const ReactModule = await import('react');
    return { View: (props: any) => ReactModule.createElement('View', props, props.children) };
});
vi.mock('react-native-unistyles', () => ({
    StyleSheet: { create: (factory: any) => factory({ colors: { groupped: { background: 'background' } } }) },
}));
vi.mock('./SettingsView', async () => {
    const ReactModule = await import('react');
    return { SettingsView: (props: any) => ReactModule.createElement('SettingsView', props) };
});
vi.mock('@/kissopen/KissopenHome', () => {
    throw new Error('Account settings must not mount the commercial home or load cloud files.');
});

import { SettingsViewWrapper } from './SettingsViewWrapper';
import SettingsScreen from '@/app/(app)/settings/index';

describe('independent account settings entry points', () => {
    it('uses the account settings view for both the tab and direct route, without the cloud home', async () => {
        let tree: any;
        const onScroll = vi.fn();
        await act(async () => {
            tree = create(React.createElement(React.Fragment, {},
                React.createElement(SettingsViewWrapper, { topContentInset: 72, bottomContentInset: 120, onScroll }),
                React.createElement(SettingsScreen),
            ));
        });
        try {
            const views = tree.root.findAllByType('SettingsView');
            expect(views).toHaveLength(2);
            expect(views[0].props).toMatchObject({ topContentInset: 72, bottomContentInset: 120, onScroll });
        } finally {
            await act(async () => tree.unmount());
        }
    });
});
