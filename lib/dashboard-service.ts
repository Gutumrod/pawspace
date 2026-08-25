import "server-only";

import { type EffectiveEntitlement } from "@/lib/entitlements";
import { requireManagerOrOwnerContext } from "@/lib/tenant-context";

export interface DashboardSummaryDTO {
  shop: { id: string; name: string; slug: string };
  staff: { id: string; name: string; role: "owner" | "manager" };
  rooms: {
    total: number;
    available: number;
    occupied: number;
    cleaning: number;
    maintenance: number;
  };
  bookings: {
    active: number;
    todayCheckIns: number;
    todayCheckOuts: number;
  };
  dailyReports: {
    totalReportsToday: number;
    deliveredCount: number;
    failedCount: number;
  };
  integrations: {
    lineLinked: boolean;
    googleSheetsEnabled: boolean;
    cameraEnabled: boolean;
  };
  entitlement: EffectiveEntitlement;
  commercialStatus: {
    lifecycleStatus: "trialing" | "active" | "past_due" | "grace_period" | "suspended" | "cancel_at_period_end" | "cancelled" | "expired";
    commercialAccess: boolean;
    trialEndsAt: string | null;
    currentPeriodEnd: string | null;
    gracePeriodEnd: string | null;
    blockedReason: string | null;
    roomUsage: number;
    petUsage: number;
    foundingMemberContinuityValid: boolean;
  };
}

type JsonRecord = Record<string, unknown>;
function asRecord(value: unknown, label: string): JsonRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`Invalid dashboard payload: ${label}`);
  }
  return value as JsonRecord;
}

function asString(value: unknown, label: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`Invalid dashboard payload: ${label}`);
  }
  return value;
}

function asNumber(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`Invalid dashboard payload: ${label}`);
  }
  return value;
}

function asBoolean(value: unknown, label: string): boolean {
  if (typeof value !== "boolean") {
    throw new Error(`Invalid dashboard payload: ${label}`);
  }
  return value;
}

function asNullableNumber(value: unknown, label: string): number | null {
  return value === null ? null : asNumber(value, label);
}

function asNullableString(value: unknown, label: string): string | null {
  return value === null ? null : asString(value, label);
}

const LIFECYCLE_STATUSES = new Set<DashboardSummaryDTO["commercialStatus"]["lifecycleStatus"]>([
  "trialing", "active", "past_due", "grace_period", "suspended",
  "cancel_at_period_end", "cancelled", "expired",
]);

function asLifecycleStatus(
  value: unknown,
  label: string,
): DashboardSummaryDTO["commercialStatus"]["lifecycleStatus"] {
  const status = asString(value, label);
  if (!LIFECYCLE_STATUSES.has(status as DashboardSummaryDTO["commercialStatus"]["lifecycleStatus"])) {
    throw new Error(`Invalid dashboard payload: ${label}`);
  }
  return status as DashboardSummaryDTO["commercialStatus"]["lifecycleStatus"];
}
export async function getDashboardSummary(): Promise<DashboardSummaryDTO> {
  const { client: supabase, staff: tenantStaff } = await requireManagerOrOwnerContext();
  const [dashboardResult, commercialResult] = await Promise.all([
    supabase.rpc("get_owner_manager_dashboard_summary"),
    supabase.rpc("get_shop_commercial_status", { p_shop_id: tenantStaff.shopId }),
  ]);

  if (dashboardResult.error || !dashboardResult.data) {
    throw new Error(
      `Failed to load dashboard summary: ${dashboardResult.error?.message || "Empty dashboard response"}`,
    );
  }
  if (commercialResult.error || !commercialResult.data) {
    throw new Error(
      `Failed to load commercial status: ${commercialResult.error?.message || "Empty commercial response"}`,
    );
  }

  const root = asRecord(dashboardResult.data, "root");
  const commercialStatus = asRecord(commercialResult.data, "commercialStatus");
  const shop = asRecord(root.shop, "shop");
  const staffPayload = asRecord(root.staff, "staff");
  const rooms = asRecord(root.rooms, "rooms");
  const bookings = asRecord(root.bookings, "bookings");
  const dailyReports = asRecord(root.dailyReports, "dailyReports");
  const integrations = asRecord(root.integrations, "integrations");
  const entitlement = asRecord(root.entitlement, "entitlement");

  const staffRole = asString(staffPayload.role, "staff.role");
  if (staffRole !== "owner" && staffRole !== "manager") {
    throw new Error("Invalid dashboard payload: unauthorized staff role");
  }

  const commercialOffer = asString(entitlement.commercial_offer, "entitlement.commercial_offer");
  if (commercialOffer !== "standard" && commercialOffer !== "founding_member") {
    throw new Error("Invalid dashboard payload: commercial offer");
  }

  const futurePaidAddOnsIncluded = asBoolean(
    entitlement.future_paid_addons_included,
    "entitlement.future_paid_addons_included",
  );
  if (futurePaidAddOnsIncluded) {
    throw new Error("Invalid dashboard payload: future paid add-ons must not be included");
  }
  return {
    shop: {
      id: asString(shop.id, "shop.id"),
      name: asString(shop.name, "shop.name"),
      slug: asString(shop.slug, "shop.slug"),
    },
    staff: {
      id: asString(staffPayload.id, "staff.id"),
      name: asString(staffPayload.name, "staff.name"),
      role: staffRole,
    },
    rooms: {
      total: asNumber(rooms.total, "rooms.total"),
      available: asNumber(rooms.available, "rooms.available"),
      occupied: asNumber(rooms.occupied, "rooms.occupied"),
      cleaning: asNumber(rooms.cleaning, "rooms.cleaning"),
      maintenance: asNumber(rooms.maintenance, "rooms.maintenance"),
    },
    bookings: {
      active: asNumber(bookings.active, "bookings.active"),
      todayCheckIns: asNumber(bookings.todayCheckIns, "bookings.todayCheckIns"),
      todayCheckOuts: asNumber(bookings.todayCheckOuts, "bookings.todayCheckOuts"),
    },
    dailyReports: {
      totalReportsToday: asNumber(dailyReports.totalReportsToday, "dailyReports.totalReportsToday"),
      deliveredCount: asNumber(dailyReports.deliveredCount, "dailyReports.deliveredCount"),
      failedCount: asNumber(dailyReports.failedCount, "dailyReports.failedCount"),
    },
    integrations: {
      lineLinked: asBoolean(integrations.lineLinked, "integrations.lineLinked"),
      googleSheetsEnabled: asBoolean(
        integrations.googleSheetsEnabled,
        "integrations.googleSheetsEnabled",
      ),
      cameraEnabled: asBoolean(integrations.cameraEnabled, "integrations.cameraEnabled"),
    },
    commercialStatus: {
      lifecycleStatus: asLifecycleStatus(commercialStatus.lifecycle_status, "commercialStatus.lifecycle_status"),
      commercialAccess: asBoolean(commercialStatus.commercial_access, "commercialStatus.commercial_access"),
      trialEndsAt: asNullableString(commercialStatus.trial_ends_at, "commercialStatus.trial_ends_at"),
      currentPeriodEnd: asNullableString(commercialStatus.current_period_end, "commercialStatus.current_period_end"),
      gracePeriodEnd: asNullableString(commercialStatus.grace_period_end, "commercialStatus.grace_period_end"),
      blockedReason: asNullableString(commercialStatus.blocked_reason, "commercialStatus.blocked_reason"),
      roomUsage: asNumber(commercialStatus.current_room_usage, "commercialStatus.current_room_usage"),
      petUsage: asNumber(commercialStatus.current_pet_usage, "commercialStatus.current_pet_usage"),
      foundingMemberContinuityValid: asBoolean(commercialStatus.founding_member_continuity_valid, "commercialStatus.founding_member_continuity_valid"),
    },
    entitlement: {
      packageId: asString(entitlement.package_id, "entitlement.package_id"),
      packageName: asString(entitlement.package_name, "entitlement.package_name"),
      commercialOffer,
      monthlyPrice: asNumber(entitlement.monthly_price, "entitlement.monthly_price"),
      annualPrice: asNullableNumber(entitlement.annual_price, "entitlement.annual_price"),
      roomLimit: asNullableNumber(entitlement.room_limit, "entitlement.room_limit"),
      petHistoryLimit: asNullableNumber(
        entitlement.pet_history_limit,
        "entitlement.pet_history_limit",
      ),
      supportTier: asNullableString(entitlement.support_tier, "entitlement.support_tier"),
      futurePaidAddOnsIncluded: false,
    },
  };
}
