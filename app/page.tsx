import { redirect } from "next/navigation";
import { getOperationsSnapshot } from "@/lib/operations-service";
import OperationsClient from "@/app/operations-client";

export const metadata = {
  title: "PawSpace — Operations",
  robots: { index: false, follow: false },
};

export default async function HomePage() {
  let snapshot;
  try {
    snapshot = await getOperationsSnapshot();
  } catch {
    redirect("/login?error=UnauthorizedOperationsAccess");
  }

  return <OperationsClient initial={snapshot} />;
}
