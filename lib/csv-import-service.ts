import type { SupabaseClient } from "@supabase/supabase-js";
import { StreamParser } from "@/lib/import-export";
import { logger } from "@/lib/logger";

export type NormalizedSpecies = "dog" | "cat";
export type NormalizedGender = "male" | "female" | "neutered_male" | "spayed_female";

export interface ParsedCustomerRecord {
  firstName: string;
  lastName: string | null;
  phone: string;
  emergencyPhone: string | null;
  address: string | null;
}

export interface ParsedPetRecord {
  name: string;
  species: NormalizedSpecies;
  breed: string | null;
  gender: NormalizedGender | null;
  birthDate: string | null;
  weightKg: number | null;
  specialCareNotes: string | null;
  allergies: string | null;
}

export interface ImportRowDetail {
  rowNumber: number;
  isValid: boolean;
  isCustomerNew: boolean;
  isPetNew: boolean;
  isDuplicatePet: boolean;
  isIdentityConflict: boolean;
  customer: ParsedCustomerRecord | null;
  pet: ParsedPetRecord | null;
  errors: string[];
}

export interface ImportPreviewSummary {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  newCustomers: number;
  existingCustomers: number;
  newPets: number;
  duplicatePets: number;
  identityConflicts: number;
  unsupportedColumns: string[];
  rowDetails: ImportRowDetail[];
}

export interface ImportExecutionResult {
  success: boolean;
  batchId?: string;
  totalProcessed: number;
  createdCustomers: number;
  createdPets: number;
  skippedDuplicates: number;
  errors: Array<{ rowNumber: number; message: string }>;
}

// Canonical header aliases
const HEADER_MAP: Record<string, string> = {
  // Customer headers
  first_name: "firstName",
  firstname: "firstName",
  name: "firstName",
  customer_name: "firstName",
  owner_name: "firstName",
  "ชื่อ": "firstName",
  "ชื่อจริง": "firstName",
  "ชื่อเจ้าของ": "firstName",
  "ชื่อลูกค้า": "firstName",

  last_name: "lastName",
  lastname: "lastName",
  surname: "lastName",
  "นามสกุล": "lastName",

  phone: "phone",
  customer_phone: "phone",
  owner_phone: "phone",
  tel: "phone",
  mobile: "phone",
  telephone: "phone",
  "เบอร์": "phone",
  "เบอร์โทร": "phone",
  "เบอร์โทรศัพท์": "phone",
  "เบอร์ติดต่อ": "phone",

  emergency_phone: "emergencyPhone",
  emergency_tel: "emergencyPhone",
  emergency_contact: "emergencyPhone",
  "เบอร์ฉุกเฉิน": "emergencyPhone",
  "ติดต่อฉุกเฉิน": "emergencyPhone",

  address: "address",
  "ที่อยู่": "address",

  // Pet headers
  pet_name: "petName",
  petname: "petName",
  "ชื่อสัตว์": "petName",
  "ชื่อสัตว์เลี้ยง": "petName",
  "ชื่อน้อง": "petName",

  species: "species",
  pet_type: "species",
  type: "species",
  "ชนิด": "species",
  "ชนิดสัตว์": "species",
  "ประเภท": "species",
  "ประเภทสัตว์": "species",

  breed: "breed",
  pet_breed: "breed",
  "พันธุ์": "breed",
  "สายพันธุ์": "breed",

  gender: "gender",
  sex: "gender",
  "เพศ": "gender",

  birth_date: "birthDate",
  birthdate: "birthDate",
  dob: "birthDate",
  "วันเกิด": "birthDate",
  "วันเดือนปีเกิด": "birthDate",

  weight_kg: "weightKg",
  weight: "weightKg",
  "น้ำหนัก": "weightKg",
  "น้ำหนัก(กก.)": "weightKg",
  "น้ำหนัก (กก.)": "weightKg",

  special_care_notes: "specialCareNotes",
  special_care: "specialCareNotes",
  care_notes: "specialCareNotes",
  notes: "specialCareNotes",
  "การดูแลพิเศษ": "specialCareNotes",
  "ข้อควรระวัง": "specialCareNotes",
  "หมายเหตุ": "specialCareNotes",

  allergies: "allergies",
  allergy: "allergies",
  "แพ้อาหาร": "allergies",
  "อาการแพ้": "allergies",
  "แพ้": "allergies",
};

export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/[^\d+]/g, "").trim();
  if (digits.startsWith("+66")) {
    return "0" + digits.slice(3);
  }
  if (digits.startsWith("66") && digits.length === 11) {
    return "0" + digits.slice(2);
  }
  // Strip any other leading country-code "+" before validating - the stored/RPC
  // contract is digits-only ([0-9]{9,15}), so a lingering "+" must never survive.
  const stripped = digits.startsWith("+") ? digits.slice(1) : digits;
  if (!/^\d+$/.test(stripped)) return null;
  if (stripped.length >= 9 && stripped.length <= 10 && stripped.startsWith("0")) {
    return stripped;
  }
  if (stripped.length >= 9 && stripped.length <= 15) {
    return stripped;
  }
  return null;
}

export function normalizeSpecies(raw: string | null | undefined): NormalizedSpecies | null {
  if (!raw) return null;
  const lower = raw.trim().toLowerCase();
  if (["dog", "dogs", "canine", "สุนัข", "หมา", "น้องหมา"].includes(lower)) {
    return "dog";
  }
  if (["cat", "cats", "feline", "แมว", "น้องแมว"].includes(lower)) {
    return "cat";
  }
  return null;
}

export function normalizeGender(raw: string | null | undefined): NormalizedGender | null {
  if (!raw) return null;
  const lower = raw.trim().toLowerCase();
  if (["male", "m", "ผู้", "ตัวผู้", "เพศผู้"].includes(lower)) {
    return "male";
  }
  if (["female", "f", "เมีย", "ตัวเมีย", "เพศเมีย"].includes(lower)) {
    return "female";
  }
  if (["neutered_male", "neutered", "ผู้ทำหมัน", "ทำหมัน(ผู้)", "ทำหมันเพศผู้"].includes(lower)) {
    return "neutered_male";
  }
  if (["spayed_female", "spayed", "เมียทำหมัน", "ทำหมัน(เมีย)", "ทำหมันเพศเมีย", "ทำหมัน"].includes(lower)) {
    return "spayed_female";
  }
  return null;
}

function isRealCalendarDate(year: number, month: number, day: number): boolean {
  const d = new Date(Date.UTC(year, month - 1, day));
  return d.getUTCFullYear() === year && d.getUTCMonth() === month - 1 && d.getUTCDate() === day;
}

export function normalizeDate(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    const [, year, month, day] = isoMatch;
    if (isRealCalendarDate(Number(year), Number(month), Number(day))) return trimmed;
  }
  const slashMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slashMatch) {
    const [, day, month, year] = slashMatch;
    if (isRealCalendarDate(Number(year), Number(month), Number(day))) {
      return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
    }
  }
  return null;
}

export async function parseCsvContent(csvString: string) {
  const parser = new StreamParser();
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(csvString));
      controller.close();
    },
  });

  return await parser.parseStream<Record<string, unknown>>(stream, {
    format: "csv",
    hasHeader: true,
    maxBytes: 10 * 1024 * 1024, // 10MB
    maxRows: 2000,
  });
}

/**
 * Generates an in-memory preview of the CSV data compared against existing tenant records.
 * STRICTLY READ-ONLY: Produces zero database writes.
 */
export async function previewCustomerPetCsv(
  client: SupabaseClient,
  shopId: string,
  csvString: string,
): Promise<ImportPreviewSummary> {
  const records = await parseCsvContent(csvString);

  // Fetch existing owners and pets for this tenant to identify duplicates and conflicts
  const [ownersResult, petsResult] = await Promise.all([
    client.from("pet_owners").select("id,phone,first_name,last_name").eq("shop_id", shopId),
    client.from("pets").select("id,owner_id,name,species").eq("shop_id", shopId),
  ]);

  if (ownersResult.error) {
    throw new Error(`Failed to load existing pet owners: ${ownersResult.error.message}`);
  }
  if (petsResult.error) {
    throw new Error(`Failed to load existing pets: ${petsResult.error.message}`);
  }

  // Maps for existing tenant data
  const existingOwnersByPhone = new Map<string, { id: string; firstName: string; lastName: string | null }>();
  for (const owner of ownersResult.data ?? []) {
    const norm = normalizePhone(owner.phone);
    if (norm) existingOwnersByPhone.set(norm, { id: owner.id, firstName: owner.first_name, lastName: owner.last_name });
  }

  const existingPetsKeySet = new Set<string>();
  for (const pet of petsResult.data ?? []) {
    const key = `${pet.owner_id}:${pet.name.trim().toLowerCase()}:${pet.species}`;
    existingPetsKeySet.add(key);
  }

  // Detect duplicate canonical headers & unsupported headers
  const unsupportedHeadersSet = new Set<string>();
  if (records.length > 0 && records[0].value) {
    const canonicalHeadersSeen = new Map<string, string>();
    for (const rawKey of Object.keys(records[0].value)) {
      const lowerKey = rawKey.trim().toLowerCase();
      const canon = HEADER_MAP[lowerKey];
      if (canon) {
        if (canonicalHeadersSeen.has(canon)) {
          const prevCol = canonicalHeadersSeen.get(canon);
          throw new Error(`CSV_DUPLICATE_HEADER: Duplicate column mapping detected for field "${canon}" ("${prevCol}" and "${rawKey}").`);
        }
        canonicalHeadersSeen.set(canon, rawKey);
      } else {
        unsupportedHeadersSet.add(rawKey.trim());
      }
    }
  }

  const rowDetails: ImportRowDetail[] = [];
  const sessionNewOwnersByPhone = new Map<string, { firstName: string; rowNumber: number }>();
  const sessionNewPetsKeySet = new Set<string>();

  let newCustomersCount = 0;
  let newPetsCount = 0;
  let duplicatePetsCount = 0;
  let identityConflictsCount = 0;
  let validRowsCount = 0;
  let invalidRowsCount = 0;

  for (const record of records) {
    const errors: string[] = [];
    if (!record.valid || !record.value) {
      invalidRowsCount++;
      rowDetails.push({
        rowNumber: record.row,
        isValid: false,
        isCustomerNew: false,
        isPetNew: false,
        isDuplicatePet: false,
        isIdentityConflict: false,
        customer: null,
        pet: null,
        errors: record.errors?.map((e) => e.message) || ["Malformed CSV row"],
      });
      continue;
    }

    const rowVal = record.value;
    const mapped: Record<string, string> = {};

    for (const [k, v] of Object.entries(rowVal)) {
      const canon = HEADER_MAP[k.trim().toLowerCase()];
      if (canon && v !== undefined && v !== null) {
        mapped[canon] = String(v).trim();
      }
    }

    // Customer Validation
    const rawFirstName = mapped.firstName;
    const rawLastName = mapped.lastName || null;
    const rawPhone = mapped.phone;
    const rawEmergency = mapped.emergencyPhone || null;
    const rawAddress = mapped.address || null;

    if (!rawFirstName) {
      errors.push("Customer name / first name is required.");
    }
    if (!rawPhone) {
      errors.push("Customer phone number is required.");
    }

    const normPhone = normalizePhone(rawPhone);
    if (rawPhone && !normPhone) {
      errors.push(`Invalid phone format: "${rawPhone}". Expected at least 9-10 digits.`);
    }

    // Deterministic Customer Identity Conflict Check
    let isIdentityConflict = false;
    if (normPhone && rawFirstName) {
      const existingOwner = existingOwnersByPhone.get(normPhone);
      if (existingOwner) {
        if (existingOwner.firstName.trim().toLowerCase() !== rawFirstName.trim().toLowerCase()) {
          isIdentityConflict = true;
          errors.push(
            `Identity Conflict: Phone ${normPhone} is already registered to "${existingOwner.firstName}", but CSV provides "${rawFirstName}". Auto-merge rejected; manual review required.`
          );
        }
      } else if (sessionNewOwnersByPhone.has(normPhone)) {
        const prev = sessionNewOwnersByPhone.get(normPhone)!;
        if (prev.firstName.trim().toLowerCase() !== rawFirstName.trim().toLowerCase()) {
          isIdentityConflict = true;
          errors.push(
            `Ambiguous Identity Conflict: Phone ${normPhone} appears with conflicting names ("${prev.firstName}" vs "${rawFirstName}") in the same CSV.`
          );
        }
      }
    }

    // Pet Validation
    const rawPetName = mapped.petName;
    const rawSpecies = mapped.species;
    const rawBreed = mapped.breed || null;
    const rawGender = mapped.gender || null;
    const rawBirthDate = mapped.birthDate || null;
    const rawWeight = mapped.weightKg;
    const rawNotes = mapped.specialCareNotes || null;
    const rawAllergies = mapped.allergies || null;

    const hasPet = Boolean(rawPetName);
    let normSpecies: NormalizedSpecies | null = null;
    let normGender: NormalizedGender | null = null;
    let normBirthDate: string | null = null;
    let normWeight: number | null = null;

    if (hasPet) {
      normSpecies = normalizeSpecies(rawSpecies);
      if (!normSpecies) {
        errors.push(`Invalid or missing pet species: "${rawSpecies || ""}". Must be dog or cat.`);
      }

      if (rawGender) {
        normGender = normalizeGender(rawGender);
        if (!normGender) {
          errors.push(`Invalid pet gender: "${rawGender}". Must be male, female, neutered_male, or spayed_female.`);
        }
      }

      if (rawBirthDate) {
        normBirthDate = normalizeDate(rawBirthDate);
        if (!normBirthDate) {
          errors.push(`Invalid birth date: "${rawBirthDate}". Format should be YYYY-MM-DD or DD/MM/YYYY.`);
        }
      }

      if (rawWeight) {
        const isStrictNumber = /^\d+(?:\.\d+)?$/.test(rawWeight.trim());
        const parsedWeight = Number(rawWeight);
        if (!isStrictNumber || !Number.isFinite(parsedWeight) || parsedWeight < 0) {
          errors.push(`Invalid pet weight: "${rawWeight}". Must be a non-negative number.`);
        } else {
          normWeight = parsedWeight;
        }
      }
    } else if (rawSpecies || rawBreed || rawGender || rawBirthDate || rawWeight || rawNotes || rawAllergies) {
      errors.push("Pet data provided but pet name is missing.");
    }

    if (isIdentityConflict) {
      identityConflictsCount++;
    }

    const isValid = errors.length === 0;
    if (isValid) {
      validRowsCount++;
    } else {
      invalidRowsCount++;
    }

    let isCustomerNew = false;
    let isPetNew = false;
    let isDuplicatePet = false;

    if (isValid && normPhone && rawFirstName) {
      const existingOwner = existingOwnersByPhone.get(normPhone);
      if (existingOwner) {
        // Customer matched consistently
      } else if (sessionNewOwnersByPhone.has(normPhone)) {
        // Already registered as new in earlier row
      } else {
        isCustomerNew = true;
        sessionNewOwnersByPhone.set(normPhone, { firstName: rawFirstName, rowNumber: record.row });
        newCustomersCount++;
      }

      // Determine pet status
      if (hasPet && normSpecies && rawPetName) {
        const petKey = `${normPhone}:${rawPetName.trim().toLowerCase()}:${normSpecies}`;
        const dbPetKey = existingOwner
          ? `${existingOwner.id}:${rawPetName.trim().toLowerCase()}:${normSpecies}`
          : null;

        if ((dbPetKey && existingPetsKeySet.has(dbPetKey)) || sessionNewPetsKeySet.has(petKey)) {
          isDuplicatePet = true;
          duplicatePetsCount++;
        } else {
          isPetNew = true;
          sessionNewPetsKeySet.add(petKey);
          newPetsCount++;
        }
      }
    }

    const customerRecord: ParsedCustomerRecord | null =
      rawFirstName && normPhone
        ? {
            firstName: rawFirstName,
            lastName: rawLastName,
            phone: normPhone,
            emergencyPhone: rawEmergency,
            address: rawAddress,
          }
        : null;

    const petRecord: ParsedPetRecord | null =
      hasPet && normSpecies && rawPetName
        ? {
            name: rawPetName.trim(),
            species: normSpecies,
            breed: rawBreed,
            gender: normGender,
            birthDate: normBirthDate,
            weightKg: normWeight,
            specialCareNotes: rawNotes,
            allergies: rawAllergies,
          }
        : null;

    rowDetails.push({
      rowNumber: record.row,
      isValid,
      isCustomerNew,
      isPetNew,
      isDuplicatePet,
      isIdentityConflict,
      customer: customerRecord,
      pet: petRecord,
      errors,
    });
  }

  // Count existing customers that are matched in this CSV
  const totalUniquePhonesInCsv = new Set(
    rowDetails.filter((r) => r.isValid && r.customer).map((r) => r.customer!.phone),
  ).size;
  const matchedExistingCustomersCount = totalUniquePhonesInCsv - newCustomersCount;

  return {
    totalRows: records.length,
    validRows: validRowsCount,
    invalidRows: invalidRowsCount,
    newCustomers: newCustomersCount,
    existingCustomers: Math.max(0, matchedExistingCustomersCount),
    newPets: newPetsCount,
    duplicatePets: duplicatePetsCount,
    identityConflicts: identityConflictsCount,
    unsupportedColumns: Array.from(unsupportedHeadersSet),
    rowDetails,
  };
}

/**
 * Authoritatively executes the import in an ATOMIC transaction via import_customers_and_pets_atomic RPC.
 * If any error occurs or conflict is detected, the entire batch rolls back completely.
 */
export async function executeCustomerPetImport(
  client: SupabaseClient,
  shopId: string,
  preview: ImportPreviewSummary,
): Promise<ImportExecutionResult> {
  // Reject if any identity conflict exists
  if (preview.identityConflicts > 0) {
    return {
      success: false,
      totalProcessed: 0,
      createdCustomers: 0,
      createdPets: 0,
      skippedDuplicates: 0,
      errors: [{ rowNumber: 0, message: "Import rejected: Unresolved identity conflicts present in preview." }],
    };
  }

  const validDetails = preview.rowDetails.filter((r) => r.isValid && r.customer);
  if (validDetails.length === 0) {
    return {
      success: false,
      totalProcessed: 0,
      createdCustomers: 0,
      createdPets: 0,
      skippedDuplicates: 0,
      errors: [{ rowNumber: 0, message: "No valid rows found to import." }],
    };
  }

  // Construct authoritative source-row payload for atomic RPC
  const batchPayload = validDetails.map((detail) => ({
    row_number: detail.rowNumber,
    customer: {
      firstName: detail.customer!.firstName,
      lastName: detail.customer!.lastName || null,
      phone: detail.customer!.phone,
      emergencyPhone: detail.customer!.emergencyPhone || null,
      address: detail.customer!.address || null,
    },
    pet: detail.pet
      ? {
          name: detail.pet.name,
          species: detail.pet.species,
          breed: detail.pet.breed || null,
          gender: detail.pet.gender || null,
          birthDate: detail.pet.birthDate || null,
          weightKg: detail.pet.weightKg ?? null,
          specialCareNotes: detail.pet.specialCareNotes || null,
          allergies: detail.pet.allergies || null,
        }
      : null,
  }));

  const { data: rpcResult, error: rpcError } = await client.rpc("import_customers_and_pets_atomic", {
    p_records: batchPayload,
  });

  if (rpcError || !rpcResult) {
    logger.error("Atomic import RPC failed", {
      shopId,
      error: rpcError?.message,
    });
    return {
      success: false,
      totalProcessed: 0,
      createdCustomers: 0,
      createdPets: 0,
      skippedDuplicates: 0,
      errors: [{ rowNumber: 0, message: rpcError?.message || "Atomic import transaction failed." }],
    };
  }

  const res = rpcResult as {
    batch_id: string;
    total_processed: number;
    created_customers: number;
    created_pets: number;
    skipped_duplicates: number;
  };

  return {
    success: true,
    batchId: res.batch_id,
    totalProcessed: res.total_processed,
    createdCustomers: res.created_customers,
    createdPets: res.created_pets,
    skippedDuplicates: res.skipped_duplicates,
    errors: [],
  };
}
