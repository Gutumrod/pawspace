// Pure entitlement domain logic for PawSpace Phase 9.
// Billing execution and hard quota enforcement are intentionally outside this phase.

export interface PackageDefinition {
  id: string;
  name: string;
  monthlyPrice: number;
  annualPrice: number | null;
  roomLimit: number | null;
  petHistoryLimit: number | null;
  supportTier: string | null;
}

export const CANONICAL_PACKAGES: Record<string, PackageDefinition> = {
  starter: {
    id: "starter",
    name: "Starter",
    monthlyPrice: 990,
    annualPrice: 9900,
    roomLimit: 10,
    petHistoryLimit: 300,
    supportTier: null,
  },
  pro: {
    id: "pro",
    name: "Pro",
    monthlyPrice: 1490,
    annualPrice: 14900,
    roomLimit: null,
    petHistoryLimit: null,
    supportTier: null,
  },
  enterprise: {
    id: "enterprise",
    name: "Enterprise",
    monthlyPrice: 2490,
    annualPrice: 24900,
    roomLimit: null,
    petHistoryLimit: null,
    supportTier: "priority",
  },
};

export interface ShopCommercialState {
  packageId: string;
  commercialOffer: "standard" | "founding_member";
}

export interface EffectiveEntitlement {
  packageId: string;
  packageName: string;
  commercialOffer: "standard" | "founding_member";
  monthlyPrice: number;
  annualPrice: number | null;
  roomLimit: number | null;
  petHistoryLimit: number | null;
  supportTier: string | null;
  futurePaidAddOnsIncluded: false;
}

export function resolveEffectiveEntitlement(
  state?: ShopCommercialState | null,
): EffectiveEntitlement {
  const packageId =
    state?.packageId && CANONICAL_PACKAGES[state.packageId]
      ? state.packageId
      : "starter";
  const offer =
    state?.commercialOffer === "founding_member" ? "founding_member" : "standard";

  const basePackage = CANONICAL_PACKAGES[packageId];

  if (offer === "founding_member" && packageId === "starter") {
    const proPackage = CANONICAL_PACKAGES.pro;
    return {
      packageId: "starter",
      packageName: "Starter (Founding Member Pro)",
      commercialOffer: "founding_member",
      monthlyPrice: 990,
      annualPrice: null,
      roomLimit: proPackage.roomLimit,
      petHistoryLimit: proPackage.petHistoryLimit,
      supportTier: null,
      futurePaidAddOnsIncluded: false,
    };
  }

  return {
    packageId: basePackage.id,
    packageName: basePackage.name,
    commercialOffer: offer,
    monthlyPrice: basePackage.monthlyPrice,
    annualPrice: basePackage.annualPrice,
    roomLimit: basePackage.roomLimit,
    petHistoryLimit: basePackage.petHistoryLimit,
    supportTier: basePackage.supportTier,
    futurePaidAddOnsIncluded: false,
  };
}
