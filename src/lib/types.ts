export type SalesRow = {
  product: string;
  date: string;
  quantity: number;
  sales: number;
};

export type ModelId = "arima" | "random_forest" | "xgboost" | "lstm";

export type ModelMetrics = {
  id: ModelId;
  name: string;
  mae: number;
  rmse: number;
};

export type ForecastPoint = {
  date: string;
  actual?: number;
  predicted?: number;
};

export type ProductDemandPoint = {
  product: string;
  quantity: number;
};

export type RestockSuggestion = {
  product: string;
  reason: string;
  suggestedUnits: number;
  priority: "high" | "medium" | "low";
};

export type ForecastResponse = {
  bestModel: ModelId;
  models: ModelMetrics[];
  forecastVsActual: ForecastPoint[];
  futureForecast: { date: string; quantity: number }[];
  salesTrend: {
    date: string;
    actualQuantity: number;
    predictedQuantity: number;
    sales: number;
  }[];
  productDemand: ProductDemandPoint[];
  overstockUnderstock: { label: string; value: number }[];
  restock: RestockSuggestion[];
  period: "weekly" | "monthly";
};
