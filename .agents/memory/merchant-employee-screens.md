---
name: Merchant employee screen limits
description: User-confirmed navigation and order-detail behavior for employee accounts.
---

Employees should have only the Orders list, order details presented as a modal, and assigned-shop parameters. Merchant and admin navigation should keep its existing full-screen order-detail behavior. Keep sign-out as an action inside Shop parameters rather than restoring a separate employee Profile screen.

**Why:** The user explicitly limited employee access to these three surfaces and confirmed that tapping an order should show a popup instead of a separate detail page.

**How to apply:** Preserve role-specific tab visibility and route guards. Do not restore employee access to More/Profile, Reviews, account Settings, or merchant shop-profile routes.