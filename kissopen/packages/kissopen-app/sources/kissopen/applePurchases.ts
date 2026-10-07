import Purchases from 'react-native-purchases';
import { applicationId } from 'expo-application';
import { appMarket } from '@/appIdentity';
import type { PurchasesStoreProduct } from 'react-native-purchases';
import { client } from './api/client';
import type { AppleCatalog, AppleProduct } from './api/types';
import { consumerSessionVersion } from './sessionEvents';
import { ApplePurchaseError, appleProductForPurchase, applePurchaseFailure } from './applePurchasePolicy';

export type AppleStoreItem = { product: AppleProduct; price: string };
export type AppleStorePage = { catalog: AppleCatalog; items: AppleStoreItem[] };
let configuredKey = '';
let identity = '';
let working = false;

/** One SDK identity at a time. A logout while an Apple sheet is open cannot
 * credit its result to the new account; the webhook still credits the buyer. */
async function exclusive<T>(run: (check: () => void) => Promise<T>): Promise<T> {
    if (working) throw new ApplePurchaseError('pending');
    working = true;
    const version = consumerSessionVersion();
    const check = () => { if (version !== consumerSessionVersion()) throw new ApplePurchaseError('accountChanged'); };
    try { check(); const out = await run(check); check(); return out; }
    finally { working = false; }
}

async function identify(catalog: AppleCatalog, check: () => void) {
    check();
    if (!catalog.enabled || !catalog.public_key || !catalog.app_user_id || catalog.market !== appMarket || catalog.bundle_id !== applicationId) throw new ApplePurchaseError('unavailable');
    if (!configuredKey) {
        Purchases.configure({ apiKey: catalog.public_key, appUserID: catalog.app_user_id, automaticDeviceIdentifierCollectionEnabled: false });
        configuredKey = catalog.public_key;
        identity = catalog.app_user_id;
    } else {
        // Changing RevenueCat projects requires a native restart, never silently
        // purchasing against the SDK's previous project.
        if (configuredKey !== catalog.public_key) throw new ApplePurchaseError('unavailable');
        if (identity !== catalog.app_user_id) {
            await Purchases.logIn(catalog.app_user_id);
            check();
            identity = catalog.app_user_id;
        }
    }
    check();
}

async function storeProducts(catalog: AppleCatalog): Promise<PurchasesStoreProduct[]> {
    const plans = catalog.products.filter(p => p.kind === 'plan').map(p => p.product_id);
    const packs = catalog.products.filter(p => p.kind === 'points').map(p => p.product_id);
    const [subscriptions, consumables] = await Promise.all([
        plans.length ? Purchases.getProducts(plans, Purchases.PRODUCT_CATEGORY.SUBSCRIPTION) : [],
        packs.length ? Purchases.getProducts(packs, Purchases.PRODUCT_CATEGORY.NON_SUBSCRIPTION) : [],
    ]);
    return [...subscriptions, ...consumables];
}

export const applePurchases = {
    page: () => exclusive(async check => {
        const catalog = await client.appleCatalog();
        check();
        if (!catalog.enabled) return { catalog, items: [] } satisfies AppleStorePage;
        await identify(catalog, check);
        const products = await storeProducts(catalog);
        check();
        return { catalog, items: catalog.products.flatMap(product => {
            const store = products.find(p => p.identifier === product.product_id);
            // The configured subscription must actually be monthly. Never
            // label an annual/weekly store product as a monthly web plan.
            if (!store || (product.kind === 'plan' && store.subscriptionPeriod !== 'P1M')) return [];
            return [{ product, price: store.priceString }];
        }) } satisfies AppleStorePage;
    }),
    purchase: (productID: string) => exclusive(async check => {
        // Re-check the payment channel immediately before opening Apple's sheet.
        const catalog = await client.appleCatalog();
        const mapping = appleProductForPurchase(catalog, productID);
        await identify(catalog, check);
        const products = await storeProducts(catalog);
        check();
        const store = products.find(p => p.identifier === productID);
        if (!store || (mapping.kind === 'plan' && store.subscriptionPeriod !== 'P1M')) throw new ApplePurchaseError('unavailable');
        let purchase: Awaited<ReturnType<typeof Purchases.purchaseStoreProduct>>;
        try { purchase = await Purchases.purchaseStoreProduct(store); }
        catch (error) { throw applePurchaseFailure(error); }
        check();
        try {
            const request = { product_id: productID, transaction_id: purchase.transaction.transactionIdentifier };
            let out = await client.appleSync(request);
            // Consumable delivery is confirmed by the authenticated webhook,
            // not the SDK response. Give a notice that trails the sheet a short
            // chance to arrive; never re-purchase while waiting.
            if (mapping.kind === 'points') {
                for (const delay of [1500, 3000]) {
                    if (!out.pending) break;
                    await new Promise(resolve => setTimeout(resolve, delay));
                    check();
                    out = await client.appleSync(request);
                }
            }
            check();
            return out;
        } catch (error) {
            if (error instanceof ApplePurchaseError) throw error;
            // Store payment succeeded: don't present an ordinary "buy failed"
            // message that encourages a second charge.
            throw new ApplePurchaseError('confirmationPending');
        }
    }),
    restore: () => exclusive(async check => {
        await identify(await client.appleCatalog(), check);
        try { await Purchases.restorePurchases(); }
        catch (error) { throw applePurchaseFailure(error); }
        check();
        const out = await client.appleSync();
        check();
        return out;
    }),
    refresh: () => exclusive(async check => {
        // No automatic restore/syncPurchases here: foregrounding must not open
        // an Apple sign-in sheet or transfer another account's receipt.
        const out = await client.appleSync();
        check();
        return out;
    }),
    manage: () => exclusive(async check => {
        await identify(await client.appleCatalog(), check);
        await Purchases.showManageSubscriptions();
        check();
    }),
};
