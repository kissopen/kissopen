import { Redirect, useLocalSearchParams } from 'expo-router';
import { KissopenHome } from '@/kissopen/KissopenHome';

export default function KissopenSettingsScreen() {
    const { section } = useLocalSearchParams<{ section: string }>();
    if (section !== 'files') return <Redirect href="/settings" />;
    return <KissopenHome key={section} settingsSection={section} />;
}
