from odoo import fields, models


class AccountMove(models.Model):
    _inherit = "account.move"

    subscription_id = fields.Many2one(
        "subscription.subscription",
        string="Subscription",
        copy=False,
        index=True,
        ondelete="restrict",
    )
    subscription_period_start = fields.Date(copy=False, index=True)
    subscription_period_end = fields.Date(copy=False, index=True)

    _sql_constraints = [
        (
            "subscription_invoice_period_unique",
            "unique(subscription_id, subscription_period_start, subscription_period_end)",
            "Only one invoice can be created for each subscription period.",
        ),
    ]
