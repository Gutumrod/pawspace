import assert from 'node:assert';
import test from 'node:test';
import { resolveEffectiveEntitlement, CANONICAL_PACKAGES } from '../lib/entitlements';

test('Phase 9 Entitlements: Canonical Starter package exact prices and limits', () => {
    const starter = CANONICAL_PACKAGES.starter;
    assert.strictEqual(starter.monthlyPrice, 990);
    assert.strictEqual(starter.annualPrice, 9900);
    assert.strictEqual(starter.roomLimit, 10);
    assert.strictEqual(starter.petHistoryLimit, 300);
    assert.strictEqual(starter.supportTier, null);
});

test('Phase 9 Entitlements: Canonical Pro package exact prices and limits', () => {
    const pro = CANONICAL_PACKAGES.pro;
    assert.strictEqual(pro.monthlyPrice, 1490);
    assert.strictEqual(pro.annualPrice, 14900);
    assert.strictEqual(pro.roomLimit, null);
    assert.strictEqual(pro.petHistoryLimit, null);
    assert.strictEqual(pro.supportTier, null);
});

test('Phase 9 Entitlements: Canonical Enterprise package exact facts', () => {
    const enterprise = CANONICAL_PACKAGES.enterprise;
    assert.strictEqual(enterprise.monthlyPrice, 2490);
    assert.strictEqual(enterprise.annualPrice, 24900);
    assert.strictEqual(enterprise.supportTier, 'priority');
});
test('Phase 9 Entitlements: Founding Member C2 is Pro entitlement at 990 monthly without invented annual pricing', () => {
    const effective = resolveEffectiveEntitlement({
        packageId: 'starter',
        commercialOffer: 'founding_member',
    });

    assert.strictEqual(effective.packageId, 'starter');
    assert.strictEqual(effective.packageName, 'Starter (Founding Member Pro)');
    assert.strictEqual(effective.commercialOffer, 'founding_member');
    assert.strictEqual(effective.monthlyPrice, 990);
    assert.strictEqual(effective.annualPrice, null);
    assert.strictEqual(effective.roomLimit, null);
    assert.strictEqual(effective.petHistoryLimit, null);
    assert.strictEqual(effective.supportTier, null);
    assert.strictEqual(effective.futurePaidAddOnsIncluded, false);
});

test('Phase 9 Entitlements: Unknown or missing assignment fails closed to Starter', () => {
    const missing = resolveEffectiveEntitlement(null);
    const unknown = resolveEffectiveEntitlement({
        packageId: 'unknown_package_xyz',
        commercialOffer: 'standard',
    });
    assert.strictEqual(missing.packageId, 'starter');
    assert.strictEqual(missing.roomLimit, 10);
    assert.strictEqual(unknown.packageId, 'starter');
    assert.strictEqual(unknown.roomLimit, 10);
    assert.strictEqual(unknown.futurePaidAddOnsIncluded, false);
});
