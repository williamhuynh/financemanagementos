import { Card, SectionHead } from "@financelab/ui";
import ReviewClient from "./ReviewClient";
import TransferMatchClient from "./TransferMatchClient";
import { getCategories, getReviewItems, getTransferReviewData } from "../../../lib/data";

export default async function ReviewPage() {
  const reviewItems = await getReviewItems();
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
        actions={
          <>
            <button className="pill active" type="button">
              Unknowns
            </button>
            <button className="pill" type="button">
              Transfers
            </button>
            <button className="pill" type="button">
              Duplicates
            </button>
          </>
        }
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
