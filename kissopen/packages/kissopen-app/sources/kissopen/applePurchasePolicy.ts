import type { AppleCatalog, AppleProduct } from './api/types';

export type ApplePurchaseErrorCode = 'unavailable' | 'cancelled' | 'pending' | 'accountChanged' | 'otherSubscription' | 'failed' | 'confirmationPending';
export class ApplePurchaseError extends Error {
    constructor(public readonly code: ApplePurchaseErrorCode) { super(code); }
}

/** A product is chosen from the current server catalog, not an arbitrary SKU. */
export function appleProductForPurchase(catalog: AppleCatalog, productID: string): AppleProduct {
    if (!catalog.enabled || !catalog.public_key || !catalog.app_user_id) throw new ApplePurchaseError('unavailable');
    const product = catalog.products.find(p => p.product_id === productID);
    if (!product) throw new ApplePurchaseError('unavailable');
    if (product.kind === 'plan' && !catalog.can_subscribe) throw new ApplePurchaseError('otherSubscription');
    if (product.kind !== 'plan' && product.kind !== 'points') throw new ApplePurchaseError('unavailable');
    return product;
}

export function applePurchaseFailure(error: unknown): ApplePurchaseError {
    if (error instanceof ApplePurchaseError) return error;
    if (error && typeof error === 'object') {
        const failure = error as { userCancelled?: boolean; code?: string | number };
        if (failure.userCancelled || String(failure.code) === '1') return new ApplePurchaseError('cancelled');
        // RevenueCat PAYMENT_PENDING_ERROR: Ask to Buy / deferred payment.
        if (String(failure.code) === '20') return new ApplePurchaseError('pending');
    }
    return new ApplePurchaseError('failed');
}
