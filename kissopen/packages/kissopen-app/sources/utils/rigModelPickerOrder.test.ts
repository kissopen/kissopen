import { describe, expect, it } from 'vitest';
import { sortRigModelsForPicker } from './rigModelPickerOrder';

describe('KISSOPEN Agent model picker order', () => {
    it.each(['openai/gpt-6-astra', 'gpt-6-astra'])('promotes %s within its provider without mutating the catalog', (id) => {
        const models = [
            { providerId: 'claude', id: 'anthropic/opus-5' },
            { providerId: 'codex', id: 'openai/gpt-5.6-sol' },
            { providerId: 'grok', id: 'xai/grok-4.6' },
            { providerId: 'codex', id: 'openai/gpt-5.6-terra' },
            { providerId: 'codex', id },
            { providerId: 'codex', id: 'custom-model' },
        ];
        const original = [...models];

        expect(sortRigModelsForPicker(models)).toEqual([
            models[0], models[4], models[1], models[3], models[5], models[2],
        ]);
        expect(models).toEqual(original);
    });

    it('does not invent Astra when a daemon does not advertise it', () => {
        const models = [{ providerId: 'codex', id: 'openai/gpt-5.6-sol' }];
        expect(sortRigModelsForPicker(models)).toEqual(models);
        expect(sortRigModelsForPicker([])).toEqual([]);
    });
});