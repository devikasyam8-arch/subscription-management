# Subscription Management System

A standalone React frontend and Node.js API for managing subscription plans,
customer subscriptions, recurring invoices, and monthly recurring revenue.

## Requirements

- Node.js 20.19+ or 22.12+
- npm 10+

## Run locally

1. Install dependencies from the repository root:

   ```sh
   npm install
   ```

2. Start the frontend and backend:

   ```sh
   npm run dev
   ```

3. Open the frontend at [http://localhost:5173](http://localhost:5173).
   The API runs at [http://localhost:4000](http://localhost:4000).

The backend seeds a local `backend/data/store.json` on first run. This file is
git-ignored so application data stays on your machine. The initial demo data is
in `backend/data/seed.json`.

## Features

- Dashboard with active subscriptions, monthly recurring revenue, and plan
  performance
- Create and manage monthly or annual subscription plans
- Create subscriptions, activate or pause them, and search/filter customers
- Generate recurring invoices and track billing periods
- JSON-backed local persistence

To run the backend tests, use `npm test`. To create the production frontend
build, use `npm run build`.

The `subscription_management` directory also contains the earlier Odoo 18 addon.
