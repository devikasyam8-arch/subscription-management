import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowUpRight,
  Bell,
  Check,
  ChevronDown,
  CircleHelp,
  CreditCard,
  Download,
  FileText,
  Filter,
  LayoutDashboard,
  LoaderCircle,
  MoreHorizontal,
  Pause,
  Play,
  Plus,
  Search,
  Settings,
  Sparkles,
  Users,
  XCircle,
  X,
} from "lucide-react";
import { api } from "./api.js";

const navigation = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "subscriptions", label: "Subscriptions", icon: Users },
  { id: "plans", label: "Plans", icon: CreditCard },
  { id: "invoices", label: "Invoices", icon: FileText },
];

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

const today = new Date().toISOString().slice(0, 10);
const todayLabel = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
  month: "long",
  day: "numeric",
  year: "numeric",
}).format(new Date()).toUpperCase();
const formatDate = (value) => new Date(`${value}T00:00:00`).toLocaleDateString(
  "en-US",
  { month: "short", day: "numeric", year: "numeric" },
);
const initials = (name = "") => name
  .split(/\s+/)
  .filter(Boolean)
  .slice(0, 2)
  .map((part) => part[0])
  .join("")
  .toUpperCase();
const avatarColors = ["lavender", "peach", "mint", "blue", "pink", "yellow"];
const avatarColor = (name = "") => avatarColors[
  name.split("").reduce((sum, character) => sum + character.charCodeAt(0), 0)
    % avatarColors.length
];

function StatusBadge({ children }) {
  return <span className={`status-badge status-${children.toLowerCase()}`}>{children}</span>;
}

function CustomerCell({ name, email }) {
  return (
    <div className="customer-cell">
      <span className={`avatar avatar-${avatarColor(name)}`}>{initials(name)}</span>
      <span className="customer-copy">
        <strong>{name}</strong>
        <span>{email}</span>
      </span>
    </div>
  );
}

function Modal({ title, description, onClose, children }) {
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div className="modal-backdrop" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <div className="modal-heading">
          <div>
            <h2 id="modal-title">{title}</h2>
            <p>{description}</p>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Close dialog">
            <X size={18} />
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}

function SubscriptionForm({ plans, onSubmit, onClose, busy }) {
  const [values, setValues] = useState({
    customer: "",
    email: "",
    plan_id: plans[0]?.id ?? "",
    date_start: today,
  });
  const update = (event) => setValues({ ...values, [event.target.name]: event.target.value });

  return (
    <Modal
      title="New subscription"
      description="Add a customer to one of your subscription plans."
      onClose={onClose}
    >
      <form className="modal-form" onSubmit={(event) => {
        event.preventDefault();
        onSubmit(values);
      }}>
        <label>
          Customer name
          <input name="customer" value={values.customer} onChange={update} required
            placeholder="e.g. Alex Morgan" autoFocus />
        </label>
        <label>
          Email address
          <input name="email" type="email" value={values.email} onChange={update} required
            placeholder="alex@company.com" />
        </label>
        <div className="form-grid">
          <label>
            Plan
            <select name="plan_id" value={values.plan_id} onChange={update} required>
              {plans.filter((plan) => plan.active).map((plan) => (
                <option key={plan.id} value={plan.id}>
                  {plan.name} · {currency.format(plan.price)}/{plan.billing_period}
                </option>
              ))}
            </select>
          </label>
          <label>
            Start date
            <input name="date_start" type="date" value={values.date_start} onChange={update}
              required />
          </label>
        </div>
        <div className="modal-actions">
          <button type="button" className="button button-quiet" onClick={onClose}>Cancel</button>
          <button type="submit" className="button button-primary" disabled={busy || plans.length === 0}>
            {busy ? <LoaderCircle className="spin" size={16} /> : <Plus size={16} />}
            Create subscription
          </button>
        </div>
      </form>
    </Modal>
  );
}

function PlanForm({ onSubmit, onClose, busy }) {
  const [values, setValues] = useState({
    name: "",
    description: "",
    price: "",
    billing_period: "month",
    billing_period_count: "1",
  });
  const update = (event) => setValues({ ...values, [event.target.name]: event.target.value });

  return (
    <Modal
      title="Create a plan"
      description="Set the price and billing schedule for this plan."
      onClose={onClose}
    >
      <form className="modal-form" onSubmit={(event) => {
        event.preventDefault();
        onSubmit({
          ...values,
          price: Number(values.price),
          billing_period_count: Number(values.billing_period_count),
        });
      }}>
        <label>
          Plan name
          <input name="name" value={values.name} onChange={update} required
            placeholder="e.g. Pro" autoFocus />
        </label>
        <label>
          Description
          <textarea name="description" rows="3" value={values.description} onChange={update}
            placeholder="What's included in this plan?" />
        </label>
        <div className="form-grid">
          <label>
            Price (USD)
            <input name="price" type="number" min="0" step="0.01" value={values.price}
              onChange={update} required placeholder="29.00" />
          </label>
          <label>
            Billed every
            <div className="period-input">
              <input aria-label="Billing period count" name="billing_period_count" type="number"
                min="1" value={values.billing_period_count} onChange={update} required />
              <select name="billing_period" value={values.billing_period} onChange={update}
                aria-label="Billing period">
                <option value="month">month(s)</option>
                <option value="year">year(s)</option>
              </select>
            </div>
          </label>
        </div>
        <div className="modal-actions">
          <button type="button" className="button button-quiet" onClick={onClose}>Cancel</button>
          <button type="submit" className="button button-primary" disabled={busy}>
            {busy ? <LoaderCircle className="spin" size={16} /> : <Plus size={16} />}
            Create plan
          </button>
        </div>
      </form>
    </Modal>
  );
}

function MetricCard({ title, value, note, icon: Icon, tone, trend }) {
  return (
    <article className="metric-card">
      <div className="metric-top">
        <span className={`metric-icon metric-icon-${tone}`}><Icon size={18} strokeWidth={2} /></span>
        <button className="icon-button metric-menu" aria-label={`${title} options`}>
          <MoreHorizontal size={19} />
        </button>
      </div>
      <p className="metric-title">{title}</p>
      <div className="metric-value-row">
        <strong className="metric-value">{value}</strong>
        {trend && (
          <span className="trend-pill"><ArrowUpRight size={13} /> {trend}</span>
        )}
      </div>
      <p className="metric-note">{note}</p>
    </article>
  );
}

function RevenueChart({ revenueByPlan }) {
  const total = revenueByPlan.reduce((sum, item) => sum + item.monthly_revenue, 0);
  const max = Math.max(total, 1);
  const bars = [0.39, 0.48, 0.44, 0.62, 0.58, 0.73, 0.69, 0.84, 0.78, 0.91, 0.86, 1];
  return (
    <div className="chart-wrap">
      <div className="chart-summary">
        <div>
          <strong>{currency.format(total)}</strong>
          <span>Current monthly revenue</span>
        </div>
        <span className="trend-pill"><ArrowUpRight size={13} /> 12.8%</span>
      </div>
      <div className="revenue-chart" role="img" aria-label="Monthly revenue has trended upward">
        <div className="chart-y-labels">
          <span>{currency.format(max)}</span>
          <span>{currency.format(max * 0.66)}</span>
          <span>{currency.format(max * 0.33)}</span>
          <span>$0</span>
        </div>
        <div className="chart-plot">
          <div className="chart-grid">
            <span /><span /><span /><span />
          </div>
          <div className="chart-bars">
            {bars.map((height, index) => (
              <div className="chart-bar-slot" key={index}>
                <span
                  className={index === bars.length - 1 ? "chart-bar chart-bar-current" : "chart-bar"}
                  style={{ height: `${height * 100}%` }}
                />
              </div>
            ))}
          </div>
          <div className="chart-x-labels">
            <span>Nov</span><span>Dec</span><span>Jan</span><span>Feb</span>
            <span>Mar</span><span>Apr</span><span>May</span><span>Jun</span>
            <span>Jul</span><span>Aug</span><span>Sep</span><span>Oct</span>
          </div>
        </div>
      </div>
      <div className="chart-legend">
        {revenueByPlan.filter((item) => item.subscriber_count).map((item, index) => (
          <span key={item.plan_id}>
            <i className={`legend-dot legend-${index % 3}`} />
            {item.plan_name}
          </span>
        ))}
      </div>
    </div>
  );
}

function SubscriptionsTable({ subscriptions, onStateChange, onInvoice, busyId }) {
  if (!subscriptions.length) return <div className="empty-state">No subscriptions match your search.</div>;
  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>Customer</th><th>Plan</th><th>Amount</th><th>Next invoice</th>
            <th>Status</th><th aria-label="Actions" />
          </tr>
        </thead>
        <tbody>
          {subscriptions.map((subscription) => (
            <tr key={subscription.id}>
              <td><CustomerCell name={subscription.customer} email={subscription.email} /></td>
              <td><span className="plan-name">{subscription.plan?.name ?? "Plan removed"}</span></td>
              <td>
                <strong className="table-amount">
                  {subscription.plan ? currency.format(subscription.plan.price) : "—"}
                </strong>
                <span className="table-subtext">
                  / {subscription.plan?.billing_period_count > 1
                    ? `${subscription.plan.billing_period_count} `
                    : ""}{subscription.plan?.billing_period ?? "—"}
                </span>
              </td>
              <td><span className="date-cell">{formatDate(subscription.next_invoice_date)}</span></td>
              <td><StatusBadge>{subscription.state}</StatusBadge></td>
              <td>
                <div className="row-actions">
                  {subscription.state === "active" && (
                    <button className="icon-button row-action" disabled={busyId === subscription.id}
                      onClick={() => onInvoice(subscription)} title="Generate invoice"
                      aria-label={`Generate invoice for ${subscription.customer}`}>
                      {busyId === subscription.id
                        ? <LoaderCircle className="spin" size={16} />
                        : <FileText size={16} />}
                    </button>
                  )}
                  {subscription.state === "active" && (
                    <button className="mini-action"
                      onClick={() => onStateChange(subscription, "paused")} title="Pause"
                      aria-label={`Pause ${subscription.customer}'s subscription`}>
                      <Pause size={13} /> Pause
                    </button>
                  )}
                  {["draft", "paused"].includes(subscription.state) && (
                    <button className="mini-action" onClick={() => onStateChange(subscription, "active")}>
                      <Play size={13} /> {subscription.state === "paused" ? "Resume" : "Activate"}
                    </button>
                  )}
                  {["draft", "active", "paused"].includes(subscription.state) && (
                    <button className="cancel-action"
                      onClick={() => onStateChange(subscription, "cancelled")}
                      aria-label={`Cancel ${subscription.customer}'s subscription`}>
                      <XCircle size={14} /> Cancel
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Overview({ dashboard, subscriptions, onStateChange, onInvoice, busyId }) {
  const dueCount = dashboard.invoices_due ?? 0;
  const recent = dashboard.recent_subscriptions ?? [];
  return (
    <>
      <div className="welcome-row">
        <div>
          <p className="eyebrow">{todayLabel}</p>
          <h1>Good morning, Alex <span className="wave">✦</span></h1>
          <p className="page-description">Here&apos;s what&apos;s happening with your subscriptions today.</p>
        </div>
        <button className="button button-primary" onClick={() => window.dispatchEvent(new Event("new-subscription"))}>
          <Plus size={17} /> New subscription
        </button>
      </div>
      <div className="metrics-grid">
        <MetricCard title="Monthly recurring revenue" value={currency.format(dashboard.monthly_recurring_revenue ?? 0)}
          note="Across all active plans" icon={CreditCard} tone="violet" trend="12.8%" />
        <MetricCard title="Active subscriptions" value={dashboard.active_subscriptions ?? 0}
          note={`Out of ${dashboard.total_subscriptions ?? 0} total subscriptions`}
          icon={Users} tone="blue" trend="8.2%" />
        <MetricCard title="Invoices this month" value={dashboard.pending_invoices ?? 0}
          note="Waiting for payment" icon={FileText} tone="amber" />
        <MetricCard title="Invoices due" value={dueCount}
          note={dueCount ? "Needs your attention" : "You’re all caught up"} icon={Bell} tone="rose" />
      </div>
      <div className="dashboard-grid">
        <section className="panel revenue-panel">
          <div className="panel-heading">
            <div><h2>Revenue over time</h2><p>Recurring revenue across your plans</p></div>
            <button className="select-button">Last 12 months <ChevronDown size={14} /></button>
          </div>
          <RevenueChart revenueByPlan={dashboard.revenue_by_plan ?? []} />
        </section>
        <section className="panel plan-summary-panel">
          <div className="panel-heading">
            <div><h2>Plan performance</h2><p>Active subscribers by plan</p></div>
            <button className="icon-button" aria-label="Plan performance options"><MoreHorizontal size={19} /></button>
          </div>
          <div className="performance-list">
            {(dashboard.revenue_by_plan ?? []).map((item, index) => {
              const share = dashboard.active_subscriptions
                ? (item.subscriber_count / dashboard.active_subscriptions) * 100
                : 0;
              return (
                <div className="performance-item" key={item.plan_id}>
                  <div className="performance-title">
                    <span><i className={`legend-dot legend-${index % 3}`} />{item.plan_name}</span>
                    <strong>{item.subscriber_count}</strong>
                  </div>
                  <div className="progress-track">
                    <span className={`progress-fill progress-${index % 3}`} style={{ width: `${share}%` }} />
                  </div>
                  <div className="performance-foot">
                    <span>{currency.format(item.monthly_revenue)} / month</span>
                    <span>{Math.round(share)}%</span>
                  </div>
                </div>
              );
            })}
          </div>
          <button className="text-link" onClick={() => window.dispatchEvent(new CustomEvent("navigate", { detail: "plans" }))}>
          View all plans <ArrowUpRight size={14} />
          </button>
        </section>
      </div>
      <section className="panel table-panel">
        <div className="panel-heading panel-heading-table">
          <div><h2>Recent subscriptions</h2><p>Your latest customer sign-ups</p></div>
          <button className="text-link" onClick={() => window.dispatchEvent(new CustomEvent("navigate", { detail: "subscriptions" }))}>
            View all <ArrowUpRight size={14} />
          </button>
        </div>
        <SubscriptionsTable
          subscriptions={recent}
          onStateChange={onStateChange}
          onInvoice={onInvoice}
          busyId={busyId}
        />
      </section>
      <div className="bottom-note"><Sparkles size={14} /> Your subscription data is up to date</div>
    </>
  );
}

function PlansView({ plans, subscriptions, onCreate }) {
  return (
    <>
      <div className="welcome-row">
        <div><p className="eyebrow">YOUR CATALOG</p><h1>Plans</h1>
          <p className="page-description">Build flexible pricing for every kind of customer.</p></div>
        <button className="button button-primary" onClick={onCreate}><Plus size={17} /> Create plan</button>
      </div>
      <div className="plans-grid">
        {plans.map((plan, index) => {
          const subscribers = subscriptions.filter((item) => item.plan_id === plan.id
            && item.state === "active").length;
          const highlights = [
            ["Everything you need to get started", "Email support", "Up to 3 team members"],
            ["Everything in Starter", "Advanced reporting", "Priority support"],
            ["Everything in Growth", "Unlimited team members", "Dedicated success manager"],
          ][index % 3];
          return (
            <article className={`plan-card ${index === 1 ? "plan-card-featured" : ""}`} key={plan.id}>
              {index === 1 && <span className="popular-tag">MOST POPULAR</span>}
              <div className={`plan-symbol plan-symbol-${index % 3}`}><CreditCard size={19} /></div>
              <h2>{plan.name}</h2>
              <p className="plan-description">{plan.description || "A flexible plan for your customers."}</p>
              <div className="plan-price">
                <strong>{currency.format(plan.price)}</strong>
                <span>/ {plan.billing_period_count > 1 ? `${plan.billing_period_count} ` : ""}{plan.billing_period}</span>
              </div>
              <div className="plan-subscriber-count"><Users size={15} /> {subscribers} active {subscribers === 1 ? "subscriber" : "subscribers"}</div>
              <div className="plan-divider" />
              <ul className="plan-highlights">
                {highlights.map((highlight) => <li key={highlight}><Check size={15} />{highlight}</li>)}
              </ul>
              <span className="plan-status"><i />{plan.active ? "Active" : "Archived"}</span>
            </article>
          );
        })}
        <button className="add-plan-card" onClick={onCreate}>
          <span><Plus size={20} /></span><strong>Create a new plan</strong>
          <small>Make a plan that fits your next big idea.</small>
        </button>
      </div>
    </>
  );
}

function InvoicesView({ invoices }) {
  return (
    <>
      <div className="welcome-row">
        <div><p className="eyebrow">BILLING</p><h1>Invoices</h1>
          <p className="page-description">A clear view of your recurring billing history.</p></div>
        <button className="button button-outline" onClick={() => window.print()}>
          <Download size={16} /> Export
        </button>
      </div>
      <section className="panel invoice-panel">
        <div className="panel-heading panel-heading-table">
          <div><h2>All invoices</h2><p>{invoices.length} invoices generated</p></div>
          <span className="select-button"><Filter size={14} /> All status</span>
        </div>
        {invoices.length === 0 ? <div className="empty-state">Invoices will appear here after you generate one from an active subscription.</div> : (
          <div className="table-scroll">
            <table>
              <thead><tr><th>Invoice</th><th>Customer</th><th>Plan</th><th>Billing period</th><th>Amount</th><th>Status</th></tr></thead>
              <tbody>{invoices.map((invoice) => (
                <tr key={invoice.id}>
                  <td><strong className="invoice-id">{invoice.id}</strong></td>
                  <td><CustomerCell name={invoice.customer} email="" /></td>
                  <td><span className="plan-name">{invoice.plan}</span></td>
                  <td><span className="date-cell">{formatDate(invoice.period_start)} – {formatDate(invoice.period_end)}</span></td>
                  <td><strong className="table-amount">{currency.format(invoice.amount)}</strong></td>
                  <td><StatusBadge>{invoice.status}</StatusBadge></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}

function App() {
  const [page, setPage] = useState("overview");
  const [dashboard, setDashboard] = useState(null);
  const [subscriptions, setSubscriptions] = useState([]);
  const [plans, setPlans] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [modal, setModal] = useState(null);
  const [busy, setBusy] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadData = useCallback(async () => {
    setError("");
    try {
      const [dashboardData, subscriptionData, planData, invoiceData] = await Promise.all([
        api.dashboard(),
        api.subscriptions(),
        api.plans(),
        api.invoices(),
      ]);
      setDashboard(dashboardData);
      setSubscriptions(subscriptionData);
      setPlans(planData);
      setInvoices(invoiceData);
      return true;
    } catch (loadError) {
      setError(loadError.message);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);
  useEffect(() => {
    const onNewSubscription = () => setModal("subscription");
    const onNavigate = (event) => setPage(event.detail);
    window.addEventListener("new-subscription", onNewSubscription);
    window.addEventListener("navigate", onNavigate);
    return () => {
      window.removeEventListener("new-subscription", onNewSubscription);
      window.removeEventListener("navigate", onNavigate);
    };
  }, []);
  useEffect(() => {
    if (!notice) return undefined;
    const timeout = window.setTimeout(() => setNotice(""), 3500);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  const filteredSubscriptions = useMemo(() => subscriptions.filter((subscription) => {
    const matchesSearch = `${subscription.customer} ${subscription.email} ${subscription.plan?.name ?? ""}`
      .toLowerCase().includes(search.toLowerCase());
    return matchesSearch && (statusFilter === "all" || subscription.state === statusFilter);
  }), [search, statusFilter, subscriptions]);

  async function submitForm(operation, message) {
    setBusy(true);
    setError("");
    try {
      await operation();
      setModal(null);
      if (await loadData()) setNotice(message);
    } catch (operationError) {
      setError(operationError.message);
    } finally {
      setBusy(false);
    }
  }

  async function changeState(subscription, state) {
    if (
      state === "cancelled"
      && !window.confirm(`Cancel ${subscription.customer}'s subscription?`)
    ) return;
    const title = state === "active" ? "Subscription activated" : `Subscription ${state}`;
    setBusyId(subscription.id);
    setError("");
    try {
      await api.updateSubscriptionState(subscription.id, state);
      if (await loadData()) setNotice(title);
    } catch (operationError) {
      setError(operationError.message);
    } finally {
      setBusyId(null);
    }
  }

  async function generateInvoice(subscription) {
    setBusyId(subscription.id);
    setError("");
    try {
      const invoice = await api.generateInvoice(subscription.id);
      if (await loadData()) setNotice(`Invoice ${invoice.id} created`);
    } catch (operationError) {
      setError(operationError.message);
    } finally {
      setBusyId(null);
    }
  }

  const pageTitle = navigation.find((item) => item.id === page)?.label ?? "Overview";

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#" onClick={(event) => { event.preventDefault(); setPage("overview"); }}>
          <span className="brand-mark"><span /><span /><span /></span>
          <span>orbit<span className="brand-period">.</span></span>
        </a>
        <div className="workspace-switcher">
          <span className="workspace-avatar">S</span>
          <span className="workspace-copy"><strong>Studio Acme</strong><small>Pro workspace</small></span>
          <ChevronDown size={15} />
        </div>
        <span className="nav-section-label">WORKSPACE</span>
        <nav className="main-nav" aria-label="Main navigation">
          {navigation.map(({ id, label, icon: Icon }) => (
            <button key={id} className={`nav-item ${page === id ? "nav-item-active" : ""}`}
              onClick={() => setPage(id)}>
              <Icon size={18} strokeWidth={1.8} /><span>{label}</span>
              {id === "subscriptions" && <span className="nav-count">{subscriptions.length}</span>}
            </button>
          ))}
        </nav>
        <div className="sidebar-lower">
          <div className="upgrade-card">
            <div className="upgrade-icon"><Sparkles size={16} /></div>
            <strong>Make more of Orbit</strong>
            <p>Unlock deeper insights with the Growth plan.</p>
            <button onClick={() => setNotice("You’re already exploring Orbit Growth!")}>
              Explore plans <ArrowUpRight size={14} />
            </button>
          </div>
          <button className="nav-item sidebar-utility" onClick={() => setNotice("Help center coming soon.")}>
            <CircleHelp size={18} /> Help center
          </button>
          <button className="nav-item sidebar-utility" onClick={() => setNotice("Settings coming soon.")}>
            <Settings size={18} /> Settings
          </button>
          <div className="profile-card">
            <span className="avatar avatar-profile">AC</span>
            <span className="customer-copy"><strong>Alex Chen</strong><span>alex@studio.co</span></span>
            <MoreHorizontal size={18} />
          </div>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div className="breadcrumbs"><span>Workspace</span><span className="breadcrumb-slash">/</span><strong>{pageTitle}</strong></div>
          <div className="topbar-actions">
            <label className="global-search"><Search size={16} /><input placeholder="Search anything..."
              value={search} onChange={(event) => setSearch(event.target.value)} />
              <kbd>⌘ K</kbd></label>
            <button className="icon-button topbar-bell" aria-label="Notifications"><Bell size={18} /><i /></button>
            <span className="topbar-divider" />
            <button className="help-button" onClick={() => setNotice("Help center coming soon.")}>Help <ArrowUpRight size={13} /></button>
          </div>
        </header>

        <div className="content">
          {error && <div className="alert alert-error" role="alert">{error}<button onClick={() => setError("")} aria-label="Dismiss error"><X size={16} /></button></div>}
          {loading ? (
            <div className="loading-state"><LoaderCircle className="spin" size={24} /><span>Loading your workspace…</span></div>
          ) : !dashboard ? (
            <div className="error-state"><h2>We couldn&apos;t load your workspace.</h2><p>{error}</p>
              <button className="button button-primary" onClick={() => { setLoading(true); loadData(); }}>Try again</button>
            </div>
          ) : page === "overview" ? (
            <Overview dashboard={dashboard} subscriptions={subscriptions} onStateChange={changeState}
              onInvoice={generateInvoice} busyId={busyId} />
          ) : page === "plans" ? (
            <PlansView plans={plans} subscriptions={subscriptions} onCreate={() => setModal("plan")} />
          ) : page === "invoices" ? (
            <InvoicesView invoices={invoices} />
          ) : (
            <>
              <div className="welcome-row">
                <div><p className="eyebrow">CUSTOMER BILLING</p><h1>Subscriptions</h1>
                  <p className="page-description">Manage customers, billing dates, and plan changes.</p></div>
                <button className="button button-primary" onClick={() => setModal("subscription")}>
                  <Plus size={17} /> New subscription
                </button>
              </div>
              <section className="panel subscription-panel">
                <div className="table-toolbar">
                  <div className="table-tabs">
                    {["all", "active", "paused", "draft", "cancelled"].map((status) => (
                      <button key={status} className={statusFilter === status ? "table-tab active-tab" : "table-tab"}
                        onClick={() => setStatusFilter(status)}>
                        {status === "all" ? "All subscriptions" : `${status[0].toUpperCase()}${status.slice(1)}`}
                        {status === "all" && <span>{subscriptions.length}</span>}
                      </button>
                    ))}
                  </div>
                  <div className="table-tools">
                    <label className="table-search"><Search size={15} /><input placeholder="Search customers"
                      value={search} onChange={(event) => setSearch(event.target.value)} /></label>
                    <button className="button button-outline button-small" onClick={() => setNotice("Showing all subscription records.")}>
                      <Filter size={15} /> Filter
                    </button>
                  </div>
                </div>
                <SubscriptionsTable subscriptions={filteredSubscriptions} onStateChange={changeState}
                  onInvoice={generateInvoice} busyId={busyId} />
                <div className="table-footer"><span>Showing <strong>{filteredSubscriptions.length}</strong> of <strong>{subscriptions.length}</strong> subscriptions</span>
                  <div><button disabled aria-label="Previous page">‹</button><span>1</span><button disabled aria-label="Next page">›</button></div>
                </div>
              </section>
            </>
          )}
        </div>
        <footer className="app-footer"><span>© 2026 Orbit, Inc.</span><span>Subscription management, made simple.</span></footer>
      </main>
      {modal === "subscription" && (
        <SubscriptionForm plans={plans} busy={busy} onClose={() => setModal(null)}
          onSubmit={(values) => submitForm(() => api.createSubscription(values), "Subscription created")} />
      )}
      {modal === "plan" && (
        <PlanForm busy={busy} onClose={() => setModal(null)}
          onSubmit={(values) => submitForm(() => api.createPlan(values), "Plan created")} />
      )}
      {notice && <div className="toast" role="status"><span><Check size={15} /></span>{notice}
        <button onClick={() => setNotice("")} aria-label="Dismiss notification"><X size={15} /></button></div>}
    </div>
  );
}

export default App;
