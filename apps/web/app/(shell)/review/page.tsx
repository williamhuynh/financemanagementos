import { SectionHead } from "@financelab/ui";
import ReviewClient from "./ReviewClient";
import { getCategories, getReviewItems } from "../../../lib/data";

export default async function ReviewPage() {
  const reviewItems = await getReviewItems();
  const categories = await getCategories();

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
      <ReviewClient items={reviewItems} categories={categories} />
    </>
  );
}
