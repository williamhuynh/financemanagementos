import { redirect } from "next/navigation";
import { SectionHead } from "@tandemly/ui";
import { getApiContext } from "../../../lib/api-auth";
import CategoriesClient from "./CategoriesClient";

export default async function CategoriesPage() {
  const ctx = await getApiContext();

  if (!ctx) {
    redirect("/login");
  }

  return (
    <>
      <SectionHead title="Categories" />
      <CategoriesClient
        workspaceId={ctx.workspaceId}
        userRole={ctx.role}
      />
    </>
  );
}
