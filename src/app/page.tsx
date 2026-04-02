import Link from "next/link";
import { LandingUploadClient } from "@/components/landing/LandingUploadClient";
import { demoSalesTrend, demoStockMix } from "@/lib/demo";
import { SalesTrendChart } from "@/components/charts/SalesTrendChart";
import { StockMixChart } from "@/components/charts/StockMixChart";
import { Card } from "@/components/ui/Card";

export default function HomePage() {
  return (
    <div className="space-y-10">
      <div className="max-w-2xl space-y-3">
        <p className="text-sm font-medium text-accent">Local retail forecasting</p>
        <h1 className="text-3xl font-semibold tracking-tight text-neutral-900 sm:text-4xl">
          SELLSCOPE
        </h1>
        <p className="text-muted-fg text-sm leading-relaxed">
          See demand before you stock. Fewer empty shelves and less cash tied up in slow movers.
        </p>
      </div>

      <div className="max-w-6xl">
        <LandingUploadClient />
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <Link
          href="/dashboard"
          className="inline-flex items-center justify-center rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-white hover:bg-teal-800"
        >
          Go to Dashboard
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Typical sales rhythm (demo: Actual vs AI prediction)">
          <SalesTrendChart data={demoSalesTrend} />
          <p className="mt-3 text-xs text-neutral-500">
            Sales move with seasons and promotions—guessing leads to waste or stockouts.
          </p>
        </Card>
        <Card title="Inventory posture (demo)">
          <StockMixChart data={demoStockMix} />
          <p className="mt-3 text-xs text-neutral-500">
            Many shops swing between too much and too little without a simple forecast view.
          </p>
        </Card>
      </div>
    </div>
  );
}
