from dateutil.relativedelta import relativedelta

from odoo import api, fields, models
from odoo.exceptions import UserError, ValidationError


class Subscription(models.Model):
    _name = "subscription.subscription"
    _description = "Customer Subscription"
    _order = "next_invoice_date, name"
    _check_company_auto = True

    name = fields.Char(
        required=True,
        readonly=True,
        copy=False,
        default="New",
    )
    partner_id = fields.Many2one(
        "res.partner",
        string="Customer",
        required=True,
        check_company=True,
        index=True,
    )
    plan_id = fields.Many2one(
        "subscription.plan",
        required=True,
        ondelete="restrict",
    )
    company_id = fields.Many2one(
        "res.company",
        required=True,
        default=lambda self: self.env.company,
        index=True,
    )
    user_id = fields.Many2one(
        "res.users",
        string="Salesperson",
        default=lambda self: self.env.user,
    )
    currency_id = fields.Many2one(
        related="plan_id.currency_id",
        store=True,
        readonly=True,
    )
    price = fields.Monetary(related="plan_id.price", store=True, readonly=True)
    date_start = fields.Date(required=True, default=fields.Date.context_today)
    next_invoice_date = fields.Date(
        required=True,
        default=fields.Date.context_today,
        index=True,
    )
    date_end = fields.Date()
    state = fields.Selection(
        [
            ("draft", "Draft"),
            ("active", "Active"),
            ("paused", "Paused"),
            ("cancelled", "Cancelled"),
            ("expired", "Expired"),
        ],
        required=True,
        default="draft",
        index=True,
    )
    invoice_ids = fields.One2many(
        "account.move",
        "subscription_id",
        string="Invoices",
        readonly=True,
    )
    invoice_count = fields.Integer(compute="_compute_invoice_count")
    monthly_recurring_revenue = fields.Monetary(
        compute="_compute_monthly_recurring_revenue",
        store=True,
        currency_field="currency_id",
    )
    notes = fields.Text()

    @api.model_create_multi
    def create(self, vals_list):
        sequence = self.env["ir.sequence"]
        for vals in vals_list:
            if vals.get("name", "New") == "New":
                vals["name"] = sequence.next_by_code("subscription.subscription") or "New"
        return super().create(vals_list)

    @api.depends("invoice_ids")
    def _compute_invoice_count(self):
        for subscription in self:
            subscription.invoice_count = len(subscription.invoice_ids)

    @api.depends(
        "state",
        "price",
        "plan_id.billing_period",
        "plan_id.billing_period_count",
    )
    def _compute_monthly_recurring_revenue(self):
        for subscription in self:
            monthly_revenue = 0.0
            if subscription.state == "active" and subscription.plan_id.billing_period_count:
                if subscription.plan_id.billing_period == "month":
                    monthly_revenue = (
                        subscription.price / subscription.plan_id.billing_period_count
                    )
                else:
                    monthly_revenue = (
                        subscription.price
                        / (12 * subscription.plan_id.billing_period_count)
                    )
            subscription.monthly_recurring_revenue = monthly_revenue

    @api.constrains("date_start", "next_invoice_date", "date_end")
    def _check_dates(self):
        for subscription in self:
            if subscription.date_end and subscription.date_end < subscription.date_start:
                raise ValidationError("The end date cannot be before the start date.")
            if subscription.next_invoice_date < subscription.date_start:
                raise ValidationError(
                    "The next invoice date cannot be before the start date."
                )

    def action_activate(self):
        for subscription in self:
            if subscription.state not in ("draft", "paused"):
                raise UserError("Only draft or paused subscriptions can be activated.")
            subscription.state = "active"

    def action_pause(self):
        for subscription in self:
            if subscription.state != "active":
                raise UserError("Only active subscriptions can be paused.")
            subscription.state = "paused"

    def action_cancel(self):
        for subscription in self:
            if subscription.state not in ("draft", "active", "paused"):
                raise UserError("Only draft, active, or paused subscriptions can be cancelled.")
            subscription.state = "cancelled"

    def action_generate_invoice(self):
        self.ensure_one()
        if self.state != "active":
            raise UserError("An invoice can only be generated for an active subscription.")
        return self._generate_recurring_invoice()

    def _get_next_invoice_date(self, invoice_date):
        self.ensure_one()
        if self.plan_id.billing_period == "year":
            return invoice_date + relativedelta(
                years=self.plan_id.billing_period_count
            )
        return invoice_date + relativedelta(
            months=self.plan_id.billing_period_count
        )

    def _generate_recurring_invoice(self):
        self.ensure_one()
        invoice_date = self.next_invoice_date
        next_invoice_date = self._get_next_invoice_date(invoice_date)
        existing_invoice = self.env["account.move"].search(
            [
                ("subscription_id", "=", self.id),
                ("subscription_period_start", "=", invoice_date),
                ("subscription_period_end", "=", next_invoice_date - relativedelta(days=1)),
            ],
            limit=1,
        )
        if existing_invoice:
            raise UserError(
                "An invoice already exists for this subscription period."
            )

        invoice = self.env["account.move"].create(
            {
                "move_type": "out_invoice",
                "partner_id": self.partner_id.id,
                "company_id": self.company_id.id,
                "currency_id": self.currency_id.id,
                "invoice_date": invoice_date,
                "invoice_origin": self.name,
                "subscription_id": self.id,
                "subscription_period_start": invoice_date,
                "subscription_period_end": next_invoice_date - relativedelta(days=1),
                "invoice_line_ids": [
                    (
                        0,
                        0,
                        {
                            "product_id": self.plan_id.product_id.id,
                            "name": self.plan_id.name,
                            "quantity": 1,
                            "price_unit": self.price,
                        },
                    )
                ],
            }
        )
        values = {"next_invoice_date": next_invoice_date}
        if self.date_end and next_invoice_date > self.date_end:
            values["state"] = "expired"
        self.write(values)
        return invoice

    @api.model
    def _cron_generate_due_invoices(self):
        today = fields.Date.context_today(self)
        due_subscriptions = self.search(
            [
                ("state", "=", "active"),
                ("next_invoice_date", "<=", today),
            ]
        )
        for subscription in due_subscriptions:
            if subscription.date_end and subscription.next_invoice_date > subscription.date_end:
                subscription.state = "expired"
                continue
            subscription._generate_recurring_invoice()

    def action_view_invoices(self):
        self.ensure_one()
        return {
            "type": "ir.actions.act_window",
            "name": "Subscription Invoices",
            "res_model": "account.move",
            "view_mode": "list,form",
            "domain": [("subscription_id", "=", self.id)],
            "context": {"default_subscription_id": self.id},
        }
