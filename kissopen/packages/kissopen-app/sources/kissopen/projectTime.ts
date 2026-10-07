import { t } from '@/text';

/** Shared list metadata, independent of any dashboard. */
export type ProjectListItem = {
    id: string;
    name: string;
    place: string;
    updatedAt: number;
};

export function sinceOf(at: number, now: number): string {
    const minutes = Math.max(1, Math.round((now - at) / 60_000));
    if (minutes < 60) return t('kissopen.homePage.minutesAgo', { count: minutes });
    const hours = Math.round(minutes / 60);
    if (hours < 24) return t('kissopen.homePage.hoursAgo', { count: hours });
    return t('kissopen.homePage.daysAgo', { count: Math.round(hours / 24) });
}
