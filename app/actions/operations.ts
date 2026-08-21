"use server";

import { revalidatePath } from "next/cache";
import { requireManagerOrOwnerContext, requireTenantContext } from "@/lib/tenant-context";
import {
  createOwner,
  createPet,
  createRoom,
  updateOwner,
  updatePet,
  updateRoom,
  type PetInput,
  type RoomType,
} from "@/lib/operations-service";
import { logger } from "@/lib/logger";

function refreshOperations() {
  revalidatePath("/");
  revalidatePath("/dashboard");
}

async function safeRun<T>(operation: string, fn: () => Promise<T>): Promise<T | { success: false; error: string }> {
  try {
    return await fn();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected server error.";
    logger.warn("Operations action rejected", { operation, error: message });
    return { success: false, error: message };
  }
}
export async function createRoomAction(input: { roomNumber: string; roomType: RoomType; capacityPets: number; basePricePerNight: number }) {
  return safeRun("createRoom", async () => {
    const { client } = await requireManagerOrOwnerContext();
    const result = await createRoom(client, input);
    if (result.success) refreshOperations();
    return result;
  });
}

export async function updateRoomAction(input: { roomId: string; roomNumber: string; roomType: RoomType; capacityPets: number; basePricePerNight: number }) {
  return safeRun("updateRoom", async () => {
    const { client } = await requireManagerOrOwnerContext();
    const result = await updateRoom(client, input);
    if (result.success) refreshOperations();
    return result;
  });
}

export async function createOwnerAction(input: { firstName: string; lastName?: string | null; phone: string; emergencyPhone?: string | null; address?: string | null }) {
  return safeRun("createOwner", async () => {
    const { client } = await requireTenantContext();
    const result = await createOwner(client, input);
    if (result.success) refreshOperations();
    return result;
  });
}
export async function updateOwnerAction(input: { ownerId: string; firstName: string; lastName?: string | null; phone: string; emergencyPhone?: string | null; address?: string | null }) {
  return safeRun("updateOwner", async () => {
    const { client } = await requireTenantContext();
    const result = await updateOwner(client, input);
    if (result.success) refreshOperations();
    return result;
  });
}

export async function createPetAction(input: PetInput) {
  return safeRun("createPet", async () => {
    const { client } = await requireTenantContext();
    const result = await createPet(client, input);
    if (result.success) refreshOperations();
    return result;
  });
}

export async function updatePetAction(petId: string, input: PetInput) {
  return safeRun("updatePet", async () => {
    const { client } = await requireTenantContext();
    const result = await updatePet(client, petId, input);
    if (result.success) refreshOperations();
    return result;
  });
}
