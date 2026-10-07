import * as React from 'react';
import { AppState } from 'react-native';
import { useRouter } from 'expo-router';
import { Item } from '@/components/Item';
import { ItemGroup } from '@/components/ItemGroup';
import { t } from '@/text';
import { applePurchases, type AppleStorePage, type AppleStoreItem } from './applePurchases';
import { ApplePurchaseError } from './applePurchasePolicy';
import { onConsumerSessionEnded } from './sessionEvents';
import { openExternalUrl } from '@/utils/openExternalUrl';
import type { Billing } from './api/types';

/** StoreKit-only payment surface on iPhone. No link or fallback to web checkout. */
export function AppleBilling({ billing, onBilling }: { billing: Billing; onBilling: (billing: Billing) => void }) {
    const router = useRouter();
    const [page, setPage] = React.useState<AppleStorePage>();
    const [busy, setBusy] = React.useState(false);
    const [notice, setNotice] = React.useState('');
    const alive = React.useRef(false);
    const locked = React.useRef(false);
    const report = (error: unknown) => {
        if (error instanceof ApplePurchaseError && (error.code === 'cancelled' || error.code === 'accountChanged')) return;
        const code = error instanceof ApplePurchaseError ? error.code : 'failed';
        setNotice(t(code === 'unavailable' ? 'kissopen.appleBilling.unavailable'
            : code === 'otherSubscription' ? 'kissopen.appleBilling.otherSubscription'
            : code === 'pending' || code === 'confirmationPending' ? 'kissopen.appleBilling.pending'
            : 'kissopen.appleBilling.failed'));
    };
    const load = async () => {
        if (locked.current || !alive.current) return;
        locked.current = true;
        setBusy(true);
        try {
            const next = await applePurchases.page();
            if (!alive.current) return;
            setPage(next);
            if (next.catalog.enabled) {
                const out = await applePurchases.refresh();
                if (!alive.current) return;
                onBilling(out.billing);
                setPage({ ...next, catalog: { ...next.catalog, subscription: out.subscription, can_subscribe: out.can_subscribe } });
            }
        } catch (error) { if (alive.current) report(error); }
        finally { locked.current = false; if (alive.current) setBusy(false); }
    };
    React.useEffect(() => {
        alive.current = true;
        void load();
        const ended = onConsumerSessionEnded(() => { alive.current = false; setPage(undefined); setNotice(''); });
        const subscription = AppState.addEventListener('change', state => { if (state === 'active') void load(); });
        const interval = setInterval(() => { if (AppState.currentState === 'active') void load(); }, 120000);
        return () => { alive.current = false; ended(); subscription.remove(); clearInterval(interval); };
    }, []);

    const act = async (kind: 'buy' | 'restore' | 'manage', item?: AppleStoreItem) => {
        if (locked.current || !page?.catalog.enabled) return;
        locked.current = true;
        setBusy(true);
        setNotice('');
        try {
            if (kind === 'manage') { await applePurchases.manage(); return; }
            const out = kind === 'restore' ? await applePurchases.restore() : await applePurchases.purchase(item!.product.product_id);
            if (!alive.current) return;
            onBilling(out.billing);
            setPage(current => current ? { ...current, catalog: { ...current.catalog, subscription: out.subscription, can_subscribe: out.can_subscribe } } : current);
            setNotice(t(out.pending ? 'kissopen.appleBilling.pending' : kind === 'restore' ? 'kissopen.appleBilling.restored' : 'kissopen.appleBilling.confirmed'));
        } catch (error) { if (alive.current) report(error); }
        finally { locked.current = false; if (alive.current) setBusy(false); }
    };
    const enabled = page?.catalog.enabled;
    const subscription = page?.catalog.subscription;
    const plans = page?.items.filter(item => item.product.kind === 'plan') ?? [];
    const packs = page?.items.filter(item => item.product.kind === 'points') ?? [];
    return <>
        {!!notice && <ItemGroup><Item title={notice} subtitleLines={0} /></ItemGroup>}
        {subscription && <ItemGroup title={t('kissopen.appleBilling.subscription')}>
            <Item title={t(subscription.will_renew ? 'kissopen.appleBilling.renewsAt' : 'kissopen.appleBilling.endsAt')} detail={new Date(subscription.expires_at).toLocaleDateString()} />
        </ItemGroup>}
        <ItemGroup title={t('kissopen.home.otherPlans')} footer={t('kissopen.appleBilling.subscriptionRules')}>
            {!page && <Item title={busy ? t('common.loading') : t('kissopen.appleBilling.failed')} loading={busy} onPress={() => void load()} />}
            {page && !enabled && <Item title={t('kissopen.appleBilling.unavailable')} subtitleLines={0} onPress={() => void load()} />}
            {enabled && !page.catalog.can_subscribe && <Item title={t('kissopen.appleBilling.otherSubscription')} subtitleLines={0} />}
            {enabled && !plans.length && <Item title={t('kissopen.appleBilling.productsUnavailable')} onPress={() => void load()} />}
            {plans.map(item => {
                const included = billing.points.plans.find(plan => plan.id === item.product.item_id);
                const description = [
                    t('kissopen.appleBilling.monthly', { price: item.price }),
                    included && included.week > 0 ? t('kissopen.home.planWeekPoints', { count: included.week }) : '',
                    included && included.five_hour > 0 ? t('kissopen.appleBilling.fiveHourPoints', { count: included.five_hour }) : '',
                    included && included.month > 0 ? t('kissopen.appleBilling.monthPoints', { count: included.month }) : '',
                ].filter(Boolean).join('\n');
                return <Item key={item.product.product_id} title={item.product.name}
                subtitle={description} subtitleLines={0}
                detail={subscription?.product_id === item.product.product_id ? t('kissopen.appleBilling.current') : t('kissopen.appleBilling.select')}
                disabled={busy || !page?.catalog.can_subscribe || subscription?.product_id === item.product.product_id}
                onPress={() => void act('buy', item)} />;
            })}
        </ItemGroup>
        <ItemGroup title={t('kissopen.home.pointsTitle')} footer={t('kissopen.appleBilling.pointsRules')}>
            <Item title={t('kissopen.home.pointsBalance')} detail={t('kissopen.home.pointsCount', { count: billing.points.balance })} />
            {packs.map(item => <Item key={item.product.product_id} title={item.product.name}
                subtitle={t('kissopen.home.pointsCount', { count: item.product.points })} detail={item.price}
                disabled={busy} onPress={() => void act('buy', item)} />)}
        </ItemGroup>
        <ItemGroup>
            <Item title={t('kissopen.appleBilling.restore')} disabled={busy || !enabled} onPress={() => void act('restore')} />
            <Item title={t('kissopen.appleBilling.manage')} disabled={busy || !enabled} onPress={() => void act('manage')} />
            <Item title={t('kissopen.appleBilling.terms')} onPress={() => void openExternalUrl('https://www.apple.com/legal/internet-services/itunes/dev/stdeula/')} />
            <Item title={t('settings.privacyPolicy')} onPress={() => router.push('/settings/about/privacy')} />
        </ItemGroup>
        {!!page?.catalog.purchases.length && <ItemGroup title={t('kissopen.appleBilling.recentPurchases')} footer={t('kissopen.appleBilling.receiptHint')}>
            {page.catalog.purchases.map(purchase => <Item key={purchase.id} title={purchase.name}
                subtitle={`${new Date(purchase.purchased_at).toLocaleString()} · ${t(purchase.status === 'refunded' ? 'kissopen.appleBilling.refunded' : 'kissopen.appleBilling.paid')}`}
                detail={purchase.currency && purchase.price ? `${purchase.currency} ${purchase.price}` : undefined} />)}
        </ItemGroup>}
    </>;
}
