type RigPickerModel = {
    id: string;
    providerId: string;
};

/**
 * Older daemons can append Astra after their existing models. Promote it for
 * display, keeping provider order and every other row's relative order intact.
 * Only advertised models participate; this does not supply session defaults.
 */
export function sortRigModelsForPicker<T extends RigPickerModel>(models: readonly T[]): T[] {
    const groups = new Map<string, T[]>();
    for (const model of models) {
        const group = groups.get(model.providerId) ?? [];
        group.push(model);
        groups.set(model.providerId, group);
    }
    const isAstra = (model: T) => model.id === 'openai/gpt-6-astra' || model.id === 'gpt-6-astra';
    return [...groups.values()].flatMap((group) => [
        ...group.filter(isAstra),
        ...group.filter((model) => !isAstra(model)),
    ]);
}