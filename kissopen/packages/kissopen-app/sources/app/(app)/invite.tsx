import * as React from 'react';
import { Redirect } from 'expo-router';

export default React.memo(function InviteRoute() {
    return <Redirect href="/settings" />;
});
