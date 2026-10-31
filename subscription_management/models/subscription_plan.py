from odoo import api, fields, models
from odoo.exceptions import ValidationError


class SubscriptionPlan(models.Model):
    _name = "subscription.plan"
    _description = "Subscription Plan"
    _order = "name"

    name = fields.Char(required=True)
    active = fields.Boolean(default=True)
    product_id = fields.Many2one(
        "product.product",
        string="Invoice Product",
        required=True,
        domain=[("type", "=", "service")],
        help="Service product used on recurring customer invoices.",
    )
    price = fields.Monetary(required=True, default=0.0)
    currency_id = fields.Many2one(
        "res.currency",
        required=True,
        default=lambda self: self.env.company.currency_id,
    )
    billing_period = fields.Selection(
        [
            ("month", "Month(s)"),
            ("year", "Year(s)"),
        ],
        required=True,
        default="month",
    )
    billing_period_count = fields.Integer(required=True, default=1)
    description = fields.Text()
    subscription_ids = fields.One2many(
        "subscription.subscription",
        "plan_id",
        string="Subscriptions",
    )
    subscription_count = fields.Integer(compute="_compute_subscription_count")

    @api.depends("subscription_ids")
    def _compute_subscription_count(self):
        counts = self.env["subscription.subscription"]._read_group(
            [("plan_id", "in", self.ids)],
            ["plan_id"],
            ["__count"],
        )
        count_by_plan = {plan.id: count for plan, count in counts}
        for plan in self:
            plan.subscription_count = count_by_plan.get(plan.id, 0)

    @api.constrains("billing_period_count", "price")
    def _check_billing_values(self):
        for plan in self:
            if plan.billing_period_count < 1:
                raise ValidationError("The billing period count must be at least 1.")
            if plan.price < 0:
                raise ValidationError("The plan price cannot be negative.")

    def action_view_subscriptions(self):
        self.ensure_one()
        return {
            "type": "ir.actions.act_window",
            "name": "Subscriptions",
            "res_model": "subscription.subscription",
            "view_mode": "list,form",
            "domain": [("plan_id", "=", self.id)],
            "context": {"default_plan_id": self.id},
        }
