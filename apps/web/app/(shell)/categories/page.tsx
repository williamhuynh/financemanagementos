import { redirect } from "next/navigation";
import { SectionHead } from "@tandemly/ui";
import { getApiContext } from "../../../lib/api-auth";
import { getWorkspaceById } from "../../../lib/workspace-service";
import CategoriesClient from "./CategoriesClient";

export default async function CategoriesPage() {
  const ctx = await getApiContext();

  if (!ctx) {
    redirect("/login");
  }

  const workspace = await getWorkspaceById(ctx.workspaceId);
  const homeCurrency = workspace?.currency ?? "AUD";

  return (
    <>
      <SectionHead title="Categories" />
      <CategoriesClient
        workspaceId={ctx.workspaceId}
        userRole={ctx.role}
        homeCurrency={homeCurrency}
      />
    </>
  );
}
