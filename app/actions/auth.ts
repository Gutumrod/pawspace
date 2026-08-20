"use server";

import { loginWithPassword, logout, getCurrentSession, type AuthResult } from "@/lib/auth";
import { getCurrentStaffContext, type StaffContext } from "@/lib/tenant-context";

export async function loginAction(
  formDataOrPayload: FormData | { email: string; password: string }
): Promise<AuthResult> {
  let email = "";
  let password = "";

  if (formDataOrPayload instanceof FormData) {
    email = (formDataOrPayload.get("email") as string) || "";
    password = (formDataOrPayload.get("password") as string) || "";
  } else {
    email = formDataOrPayload.email || "";
    password = formDataOrPayload.password || "";
  }

  return loginWithPassword(email, password);
}

export async function logoutAction(): Promise<{ success: boolean; error?: string }> {
  return logout();
}

export async function getSessionAction() {
  return getCurrentSession();
}

export async function getCurrentStaffAction(): Promise<StaffContext | null> {
  return getCurrentStaffContext();
}
