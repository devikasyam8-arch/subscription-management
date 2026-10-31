{
    "name": "Subscription Management",
    "version": "18.0.1.0.0",
    "category": "Sales/Subscriptions",
    "summary": "Manage subscription plans, renewals, and recurring invoices",
    "license": "LGPL-3",
    "depends": ["account", "product"],
    "data": [
        "security/ir.model.access.csv",
        "data/subscription_data.xml",
        "views/subscription_plan_views.xml",
        "views/subscription_views.xml",
        "views/subscription_menus.xml",
    ],
    "installable": True,
    "application": True,
}
