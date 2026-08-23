import type { SupabaseClient } from "@supabase/supabase-js";
import { getLineChannelAccessTokenForShop } from "@/lib/env";

export interface PilotReadinessItem {
  id: string;
  category: "core" | "operations" | "integration";
  title: string;
  description: string;
  isReady: boolean;
  isCritical: boolean;
  currentValue: string | number | boolean | null;
  remediation?: string;
}

export interface PilotReadinessEvaluation {
  shopId: string;
  shopName: string;
  shopSlug: string;
  isPilotReady: boolean;
  readinessPercentage: number;
  criticalPassed: number;
  criticalTotal: number;
  items: PilotReadinessItem[];
  blockingIssues: string[];
  recommendations: string[];
  evaluatedAt: string;
}

export async function evaluatePilotReadiness(
  client: SupabaseClient,
): Promise<PilotReadinessEvaluation> {
  const { data: staffCtx, error: ctxErr } = await client.rpc("get_current_staff_context");
  if (ctxErr || !staffCtx || !staffCtx.shop_id) {
    throw new Error(`Unable to resolve authenticated staff tenant context: ${ctxErr?.message || "empty"}`);
  }

  const callerShopId = staffCtx.shop_id as string;
  const callerShopName = staffCtx.shop_name as string;
  const callerShopSlug = staffCtx.shop_slug as string;

  // Query tenant resources
  const [
    shopResult,
    ownersResult,
    roomsResult,
    customersResult,
    petsResult,
    bookingsResult,
  ] = await Promise.all([
    client
      .from("shops")
      .select("id,name,slug,phone,line_oa_id,google_sheet_id,subscription_status")
      .eq("id", callerShopId)
      .single(),
    client
      .from("staff_users")
      .select("id,role,is_active")
      .eq("shop_id", callerShopId)
      .eq("is_active", true),
    client
      .from("rooms")
      .select("id,room_number,room_type,capacity_pets,base_price_per_night,status")
      .eq("shop_id", callerShopId),
    client
      .from("pet_owners")
      .select("id", { count: "exact", head: true })
      .eq("shop_id", callerShopId),
    client
      .from("pets")
      .select("id", { count: "exact", head: true })
      .eq("shop_id", callerShopId),
    client
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .eq("shop_id", callerShopId),
  ]);

  if (shopResult.error || !shopResult.data) {
    throw new Error(`Failed to load shop configuration: ${shopResult.error?.message || "Not found"}`);
  }

  const shop = shopResult.data;
  const staffUsers = ownersResult.data ?? [];
  const rooms = roomsResult.data ?? [];
  const customerCount = customersResult.count ?? 0;
  const petCount = petsResult.count ?? 0;
  const bookingCount = bookingsResult.count ?? 0;

  const activeOwners = staffUsers.filter((s) => s.role === "owner");
  const availableRooms = rooms.filter((r) => r.status === "available");

  // --- Strict Operational Integration Checks ---

  // 1. LINE OA & Daily Report Dispatch
  const hasLineOaId = Boolean(shop.line_oa_id && shop.line_oa_id.trim().length > 0);
  let hasLineToken = false;
  try {
    const shopToken = getLineChannelAccessTokenForShop(callerShopId);
    hasLineToken = Boolean(shopToken && shopToken.trim().length > 0);
  } catch {
    hasLineToken = false;
  }
  const hasLineDispatchSecret = Boolean(process.env.LINE_DISPATCH_SECRET?.trim());
  const isLineOperationallyReady = hasLineOaId && hasLineToken && hasLineDispatchSecret;

  let lineCurrentValue = "Not Configured";
  let lineRemediation = "Enter your LINE OA ID (@yourhotel) in Shop Profile settings.";
  if (!hasLineOaId) {
    lineCurrentValue = "Not Configured (@id missing)";
    lineRemediation = "Configure LINE OA ID in Shop Profile.";
  } else if (!hasLineToken) {
    lineCurrentValue = `Configured (${shop.line_oa_id}) but Missing Server Token`;
    lineRemediation = `Add entry for shop "${callerShopId}" in LINE_CHANNEL_ACCESS_TOKENS_JSON on server.`;
  } else if (!hasLineDispatchSecret) {
    lineCurrentValue = `Configured (${shop.line_oa_id}) but Missing LINE_DISPATCH_SECRET`;
    lineRemediation = "Set LINE_DISPATCH_SECRET environment variable on server.";
  } else {
    lineCurrentValue = `Configured & Operationally Ready (${shop.line_oa_id})`;
    lineRemediation = "";
  }

  // 2. Google Sheets Sync Integration
  const hasSheetId = Boolean(shop.google_sheet_id && shop.google_sheet_id.trim().length > 0);
  let hasValidGoogleCreds = false;
  try {
    const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
    if (raw) {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      const email = parsed.client_email;
      const pkey = parsed.private_key;
      if (
        typeof email === "string" &&
        email.includes("@") &&
        typeof pkey === "string" &&
        pkey.includes("BEGIN PRIVATE KEY")
      ) {
        hasValidGoogleCreds = true;
      }
    }
  } catch {
    hasValidGoogleCreds = false;
  }
  const hasGoogleSyncSecret = Boolean(process.env.GOOGLE_SYNC_DISPATCH_SECRET?.trim());
  const isGoogleSheetsOperationallyReady = hasSheetId && hasValidGoogleCreds && hasGoogleSyncSecret;

  let googleCurrentValue = "Not Connected";
  let googleRemediation = "Bind Google Sheet ID via Settings → Integrations.";
  if (!hasSheetId) {
    googleCurrentValue = "Not Connected (Sheet ID missing)";
    googleRemediation = "Bind Google Sheet ID to this shop.";
  } else if (!hasValidGoogleCreds) {
    googleCurrentValue = "Bound but Missing/Invalid GOOGLE_SERVICE_ACCOUNT_JSON on server";
    googleRemediation = "Configure valid GOOGLE_SERVICE_ACCOUNT_JSON on server.";
  } else if (!hasGoogleSyncSecret) {
    googleCurrentValue = "Bound but Missing GOOGLE_SYNC_DISPATCH_SECRET on server";
    googleRemediation = "Set GOOGLE_SYNC_DISPATCH_SECRET environment variable on server.";
  } else {
    googleCurrentValue = "Connected & Operationally Ready";
    googleRemediation = "";
  }

  // --- Items Checklist Definition ---
  const items: PilotReadinessItem[] = [
    {
      id: "shop_profile",
      category: "core",
      title: "Shop Profile & Identity",
      description: "Shop name, slug, and contact phone must be configured.",
      isReady: Boolean(shop.name && shop.slug && shop.phone),
      isCritical: true,
      currentValue: shop.name ? `${shop.name} (${shop.slug})` : null,
      remediation: "Set shop name, slug, and contact phone number.",
    },
    {
      id: "active_owner",
      category: "core",
      title: "Active Shop Owner",
      description: "Shop must have at least 1 active owner with a valid login.",
      isReady: activeOwners.length >= 1,
      isCritical: true,
      currentValue: `${activeOwners.length} Active Owner(s)`,
      remediation: "Bootstrap shop with an active owner account.",
    },
    {
      id: "usable_rooms",
      category: "operations",
      title: "Room Inventory Ready",
      description: "Shop must have at least 1 room configured and available for guest boarding.",
      isReady: availableRooms.length >= 1,
      isCritical: true,
      currentValue: `${availableRooms.length} Available Room(s) of ${rooms.length} total`,
      remediation: "Add rooms to the room matrix or mark cleaned rooms as available.",
    },
    {
      id: "customer_pet_data",
      category: "operations",
      title: "Customer & Pet Records",
      description: "Pet hotel guest and owner records available for bookings.",
      isReady: customerCount > 0 && petCount > 0,
      isCritical: true,
      currentValue: `${customerCount} Owners, ${petCount} Pets`,
      remediation: "Import initial customer and pet list using CSV Import.",
    },
    {
      id: "line_oa",
      category: "integration",
      title: "LINE Official Account & Daily Reports",
      description: "LINE OA ID and server channel token configured for sending Daily Reports.",
      isReady: isLineOperationallyReady,
      isCritical: true,
      currentValue: lineCurrentValue,
      remediation: lineRemediation,
    },
    {
      id: "google_sheets",
      category: "integration",
      title: "Google Sheets Sync",
      description: "Pet-centric real-time export replica bound to Google Sheets with valid server credentials.",
      isReady: isGoogleSheetsOperationallyReady,
      isCritical: true,
      currentValue: googleCurrentValue,
      remediation: googleRemediation,
    },
    {
      id: "booking_ready",
      category: "operations",
      title: "Booking Engine Operational",
      description: "Room matrix and authoritative booking gateway ready for front-desk check-ins.",
      isReady: availableRooms.length >= 1 && activeOwners.length >= 1,
      isCritical: true,
      currentValue: `${bookingCount} Total Booking(s) Recorded`,
      remediation: "Ensure at least one room is in 'available' status.",
    },
  ];

  const criticalItems = items.filter((i) => i.isCritical);
  const criticalPassed = criticalItems.filter((i) => i.isReady).length;
  const totalPassed = items.filter((i) => i.isReady).length;

  const isPilotReady = criticalPassed === criticalItems.length;
  const readinessPercentage = Math.round((totalPassed / items.length) * 100);

  const blockingIssues: string[] = [];
  const recommendations: string[] = [];

  for (const item of items) {
    if (!item.isReady) {
      if (item.isCritical) {
        blockingIssues.push(`${item.title}: ${item.remediation || item.description}`);
      } else {
        recommendations.push(`${item.title}: ${item.remediation || item.description}`);
      }
    }
  }

  return {
    shopId: callerShopId,
    shopName: shop.name || callerShopName,
    shopSlug: shop.slug || callerShopSlug,
    isPilotReady,
    readinessPercentage,
    criticalPassed,
    criticalTotal: criticalItems.length,
    items,
    blockingIssues,
    recommendations,
    evaluatedAt: new Date().toISOString(),
  };
}
