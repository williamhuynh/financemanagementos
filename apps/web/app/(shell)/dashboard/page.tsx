import { Card, DonutChart, Hero, SectionHead, TrendChart, WaterfallChart } from "@financelab/ui";
import { getStatCards } from "../../../lib/data";

export default async function DashboardPage() {
  const statCards = await getStatCards();

  return (
    <>
      <SectionHead
        eyebrow="Dashboard"
        title="Household Overview"
        breadcrumbs={[
          { label: "Home", href: "/dashboard" },
          { label: "Overview" }
        ]}
        actions={
          <>
            <button className="pill" type="button">
              Snapshot
            </button>
            <button className="pill" type="button">
              Add note
            </button>
          </>
        }
      />
      <Hero />
      <div className="grid cards">
        {statCards.map((card, index) => (
          <Card
            key={card.title}
            title={card.title}
            value={card.value}
            sub={card.sub}
            tone={card.tone as "glow" | "negative"}
            className={`card-${index}`}
          />
        ))}
      </div>
      <div className="grid charts">
        <DonutChart
          title="Spend by Category"
          segmentClasses={["seg-a", "seg-b", "seg-c"]}
          legend={[
            { label: "Housing 14%", dot: "a" },
            { label: "Transport 30%", dot: "b" },
            { label: "Groceries 4%", dot: "c" },
            { label: "Other 52%", dot: "d" }
          ]}
        />
        <DonutChart
          title="Portfolio Split"
          segmentClasses={["seg-e", "seg-f", "seg-g"]}
          legend={[
            { label: "High growth 43%", dot: "e" },
            { label: "Property 30%", dot: "f" },
            { label: "Cash 8%", dot: "g" }
          ]}
        />
        <TrendChart />
        <WaterfallChart />
      </div>
    </>
  );
}
