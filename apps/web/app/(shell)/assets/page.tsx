import { Card, SectionHead } from "@financelab/ui";
import { getAssetCards } from "../../../lib/data";

export default async function AssetsPage() {
  const assetCards = await getAssetCards();

  return (
    <>
      <SectionHead
        eyebrow="Assets"
        title="Portfolio Snapshot"
        breadcrumbs={[
          { label: "Home", href: "/dashboard" },
          { label: "Assets" }
        ]}
        actions={
          <>
            <button className="pill" type="button">
              Update values
            </button>
            <button className="pill" type="button">
              Add asset
            </button>
          </>
        }
      />
      <div className="grid cards">
        {assetCards.map((card) => (
          <Card key={card.title} title={card.title} value={card.value} sub={card.sub} tone="glow" />
        ))}
      </div>
    </>
  );
}
