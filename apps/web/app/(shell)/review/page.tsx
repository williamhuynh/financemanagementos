import { Card, SectionHead } from "@financelab/ui";
import ReviewClient from "./ReviewClient";
import ReviewFilters from "./ReviewFilters";
import TransferMatchClient from "./TransferMatchClient";
import {
  getCategories,
  getReviewItems,
  getTransferReviewData,
  type ReviewFilterParams
} from "../../../lib/data";

type ReviewSearchParams = {
  account?: string;
  month?: string;
  sort?: string;
};

type ReviewPageProps = {
  searchParams?: Promise<ReviewSearchParams>;
};

export default async function ReviewPage({ searchParams }: ReviewPageProps) {
  const resolvedSearchParams = await searchParams;
  const reviewItems = await getReviewItems({
    account: resolvedSearchParams?.account,
    month: resolvedSearchParams?.month,
    sort: resolvedSearchParams?.sort as ReviewFilterParams["sort"]
  });
  const categories = await getCategories();
  const transferReviewData = await getTransferReviewData();

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
        <Card title="Transfer Matches">
          <TransferMatchClient
            suggestions={transferReviewData.suggestions}
            unmatched={transferReviewData.unmatched}
            paired={transferReviewData.paired}
          />
        </Card>
      </div>
    </>
  );
}
