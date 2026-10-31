async function request(path, options = {}) {
  const response = await fetch(`/api${path}`, {
    ...options,
    headers: {
      ...(options.body ? { "content-type": "application/json" } : {}),
      ...options.headers,
    },
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error || `Request failed (${response.status}).`);
  }
  return payload;
}

export const api = {
  dashboard: () => request("/dashboard"),
  plans: () => request("/plans"),
  subscriptions: () => request("/subscriptions"),
  invoices: () => request("/invoices"),
  createPlan: (data) => request("/plans", {
    method: "POST",
    body: JSON.stringify(data),
  }),
  createSubscription: (data) => request("/subscriptions", {
    method: "POST",
    body: JSON.stringify(data),
  }),
  updateSubscriptionState: (id, state) => request(`/subscriptions/${id}/state`, {
    method: "PATCH",
    body: JSON.stringify({ state }),
  }),
  generateInvoice: (id) => request(`/subscriptions/${id}/invoices`, {
    method: "POST",
  }),
};
