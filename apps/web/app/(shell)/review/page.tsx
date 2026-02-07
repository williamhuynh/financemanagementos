import { SectionHead } from "@financelab/ui";
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
  const reviewItems = await getReviewItems(context.workspaceId, {
    account: resolvedSearchParams?.account,
    month: resolvedSearchParams?.month,
    sort: resolvedSearchParams?.sort as ReviewFilterParams["sort"]
  });
  const categories = await getCategories(context.workspaceId);

  return (
    <>
      <SectionHead
        eyebrow="Review Queue"
        title="Unresolved Items"
        breadcrumbs={[
          { label: "Home", href: "/dashboard" },
          { label: "Review Queue" }
        ]}
        actions={<ReviewFilters />}
      />
      <div className="review-stack">
        <ReviewClient items={reviewItems} categories={categories} />
        <TransferMatchClient />
      </div>
    </>
  );
}
