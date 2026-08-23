export type SheetScalar = string | number | boolean | null;

export const CUSTOMER_SHEET_NAME = "Customers";
export const BOOKING_SHEET_NAME = "Bookings";

export const CUSTOMER_HEADERS = [
  "Record_ID", "Pet_Name", "Species", "Breed", "Gender", "Birth_Date", "Weight_kg",
  "Avatar_URL", "Special_Care_Notes", "Allergies", "Owner_ID", "Owner_First_Name",
  "Owner_Last_Name", "Owner_Phone", "Owner_Emergency_Phone", "Owner_Address", "Created_At",
] as const;

export const BOOKING_HEADERS = [
  "Record_ID", "Owner_ID", "Owner_Name", "Room_ID", "Room_Number", "Room_Type",
  "Check_In_Date", "Check_Out_Date", "Booking_Status", "Total_Amount", "Special_Requests",
  "Pet_IDs", "Pet_Names", "Created_At",
] as const;

export type PetCustomerRecord = {
  petId: string; petName: string; species: string; breed: string | null; gender: string | null;
  birthDate: string | null; weightKg: number | null; avatarUrl: string | null;
  specialCareNotes: string | null; allergies: string | null; ownerId: string;
  ownerFirstName: string; ownerLastName: string | null; ownerPhone: string;
  ownerEmergencyPhone: string | null; ownerAddress: string | null; createdAt: string | null;
};

export type BookingSheetRecord = {
  bookingId: string; ownerId: string; ownerName: string; roomId: string;
  roomNumber: string; roomType: string; checkInDate: string; checkOutDate: string;
  bookingStatus: string; totalAmount: number; specialRequests: string | null;
  petIds: string[]; petNames: string[]; createdAt: string | null;
};

// Google Sheets (and Excel) treat a leading =, +, -, or @ as the start of a formula.
// Tenant-supplied text (typed or CSV-imported) must never reach the sheet unescaped,
// or a crafted pet/customer field becomes a live formula when the shop owner opens it.
function escapeSheetFormula(value: string): string {
  return /^[=+\-@]/.test(value) ? `'${value}` : value;
}

function cell(value: SheetScalar | undefined): string | number | boolean {
  if (value === null || value === undefined) return "";
  return typeof value === "string" ? escapeSheetFormula(value) : value;
}

export function buildCustomerRow(record: PetCustomerRecord): Array<string | number | boolean> {
  return [
    cell(record.petId), cell(record.petName), cell(record.species), cell(record.breed), cell(record.gender),
    cell(record.birthDate), cell(record.weightKg), cell(record.avatarUrl), cell(record.specialCareNotes),
    cell(record.allergies), cell(record.ownerId), cell(record.ownerFirstName), cell(record.ownerLastName),
    cell(record.ownerPhone), cell(record.ownerEmergencyPhone), cell(record.ownerAddress), cell(record.createdAt),
  ];
}

export function buildBookingRow(record: BookingSheetRecord): Array<string | number | boolean> {
  return [
    cell(record.bookingId), cell(record.ownerId), cell(record.ownerName), cell(record.roomId), cell(record.roomNumber),
    cell(record.roomType), cell(record.checkInDate), cell(record.checkOutDate), cell(record.bookingStatus),
    record.totalAmount, cell(record.specialRequests), cell(record.petIds.join(",")),
    cell(record.petNames.join(",")), cell(record.createdAt),
  ];
}

export function columnName(columnCount: number): string {
  if (!Number.isInteger(columnCount) || columnCount < 1) throw new Error("INVALID_COLUMN_COUNT");
  let n = columnCount;
  let result = "";
  while (n > 0) {
    n -= 1;
    result = String.fromCharCode(65 + (n % 26)) + result;
    n = Math.floor(n / 26);
  }
  return result;
}

export function rowsEqual(actual: unknown[], expected: readonly string[]): boolean {
  if (actual.length !== expected.length) return false;
  return expected.every((value, index) => String(actual[index] ?? "") === value);
}

export async function hashSheetRow(row: Array<string | number | boolean>): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(row));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (value) => value.toString(16).padStart(2, "0")).join("");
}
