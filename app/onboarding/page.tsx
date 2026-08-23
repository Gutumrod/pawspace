import { redirect } from "next/navigation";
import { requireManagerOrOwnerContext } from "@/lib/tenant-context";
import { evaluatePilotReadiness } from "@/lib/pilot-readiness-service";
import { getOperationsSnapshot } from "@/lib/operations-service";
import OnboardingClient from "./OnboardingClient";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "PawSpace — Pilot Onboarding & Closed Beta Readiness",
  robots: { index: false, follow: false },
};

export default async function OnboardingPage() {
  let staff;
  let operations;
  let readiness;

  try {
    const ctx = await requireManagerOrOwnerContext();
    staff = ctx.staff;
    [operations, readiness] = await Promise.all([
      getOperationsSnapshot(),
      evaluatePilotReadiness(ctx.client),
    ]);
  } catch (err) {
    console.error("OnboardingPage auth/load error:", err);
    redirect("/login?error=UnauthorizedOnboardingAccess");
  }

  return (
    <OnboardingClient
      initialStaff={staff}
      initialOperations={operations}
      initialReadiness={readiness}
    />
  );
}
