# SELLSCOPE – AI-Based Sales Forecasting System

Full-stack **Next.js** app for local retailers: enter sales (manual, CSV, or Excel), clean data, run **mock** multi-model forecasts (ARIMA, Random Forest, XGBoost, LSTM), compare **MAE/RMSE**, view charts, and get **restock suggestions**.

## Tech stack

- **Next.js** (App Router) + **React** + **TypeScript**
- **Tailwind CSS** for UI
- **Recharts** for charts
- **API route** `POST /api/forecast` for forecasting (no separate backend required)
- **Papa Parse** (CSV) and **SheetJS** (`xlsx`) for file parsing in the browser

Forecasting uses a **deterministic mock engine** (not real Python ML) so the project runs entirely on Node/Vercel. You can later swap the API implementation for a Python microservice.

## Run locally

```bash
cd sellscope
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Pages

- **`/`** – Landing: demo charts + file upload & inline forecasting results
- **`/dashboard`** – Data input, preview, analytics, insights, restock

## Sample data

Use `public/sample-sales.csv` from the project root in dev:  
`http://localhost:3000/sample-sales.csv` — download and upload on the Dashboard.

## Deploy on Vercel

1. Push the `sellscope` folder to GitHub/GitLab/Bitbucket.
2. Import the repo in [Vercel](https://vercel.com): framework **Next.js**, root directory **`sellscope`** (if the repo root is `PBL2`, set subdirectory to `sellscope`).
3. Build: `npm run build`, output: Next default.

No extra environment variables are required for the mock API.

## Project layout

- `src/app` – routes and `api/forecast`
- `src/components` – UI and charts
- `src/lib` – cleaning, parsing, forecast engine, column detection/mapping
