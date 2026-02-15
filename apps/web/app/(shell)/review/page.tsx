import { SectionHead } from "@tandemly/ui";
import { redirect } from "next/navigation";
import ReviewClient from "./ReviewClient";
import ReviewFilters from "./ReviewFilters";
import TransferMatchClient from "./TransferMatchClient";
import {
  getCategories,
  getReviewItems,
  type ReviewFilterParams
} from "../../../lib/data";
import { getApiContext } from "../../../lib/api-auth";
import { getWorkspaceById } from "../../../lib/workspace-service";

type ReviewSearchParams = {
  account?: string;
  month?: string;
  sort?: string;
};

type ReviewPageProps = {
  searchParams?: Promise<ReviewSearchParams>;
};

export default async function ReviewPage({ searchParams }: ReviewPageProps) {
  // Authenticate and get workspace context
  const context = await getApiContext();
  if (!context) {
    redirect("/login");
  }

  const resolvedSearchParams = await searchParams;
  const workspace = await getWorkspaceById(context.workspaceId);
  const homeCurrency = workspace?.currency ?? "AUD";

  // Fetch review items and categories in parallel
  const [reviewItems, categories] = await Promise.all([
    getReviewItems(context.workspaceId, {
      account: resolvedSearchParams?.account,
      month: resolvedSearchParams?.month,
      sort: resolvedSearchParams?.sort as ReviewFilterParams["sort"]
    }),
    getCategories(context.workspaceId),
  ]);

  return (
    <>
      <SectionHead
        title="Unresolved Items"
        actions={<ReviewFilters />}
      />
      <div className="review-stack">
        <ReviewClient items={reviewItems} categories={categories} />
        <TransferMatchClient homeCurrency={homeCurrency} />
      </div>
    </>
  );
}
