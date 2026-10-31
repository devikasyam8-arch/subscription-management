import express from "express";
import { randomUUID } from "node:crypto";
import { Store } from "./store.js";

const allowedStates = new Set(["draft", "active", "paused", "cancelled", "expired"]);

function isValidDate(value) {
  return typeof value === "string"
    && /^\d{4}-\d{2}-\d{2}$/.test(value)
    && !Number.isNaN(Date.parse(`${value}T00:00:00.000Z`))
    && new Date(`${value}T00:00:00.000Z`).toISOString().slice(0, 10) === value;
}

function dateAtUtcMidnight(value) {
  return new Date(`${value}T00:00:00.000Z`);
}

function formatDate(date) {
  return date.toISOString().slice(0, 10);
}

function addBillingPeriod(dateString, period, count) {
  const date = dateAtUtcMidnight(dateString);
  const day = date.getUTCDate();
  if (period === "year") {
    date.setUTCDate(1);
    date.setUTCFullYear(date.getUTCFullYear() + count);
    date.setUTCMonth(date.getUTCMonth());
  } else {
    date.setUTCDate(1);
    date.setUTCMonth(date.getUTCMonth() + count);
  }
  const lastDay = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0),
  ).getUTCDate();
  date.setUTCDate(Math.min(day, lastDay));
  return formatDate(date);
}

function subtractOneDay(dateString) {
  const date = dateAtUtcMidnight(dateString);
  date.setUTCDate(date.getUTCDate() - 1);
  return formatDate(date);
}

function monthlyRevenue(subscription, plan) {
  if (subscription.state !== "active") return 0;
  return plan.billing_period === "year"
    ? plan.price / (12 * plan.billing_period_count)
    : plan.price / plan.billing_period_count;
}

function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

export function createApp({ store = new Store() } = {}) {
  const app = express();
  app.use(express.json({ limit: "32kb" }));

  app.get("/api/health", (_request, response) => {
    response.json({ status: "ok" });
  });

  app.get("/api/plans", (_request, response) => {
    const { plans } = store.read();
    response.json(plans);
  });

  app.post("/api/plans", (request, response, next) => {
    try {
      const { name, description = "", price, billing_period, billing_period_count = 1 } =
        request.body ?? {};
      if (typeof name !== "string" || !name.trim()) {
        throw httpError(400, "A plan name is required.");
      }
      if (typeof price !== "number" || !Number.isFinite(price) || price < 0) {
        throw httpError(400, "Plan price must be a non-negative number.");
      }
      if (!["month", "year"].includes(billing_period)) {
        throw httpError(400, "Billing period must be month or year.");
      }
      if (!Number.isInteger(billing_period_count) || billing_period_count < 1) {
        throw httpError(400, "Billing period count must be a positive whole number.");
      }
      if (typeof description !== "string") {
        throw httpError(400, "Plan description must be text.");
      }

      const plan = {
        id: `plan-${randomUUID()}`,
        name: name.trim(),
        description: description.trim(),
        price,
        currency: "USD",
        billing_period,
        billing_period_count,
        active: true,
      };
      store.update((data) => data.plans.push(plan));
      response.status(201).json(plan);
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/subscriptions", (_request, response) => {
    const data = store.read();
    response.json(data.subscriptions.map((subscription) => ({
      ...subscription,
      plan: data.plans.find((plan) => plan.id === subscription.plan_id) ?? null,
    })));
  });

  app.post("/api/subscriptions", (request, response, next) => {
    try {
      const { customer, email, plan_id, date_start = formatDate(new Date()) } =
        request.body ?? {};
      if (typeof customer !== "string" || !customer.trim()) {
        throw httpError(400, "A customer name is required.");
      }
      if (
        typeof email !== "string"
        || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
      ) {
        throw httpError(400, "Enter a valid customer email address.");
      }
      if (!isValidDate(date_start)) {
        throw httpError(400, "Start date must be a valid YYYY-MM-DD date.");
      }

      const data = store.read();
      const plan = data.plans.find((item) => item.id === plan_id && item.active);
      if (!plan) throw httpError(400, "Choose an active subscription plan.");

      const subscription = {
        id: `sub-${randomUUID()}`,
        customer: customer.trim(),
        email: email.trim(),
        plan_id: plan.id,
        date_start,
        next_invoice_date: date_start,
        state: "draft",
        created_at: new Date().toISOString(),
      };
      store.update((current) => current.subscriptions.push(subscription));
      response.status(201).json({ ...subscription, plan });
    } catch (error) {
      next(error);
    }
  });

  app.patch("/api/subscriptions/:id/state", (request, response, next) => {
    try {
      const { state } = request.body ?? {};
      if (!allowedStates.has(state)) {
        throw httpError(400, "Choose a valid subscription status.");
      }
      let updated;
      store.update((data) => {
        const subscription = data.subscriptions.find(
          (item) => item.id === request.params.id,
        );
        if (!subscription) throw httpError(404, "Subscription not found.");
        const transitions = {
          draft: ["active", "cancelled"],
          active: ["paused", "cancelled"],
          paused: ["active", "cancelled"],
          cancelled: [],
          expired: [],
        };
        if (!transitions[subscription.state].includes(state)) {
          throw httpError(
            409,
            `A ${subscription.state} subscription cannot be changed to ${state}.`,
          );
        }
        subscription.state = state;
        updated = {
          ...subscription,
          plan: data.plans.find((plan) => plan.id === subscription.plan_id) ?? null,
        };
      });
      response.json(updated);
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/invoices", (_request, response) => {
    const { invoices } = store.read();
    response.json([...invoices].sort((a, b) => b.issue_date.localeCompare(a.issue_date)));
  });

  app.post("/api/subscriptions/:id/invoices", (request, response, next) => {
    try {
      let createdInvoice;
      store.update((data) => {
        const subscription = data.subscriptions.find(
          (item) => item.id === request.params.id,
        );
        if (!subscription) throw httpError(404, "Subscription not found.");
        if (subscription.state !== "active") {
          throw httpError(409, "Invoices can only be generated for active subscriptions.");
        }
        const plan = data.plans.find((item) => item.id === subscription.plan_id);
        if (!plan) throw httpError(409, "The subscription plan no longer exists.");

        const nextInvoiceDate = addBillingPeriod(
          subscription.next_invoice_date,
          plan.billing_period,
          plan.billing_period_count,
        );
        const periodEnd = subtractOneDay(nextInvoiceDate);
        const duplicate = data.invoices.some(
          (invoice) => invoice.subscription_id === subscription.id
            && invoice.period_start === subscription.next_invoice_date
            && invoice.period_end === periodEnd,
        );
        if (duplicate) {
          throw httpError(409, "An invoice already exists for this billing period.");
        }

        createdInvoice = {
          id: `INV-${randomUUID().slice(0, 8).toUpperCase()}`,
          subscription_id: subscription.id,
          customer: subscription.customer,
          plan: plan.name,
          amount: plan.price,
          currency: plan.currency,
          issue_date: subscription.next_invoice_date,
          period_start: subscription.next_invoice_date,
          period_end: periodEnd,
          status: "pending",
        };
        data.invoices.push(createdInvoice);
        subscription.next_invoice_date = nextInvoiceDate;
      });
      response.status(201).json(createdInvoice);
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/dashboard", (_request, response) => {
    const data = store.read();
    const activeSubscriptions = data.subscriptions.filter(
      (subscription) => subscription.state === "active",
    );
    const revenueByPlan = data.plans.map((plan) => ({
      plan_id: plan.id,
      plan_name: plan.name,
      currency: plan.currency,
      monthly_revenue: activeSubscriptions
        .filter((subscription) => subscription.plan_id === plan.id)
        .reduce((total, subscription) => total + monthlyRevenue(subscription, plan), 0),
      subscriber_count: activeSubscriptions.filter(
        (subscription) => subscription.plan_id === plan.id,
      ).length,
    }));
    const today = formatDate(new Date());
    response.json({
      monthly_recurring_revenue: revenueByPlan.reduce(
        (total, plan) => total + plan.monthly_revenue,
        0,
      ),
      active_subscriptions: activeSubscriptions.length,
      total_subscriptions: data.subscriptions.length,
      pending_invoices: data.invoices.filter(
        (invoice) => invoice.status === "pending",
      ).length,
      invoices_due: activeSubscriptions.filter(
        (subscription) => subscription.next_invoice_date <= today,
      ).length,
      revenue_by_plan: revenueByPlan,
      recent_subscriptions: [...data.subscriptions]
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
        .slice(0, 5)
        .map((subscription) => ({
          ...subscription,
          plan: data.plans.find((plan) => plan.id === subscription.plan_id) ?? null,
        })),
    });
  });

  app.use("/api", (_request, _response, next) => {
    next(httpError(404, "API endpoint not found."));
  });

  app.use((error, _request, response, _next) => {
    if (error instanceof SyntaxError && "body" in error) {
      return response.status(400).json({ error: "Request body must be valid JSON." });
    }
    const status = Number.isInteger(error.status) ? error.status : 500;
    if (status >= 500) console.error(error);
    return response.status(status).json({
      error: status >= 500 ? "An unexpected server error occurred." : error.message,
    });
  });

  return app;
}
