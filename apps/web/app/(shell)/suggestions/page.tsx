import { redirect } from "next/navigation";
import { SectionHead } from "@tandemly/ui";
import { getApiContext } from "../../../lib/api-auth";
import SuggestionsClient from "./SuggestionsClient";

export default async function SuggestionsPage() {
  const context = await getApiContext();
  if (!context) {
    redirect("/login");
  }

  return (
    <>
      <SectionHead title="Suggestions" />
      <SuggestionsClient userId={context.user.$id} />
    </>
  );
}
