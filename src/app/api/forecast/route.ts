import { NextResponse } from "next/server";
import { z } from "zod";
import { cleanSalesRows } from "@/lib/clean";
import { runForecastEngine } from "@/lib/forecast";

const bodySchema = z.object({
  rows: z.array(
    z.object({
      product: z.string().min(1),
      date: z.string(),
      quantity: z.number().nonnegative(),
      sales: z.number().nonnegative(),
    })
  ),
  period: z.enum(["weekly", "monthly"]).optional().default("weekly"),
});

export async function POST(req: Request) {
  try {
    const json = await req.json();
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request body", details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const rows = cleanSalesRows(parsed.data.rows);
    if (rows.length === 0) {
      return NextResponse.json(
        { error: "No valid rows after cleaning. Check product, date, quantity, and sales." },
        { status: 400 }
      );
    }
    const result = runForecastEngine(rows, parsed.data.period);
    return NextResponse.json(result);
  } catch {
    return NextResponse.json(
      { error: "Could not process forecast request." },
      { status: 500 }
    );
  }
}
