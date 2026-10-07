import * as React from 'react';
import { useRouter } from 'expo-router';
import { PersonaSetup } from '@/kissopen/PersonaSetup';
import { cloudCache } from '@/kissopen/cloudCache';

/**
 * Changing what the person said about their work, from the account tab. The
 * answers kept on the phone start the questions; saving writes a new home
 * page (the home listens for the change) and comes back.
 */
export default React.memo(function PersonaScreen() {
    const router = useRouter();
    const [initial] = React.useState(() => cloudCache.user()?.persona);
    const saved = React.useCallback(() => router.back(), [router]);
    return <PersonaSetup initial={initial} editing onSaved={saved} />;
});
