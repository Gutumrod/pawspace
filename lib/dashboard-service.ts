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
export async function getDashboardSummary(): Promise<DashboardSummaryDTO> {
  const { client: supabase } = await requireManagerOrOwnerContext();
  const { data, error } = await supabase.rpc("get_owner_manager_dashboard_summary");

  if (error || !data) {
    throw new Error(
      `Failed to load dashboard summary: ${error?.message || "Empty dashboard response"}`,
    );
  }

  const root = asRecord(data, "root");
  const shop = asRecord(root.shop, "shop");
  const staff = asRecord(root.staff, "staff");
  const rooms = asRecord(root.rooms, "rooms");
  const bookings = asRecord(root.bookings, "bookings");
  const dailyReports = asRecord(root.dailyReports, "dailyReports");
  const integrations = asRecord(root.integrations, "integrations");
  const entitlement = asRecord(root.entitlement, "entitlement");

  const staffRole = asString(staff.role, "staff.role");
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
      id: asString(staff.id, "staff.id"),
      name: asString(staff.name, "staff.name"),
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
