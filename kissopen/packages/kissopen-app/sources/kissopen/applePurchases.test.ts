import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppleCatalog, AppleSyncResult } from './api/types';

const mock = vi.hoisted(() => ({
    version: 0,
    sdk: { configure: vi.fn(), logIn: vi.fn(), getProducts: vi.fn(), purchaseStoreProduct: vi.fn(), restorePurchases: vi.fn(), showManageSubscriptions: vi.fn(), PRODUCT_CATEGORY: { SUBSCRIPTION: 'subscription', NON_SUBSCRIPTION: 'non_subscription' } },
    api: { appleCatalog: vi.fn(), appleSync: vi.fn() },
}));
vi.mock('react-native-purchases', () => ({ default: mock.sdk }));
vi.mock('expo-application', () => ({ applicationId: 'com.worpar.app' }));
vi.mock('@/appIdentity', () => ({ appMarket: 'global' }));
vi.mock('./api/client', () => ({ client: mock.api }));
vi.mock('./sessionEvents', () => ({ consumerSessionVersion: () => mock.version }));

const catalog: AppleCatalog = {
    market: 'global', bundle_id: 'com.worpar.app',
    enabled: true, public_key: 'appl_public', app_user_id: 'consumer_1', can_subscribe: true, subscription: null, purchases: [],
    products: [
        { product_id: 'plus.monthly', kind: 'plan', item_id: 'plus', name: 'Plus', points: 0 },
        { product_id: 'points.1000', kind: 'points', item_id: 'points1000', name: '1000 points', points: 1000 },
    ],
};
const confirmed = { pending: false, subscription: null, billing: { plan: { id: 'plus' }, points: { balance: 1000 } } } as AppleSyncResult;

beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mock.version = 0;
    mock.api.appleCatalog.mockResolvedValue(structuredClone(catalog));
    mock.api.appleSync.mockResolvedValue(confirmed);
    mock.sdk.logIn.mockResolvedValue({});
    mock.sdk.restorePurchases.mockResolvedValue({});
    mock.sdk.showManageSubscriptions.mockResolvedValue(undefined);
    mock.sdk.getProducts.mockImplementation(async (ids: string[]) => ids.map(id => ({ identifier: id, priceString: id === 'plus.monthly' ? '$9.99' : '€4.99', subscriptionPeriod: id === 'plus.monthly' ? 'P1M' : null })));
    mock.sdk.purchaseStoreProduct.mockResolvedValue({ transaction: { transactionIdentifier: 'apple_tx_1' }, customerInfo: { untrusted: true } });
});

describe('Apple consumer purchases', () => {
    it.each([
        { market: 'cn', bundle_id: 'com.yiqijuan.app' },
        { market: 'global', bundle_id: 'com.kissopen.app' },
        { market: 'global', bundle_id: 'com.worpar.app.preview' },
    ])('rejects a catalog that does not belong to the running native app: %j', async mismatched => {
        mock.api.appleCatalog.mockResolvedValue({ ...catalog, ...mismatched });
        const { applePurchases } = await import('./applePurchases');
        await expect(applePurchases.page()).rejects.toMatchObject({ code: 'unavailable' });
        await expect(applePurchases.purchase('points.1000')).rejects.toMatchObject({ code: 'unavailable' });
        expect(mock.sdk.configure).not.toHaveBeenCalled();
        expect(mock.sdk.purchaseStoreProduct).not.toHaveBeenCalled();
    });
    it('uses account identity and StoreKit prices, with correct product categories', async () => {
        const { applePurchases } = await import('./applePurchases');
        const page = await applePurchases.page();
        expect(mock.sdk.configure).toHaveBeenCalledWith(expect.objectContaining({ appUserID: 'consumer_1', apiKey: 'appl_public' }));
        expect(page.items.map(item => item.price)).toEqual(['$9.99', '€4.99']);
        expect(mock.sdk.getProducts).toHaveBeenCalledWith(['points.1000'], 'non_subscription');
    });
    it('does not configure or expose purchases when the server is not ready', async () => {
        mock.api.appleCatalog.mockResolvedValue({ ...catalog, enabled: false, public_key: '', app_user_id: '', products: [] });
        const { applePurchases } = await import('./applePurchases');
        expect((await applePurchases.page()).items).toEqual([]);
        expect(mock.sdk.configure).not.toHaveBeenCalled();
        await expect(applePurchases.purchase('plus.monthly')).rejects.toMatchObject({ code: 'unavailable' });
    });
    it('returns server-confirmed billing instead of trusting SDK entitlements', async () => {
        const { applePurchases } = await import('./applePurchases');
        expect(await applePurchases.purchase('plus.monthly')).toBe(confirmed);
        expect(mock.api.appleSync).toHaveBeenCalledWith({ product_id: 'plus.monthly', transaction_id: 'apple_tx_1' });
    });
    it('blocks a second subscription from a different channel but permits point packs', async () => {
        mock.api.appleCatalog.mockResolvedValue({ ...catalog, can_subscribe: false });
        const { applePurchases } = await import('./applePurchases');
        await expect(applePurchases.purchase('plus.monthly')).rejects.toMatchObject({ code: 'otherSubscription' });
        expect(mock.sdk.purchaseStoreProduct).not.toHaveBeenCalled();
        await applePurchases.purchase('points.1000');
        expect(mock.sdk.purchaseStoreProduct).toHaveBeenCalledTimes(1);
    });
    it('rejects unknown SKUs without opening a payment sheet', async () => {
        const { applePurchases } = await import('./applePurchases');
        await expect(applePurchases.purchase('attacker.sku')).rejects.toMatchObject({ code: 'unavailable' });
        expect(mock.sdk.purchaseStoreProduct).not.toHaveBeenCalled();
    });
    it('does not sell an annual subscription labeled as a monthly plan', async () => {
        mock.sdk.getProducts.mockResolvedValue([{ identifier: 'plus.monthly', priceString: '$99', subscriptionPeriod: 'P1Y' }]);
        const { applePurchases } = await import('./applePurchases');
        expect((await applePurchases.page()).items).toEqual([]);
        await expect(applePurchases.purchase('plus.monthly')).rejects.toMatchObject({ code: 'unavailable' });
        expect(mock.sdk.purchaseStoreProduct).not.toHaveBeenCalled();
    });
    it('cancellation does not confirm or retry the purchase', async () => {
        mock.sdk.purchaseStoreProduct.mockRejectedValue({ userCancelled: true });
        const { applePurchases } = await import('./applePurchases');
        await expect(applePurchases.purchase('plus.monthly')).rejects.toMatchObject({ code: 'cancelled' });
        expect(mock.api.appleSync).not.toHaveBeenCalled();
    });
    it('deferred approval is pending, not an ordinary purchase failure', async () => {
        mock.sdk.purchaseStoreProduct.mockRejectedValue({ code: '20', message: 'raw store/provider error' });
        const { applePurchases } = await import('./applePurchases');
        await expect(applePurchases.purchase('plus.monthly')).rejects.toMatchObject({ code: 'pending' });
        expect(mock.api.appleSync).not.toHaveBeenCalled();
    });
    it('a post-payment network error tells the UI not to pay again', async () => {
        mock.api.appleSync.mockRejectedValue(new Error('timeout'));
        const { applePurchases } = await import('./applePurchases');
        await expect(applePurchases.purchase('plus.monthly')).rejects.toMatchObject({ code: 'confirmationPending' });
        expect(mock.sdk.purchaseStoreProduct).toHaveBeenCalledTimes(1);
    });
    it('waits for consumable delivery without making another payment', async () => {
        const { applePurchases } = await import('./applePurchases');
        vi.useFakeTimers();
        try {
            mock.api.appleSync.mockResolvedValueOnce({ ...confirmed, pending: true }).mockResolvedValueOnce({ ...confirmed, pending: true }).mockResolvedValueOnce(confirmed);
            const result = applePurchases.purchase('points.1000');
            await vi.runAllTimersAsync();
            expect(await result).toBe(confirmed);
            expect(mock.api.appleSync).toHaveBeenCalledTimes(3);
            expect(mock.sdk.purchaseStoreProduct).toHaveBeenCalledTimes(1);
        } finally { vi.useRealTimers(); }
    });
    it('a logout while the store sheet is open cannot confirm against the new account', async () => {
        mock.sdk.purchaseStoreProduct.mockImplementation(async () => { mock.version++; return { transaction: { transactionIdentifier: 'old_tx' } }; });
        const { applePurchases } = await import('./applePurchases');
        await expect(applePurchases.purchase('plus.monthly')).rejects.toMatchObject({ code: 'accountChanged' });
        expect(mock.api.appleSync).not.toHaveBeenCalled();
    });
    it('a changed consumer logs into its own identity, never an anonymous buyer', async () => {
        const { applePurchases } = await import('./applePurchases');
        await applePurchases.page();
        mock.version++;
        mock.api.appleCatalog.mockResolvedValue({ ...catalog, app_user_id: 'consumer_2' });
        await applePurchases.page();
        expect(mock.sdk.configure).toHaveBeenCalledTimes(1);
        expect(mock.sdk.logIn).toHaveBeenCalledWith('consumer_2');
    });
    it('automatic refresh does not restore the device receipt or open Apple sign-in', async () => {
        const { applePurchases } = await import('./applePurchases');
        await applePurchases.refresh();
        expect(mock.sdk.restorePurchases).not.toHaveBeenCalled();
        expect(mock.sdk.configure).not.toHaveBeenCalled();
    });
    it('explicit restore verifies results through the backend', async () => {
        const { applePurchases } = await import('./applePurchases');
        expect(await applePurchases.restore()).toBe(confirmed);
        expect(mock.sdk.restorePurchases).toHaveBeenCalledTimes(1);
        expect(mock.api.appleSync).toHaveBeenCalledWith();
    });
    it('opens native subscription management', async () => {
        const { applePurchases } = await import('./applePurchases');
        await applePurchases.manage();
        expect(mock.sdk.showManageSubscriptions).toHaveBeenCalledTimes(1);
    });
});
