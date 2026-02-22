import { redirect } from "next/navigation";
import { SectionHead } from "@tandemly/ui";
import { getApiContext, createSessionClient } from "../../../lib/api-auth";
import { isSuperadmin } from "../../../lib/admin-guard";
import AdminClient from "./AdminClient";

export default async function AdminPage() {
  const ctx = await getApiContext();
  if (!ctx) redirect("/login");

  const session = await createSessionClient();
  if (!session) redirect("/login");

  const user = await session.account.get();
  if (!isSuperadmin(user.labels)) redirect("/dashboard");

  return (
    <>
      <SectionHead title="Admin — Workspaces" />
      <AdminClient />
    </>
  );
}
