import {
  Card,
  DonutChart,
  Hero,
  ListRow,
  ReviewCard,
  SectionHead,
  TrendChart,
  WaterfallChart
} from "@financelab/ui";

const sampleRow = {
  title: "City Edge Surrey Hills",
  sub: "23 Aug 2024 - Credit - Westpac",
  category: "Food",
  amount: "-$15.15",
  tone: "negative" as const
};

const reviewSample = {
  title: "Amber Electric",
  sub: "11 Jul 2024 - Savings - Westpac Offset",
  amount: "-$150.61",
  actions: ["Utilities", "Mark transfer", "Split"]
};

export default function UiShowcasePage() {
  return (
    <>
      <SectionHead
        eyebrow="Design System"
        title="UI Showcase"
        breadcrumbs={[
          { label: "Home", href: "/dashboard" },
          { label: "UI Showcase" }
        ]}
        actions={
          <>
            <button className="pill" type="button">
              Copy tokens
            </button>
            <button className="pill" type="button">
              Export kit
            </button>
          </>
        }
      />
      <Hero />
      <div className="grid cards">
        <Card title="Primary Card" value="$72,279" sub="+1.1% MoM" tone="glow" />
        <Card title="Neutral Card" value="$548,194" sub="Stable" />
        <Card title="Negative Card" value="$1,786,974" sub="Liabilities" tone="negative" />
      </div>
      <div className="grid charts">
        <DonutChart
          title="Spend Mix"
          segmentClasses={["seg-a", "seg-b", "seg-c"]}
          legend={[
            { label: "Housing 14%", dot: "a" },
            { label: "Transport 30%", dot: "b" },
            { label: "Groceries 4%", dot: "c" },
            { label: "Other 52%", dot: "d" }
          ]}
        />
        <TrendChart />
        <WaterfallChart />
      </div>
      <div className="review-grid">
        <ListRow
          title={sampleRow.title}
          sub={sampleRow.sub}
          category={sampleRow.category}
          amount={sampleRow.amount}
          tone={sampleRow.tone}
        />
        <ReviewCard {...reviewSample} />
      </div>
    </>
  );
}
