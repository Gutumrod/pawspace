import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  normalizePhone,
  normalizeSpecies,
  normalizeGender,
  normalizeDate,
  previewCustomerPetCsv,
  executeCustomerPetImport,
} from "../lib/csv-import-service";
import { evaluatePilotReadiness } from "../lib/pilot-readiness-service";
import { StreamSerializer, StreamParser } from "../lib/import-export";
import { buildCustomerRow, type PetCustomerRecord } from "../lib/google-sheet-records";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable ${name}.`);
  return value;
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "http://127.0.0.1:54321";
const anonKey = requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");
const serviceKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

interface TestUser {
  id: string;
  email: string;
  client: SupabaseClient;
}

function authedClient(token: string): SupabaseClient {
  return createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
}

async function createUser(email: string): Promise<TestUser> {
  const password = "TestPassword123!";
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error || !data.user) throw new Error(`createUser failed: ${error?.message}`);

  const anon = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: session, error: loginError } = await anon.auth.signInWithPassword({ email, password });
  if (loginError || !session.session) throw new Error(`login failed: ${loginError?.message}`);

  return { id: data.user.id, email, client: authedClient(session.session.access_token) };
}

let passed = 0;
let failed = 0;

function check(condition: boolean, name: string, detail?: string) {
  if (condition) {
    console.log(`  [PASS] ${name}`);
    passed++;
  } else {
    console.error(`  [FAIL] ${name}${detail ? ` - ${detail}` : ""}`);
    failed++;
  }
}

async function run() {
  console.log("=== PawSpace Phase 12 Pilot Onboarding & Closed Beta Readiness Test Suite ===\n");

  const runId = Math.random().toString(36).slice(2, 8);
  const ownerAEmail = `owner_a_${runId}@test.pawspace.com`;
  const managerAEmail = `manager_a_${runId}@test.pawspace.com`;
  const staffAEmail = `staff_a_${runId}@test.pawspace.com`;
  const ownerBEmail = `owner_b_${runId}@test.pawspace.com`;

  // 1. Setup Tenant A and Tenant B
  console.log("1. Setting up Tenant A and Tenant B...");
  const ownerA = await createUser(ownerAEmail);
  const managerA = await createUser(managerAEmail);
  const staffA = await createUser(staffAEmail);
  const ownerB = await createUser(ownerBEmail);

  const shopASlug = `pilot-hotel-a-${runId}`;
  const shopBSlug = `pilot-hotel-b-${runId}`;

  const { data: shopAId, error: shopAErr } = await ownerA.client.rpc("bootstrap_shop", {
    p_name: "PawSpace Pilot Hotel A",
    p_slug: shopASlug,
    p_phone: "02-999-0001",
    p_line_oa_id: "@pilota",
  });
  if (shopAErr || !shopAId) throw new Error(`Bootstrap Shop A failed: ${shopAErr?.message}`);

  const { data: shopBId, error: shopBErr } = await ownerB.client.rpc("bootstrap_shop", {
    p_name: "PawSpace Pilot Hotel B",
    p_slug: shopBSlug,
    p_phone: "02-999-0002",
    p_line_oa_id: "@pilotb",
  });
  if (shopBErr || !shopBId) throw new Error(`Bootstrap Shop B failed: ${shopBErr?.message}`);

  // Add Manager and Staff to Tenant A
  await ownerA.client.rpc("create_staff_membership", {
    p_user_id: managerA.id,
    p_email: managerA.email,
    p_name: "Manager Alice",
    p_role: "manager",
  });
  await ownerA.client.rpc("create_staff_membership", {
    p_user_id: staffA.id,
    p_email: staffA.email,
    p_name: "Staff Bob",
    p_role: "staff",
  });

  // 2. Normalization & Module Hub Integration Tests
  console.log("\n2. Testing Normalization & Module Hub Integration...");
  check(normalizePhone("0812345678") === "0812345678", "Normalizes 10-digit Thai phone");
  check(normalizePhone("+66812345678") === "0812345678", "Normalizes +66 country code to 08...");
  check(normalizePhone("081-234-5678") === "0812345678", "Strips dashes from phone");
  check(normalizePhone("12345") === null, "Rejects malformed short phone");
  check(
    normalizePhone("+1 234 567 890") === "1234567890",
    "Strips leading '+' from non-Thai international numbers instead of leaking it into the normalized value",
  );
  check(
    normalizePhone("+852 6012 3456") === "85260123456",
    "Normalizes Hong Kong '+852' number to pure digits",
  );
  check(
    !!normalizePhone("+1 234 567 890") && /^[0-9]{9,15}$/.test(normalizePhone("+1 234 567 890")!),
    "Normalized international phone always satisfies the RPC's digits-only 9-15 contract",
  );

  check(normalizeSpecies("dog") === "dog", "Normalizes 'dog'");
  check(normalizeSpecies("สุนัข") === "dog", "Normalizes Thai 'สุนัข' to 'dog'");
  check(normalizeSpecies("แมว") === "cat", "Normalizes Thai 'แมว' to 'cat'");
  check(normalizeSpecies("rabbit") === null, "Rejects unsupported species");

  check(normalizeGender("male") === "male", "Normalizes 'male'");
  check(normalizeGender("ตัวเมีย") === "female", "Normalizes Thai 'ตัวเมีย' to 'female'");
  check(normalizeGender("ผู้ทำหมัน") === "neutered_male", "Normalizes Thai 'ผู้ทำหมัน' to 'neutered_male'");
  check(normalizeGender("unknown_gender") === null, "Rejects invalid gender");

  check(normalizeDate("2023-05-15") === "2023-05-15", "Normalizes YYYY-MM-DD date");
  check(normalizeDate("15/05/2023") === "2023-05-15", "Normalizes DD/MM/YYYY date");
  check(normalizeDate("invalid-date") === null, "Rejects invalid date format");
  check(normalizeDate("2023-02-30") === null, "Rejects impossible calendar date instead of JavaScript rollover");

  // StreamSerializer test with formula injection protection
  const serializer = new StreamSerializer();
  const serialized = serializer.serialize(
    [{ name: "=cmd|' /C calc'!A0", phone: "0812345678" }],
    { format: "csv", escapeFormulas: true }
  );
  check(
    typeof serialized.data === "string" && serialized.data.includes("'=cmd"),
    "Module Hub StreamSerializer escapes spreadsheet formulas"
  );

  // Formula-injection protection must also apply where CSV-imported data actually leaves
  // PawSpace: the Google Sheets sync row builder, not just the standalone serializer.
  const maliciousCustomerRecord: PetCustomerRecord = {
    petId: "pet-1", petName: "=cmd|' /C calc'!A0", species: "dog", breed: null, gender: null,
    birthDate: null, weightKg: null, avatarUrl: null, specialCareNotes: "@evil()", allergies: "+1;DDE",
    ownerId: "owner-1", ownerFirstName: "-rm -rf", ownerLastName: null, ownerPhone: "0812345678",
    ownerEmergencyPhone: null, ownerAddress: "=HYPERLINK(\"http://evil\")", createdAt: null,
  };
  const sheetRow = buildCustomerRow(maliciousCustomerRecord);
  check(
    sheetRow[1] === "'=cmd|' /C calc'!A0" &&
      sheetRow[8] === "'@evil()" &&
      sheetRow[9] === "'+1;DDE" &&
      sheetRow[11] === "'-rm -rf" &&
      sheetRow[15] === "'=HYPERLINK(\"http://evil\")",
    "Google Sheets sync row builder escapes formula-triggering prefixes on every tenant-supplied text field",
  );

  // 3. Authoritative Shop Profile Mutation Tests (Finding 1)
  console.log("\n3. Testing Authoritative Shop Profile Mutation & Security Boundaries...");
  
  // 3.1 Direct authenticated table update is denied
  const directUpdate = await ownerA.client.from("shops").update({ name: "Hacked Shop Name" }).eq("id", shopAId);
  check(
    Boolean(directUpdate.error && directUpdate.error.message.includes("permission denied")),
    "Direct authenticated table UPDATE on shops table is strictly denied"
  );

  // 3.2 Owner can update profile via authoritative RPC
  const { error: ownerUpdateErr } = await ownerA.client.rpc("update_shop_profile", {
    p_name: "PawSpace Pilot Hotel A Updated",
    p_phone: "02-999-8888",
    p_line_oa_id: "@pilota_updated",
  });
  check(!ownerUpdateErr, "Owner can update shop profile through authoritative RPC");

  // Verify updated values persisted
  const { data: updatedShopA } = await admin.from("shops").select("name,phone,line_oa_id").eq("id", shopAId).single();
  check(
    updatedShopA?.name === "PawSpace Pilot Hotel A Updated" &&
    updatedShopA?.phone === "02-999-8888" &&
    updatedShopA?.line_oa_id === "@pilota_updated",
    "Updated shop profile values persisted correctly in database"
  );

  // 3.3 Manager can update profile via authoritative RPC
  const { error: managerUpdateErr } = await managerA.client.rpc("update_shop_profile", {
    p_name: "PawSpace Pilot Hotel A (by Manager)",
    p_phone: "02-999-7777",
    p_line_oa_id: "@pilota_mgr",
  });
  check(!managerUpdateErr, "Manager can update shop profile through authoritative RPC");

  // 3.4 Staff is rejected from updating profile
  const { error: staffUpdateErr } = await staffA.client.rpc("update_shop_profile", {
    p_name: "PawSpace Pilot Hotel A (by Staff)",
    p_phone: "02-999-6666",
    p_line_oa_id: "@pilota_staff",
  });
  check(
    Boolean(staffUpdateErr && staffUpdateErr.message.includes("Unauthorized")),
    "Staff member is strictly rejected from updating shop profile"
  );

  // 3.5 Empty shop name is rejected
  const { error: emptyNameErr } = await ownerA.client.rpc("update_shop_profile", {
    p_name: "   ",
    p_phone: "02-999-5555",
  });
  check(Boolean(emptyNameErr), "Empty shop name is rejected by RPC validation");

  // 3.6 Tenant B caller cannot affect Tenant A
  await ownerB.client.rpc("update_shop_profile", {
    p_name: "PawSpace Pilot Hotel B Custom",
    p_phone: "02-888-0000",
  });
  const { data: verifyShopA } = await admin.from("shops").select("name").eq("id", shopAId).single();
  check(
    verifyShopA?.name === "PawSpace Pilot Hotel A (by Manager)",
    "Tenant B profile update cannot alter Tenant A profile (cross-tenant isolation)"
  );

  // 4. CSV Structural Fail-Closed Tests (Finding 4)
  console.log("\n4. Testing CSV Structural Fail-Closed Validation...");

  // 4.1 Exact duplicate header
  let exactDupErr = false;
  try {
    const p = new StreamParser();
    const encoder = new TextEncoder();
    await p.parseStream(
      new ReadableStream({
        start(c) {
          c.enqueue(encoder.encode("phone,phone\n0811111111,0899999999"));
          c.close();
        },
      }),
      { format: "csv", hasHeader: true }
    );
  } catch (err: unknown) {
    exactDupErr = (err as Error).message.includes("CSV_DUPLICATE_HEADER");
  }
  check(exactDupErr, "Rejects CSV with exact duplicate headers");

  // 4.2 Canonical duplicate header (phone,เบอร์โทร)
  let canonDupErr = false;
  try {
    await previewCustomerPetCsv(
      ownerA.client,
      shopAId,
      `name,phone,เบอร์โทร,pet_name,species\nAlice,0811111111,0899999999,Milo,dog`
    );
  } catch (err: unknown) {
    canonDupErr = (err as Error).message.includes("CSV_DUPLICATE_HEADER");
  }
  check(canonDupErr, "Rejects CSV with canonical duplicate alias headers (phone, เบอร์โทร)");

  // 4.3 Row limit overflow (> 2000 rows)
  let rowLimitErr = false;
  try {
    const lines = ["name,phone,pet_name,species"];
    for (let i = 1; i <= 2005; i++) {
      lines.push(`Cust${i},081000${String(i).padStart(4, "0")},Pet${i},dog`);
    }
    await previewCustomerPetCsv(ownerA.client, shopAId, lines.join("\n"));
  } catch (err: unknown) {
    rowLimitErr = (err as Error).message.includes("IMPORT_ROW_LIMIT_EXCEEDED");
  }
  check(rowLimitErr, "Throws explicit IMPORT_ROW_LIMIT_EXCEEDED on > 2000 rows (no silent truncation)");

  // 4.4 Unclosed quotes in data
  const malformedQuoteCsv = `name,phone,pet_name,species\n"Alice,0812345678,Milo,dog\nBob,0898765432,Luna,cat`;
  const quotePreview = await previewCustomerPetCsv(ownerA.client, shopAId, malformedQuoteCsv);
  check(
    quotePreview.invalidRows >= 1 &&
    quotePreview.rowDetails.some((r) => r.errors.some((e) => e.includes("CSV_MALFORMED_QUOTE") || e.includes("CSV_MALFORMED_LINE"))),
    "Detects and rejects unclosed quote in CSV data"
  );

  // 4.5 Column count mismatch
  const colMismatchCsv = `name,phone,pet_name,species\nAlice,0812345678,Milo,dog,extra_field_value`;
  const colPreview = await previewCustomerPetCsv(ownerA.client, shopAId, colMismatchCsv);
  check(
    colPreview.invalidRows === 1 &&
    colPreview.rowDetails.some((r) => r.errors.some((e) => e.includes("columns, expected"))),
    "Rejects row with mismatched column count"
  );

  const impossibleDatePreview = await previewCustomerPetCsv(
    ownerA.client,
    shopAId,
    `name,phone,pet_name,species,birth_date\nAlice,0811112233,Milo,dog,2023-02-30`
  );
  check(impossibleDatePreview.invalidRows === 1, "Preview rejects impossible calendar date");

  const malformedWeightPreview = await previewCustomerPetCsv(
    ownerA.client,
    shopAId,
    `name,phone,pet_name,species,weight_kg\nAlice,0811112244,Milo,dog,12kg`
  );
  check(malformedWeightPreview.invalidRows === 1, "Preview rejects malformed numeric pet weight");

  // 5. Customer Identity Conflict Tests (Finding 3)
  console.log("\n5. Testing Ambiguous Customer Identity Conflict Handling...");

  // Seed existing customer: "Somchai" with phone "0812345678"
  const { error: seedCustErr } = await ownerA.client.rpc("create_pet_owner", {
    p_first_name: "Somchai",
    p_last_name: "Jaidee",
    p_phone: "0812345678",
    p_emergency_phone: null,
    p_address: null,
  });
  if (seedCustErr) throw new Error(`Seed customer failed: ${seedCustErr.message}`);

  // 5.1 Same phone + same name = valid existing match
  const matchSameNameCsv = `customer_name,phone,pet_name,species\nSomchai,0812345678,Milo,dog`;
  const previewSameName = await previewCustomerPetCsv(ownerA.client, shopAId, matchSameNameCsv);
  check(
    previewSameName.validRows === 1 &&
    previewSameName.identityConflicts === 0 &&
    !previewSameName.rowDetails[0].isCustomerNew,
    "Same phone + matching name resolves cleanly as existing customer"
  );

  // 5.2 Same phone + different name = IDENTITY CONFLICT (reject auto-merge)
  const conflictNameCsv = `customer_name,phone,pet_name,species\nBob,0812345678,Lucky,dog`;
  const previewConflict = await previewCustomerPetCsv(ownerA.client, shopAId, conflictNameCsv);
  check(
    previewConflict.identityConflicts === 1 &&
    previewConflict.invalidRows === 1 &&
    previewConflict.rowDetails[0].isIdentityConflict &&
    previewConflict.rowDetails[0].errors.some((e) => e.includes("Identity Conflict")),
    "Same phone + conflicting name flags IDENTITY CONFLICT and marks row invalid"
  );

  // 5.3 Attempting import with identity conflict is rejected with zero writes
  const conflictExec = await executeCustomerPetImport(ownerA.client, shopAId, previewConflict);
  check(
    !conflictExec.success && conflictExec.createdCustomers === 0 && conflictExec.createdPets === 0,
    "Import execution is blocked when preview contains identity conflicts (zero writes)"
  );

  // 5.4 Conflicting names for same phone within the same CSV
  const multiConflictCsv = `customer_name,phone,pet_name,species\nUserOne,0899991111,PetA,dog\nUserTwo,0899991111,PetB,cat`;
  const previewMultiConflict = await previewCustomerPetCsv(ownerA.client, shopAId, multiConflictCsv);
  check(
    previewMultiConflict.identityConflicts >= 1 &&
    previewMultiConflict.rowDetails.some((r) => r.isIdentityConflict),
    "Conflicting names for same phone in same CSV detected as ambiguous conflict"
  );

  // 6. Authoritative Atomic Import & Idempotency / Retry (Finding 5)
  console.log("\n6. Testing Atomic Import & Idempotent Retry...");

  const validCsv = `customer_name,last_name,phone,emergency_phone,pet_name,species,breed,gender,birth_date,weight_kg,special_care_notes,allergies,custom_tag
Wichai,Srisuk,0891234567,0897654321,Luna,cat,Persian,female,2022-01-10,3.5,Needs brushed daily,None,VIP
Wichai,Srisuk,0891234567,,Kuro,cat,Domestic,neutered_male,2021-06-15,4.2,,Fish allergy,
Somchai,,0812345678,,Buster,dog,Golden Retriever,male,2020-03-01,28.0,High energy,,
`;

  const validPreview = await previewCustomerPetCsv(ownerA.client, shopAId, validCsv);
  check(validPreview.validRows === 3, "Valid CSV parsed 3 valid rows");
  check(validPreview.identityConflicts === 0, "Zero identity conflicts in valid preview");
  check(validPreview.newCustomers === 1, "Detected 1 new customer (Wichai)");
  check(validPreview.existingCustomers === 1, "Detected 1 matched customer (Somchai)");
  check(validPreview.newPets === 3, "Detected 3 new pets (Luna, Kuro, Buster)");

  // Execute atomic import
  const importResult = await executeCustomerPetImport(ownerA.client, shopAId, validPreview);
  check(importResult.success === true, "Atomic import succeeded");
  check(importResult.createdCustomers === 1, "Created 1 customer record (Wichai)");
  check(importResult.createdPets === 3, "Created 3 pet records");
  check(Boolean(importResult.batchId), "Atomic import returned persistent batch ID");

  // Verify audit batch in database
  const { data: batchRecord } = await admin
    .from("import_batches")
    .select("status,total_rows,created_customers,created_pets,skipped_duplicates")
    .eq("id", importResult.batchId!)
    .single();
  check(
    batchRecord?.status === "completed" &&
    batchRecord?.total_rows === 3 &&
    batchRecord?.created_customers === 1 &&
    batchRecord?.created_pets === 3,
    "Audit batch persisted in import_batches table with status 'completed' and total_rows = 3 (source CSV rows count)"
  );

  // 6.2 Idempotent retry with the exact same CSV
  const retryPreview = await previewCustomerPetCsv(ownerA.client, shopAId, validCsv);
  check(retryPreview.newCustomers === 0, "Retry detects 0 new customers");
  check(retryPreview.newPets === 0, "Retry detects 0 new pets");
  check(retryPreview.duplicatePets === 3, "Retry flags all 3 pets as duplicate skips");

  const retryExec = await executeCustomerPetImport(ownerA.client, shopAId, retryPreview);
  check(retryExec.success === true, "Retry import succeeds idempotently");
  check(retryExec.createdCustomers === 0, "Retry creates 0 new customers");
  check(retryExec.createdPets === 0, "Retry creates 0 new pets");
  check(retryExec.skippedDuplicates === 3, "Retry safely skips 3 duplicate pets without error");

  // 6.3 Authoritative Audit total_rows & Anti-Forgery Security Tests
  console.log("\n6.3 Testing Authoritative total_rows & Anti-Forgery Boundary in Import RPC...");

  // Probe 1: Attempting to pass forged metadata parameter (e.g. p_source_row_count = 999999)
  const { error: forgeParamErr } = await ownerA.client.rpc(
    "import_customers_and_pets_atomic",
    {
      p_records: [
        {
          row_number: 1,
          customer: { firstName: "Probe", phone: "0897778899" },
          pet: { name: "ProbePet", species: "dog" },
        },
      ],
      p_source_row_count: 999999,
    } as unknown as { p_records: unknown }
  );
  check(
    Boolean(forgeParamErr),
    "Authenticated caller attempting forged parameter (p_source_row_count: 999999) is rejected at schema/signature boundary"
  );

  // Probe 2: 1-record payload authoritatively derives total_rows = 1 in database
  const { data: singleResult, error: singleErr } = await ownerA.client.rpc(
    "import_customers_and_pets_atomic",
    {
      p_records: [
        {
          row_number: 1,
          customer: { firstName: "Kla", lastName: "Charoen", phone: "0890001122" },
          pet: { name: "Mimi", species: "cat" },
        },
      ],
    }
  );
  check(!singleErr && Boolean(singleResult), "Single valid source row imports successfully via RPC");
  const singleBatchId = (singleResult as { batch_id: string })?.batch_id;
  const { data: singleBatch } = await admin
    .from("import_batches")
    .select("total_rows,created_customers,created_pets")
    .eq("id", singleBatchId)
    .single();
  check(
    singleBatch?.total_rows === 1 && singleBatch?.created_customers === 1 && singleBatch?.created_pets === 1,
    "Authoritative audit record stores exactly total_rows = 1 derived from payload array length"
  );

  // Probe 3: Empty records array is rejected
  const { error: emptyArrErr } = await ownerA.client.rpc(
    "import_customers_and_pets_atomic",
    { p_records: [] }
  );
  check(Boolean(emptyArrErr), "RPC strictly rejects empty records array");

  // Probe 4: Malformed payload / invalid species rolls back 100% of mutations
  const initialBatchCount = (await admin.from("import_batches").select("id", { count: "exact", head: true })).count;
  const { error: malformedErr } = await ownerA.client.rpc(
    "import_customers_and_pets_atomic",
    {
      p_records: [
        {
          row_number: 1,
          customer: { firstName: "BadOwner", phone: "0893334455" },
          pet: { name: "Foxy", species: "unsupported_fox" },
        },
      ],
    }
  );
  check(Boolean(malformedErr), "RPC strictly rejects row with unsupported species");

  // Verify zero database writes on failure
  const { data: badOwnerCheck } = await admin
    .from("pet_owners")
    .select("id")
    .eq("shop_id", shopAId)
    .eq("phone", "0893334455");
  check(badOwnerCheck?.length === 0, "Zero customer records created on failed atomic import");

  const { data: badPetCheck } = await admin
    .from("pets")
    .select("id")
    .eq("shop_id", shopAId)
    .eq("name", "Foxy");
  check(badPetCheck?.length === 0, "Zero pet records created on failed atomic import");

  const finalBatchCount = (await admin.from("import_batches").select("id", { count: "exact", head: true })).count;
  check(
    initialBatchCount === finalBatchCount,
    "No forged import_batches audit record created on failed atomic import"
  );

  // Probe 5: Authoritative RPC enforces the same 2,000 source-row ceiling as CSV parsing.
  const overLimitRecords = Array.from({ length: 2001 }, (_, index) => ({
    row_number: index + 1,
    customer: { firstName: "OverLimit", phone: "0895556677" },
    pet: null,
  }));
  const { error: overLimitRpcErr } = await ownerA.client.rpc("import_customers_and_pets_atomic", {
    p_records: overLimitRecords,
  });
  check(
    Boolean(overLimitRpcErr?.message.includes("IMPORT_ROW_LIMIT_EXCEEDED")),
    "Direct RPC rejects > 2000 source rows before any writes"
  );
  const { data: overLimitOwner } = await admin.from("pet_owners").select("id").eq("shop_id", shopAId).eq("phone", "0895556677");
  check(overLimitOwner?.length === 0, "Row-limit rejection creates zero customer records");

  // Probe 6: Direct RPC cannot bypass normalized phone validation.
  const { error: invalidPhoneRpcErr } = await ownerA.client.rpc("import_customers_and_pets_atomic", {
    p_records: [{ row_number: 1, customer: { firstName: "BadPhone", phone: "12345" }, pet: null }],
  });
  check(Boolean(invalidPhoneRpcErr), "Direct RPC rejects invalid customer phone format");
  const { data: invalidPhoneOwner } = await admin.from("pet_owners").select("id").eq("shop_id", shopAId).eq("phone", "12345");
  check(invalidPhoneOwner?.length === 0, "Invalid phone rejection creates zero customer records");

  // Probe 7: Negative pet weight fails atomically after owner resolution/creation.
  const { error: negativeWeightRpcErr } = await ownerA.client.rpc("import_customers_and_pets_atomic", {
    p_records: [{ row_number: 1, customer: { firstName: "BadWeight", phone: "0895556688" }, pet: { name: "Heavy", species: "dog", weightKg: -1 } }],
  });
  check(Boolean(negativeWeightRpcErr), "Direct RPC rejects negative pet weight");
  const { data: negativeWeightOwner } = await admin.from("pet_owners").select("id").eq("shop_id", shopAId).eq("phone", "0895556688");
  check(negativeWeightOwner?.length === 0, "Negative weight rejection rolls back customer creation");

  // Probe 8: A malformed pet object cannot be silently treated as customer-only import.
  const { error: missingPetNameErr } = await ownerA.client.rpc("import_customers_and_pets_atomic", {
    p_records: [{ row_number: 1, customer: { firstName: "MissingPetName", phone: "0895556699" }, pet: { species: "cat" } }],
  });
  check(Boolean(missingPetNameErr), "Direct RPC rejects pet object with missing name");
  const { data: missingPetNameOwner } = await admin.from("pet_owners").select("id").eq("shop_id", shopAId).eq("phone", "0895556699");
  check(missingPetNameOwner?.length === 0, "Malformed pet rejection rolls back customer creation");

  const { error: malformedNumericErr } = await ownerA.client.rpc("import_customers_and_pets_atomic", {
    p_records: [{ row_number: 1, customer: { firstName: "BadNumeric", phone: "0895556700" }, pet: { name: "Pet", species: "dog", weightKg: "12kg" } }],
  });
  check(Boolean(malformedNumericErr), "Direct RPC rejects malformed numeric pet weight");
  const { data: malformedNumericOwner } = await admin.from("pet_owners").select("id").eq("shop_id", shopAId).eq("phone", "0895556700");
  check(malformedNumericOwner?.length === 0, "Malformed numeric rejection rolls back customer creation");

  const { error: malformedDateErr } = await ownerA.client.rpc("import_customers_and_pets_atomic", {
    p_records: [{ row_number: 1, customer: { firstName: "BadDate", phone: "0895556701" }, pet: { name: "Pet", species: "cat", birthDate: "2023-02-30" } }],
  });
  check(Boolean(malformedDateErr), "Direct RPC rejects impossible pet birth date");
  const { data: malformedDateOwner } = await admin.from("pet_owners").select("id").eq("shop_id", shopAId).eq("phone", "0895556701");
  check(malformedDateOwner?.length === 0, "Impossible date rejection rolls back customer creation");

  const postBoundaryBatchCount = (await admin.from("import_batches").select("id", { count: "exact", head: true })).count;
  check(finalBatchCount === postBoundaryBatchCount, "All rejected direct-RPC boundary probes create zero audit batches");

  console.log("\n7. Testing Room Setup & Role Authorization Boundaries...");
  const { data: room1Id, error: r1Err } = await ownerA.client.rpc("create_room", {
    p_room_number: "VIP-101",
    p_room_type: "vip",
    p_capacity_pets: 2,
    p_base_price_per_night: 800,
  });
  check(!r1Err && Boolean(room1Id), "Owner can create room");

  const { data: room2Id, error: r2Err } = await managerA.client.rpc("create_room", {
    p_room_number: "VIP-102",
    p_room_type: "standard",
    p_capacity_pets: 1,
    p_base_price_per_night: 500,
  });
  check(!r2Err && Boolean(room2Id), "Manager can create room");

  const { error: r3Err } = await staffA.client.rpc("create_room", {
    p_room_number: "VIP-103",
    p_room_type: "deluxe",
    p_capacity_pets: 2,
    p_base_price_per_night: 600,
  });
  check(Boolean(r3Err), "Staff member is rejected from creating rooms");

  // 8. Operational Integration Readiness Tests (Finding 1 & 6)
  console.log("\n8. Testing Operational Integration Readiness & Invariants...");

  // 8.1 Negative Test: Missing LINE Token or Google Sheet configuration blocks PILOT READY
  delete process.env.LINE_CHANNEL_ACCESS_TOKENS_JSON;
  delete process.env.GOOGLE_SERVICE_ACCOUNT_JSON;

  const negativeReadinessA = await evaluatePilotReadiness(ownerA.client);
  check(
    negativeReadinessA.isPilotReady === false,
    "Shop with LINE OA configured but missing server LINE token is BLOCKED (isPilotReady = false)"
  );
  check(
    negativeReadinessA.blockingIssues.some((issue) => issue.includes("LINE Official Account")),
    "Blocking issues explicitly include LINE OA token prerequisite"
  );
  check(
    negativeReadinessA.blockingIssues.some((issue) => issue.includes("Google Sheets Sync")),
    "Blocking issues explicitly include Google Sheets prerequisite"
  );

  // 8.2 Positive Test: Fully operationally configured shop achieves PILOT READY
  process.env.LINE_DISPATCH_SECRET = "test-line-dispatch-secret";
  process.env.LINE_CHANNEL_ACCESS_TOKENS_JSON = JSON.stringify({
    [shopAId]: "test-line-channel-token-shop-a",
  });
  process.env.GOOGLE_SYNC_DISPATCH_SECRET = "test-google-sync-secret";
  process.env.GOOGLE_SERVICE_ACCOUNT_JSON = JSON.stringify({
    client_email: "pawspace-pilot@pawspace-test.iam.gserviceaccount.com",
    private_key: "-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQD\n-----END PRIVATE KEY-----",
  });

  // Bind Google Sheet to Tenant A with unique sheet ID
  const testSheetId = `1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2_${runId}`;
  const { error: updateSheetErr } = await admin
    .from("shops")
    .update({ google_sheet_id: testSheetId })
    .eq("id", shopAId);
  if (updateSheetErr) throw new Error(`Update sheet error: ${updateSheetErr.message}`);

  const readyA = await evaluatePilotReadiness(ownerA.client);
  if (readyA.blockingIssues.length > 0) {
    console.log("readyA blocking issues:", readyA.blockingIssues);
    console.log("readyA items:", readyA.items.map(i => ({ id: i.id, isReady: i.isReady, current: i.currentValue })));
  }
  check(readyA.isPilotReady === true, "Fully configured shop evaluates as TECHNICAL PILOT READY (isPilotReady = true)");
  check(readyA.readinessPercentage === 100, "Readiness percentage is 100% when all critical integrations are ready");
  check(readyA.criticalPassed === readyA.criticalTotal, "Passed all 7/7 critical readiness items");
  check(readyA.blockingIssues.length === 0, "Zero blocking issues when operationally ready");

  // Verify secret safety: readiness items do not expose secrets
  const allCurrentValues = JSON.stringify(readyA.items.map((i) => i.currentValue));
  check(
    !allCurrentValues.includes("Bearer") &&
    !allCurrentValues.includes("test-line-channel-token-shop-a") &&
    !allCurrentValues.includes("PRIVATE KEY"),
    "Readiness evaluation contains zero raw tokens or private keys"
  );

  // 8.3 Cross-Tenant Isolation: Tenant B has 0 rooms, no sheet, no LINE token in JSON
  const readinessB = await evaluatePilotReadiness(ownerB.client);
  check(readinessB.isPilotReady === false, "Tenant B evaluated as NOT READY");
  check(
    readinessB.blockingIssues.some((issue) => issue.includes("Room Inventory Ready")),
    "Tenant B explicitly flags missing room inventory as blocking issue"
  );
  check(
    readinessB.blockingIssues.some((issue) => issue.includes("LINE Official Account")),
    "Tenant B does not inherit Tenant A LINE token (tenant isolation in readiness check)"
  );
  check(
    readyA.shopId !== readinessB.shopId && readyA.shopId === shopAId,
    "Tenant B resources never satisfy Tenant A readiness"
  );

  // --- SUMMARY ---
  console.log(`\n========================================`);
  console.log(`Phase 12 Tests Complete: ${passed} passed, ${failed} failed.`);
  console.log(`========================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

run().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
