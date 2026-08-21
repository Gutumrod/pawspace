"use server";

import { requireOwnerContext, type StaffRole } from "@/lib/tenant-context";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { logger } from "@/lib/logger";

export interface InviteStaffInput {
  email: string;
  name: string;
  role: StaffRole;
  password?: string;
}

export interface StaffActionResult {
  success: boolean;
  userId?: string;
  error?: string;
}

const VALID_ROLES: StaffRole[] = ["owner", "manager", "staff"];

/**
 * Invites or creates a staff member for the current shop.
 *
 * Requirements:
 * 1. Caller must be an active Owner of the shop.
 * 2. Auth user is provisioned via Supabase Auth Admin API (trusted server only).
 * 3. `create_staff_membership` RPC assigns the user to the caller's shop.
 * 4. Invariant: If RPC fails, any newly provisioned auth user is cleaned up.
 */
export async function inviteStaffAction(input: InviteStaffInput): Promise<StaffActionResult> {
  const email = input.email?.trim().toLowerCase();
  const name = input.name?.trim();
  const role = input.role;

  if (!email || !email.includes("@")) {
    return { success: false, error: "A valid email address is required." };
  }

  if (!name) {
    return { success: false, error: "Staff member name is required." };
  }

  if (!VALID_ROLES.includes(role)) {
    return {
      success: false,
      error: `Invalid role: "${role}". Must be one of: ${VALID_ROLES.join(", ")}.`,
    };
  }

  let ownerContext;
  try {
    ownerContext = await requireOwnerContext();
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Unauthorized";
    return { success: false, error: errorMsg };
  }

  const { staff: owner, client: ownerClient } = ownerContext;
  const admin = getSupabaseAdminClient();
  let targetUserId: string | null = null;
  let isNewlyCreatedAuthUser = false;

  try {
    // 1. Provision or find the Auth user.
    // If the owner explicitly supplied a password, set it directly (e.g. handed to the
    // staff member in person) - no email needed. Otherwise the staff member has no way
    // to learn a system-generated password, so send a real Supabase invite email that
    // lets them set their own password via a secure link.
    let existingUserLookupNeeded = false;

    if (input.password) {
      const { data: createData, error: createError } = await admin.auth.admin.createUser({
        email,
        password: input.password,
        email_confirm: true,
        user_metadata: { name },
      });

      if (!createError && createData?.user) {
        targetUserId = createData.user.id;
        isNewlyCreatedAuthUser = true;
      } else if (createError && (createError.message.includes("already") || createError.status === 422)) {
        existingUserLookupNeeded = true;
      } else {
        logger.error("Failed to provision auth user for staff invite", {
          email,
          error: createError?.message,
        });
        return {
          success: false,
          error: createError?.message || "Failed to provision staff authentication account.",
        };
      }
    } else {
      const appBaseUrl = process.env.APP_BASE_URL || "http://127.0.0.1:3000";
      const { data: inviteData, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
        data: { name },
        redirectTo: `${appBaseUrl}/auth/accept-invite`,
      });

      if (!inviteError && inviteData?.user) {
        targetUserId = inviteData.user.id;
        isNewlyCreatedAuthUser = true;
      } else if (inviteError && (inviteError.message.includes("already") || inviteError.status === 422)) {
        existingUserLookupNeeded = true;
      } else {
        logger.error("Failed to send staff invite email", {
          email,
          error: inviteError?.message,
        });
        return {
          success: false,
          error: inviteError?.message || "Failed to send staff invitation email.",
        };
      }
    }

    if (existingUserLookupNeeded) {
      // User already exists in Auth - look up their ID.
      const { data: listData, error: listError } = await admin.auth.admin.listUsers();
      if (listError || !listData?.users) {
        return {
          success: false,
          error: "Failed to look up existing auth user.",
        };
      }
      const found = listData.users.find((u) => u.email?.toLowerCase() === email);
      if (!found) {
        return {
          success: false,
          error: "Existing user could not be located in Auth database.",
        };
      }
      targetUserId = found.id;

      // No password was supplied and the account already existed (so no invite email
      // was sent above) - give them a way to establish credentials via a password-reset
      // email instead of leaving the membership unusable.
      if (!input.password) {
        const appBaseUrl = process.env.APP_BASE_URL || "http://127.0.0.1:3000";
        const { error: resetError } = await getSupabaseServerClient().auth.resetPasswordForEmail(email, {
          redirectTo: `${appBaseUrl}/auth/accept-invite`,
        });
        if (resetError) {
          logger.warn("Failed to send password-reset email to existing staff account", {
            email,
            error: resetError.message,
          });
        }
      }
    }

    if (!targetUserId) {
      return { success: false, error: "Could not resolve user ID for staff invite." };
    }

    // 2. Call authoritative create_staff_membership RPC using authenticated owner client
    const { error: rpcError } = await ownerClient.rpc("create_staff_membership", {
      p_user_id: targetUserId,
      p_email: email,
      p_name: name,
      p_role: role,
    });

    if (rpcError) {
      // Clean up newly created auth user if membership creation fails (compensation)
      if (isNewlyCreatedAuthUser) {
        try {
          await admin.auth.admin.deleteUser(targetUserId);
        } catch (cleanupErr) {
          logger.error("Failed to cleanup orphaned auth user after RPC failure", {
            targetUserId,
            error: cleanupErr instanceof Error ? cleanupErr.message : String(cleanupErr),
          });
        }
      }

      logger.warn("create_staff_membership RPC rejected", {
        ownerId: owner.userId,
        shopId: owner.shopId,
        targetUserId,
        error: rpcError.message,
      });

      return {
        success: false,
        error: rpcError.message || "Failed to create staff membership.",
      };
    }

    logger.info("Staff membership created successfully", {
      ownerId: owner.userId,
      shopId: owner.shopId,
      targetUserId,
      email,
      role,
    });

    return {
      success: true,
      userId: targetUserId,
    };
  } catch (err) {
    if (isNewlyCreatedAuthUser && targetUserId) {
      try {
        await admin.auth.admin.deleteUser(targetUserId);
      } catch {
        // Ignore secondary error
      }
    }

    logger.error("Unexpected error during staff invitation", {
      email,
      error: err instanceof Error ? err.message : String(err),
    });

    return {
      success: false,
      error: "An unexpected error occurred while inviting staff member.",
    };
  }
}

/**
 * Disables a staff member.
 * Owner-only, cross-tenant guarded, protected by enforce_last_active_owner() trigger.
 */
export async function disableStaffAction(userId: string): Promise<StaffActionResult> {
  if (!userId) {
    return { success: false, error: "Target user ID is required." };
  }

  let ownerContext;
  try {
    ownerContext = await requireOwnerContext();
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Unauthorized";
    return { success: false, error: errorMsg };
  }

  const { staff: owner, client: ownerClient } = ownerContext;

  try {
    const { error } = await ownerClient.rpc("disable_staff", {
      p_user_id: userId,
    });

    if (error) {
      logger.warn("disable_staff RPC rejected", {
        ownerId: owner.userId,
        shopId: owner.shopId,
        targetUserId: userId,
        error: error.message,
      });
      return { success: false, error: error.message };
    }

    logger.info("Staff member disabled", {
      ownerId: owner.userId,
      shopId: owner.shopId,
      targetUserId: userId,
    });

    return { success: true, userId };
  } catch (err) {
    logger.error("Unexpected error disabling staff member", {
      targetUserId: userId,
      error: err instanceof Error ? err.message : String(err),
    });
    return { success: false, error: "Failed to disable staff member." };
  }
}

/**
 * Enables a previously disabled staff member.
 * Owner-only, cross-tenant guarded.
 */
export async function enableStaffAction(userId: string): Promise<StaffActionResult> {
  if (!userId) {
    return { success: false, error: "Target user ID is required." };
  }

  let ownerContext;
  try {
    ownerContext = await requireOwnerContext();
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Unauthorized";
    return { success: false, error: errorMsg };
  }

  const { staff: owner, client: ownerClient } = ownerContext;

  try {
    const { error } = await ownerClient.rpc("enable_staff", {
      p_user_id: userId,
    });

    if (error) {
      logger.warn("enable_staff RPC rejected", {
        ownerId: owner.userId,
        shopId: owner.shopId,
        targetUserId: userId,
        error: error.message,
      });
      return { success: false, error: error.message };
    }

    logger.info("Staff member enabled", {
      ownerId: owner.userId,
      shopId: owner.shopId,
      targetUserId: userId,
    });

    return { success: true, userId };
  } catch (err) {
    logger.error("Unexpected error enabling staff member", {
      targetUserId: userId,
      error: err instanceof Error ? err.message : String(err),
    });
    return { success: false, error: "Failed to enable staff member." };
  }
}

/**
 * Changes a staff member's role (owner, manager, or staff).
 * Owner-only, cross-tenant guarded, protected by enforce_last_active_owner() trigger.
 */
export async function changeStaffRoleAction(
  userId: string,
  newRole: StaffRole
): Promise<StaffActionResult> {
  if (!userId) {
    return { success: false, error: "Target user ID is required." };
  }

  if (!VALID_ROLES.includes(newRole)) {
    return {
      success: false,
      error: `Invalid role: "${newRole}". Must be one of: ${VALID_ROLES.join(", ")}.`,
    };
  }

  let ownerContext;
  try {
    ownerContext = await requireOwnerContext();
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Unauthorized";
    return { success: false, error: errorMsg };
  }

  const { staff: owner, client: ownerClient } = ownerContext;

  try {
    const { error } = await ownerClient.rpc("change_staff_role", {
      p_user_id: userId,
      p_new_role: newRole,
    });

    if (error) {
      logger.warn("change_staff_role RPC rejected", {
        ownerId: owner.userId,
        shopId: owner.shopId,
        targetUserId: userId,
        newRole,
        error: error.message,
      });
      return { success: false, error: error.message };
    }

    logger.info("Staff role updated", {
      ownerId: owner.userId,
      shopId: owner.shopId,
      targetUserId: userId,
      newRole,
    });

    return { success: true, userId };
  } catch (err) {
    logger.error("Unexpected error changing staff role", {
      targetUserId: userId,
      newRole,
      error: err instanceof Error ? err.message : String(err),
    });
    return { success: false, error: "Failed to change staff role." };
  }
}

/**
 * Removes a staff member from the shop.
 * Owner-only, cross-tenant guarded, protected by enforce_last_active_owner() trigger.
 */
export async function removeStaffAction(userId: string): Promise<StaffActionResult> {
  if (!userId) {
    return { success: false, error: "Target user ID is required." };
  }

  let ownerContext;
  try {
    ownerContext = await requireOwnerContext();
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Unauthorized";
    return { success: false, error: errorMsg };
  }

  const { staff: owner, client: ownerClient } = ownerContext;

  try {
    const { error } = await ownerClient.rpc("remove_staff", {
      p_user_id: userId,
    });

    if (error) {
      logger.warn("remove_staff RPC rejected", {
        ownerId: owner.userId,
        shopId: owner.shopId,
        targetUserId: userId,
        error: error.message,
      });
      return { success: false, error: error.message };
    }

    logger.info("Staff member removed from shop", {
      ownerId: owner.userId,
      shopId: owner.shopId,
      targetUserId: userId,
    });

    // DB membership is already revoked (the authoritative access-control step, done
    // above). Auth account cleanup is a trusted-server follow-up: best-effort and
    // retryable - it must never re-grant access if it fails, only tidy up the Auth
    // record, so a failure here is logged but does not fail the action.
    const admin = getSupabaseAdminClient();
    const { error: authDeleteError } = await admin.auth.admin.deleteUser(userId);
    if (authDeleteError) {
      logger.error("Failed to delete Auth account after staff removal (DB removal already succeeded; retry Auth cleanup separately)", {
        ownerId: owner.userId,
        shopId: owner.shopId,
        targetUserId: userId,
        error: authDeleteError.message,
      });
    }

    return { success: true, userId };
  } catch (err) {
    logger.error("Unexpected error removing staff member", {
      targetUserId: userId,
      error: err instanceof Error ? err.message : String(err),
    });
    return { success: false, error: "Failed to remove staff member." };
  }
}
