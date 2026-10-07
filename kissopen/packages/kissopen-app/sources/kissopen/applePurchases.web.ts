import type { AppleCatalog, AppleProduct, AppleSyncResult } from './api/types';
import { ApplePurchaseError } from './applePurchasePolicy';
export type AppleStoreItem = { product: AppleProduct; price: string };
export type AppleStorePage = { catalog: AppleCatalog; items: AppleStoreItem[] };
const unavailable = async (): Promise<never> => { throw new ApplePurchaseError('unavailable'); };
// Keep the native purchase SDK out of the web bundle. Web checkout is unchanged.
export const applePurchases: {
    page: () => Promise<AppleStorePage>;
    purchase: (id: string) => Promise<AppleSyncResult>;
    restore: () => Promise<AppleSyncResult>;
    refresh: () => Promise<AppleSyncResult>;
    manage: () => Promise<void>;
} = { page: unavailable, purchase: unavailable, restore: unavailable, refresh: unavailable, manage: unavailable };
