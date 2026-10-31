import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { createApp } from "../src/app.js";
import { Store } from "../src/store.js";

async function createTestServer(t) {
  const directory = mkdtempSync(path.join(tmpdir(), "subscriptions-"));
  const server = createApp({
    store: new Store(path.join(directory, "store.json")),
  }).listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  t.after(async () => {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
    rmSync(directory, { recursive: true, force: true });
  });
  return `http://127.0.0.1:${server.address().port}`;
}

test("health and dashboard return subscription metrics", async (t) => {
  const baseUrl = await createTestServer(t);
  const health = await fetch(`${baseUrl}/api/health`);
  assert.equal(health.status, 200);
  assert.deepEqual(await health.json(), { status: "ok" });

  const response = await fetch(`${baseUrl}/api/dashboard`);
  const dashboard = await response.json();
  assert.equal(response.status, 200);
  assert.equal(dashboard.active_subscriptions, 3);
  assert.equal(dashboard.total_subscriptions, 5);
  assert.equal(dashboard.monthly_recurring_revenue, 127.16666666666666);
});

test("creating and activating a subscription persists it", async (t) => {
  const baseUrl = await createTestServer(t);
  const createdResponse = await fetch(`${baseUrl}/api/subscriptions`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      customer: "Test Customer",
      email: "test@example.com",
      plan_id: "plan-starter",
      date_start: "2026-10-31",
    }),
  });
  assert.equal(createdResponse.status, 201);
  const created = await createdResponse.json();
  assert.equal(created.state, "draft");

  const activationResponse = await fetch(
    `${baseUrl}/api/subscriptions/${created.id}/state`,
    {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ state: "active" }),
    },
  );
  assert.equal(activationResponse.status, 200);

  const subscriptions = await fetch(`${baseUrl}/api/subscriptions`);
  assert.equal((await subscriptions.json()).length, 6);
});

test("invoice generation advances a monthly subscription and rejects duplicates", async (t) => {
  const baseUrl = await createTestServer(t);
  const activated = await fetch(`${baseUrl}/api/subscriptions/sub-1005/state`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ state: "active" }),
  });
  assert.equal(activated.status, 200);

  const invoiceResponse = await fetch(
    `${baseUrl}/api/subscriptions/sub-1005/invoices`,
    { method: "POST" },
  );
  assert.equal(invoiceResponse.status, 201);
  const invoice = await invoiceResponse.json();
  assert.equal(invoice.period_start, "2026-11-11");
  assert.equal(invoice.period_end, "2026-12-10");

  const subscriptions = await fetch(`${baseUrl}/api/subscriptions`);
  const updated = (await subscriptions.json()).find((item) => item.id === "sub-1005");
  assert.equal(updated.next_invoice_date, "2026-12-11");
});

test("invalid requests and invalid state transitions return clear errors", async (t) => {
  const baseUrl = await createTestServer(t);
  const invalidSubscription = await fetch(`${baseUrl}/api/subscriptions`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ customer: "", email: "nope", plan_id: "missing" }),
  });
  assert.equal(invalidSubscription.status, 400);
  assert.match((await invalidSubscription.json()).error, /customer name/i);

  const invalidTransition = await fetch(
    `${baseUrl}/api/subscriptions/sub-1003/state`,
    {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ state: "draft" }),
    },
  );
  assert.equal(invalidTransition.status, 409);
});
