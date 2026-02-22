import { redirect } from "next/navigation";
import { SectionHead } from "@tandemly/ui";
import { getApiContext } from "../../../../lib/api-auth";
import BillingClient from "./BillingClient";

export default async function BillingPage() {
  const ctx = await getApiContext();
  if (!ctx) redirect("/login");

  return (
    <>
      <SectionHead title="Plan & Billing" />
      <BillingClient workspaceId={ctx.workspaceId} />
    </>
  );
}
